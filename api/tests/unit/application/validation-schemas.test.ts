import {
  ExecuteCommandRequestSchema,
  BatchCommandRequestSchema,
  ErrorResponseSchema,
  validateRequest,
} from '../../../src/application/validation-schemas.js';

describe('validation-schemas', () => {
  it('fills defaults for execute command request', () => {
    const parsed = ExecuteCommandRequestSchema.parse({ command: 'ls' });
    expect(parsed.timeout).toBe(30000);
    expect(parsed.cwd).toBe('/tmp');
  });

  it('rejects empty batch commands', () => {
    expect(() => BatchCommandRequestSchema.parse({ commands: [] })).toThrow();
  });

  it('validates error response schema success path', () => {
    const now = new Date().toISOString();
    const result = ErrorResponseSchema.safeParse({
      error: { code: 'X', message: 'oops' },
      timestamp: now,
    });
    expect(result.success).toBe(true);
  });

  it('validateRequest returns error when invalid', () => {
    const outcome = validateRequest(ExecuteCommandRequestSchema, { command: '' });
    expect(outcome.valid).toBe(false);
  });

  it('validateRequest returns data when valid', () => {
    const outcome = validateRequest(ExecuteCommandRequestSchema, { command: 'echo hi', timeout: 1000, cwd: '/tmp' });
    expect(outcome.valid).toBe(true);
    if (outcome.valid) {
      expect(outcome.data.command).toBe('echo hi');
    }
  });
});
