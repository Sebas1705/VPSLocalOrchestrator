/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
/**
 * OS Command Process Manager Adapter
 *
 * Uses `ps`, `kill`, and other shell commands to manage processes.
 * All side-effects are isolated in this adapter.
 */

import type { IProcessManager, ProcessInfo, ProcessStats } from '../ports/os-adapters.js';
import type { ICommandExecutor } from '../ports/os-adapters.js';

export class OsCommandProcessManager implements IProcessManager {
  constructor(private readonly commandExecutor: ICommandExecutor) {}

  async getProcessList(): Promise<ProcessInfo[]> {
    try {
      // ps aux format: USER PID %CPU %MEM VSZ RSS COMMAND
      const result = await this.commandExecutor.execute('ps aux --no-header', {});

      if (result.exitCode !== 0) {
        return [];
      }

      return result.stdout
        .split('\n')
        .filter((line) => line.trim())
        .slice(0, 10) // top 10 processes
        .map((line) => this.parseProcessLine(line));
    } catch {
      return [];
    }
  }

  async getProcessById(pid: number): Promise<ProcessInfo | null> {
    try {
      const result = await this.commandExecutor.execute(`ps p ${pid} --no-header`, {});

      if (result.exitCode !== 0 || !result.stdout) {
        return null;
      }

      return this.parseProcessLine(result.stdout);
    } catch {
      return null;
    }
  }

  async killProcess(pid: number, signal: string = 'TERM'): Promise<void> {
    const result = await this.commandExecutor.execute(`kill -${signal} ${pid}`, {});

    if (result.exitCode !== 0) {
      throw new Error(`Failed to kill process ${pid}: ${result.stderr}`);
    }
  }

  async getProcessStats(pid: number): Promise<ProcessStats | null> {
    try {
      const result = await this.commandExecutor.execute(
        `ps p ${pid} -o %cpu,%mem,etime,nlwp --no-header`,
        {}
      );

      if (result.exitCode !== 0 || !result.stdout) {
        return null;
      }

      const parts = result.stdout.trim().split(/\s+/);
      return {
        pid,
        cpuUsage: parseFloat(parts[0]) || 0,
        memoryUsage: parseFloat(parts[1]) || 0,
        uptime: this.parseUptime(parts[2] || '0'),
        threads: parseInt(parts[3] || '1', 10),
      };
    } catch {
      return null;
    }
  }

  private parseProcessLine(line: string): ProcessInfo {
    const parts = line.trim().split(/\s+/);
    return {
      pid: parseInt(parts[1], 10),
      user: parts[0],
      cpuPercent: parseFloat(parts[2]) || 0,
      memoryMb: (parseInt(parts[4], 10) * 1024) / 1024 || 0, // VSZ to MB
      name: parts[10] || 'unknown',
      command: parts.slice(10).join(' ') || '',
    };
  }

  private parseUptime(etimeStr: string): number {
    // etime format: HH:MM:SS or MM:SS
    const parts = etimeStr.split(':');
    let seconds = 0;

    if (parts.length === 3) {
      seconds += parseInt(parts[0], 10) * 3600; // hours
      seconds += parseInt(parts[1], 10) * 60; // minutes
      seconds += parseInt(parts[2], 10); // seconds
    } else if (parts.length === 2) {
      seconds += parseInt(parts[0], 10) * 60; // minutes
      seconds += parseInt(parts[1], 10); // seconds
    }

    return seconds;
  }
}
