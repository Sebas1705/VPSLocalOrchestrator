import { runProcess } from './commandExecutor.js';
import { assertPid, assertSignal, getCommandPolicyConfig } from './commandPolicy.js';
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
    // `top -bn1`, then parse the idle percentage from the "Cpu(s)" line in JS
    // (previously a shell pipeline through grep/sed/awk).
    const result = await runProcess('top', ['-bn1']);
    const cpuLine = result.stdout.split('\n').find((line) => line.includes('Cpu(s)'));
    const idle = cpuLine?.match(/([\d.]+)\s*%?\s*id/)?.[1];
    if (idle === undefined) return 0;
    return Math.round((100 - parseFloat(idle)) * 10) / 10 || 0;
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
    // `df -k /`: last line is "Filesystem 1K-blocks Used Available Use% Mounted"
    const result = await runProcess('df', ['-k', '/']);
    const lastLine = result.stdout.split('\n').filter((line) => line.trim()).pop() ?? '';
    const [, total, used, free, percent] = lastLine.trim().split(/\s+/);
    
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
    const count = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 1000) : 10;
    // `ps aux` columns: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND.
    // Header and top-N selection are done here instead of head/tail/awk.
    const result = await runProcess('ps', ['aux', '--sort=-%cpu']);

    const processes: ProcessInfo[] = [];
    const lines = result.stdout.split('\n').filter(line => line.trim()).slice(1, count + 1);

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 11) {
        processes.push({
          pid: parseInt(parts[1] ?? ''),
          name: parts[10] ?? '',
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
    const result = await runProcess('kill', [`-${assertSignal(signal)}`, String(assertPid(pid))]);
    return result.exitCode === 0;
  } catch (error) {
    return false;
  }
}

/**
 * Cambia la prioridad de un proceso (nice value)
 * @param pid - Process ID
 * @param priority - Nice value (-20 a 19, menor = mayor prioridad)
 * @returns success y mensaje
 */
export async function setProcessPriority(
  pid: number,
  priority: number
): Promise<{ success: boolean; message: string; currentPriority?: number }> {
  // Validar rango de prioridad
  if (priority < -20 || priority > 19) {
    return {
      success: false,
      message: 'Priority must be between -20 (highest) and 19 (lowest)',
    };
  }

  try {
    // Verificar que el proceso existe
    const safePid = String(assertPid(pid));
    if (!Number.isInteger(priority)) {
      return { success: false, message: 'Priority must be an integer' };
    }
    const checkResult = await runProcess('ps', ['-p', safePid, '-o', 'pid=']);
    if (checkResult.exitCode !== 0) {
      return {
        success: false,
        message: `Process ${pid} not found`,
      };
    }

    // Intentar sin sudo primero (si el proceso pertenece al usuario actual)
    let result = await runProcess('renice', [String(priority), '-p', safePid]);

    // Si falla por permisos, intentar con sudo -n (salvo ALLOW_SUDO_COMMANDS=false)
    if (result.exitCode !== 0 && /permission/i.test(result.stderr) && getCommandPolicyConfig().allowSudo) {
      result = await runProcess('sudo', ['-n', 'renice', String(priority), '-p', safePid]);
    }

    if (result.exitCode === 0) {
      return {
        success: true,
        message: `Process ${pid} priority changed to ${priority}`,
        currentPriority: priority,
      };
    } else {
      return {
        success: false,
        message: result.stderr || 'Failed to change priority (insufficient permissions)',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Error changing process priority',
    };
  }
}
