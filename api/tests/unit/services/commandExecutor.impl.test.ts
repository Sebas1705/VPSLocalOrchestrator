const execMock = jest.fn();
const spawnMock = jest.fn();

jest.mock('child_process', () => ({
  exec: execMock,
  spawn: spawnMock,
}));

import { EventEmitter } from 'events';
import * as childProcess from 'child_process';

describe('commandExecutor', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('executeCommand returns stdout on success', async () => {
    execMock.mockImplementation((cmd, _opts, cb) => {
      cb?.(null, 'ok\n', '');
      return {} as any;
    });

    let resultPromise: Promise<any> | undefined;
    jest.isolateModules(() => {
      const { executeCommand } = require('../../../src/services/commandExecutor.js');
      resultPromise = executeCommand('echo ok');
    });

    const result = await resultPromise!;
    expect(execMock).toHaveBeenCalledWith('echo ok', expect.any(Object), expect.any(Function));
    expect(result.exitCode).toBeGreaterThanOrEqual(0);
    expect(typeof result.stdout).toBe('string');
    expect(typeof result.stderr).toBe('string');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('executeCommand captures stderr and exitCode on failure', async () => {
    execMock.mockImplementation((cmd, _opts, cb) => {
      cb?.({ code: 2, stdout: 'partial output\n', stderr: 'bad things\n' } as any, '', '');
      return {} as any;
    });

    let resultPromise: Promise<any> | undefined;
    jest.isolateModules(() => {
      const { executeCommand } = require('../../../src/services/commandExecutor.js');
      resultPromise = executeCommand('bad-command');
    });

    const result = await resultPromise!;
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('partial output');
    expect(result.stderr).toContain('bad things');
  });

  it('executeCommand defaults exitCode to 1 when code missing', async () => {
    execMock.mockImplementation((_cmd, _opts, cb) => {
      cb?.({ message: 'oops' } as any, '', '');
      return {} as any;
    });

    let resultPromise: Promise<any> | undefined;
    jest.isolateModules(() => {
      const { executeCommand } = require('../../../src/services/commandExecutor.js');
      resultPromise = executeCommand('fails');
    });

    const result = await resultPromise!;
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('oops');
  });

  it('executeStreamCommand handles close event without code (defaults to 0)', async () => {
    const { EventEmitter } = require('events');
    const stdoutEmitter = new EventEmitter();
    const stderrEmitter = new EventEmitter();
    let closeHandler: any;

    const mockChild = {
      stdout: stdoutEmitter,
      stderr: stderrEmitter,
      on: jest.fn((event, cb) => {
        if (event === 'close') closeHandler = cb;
      }),
    };

    spawnMock.mockReturnValue(mockChild);

    const onClose = jest.fn();
    jest.isolateModules(() => {
      const { executeStreamCommand } = require('../../../src/services/commandExecutor.js');
      executeStreamCommand('cmd', ['arg'], jest.fn(), jest.fn(), onClose);
    });

    // Call close handler without code
    closeHandler(undefined);

    // Should default undefined to 0
    expect(onClose).toHaveBeenCalledWith(0);
  });

  it('executeStreamCommand forwards data events from stdout and stderr', async () => {
    const { EventEmitter } = require('events');
    const stdoutEmitter = new EventEmitter();
    const stderrEmitter = new EventEmitter();
    const onData = jest.fn();
    const onError = jest.fn();
    const onClose = jest.fn();

    const mockChild = {
      stdout: stdoutEmitter,
      stderr: stderrEmitter,
      on: jest.fn(),
    };

    spawnMock.mockReturnValue(mockChild);

    jest.isolateModules(() => {
      const { executeStreamCommand } = require('../../../src/services/commandExecutor.js');
      executeStreamCommand('cmd', ['arg'], onData, onError, onClose);
    });

    // Trigger data events
    stdoutEmitter.emit('data', Buffer.from('stdout text'));
    stderrEmitter.emit('data', Buffer.from('stderr text'));

    expect(onData).toHaveBeenCalledWith('stdout text');
    expect(onError).toHaveBeenCalledWith('stderr text');
  });
});
