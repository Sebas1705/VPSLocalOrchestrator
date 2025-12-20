jest.mock('os', () => ({
  totalmem: jest.fn(() => 1024 * 1024 * 1024),
  freemem: jest.fn(() => 512 * 1024 * 1024),
  cpus: jest.fn(() => [{ model: 'Test CPU' }]),
  uptime: jest.fn(() => 1200),
  platform: jest.fn(() => 'linux'),
}));

import * as os from 'os';
import { getProcessList, getSystemResources, killProcess, setProcessPriority } from '../../../src/services/resourceMonitor.js';
import { executeCommand } from '../../../src/services/commandExecutor.js';

jest.mock('../../../src/services/commandExecutor.js', () => ({
  executeCommand: jest.fn(),
}));

const executeCommandMock = executeCommand as jest.Mock;

describe('resourceMonitor', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSystemResources', () => {
    it('returns cpu, memory, and disk metrics', async () => {
      executeCommandMock
        .mockResolvedValueOnce({ stdout: '12.5', stderr: '', exitCode: 0, duration: 10 }) // CPU
        .mockResolvedValueOnce({ stdout: '1000 200 800 20%', stderr: '', exitCode: 0, duration: 10 }); // Disk

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
        .mockResolvedValueOnce({ stdout: '1000 200 800 20%', stderr: '', exitCode: 0, duration: 10 });

      const resources = await getSystemResources();

      expect(resources.cpu.usage).toBe(0);
      expect(resources.disk.usagePercent).toBeCloseTo(20);
    });

    it('returns zeroed disk metrics when parsing fails', async () => {
      executeCommandMock
        .mockResolvedValueOnce({ stdout: '5', stderr: '', exitCode: 0, duration: 10 })
        .mockRejectedValueOnce(new Error('df fail'));

      const resources = await getSystemResources();
      expect(resources.disk).toEqual({ total: 0, free: 0, used: 0, usagePercent: 0 });
    });
  });

  describe('getProcessList', () => {
    it('parses process list output', async () => {
      const psOutput = '1234 node 12.0 1.5\n4321 nginx 5.0 0.8\n';
      executeCommandMock.mockResolvedValueOnce({ stdout: psOutput, stderr: '', exitCode: 0, duration: 5 });

      const processes = await getProcessList(2);

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