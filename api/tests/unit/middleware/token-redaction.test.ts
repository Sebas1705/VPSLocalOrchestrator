/**
 * Credentials must never reach log output: requireAuth, the rate limiter and
 * its middleware log only presence or a short SHA-256 fingerprint.
 */

import crypto from 'crypto';

const TOKEN = 'super-secret-api-token-0123456789abcdef';
const WRONG = 'wrong-token-that-must-not-be-logged-9876';
process.env.API_TOKEN = TOKEN;
process.env.PORT = process.env.PORT || '3999';
process.env.SECRET_KEY = process.env.SECRET_KEY || crypto.randomBytes(32).toString('base64');

// Capture everything sent to the structured logger as well as the console.
const loggerOutput: string[] = [];
const { LoggerFactory } = require('../../../src/infrastructure/logging/index.js');
const capture = (level: string) => (...args: unknown[]) => loggerOutput.push(`${level} ${JSON.stringify(args)}`);
LoggerFactory.initialize({
  debug: capture('debug'),
  info: capture('info'),
  warn: capture('warn'),
  error: capture('error'),
  setLevel: () => undefined,
  setTraceContext: () => undefined,
});

const { requireAuth } = require('../../../src/middleware/requireAuth.js');
const { RateLimiter } = require('../../../src/infrastructure/ratelimit/index.js');
const { secretFingerprint } = require('../../../src/infrastructure/logging/redact.js');

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const;
let consoleSpies: jest.SpyInstance[] = [];

function allOutput(): string {
  const consoleLines = consoleSpies.flatMap((spy) => spy.mock.calls.map((call) => JSON.stringify(call)));
  return [...consoleLines, ...loggerOutput].join('\n');
}

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(authorization?: string) {
  return { method: 'POST', originalUrl: '/api/command/execute', url: '/execute', headers: authorization ? { authorization } : {} } as any;
}

beforeEach(() => {
  loggerOutput.length = 0;
  consoleSpies = CONSOLE_METHODS.map((method) => jest.spyOn(console, method).mockImplementation(() => undefined));
});

afterEach(() => {
  consoleSpies.forEach((spy) => spy.mockRestore());
});

describe('requireAuth logging', () => {
  it('never logs a valid token or the Authorization header', () => {
    const next = jest.fn();
    requireAuth(mockReq(`Bearer ${TOKEN}`), mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(allOutput()).not.toContain(TOKEN);
    expect(allOutput()).not.toContain(TOKEN.slice(0, 10));
  });

  it('logs only that an invalid token was present', () => {
    const res = mockRes();
    requireAuth(mockReq(`Bearer ${WRONG}`), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    const output = allOutput();
    expect(output).toContain('present but invalid');
    expect(output).not.toContain(WRONG);
    expect(output).not.toContain(WRONG.slice(0, 10));
    expect(output).not.toMatch(/Bearer/);
  });

  it('logs that the token was absent', () => {
    requireAuth(mockReq(), mockRes(), jest.fn());
    expect(allOutput()).toContain('absent');
  });
});

describe('rate limiter logging', () => {
  it('logs a fingerprint instead of the token', () => {
    const limiter = new RateLimiter();
    limiter.setConfig(TOKEN, { maxRequests: 10, windowMs: 1000, maxConcurrent: 2 });
    limiter.reset(TOKEN);
    limiter.setConfig(WRONG, { maxRequests: 10, windowMs: 1000, maxConcurrent: 2 });
    const stats = limiter.getAllStats();
    limiter.stop();
    expect(JSON.stringify(stats)).not.toContain(WRONG.slice(0, 10));

    const output = allOutput() + JSON.stringify(stats);
    expect(output).not.toContain(TOKEN);
    expect(output).not.toContain(TOKEN.slice(0, 10));
    expect(loggerOutput.join('\n')).toContain(secretFingerprint(TOKEN));
  });
});

describe('secretFingerprint', () => {
  it('is short, stable and does not contain the input', () => {
    const fp = secretFingerprint(TOKEN);
    expect(fp).toMatch(/^sha256:[0-9a-f]{8}$/);
    expect(secretFingerprint(TOKEN)).toBe(fp);
    expect(secretFingerprint(WRONG)).not.toBe(fp);
    expect(secretFingerprint(undefined)).toBe('none');
  });
});
