import { Command, CommandExecution, CommandResult } from '../../../src/domain/command/entities.js';
import {
  CommandExecutionError,
  ResourceAccessError,
  ServiceManagementError,
  ValidationError,
  isDomainError,
  errorStatusMap,
} from '../../../src/domain/errors/index.js';

describe('domain entities', () => {
  it('Command validates input and detects privileged', () => {
    expect(() => new Command('')).toThrow();
    expect(() => new Command('ls', 0)).toThrow();
    const cmd = new Command('sudo ls');
    expect(cmd.isPrivileged()).toBe(true);
    expect(new Command('echo ok').isPrivileged()).toBe(false);
    expect(Command.create('echo ok').timeout).toBe(30000);
  });

  it('CommandExecution lifecycle updates status and duration', () => {
    const cmd = new Command('echo ok');
    const exec = new CommandExecution('1', cmd, 'u');
    exec.start();
    exec.complete(1, 'out', 'err');
    expect(exec.status).toBe('failed');
    expect(exec.exitCode).toBe(1);
    expect(exec.getDuration()).toBeGreaterThanOrEqual(0);
    exec.timeout();
    expect(exec.status).toBe('timeout');

    const successExec = new CommandExecution('2', new Command('echo hi'), 'u');
    successExec.complete(0, 'ok', '');
    expect(successExec.isSuccess()).toBe(true);

    // isSuccess false when status is not completed even with exitCode 0
    const failExec = new CommandExecution('3', new Command('fail'), 'u');
    failExec.exitCode = 0;
    failExec.status = 'timeout';
    expect(failExec.isSuccess()).toBe(false);

    // getDuration when endedAt is null (uses new Date())
    const pendingExec = new CommandExecution('4', new Command('pending'), 'u');
    pendingExec.start();
    const duration = pendingExec.getDuration();
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('CommandResult helper constructors set success/failure', () => {
    const ok = CommandResult.success('hi', 5);
    expect(ok.isSuccess()).toBe(true);
    const bad = CommandResult.failure(2, 'err', 10);
    expect(bad.isSuccess()).toBe(false);
  });
});

describe('domain errors', () => {
  it('CommandExecutionError factories set status codes', () => {
    expect(CommandExecutionError.timeout('cmd', 10).statusCode).toBe(408);
    expect(CommandExecutionError.denied('cmd', 'nope').statusCode).toBe(403);
    expect(CommandExecutionError.invalidSyntax('cmd', 'bad').code).toBe('COMMAND_EXECUTION_ERROR');
  });

  it('ResourceAccessError factories set context', () => {
    expect(ResourceAccessError.notFound('res', '1').statusCode).toBe(404);
    expect(ResourceAccessError.invalid('res', 'f', 'v').context?.field).toBe('f');
    expect(ResourceAccessError.permissionDenied('res', 'op').statusCode).toBe(403);
    expect(ResourceAccessError.conflict('res', 'taken').statusCode).toBe(409);
  });

  it('ServiceManagementError factories set codes', () => {
    expect(ServiceManagementError.notFound('svc').statusCode).toBe(404);
    expect(ServiceManagementError.unavailable('svc', 'down').statusCode).toBe(503);
    expect(ServiceManagementError.invalidAction('noop').statusCode).toBe(400);
    expect(ServiceManagementError.operationFailed('svc', 'start', 'boom').context?.operation).toBe('start');
  });

  it('ValidationError factories and guard', () => {
    expect(ValidationError.missingRequired('field').code).toBe('VALIDATION_ERROR');
    const err = ValidationError.outOfRange('n', 5, 1, 10);
    expect(isDomainError(err)).toBe(true);
    expect(errorStatusMap.VALIDATION_ERROR).toBe(400);
    expect(errorStatusMap.COMMAND_EXECUTION_ERROR).toBe(400);
    expect(errorStatusMap.RESOURCE_ACCESS_ERROR).toBe(400);
    expect(ValidationError.invalidType('field', 'string', 'number').field).toBe('field');
    expect(isDomainError(new Error('generic'))).toBe(false);
  });

  it('ValidationError outOfRange handles min-only and max-only', () => {
    const minOnly = ValidationError.outOfRange('level', 2, 1);
    expect(minOnly.message).toContain('>=');
    const maxOnly = ValidationError.outOfRange('level', 2, undefined, 5);
    expect(maxOnly.message).toContain('<=');
  });

  it('DomainError constructor sets all properties', () => {
    const ctx = { key: 'value' };
    const err = new CommandExecutionError('test message', 500, ctx);
    expect(err.code).toBe('COMMAND_EXECUTION_ERROR');
    expect(err.statusCode).toBe(500);
    expect(err.context).toEqual(ctx);
    expect(err.name).toBe('CommandExecutionError');
  });

  it('ResourceAccessError covers all factory methods', () => {
    // notFound
    const notFound = ResourceAccessError.notFound('process', '123');
    expect(notFound.statusCode).toBe(404);
    expect(notFound.context?.id).toBe('123');

    // invalid
    const invalid = ResourceAccessError.invalid('memory', 'size', -100);
    expect(invalid.statusCode).toBe(400);
    expect(invalid.context?.value).toBe(-100);

    // conflict
    const conflict = ResourceAccessError.conflict('resource', 'already exists');
    expect(conflict.statusCode).toBe(409);
    expect(conflict.context?.reason).toBe('already exists');

    // permissionDenied
    const denied = ResourceAccessError.permissionDenied('file', 'write');
    expect(denied.statusCode).toBe(403);
    expect(denied.context?.operation).toBe('write');
  });

  it('ServiceManagementError covers all factory methods', () => {
    // notFound
    const notFound = ServiceManagementError.notFound('nginx');
    expect(notFound.statusCode).toBe(404);
    expect(notFound.context?.serviceName).toBe('nginx');

    // unavailable
    const unavail = ServiceManagementError.unavailable('mysql', 'connection refused');
    expect(unavail.statusCode).toBe(503);
    expect(unavail.context?.reason).toBe('connection refused');

    // operationFailed
    const opFailed = ServiceManagementError.operationFailed('redis', 'start', 'port in use');
    expect(opFailed.statusCode).toBe(500);
    expect(opFailed.context?.error).toBe('port in use');

    // invalidAction
    const badAction = ServiceManagementError.invalidAction('deploy');
    expect(badAction.statusCode).toBe(400);
    expect(badAction.context?.action).toBe('deploy');
  });

  it('CommandExecutionError covers all factory methods', () => {
    // timeout
    const timeout = CommandExecutionError.timeout('sleep 100', 5000);
    expect(timeout.statusCode).toBe(408);
    expect(timeout.context?.timeoutMs).toBe(5000);

    // denied
    const denied = CommandExecutionError.denied('rm -rf /', 'not allowed');
    expect(denied.statusCode).toBe(403);
    expect(denied.context?.reason).toBe('not allowed');

    // invalidSyntax
    const syntax = CommandExecutionError.invalidSyntax('echo', 'unclosed quote');
    expect(syntax.statusCode).toBe(400);
    expect(syntax.context?.error).toBe('unclosed quote');
  });

  it('ValidationError covers all factory methods', () => {
    // missingRequired
    const missing = ValidationError.missingRequired('username');
    expect(missing.statusCode).toBe(400);
    expect(missing.field).toBe('username');

    // invalidType
    const type = ValidationError.invalidType('age', 'number', 'string');
    expect(type.statusCode).toBe(400);
    expect(type.field).toBe('age');

    // outOfRange with min and max
    const range = ValidationError.outOfRange('port', 70000, 0, 65535);
    expect(range.statusCode).toBe(400);
    expect(range.field).toBe('port');
    expect(range.message).toContain('0-65535');

    // outOfRange with only min
    const minRange = ValidationError.outOfRange('threads', -1, 1);
    expect(minRange.message).toContain('>= 1');

    // outOfRange with only max
    const maxRange = ValidationError.outOfRange('limit', 2000, undefined, 1000);
    expect(maxRange.message).toContain('<= 1000');
  });
});
