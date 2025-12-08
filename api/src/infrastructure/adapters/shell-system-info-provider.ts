/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
/**
 * System Information Provider via Shell Commands
 *
 * Reads system metrics using standard Unix tools (cat /proc/*, etc.).
 * All I/O is isolated in this adapter.
 */

import type { ISystemInfoProvider, CPUInfo, MemoryInfo, DiskInfo, NetworkInfo } from '../ports/os-adapters.js';
import type { ICommandExecutor } from '../ports/os-adapters.js';

export class ShellSystemInfoProvider implements ISystemInfoProvider {
  constructor(private readonly commandExecutor: ICommandExecutor) {}

  async getCPUInfo(): Promise<CPUInfo> {
    try {
      const result = await this.commandExecutor.execute('cat /proc/stat | head -1', {});

      if (result.exitCode !== 0) {
        return { cores: 0, userPercent: 0, systemPercent: 0, idlePercent: 0 };
      }

      // Parse cpu line: cpu  user nice system idle
      const parts = result.stdout.split(/\s+/);
      const total = parseInt(parts[1], 10) + parseInt(parts[2], 10) + parseInt(parts[3], 10) + parseInt(parts[4], 10);

      return {
        cores: 1, // simplified; would need /proc/cpuinfo for actual cores
        userPercent: total > 0 ? (parseInt(parts[1], 10) / total) * 100 : 0,
        systemPercent: total > 0 ? (parseInt(parts[3], 10) / total) * 100 : 0,
        idlePercent: total > 0 ? (parseInt(parts[4], 10) / total) * 100 : 0,
      };
    } catch {
      return { cores: 0, userPercent: 0, systemPercent: 0, idlePercent: 0 };
    }
  }

  async getMemoryInfo(): Promise<MemoryInfo> {
    try {
      const result = await this.commandExecutor.execute('cat /proc/meminfo | grep -E "^MemTotal|^MemFree|^MemAvailable"', {});

      if (result.exitCode !== 0) {
        return { total: 0, used: 0, free: 0, available: 0 };
      }

      const lines = result.stdout.split('\n');
      const memMap: Record<string, number> = {};

      lines.forEach((line) => {
        const [key, val] = line.split(':');
        memMap[key.trim()] = parseInt(val || '0', 10) * 1024; // kB to bytes
      });

      return {
        total: memMap['MemTotal'] || 0,
        used: (memMap['MemTotal'] || 0) - (memMap['MemFree'] || 0),
        free: memMap['MemFree'] || 0,
        available: memMap['MemAvailable'] || 0,
      };
    } catch {
      return { total: 0, used: 0, free: 0, available: 0 };
    }
  }

  async getDiskInfo(): Promise<DiskInfo> {
    try {
      const result = await this.commandExecutor.execute('df -B1 / | tail -1', {});

      if (result.exitCode !== 0) {
        return { total: 0, used: 0, available: 0 };
      }

      const parts = result.stdout.split(/\s+/);
      return {
        total: parseInt(parts[1], 10) || 0,
        used: parseInt(parts[2], 10) || 0,
        available: parseInt(parts[3], 10) || 0,
      };
    } catch {
      return { total: 0, used: 0, available: 0 };
    }
  }

  async getNetworkInterfaces(): Promise<NetworkInfo[]> {
    try {
      const result = await this.commandExecutor.execute('ip link show', {});

      if (result.exitCode !== 0) {
        return [];
      }

      const interfaces: NetworkInfo[] = [];
      const lines = result.stdout.split('\n');

      for (const line of lines) {
        if (line.match(/^\d+:/)) {
          const match = line.match(/(\S+):\s.*state (\w+)/);
          if (match) {
            interfaces.push({
              name: match[1],
              status: match[2].toLowerCase() === 'up' ? 'up' : 'down',
            });
          }
        }
      }

      return interfaces;
    } catch {
      return [];
    }
  }

  async getSystemUptime(): Promise<number> {
    try {
      const result = await this.commandExecutor.execute('cat /proc/uptime', {});

      if (result.exitCode !== 0) {
        return 0;
      }

      const uptime = parseFloat(result.stdout.split(' ')[0] || '0');
      return Math.floor(uptime);
    } catch {
      return 0;
    }
  }
}
