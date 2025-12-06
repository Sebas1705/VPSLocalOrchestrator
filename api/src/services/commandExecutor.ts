import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface CommandOptions {
  timeout?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Ejecuta un comando del sistema y retorna el resultado
 */
export async function executeCommand(
  command: string,
  options: CommandOptions = {}
): Promise<CommandResult> {
  const startTime = Date.now();
  const timeout = options.timeout || 30000; // 30 segundos por defecto

  try {
    const { stdout, stderr } = await execPromise(command, {
      timeout,
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || error.message,
      exitCode: error.code || 1,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Ejecuta un comando en modo streaming (para comandos de larga duración)
 */
export function executeStreamCommand(
  command: string,
  args: string[] = [],
  onData: (data: string) => void,
  onError: (data: string) => void,
  onClose: (code: number) => void
) {
  const child = spawn(command, args, {
    shell: true,
  });

  child.stdout.on('data', (data) => {
    onData(data.toString());
  });

  child.stderr.on('data', (data) => {
    onError(data.toString());
  });

  child.on('close', (code) => {
    onClose(code || 0);
  });

  return child;
}
