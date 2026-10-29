/**
 * Hexagonal OS adapters: every call goes through ICommandExecutor as an
 * explicit argv (no shell strings, no pipes) and user-controlled values are
 * validated before anything is executed.
 */

const execFileMock = jest.fn();
jest.mock('child_process', () => ({ execFile: execFileMock }));

import { ChildProcessCommandExecutor } from '../../../src/infrastructure/adapters/child-process-command-executor.js';
import { OsCommandProcessManager } from '../../../src/infrastructure/adapters/os-command-process-manager.js';
import { ShellSystemInfoProvider } from '../../../src/infrastructure/adapters/shell-system-info-provider.js';
import { SystemdServiceManager } from '../../../src/infrastructure/adapters/systemd-service-manager.js';
import type { ICommandExecutor } from '../../../src/infrastructure/ports/os-adapters.js';

function fakeExecutor(stdout = '', exitCode = 0) {
  const execute = jest.fn(async () => ({ stdout, stderr: '', exitCode, duration: 1 }));
  return { executor: { execute } as unknown as ICommandExecutor, execute };
}

afterEach(() => jest.clearAllMocks());

describe('ChildProcessCommandExecutor', () => {
  it('uses execFile with the argv and shell disabled', async () => {
    execFileMock.mockImplementation((_file, _args, _opts, cb) => cb(null, ' ok \n', ''));
    const result = await new ChildProcessCommandExecutor().execute('/usr/bin/df', ['-B1', '/'], { timeout: 1000 });

    expect(execFileMock).toHaveBeenCalledWith(
      '/usr/bin/df',
      ['-B1', '/'],
      expect.objectContaining({ shell: false, timeout: 1000 }),
      expect.any(Function)
    );
    expect(result).toEqual(expect.objectContaining({ stdout: 'ok', exitCode: 0 }));
  });

  it('maps failures to exit codes without throwing', async () => {
    execFileMock.mockImplementation((_file, _args, _opts, cb) => cb({ code: 3, stderr: 'nope' }, '', ''));
    const result = await new ChildProcessCommandExecutor().execute('/usr/bin/false', []);
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toBe('nope');
  });
});

describe('SystemdServiceManager', () => {
  it('passes the unit name as a single argv element', async () => {
    const { executor, execute } = fakeExecutor();
    await new SystemdServiceManager(executor).restartService('nginx');
    expect(execute).toHaveBeenCalledWith('systemctl', ['restart', 'nginx'], {});
  });

  it.each(['nginx; reboot', '--now', '$(id)', 'a b'])('rejects unit name %j before executing', async (name) => {
    const { executor, execute } = fakeExecutor();
    await expect(new SystemdServiceManager(executor).startService(name)).rejects.toThrow('invalid service name');
    expect(execute).not.toHaveBeenCalled();
  });

  it('lists services without a grep pipeline', async () => {
    const { executor, execute } = fakeExecutor('nginx.service loaded active running nginx\n');
    const services = await new SystemdServiceManager(executor).listServices();
    expect(execute).toHaveBeenCalledWith('systemctl', ['list-units', '--type=service', '--no-pager', '--plain', '--no-legend'], {});
    expect(services[0]).toEqual(expect.objectContaining({ name: 'nginx', status: 'active' }));
  });
});

describe('OsCommandProcessManager', () => {
  it('kills with a validated signal and pid', async () => {
    const { executor, execute } = fakeExecutor();
    await new OsCommandProcessManager(executor).killProcess(42, 'KILL');
    expect(execute).toHaveBeenCalledWith('kill', ['-KILL', '42'], {});
  });

  it('rejects injected signals and pids', async () => {
    const { executor, execute } = fakeExecutor();
    const manager = new OsCommandProcessManager(executor);
    await expect(manager.killProcess(42, 'TERM; reboot')).rejects.toThrow();
    await expect(manager.killProcess('1 && id' as any)).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('ShellSystemInfoProvider', () => {
  it('reads /proc and df through argv and filters in code', async () => {
    const { executor, execute } = fakeExecutor(
      ['MemTotal: 100 kB', 'MemFree: 40 kB', 'MemAvailable: 60 kB', 'Buffers: 5 kB'].join('\n')
    );
    const memory = await new ShellSystemInfoProvider(executor).getMemoryInfo();
    expect(execute).toHaveBeenCalledWith('cat', ['/proc/meminfo'], {});
    expect(memory).toEqual({ total: 102400, used: 61440, free: 40960, available: 61440 });

    const df = fakeExecutor(['Filesystem 1B-blocks Used Available Use% Mounted on', '/dev/sda1 1000 400 600 40% /'].join('\n'));
    const disk = await new ShellSystemInfoProvider(df.executor).getDiskInfo();
    expect(df.execute).toHaveBeenCalledWith('df', ['-B1', '/'], {});
    expect(disk).toEqual({ total: 1000, used: 400, available: 600 });
  });
});
