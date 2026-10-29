jest.mock('os', () => ({
  totalmem: jest.fn(() => 1024 * 1024 * 1024),
  freemem: jest.fn(() => 512 * 1024 * 1024),
  cpus: jest.fn(() => [{ model: 'Test CPU' }]),
  uptime: jest.fn(() => 1200),
  platform: jest.fn(() => 'linux'),
}));

import * as os from 'os';
import { getProcessList, getSystemResources, killProcess, setProcessPriority } from '../../../src/services/resourceMonitor.js';
import { runProcess } from '../../../src/services/commandExecutor.js';

jest.mock('../../../src/services/commandExecutor.js', () => ({
  runProcess: jest.fn(),
}));

const executeCommandMock = runProcess as jest.Mock;

const TOP_OUTPUT = (idle: string) =>
  ['top - 10:00:00 up 1 day', `%Cpu(s):  5.0 us,  2.0 sy,  0.0 ni, ${idle} id,  0.0 wa`, 'MiB Mem : 1000 total'].join('\n');
const DF_OUTPUT = ['Filesystem 1K-blocks Used Available Use% Mounted on', '/dev/sda1 1000 200 800 20% /'].join('\n');

describe('resourceMonitor', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSystemResources', () => {
    it('returns cpu, memory, and disk metrics', async () => {
      executeCommandMock
        .mockResolvedValueOnce({ stdout: TOP_OUTPUT('87.5'), stderr: '', exitCode: 0, duration: 10 }) // CPU
        .mockResolvedValueOnce({ stdout: DF_OUTPUT, stderr: '', exitCode: 0, duration: 10 }); // Disk

      const resources = await getSystemResources();

      expect(resources.cpu.usage).toBeCloseTo(12.5);
      expect(resources.cpu.cores).toBe(1);
      expect(resources.cpu.model).toBe('Test CPU');
      expect(resources.memory.used).toBeGreaterThan(0);
      expect(resources.disk.total).toBe(1000 * 1024);
      expect(resources.disk.usagePercent).toBeCloseTo(20);
      expect(resources.uptime).toBe(1200);
      expect(resources.platform).toBe('linux');
    });

    it('falls back to zeros when cpu command fails', async () => {
      executeCommandMock
        .mockRejectedValueOnce(new Error('cpu fail'))
        .mockResolvedValueOnce({ stdout: DF_OUTPUT, stderr: '', exitCode: 0, duration: 10 });

      const resources = await getSystemResources();

      expect(resources.cpu.usage).toBe(0);
      expect(resources.disk.usagePercent).toBeCloseTo(20);
    });

    it('returns zeroed disk metrics when parsing fails', async () => {
      executeCommandMock
        .mockResolvedValueOnce({ stdout: TOP_OUTPUT('95.0'), stderr: '', exitCode: 0, duration: 10 })
        .mockRejectedValueOnce(new Error('df fail'));

      const resources = await getSystemResources();
      expect(resources.disk).toEqual({ total: 0, free: 0, used: 0, usagePercent: 0 });
    });
  });

  describe('getProcessList', () => {
    it('parses process list output', async () => {
      const psOutput = [
        'USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND',
        'app 1234 12.0 1.5 100 50 ? S 10:00 0:01 node server.js',
        'www 4321 5.0 0.8 100 50 ? S 10:00 0:01 nginx -g daemon',
        'www 4322 1.0 0.1 100 50 ? S 10:00 0:01 nginx -g daemon',
      ].join('\n');
      executeCommandMock.mockResolvedValueOnce({ stdout: psOutput, stderr: '', exitCode: 0, duration: 5 });

      const processes = await getProcessList(2);

      // header skipped and list truncated in code, no head/tail/awk pipeline
      expect(executeCommandMock).toHaveBeenCalledWith('ps', ['aux', '--sort=-%cpu']);
      expect(processes).toHaveLength(2);
      expect(processes[0]).toEqual({ pid: 1234, name: 'node', cpu: 12, memory: 1.5 });
      expect(processes[1].name).toBe('nginx');
    });

    it('returns empty array on command failure', async () => {
      executeCommandMock.mockRejectedValueOnce(new Error('ps failed'));
      const processes = await getProcessList(1);
      expect(processes).toEqual([]);
    });

    it('returns empty array when no process lines are parsed', async () => {
      executeCommandMock.mockResolvedValueOnce({ stdout: '  \n', stderr: '', exitCode: 0, duration: 5 });
      const processes = await getProcessList(3);
      expect(processes).toEqual([]);
    });
  });

  describe('killProcess', () => {
    it('returns true when kill succeeds', async () => {
      executeCommandMock.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0, duration: 1 });
      await expect(killProcess(123)).resolves.toBe(true);
      expect(executeCommandMock).toHaveBeenCalledWith('kill', ['-TERM', '123']);
    });

    it('rejects injected signals and pids without spawning anything', async () => {
      await expect(killProcess(1, 'TERM; rm -rf /')).resolves.toBe(false);
      await expect(killProcess('1 && reboot' as any)).resolves.toBe(false);
      await expect(killProcess(-1)).resolves.toBe(false);
      expect(executeCommandMock).not.toHaveBeenCalled();
    });

    it('returns false on error', async () => {
      executeCommandMock.mockRejectedValueOnce(new Error('kill failed'));
      await expect(killProcess(999)).resolves.toBe(false);
    });

    it('returns false when exit code is non-zero', async () => {
      executeCommandMock.mockResolvedValueOnce({ stdout: '', stderr: 'fail', exitCode: 1, duration: 1 });
      await expect(killProcess(555)).resolves.toBe(false);
    });
  });

  describe('setProcessPriority', () => {
    it('rejects priorities outside allowed range', async () => {
      const result = await setProcessPriority(10, 50);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Priority must be between');
    });

    it('returns not found when process does not exist', async () => {
      executeCommandMock.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 1, duration: 1 });
      const result = await setProcessPriority(9999, 5);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('changes priority when allowed', async () => {
      executeCommandMock
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0, duration: 1 }) // check ps
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0, duration: 1 }); // renice

      const result = await setProcessPriority(100, -5);
      expect(result.success).toBe(true);
      expect(result.currentPriority).toBe(-5);
    });

    it('retries with sudo when permission denied', async () => {
      executeCommandMock
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0, duration: 1 }) // check ps
        .mockResolvedValueOnce({ stdout: '', stderr: 'permission denied', exitCode: 1, duration: 1 }) // renice
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0, duration: 1 }); // sudo renice

      const result = await setProcessPriority(200, 10);
      expect(result.success).toBe(true);
      expect(executeCommandMock).toHaveBeenCalledTimes(3);
      expect(executeCommandMock).toHaveBeenNthCalledWith(1, 'ps', ['-p', '200', '-o', 'pid=']);
      expect(executeCommandMock).toHaveBeenNthCalledWith(2, 'renice', ['10', '-p', '200']);
      expect(executeCommandMock).toHaveBeenNthCalledWith(3, 'sudo', ['-n', 'renice', '10', '-p', '200']);
    });

    it('does not retry with sudo when ALLOW_SUDO_COMMANDS=false', async () => {
      const previous = process.env.ALLOW_SUDO_COMMANDS;
      process.env.ALLOW_SUDO_COMMANDS = 'false';
      try {
        executeCommandMock
          .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0, duration: 1 }) // check ps
          .mockResolvedValueOnce({ stdout: '', stderr: 'permission denied', exitCode: 1, duration: 1 }); // renice

        const result = await setProcessPriority(200, 10);
        expect(result.success).toBe(false);
        expect(executeCommandMock).toHaveBeenCalledTimes(2);
      } finally {
        if (previous === undefined) delete process.env.ALLOW_SUDO_COMMANDS;
        else process.env.ALLOW_SUDO_COMMANDS = previous;
      }
    });

    it('rejects a non-numeric pid before running ps', async () => {
      const result = await setProcessPriority('1; reboot' as any, 5);
      expect(result.success).toBe(false);
      expect(executeCommandMock).not.toHaveBeenCalled();
    });

    it('returns failure when renice exits with non-permission error', async () => {
      executeCommandMock
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0, duration: 1 }) // check ps
        .mockResolvedValueOnce({ stdout: '', stderr: 'other failure', exitCode: 2, duration: 1 }); // renice

      const result = await setProcessPriority(201, 1);
      expect(result.success).toBe(false);
      expect(result.message).toContain('other failure');
    });

    it('returns error message on unexpected failure', async () => {
      executeCommandMock.mockRejectedValueOnce(new Error('boom'));
      const result = await setProcessPriority(500, 0);
      expect(result.success).toBe(false);
      expect(result.message).toContain('boom');
    });

    it('validates priority boundary values', async () => {
      // Min valid priority
      executeCommandMock
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0, duration: 1 }) // check ps
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0, duration: 1 }); // renice

      const minResult = await setProcessPriority(100, -20);
      expect(minResult.success).toBe(true);

      // Max valid priority
      executeCommandMock
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0, duration: 1 }) // check ps
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0, duration: 1 }); // renice

      const maxResult = await setProcessPriority(101, 19);
      expect(maxResult.success).toBe(true);
    });
  });
});