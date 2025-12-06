import { executeCommand } from './commandExecutor.js';
import * as os from 'os';
import * as fs from 'fs/promises';

export interface SystemResources {
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  uptime: number;
  platform: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
}

/**
 * Obtiene información del uso de CPU
 */
async function getCpuUsage(): Promise<number> {
  try {
    const result = await executeCommand(
      "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'"
    );
    return parseFloat(result.stdout) || 0;
  } catch (error) {
    // Fallback para sistemas no Linux
    return 0;
  }
}

/**
 * Obtiene información del uso de disco
 */
async function getDiskUsage(): Promise<{ total: number; free: number; used: number; usagePercent: number }> {
  try {
    const result = await executeCommand("df -k / | tail -1 | awk '{print $2,$3,$4,$5}'");
    const [total, used, free, percent] = result.stdout.split(' ');
    
    return {
      total: parseInt(total ?? '') * 1024, // Convertir a bytes
      used: parseInt(used ?? '') * 1024,
      free: parseInt(free ?? '') * 1024,
      usagePercent: parseFloat(percent ?? ''),
    };
  } catch (error) {
    return { total: 0, free: 0, used: 0, usagePercent: 0 };
  }
}

/**
 * Obtiene recursos del sistema
 */
export async function getSystemResources(): Promise<SystemResources> {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const cpuUsage = await getCpuUsage();
  const diskUsage = await getDiskUsage();

  return {
    cpu: {
      usage: cpuUsage,
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || 'Unknown',
    },
    memory: {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      usagePercent: (usedMem / totalMem) * 100,
    },
    disk: diskUsage,
    uptime: os.uptime(),
    platform: os.platform(),
  };
}

/**
 * Obtiene lista de procesos en ejecución
 */
export async function getProcessList(limit: number = 10): Promise<ProcessInfo[]> {
  try {
    const result = await executeCommand(
      `ps aux --sort=-%cpu | head -n ${limit + 1} | tail -n ${limit} | awk '{print $2,$11,$3,$4}'`
    );

    const processes: ProcessInfo[] = [];
    const lines = result.stdout.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        processes.push({
          pid: parseInt(parts[0] ?? ''),
          name: parts[1] ?? '',
          cpu: parseFloat(parts[2] ?? ''),
          memory: parseFloat(parts[3] ?? ''),
        });
      }
    }

    return processes;
  } catch (error) {
    return [];
  }
}

/**
 * Mata un proceso por PID
 */
export async function killProcess(pid: number, signal: string = 'TERM'): Promise<boolean> {
  try {
    const result = await executeCommand(`kill -${signal} ${pid}`);
    return result.exitCode === 0;
  } catch (error) {
    return false;
  }
}
