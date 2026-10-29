import { execFile, spawn } from 'child_process';
import path from 'path';
import {
  authorizeCommand,
  resolveExecutable,
  sanitizeRequestEnv,
  getCommandPolicyConfig,
  type CommandInput,
  type AuthorizedCommand,
} from './commandPolicy.js';

export type { CommandInput, CommandSpec } from './commandPolicy.js';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface CommandOptions {
  timeout?: number | undefined;
  cwd?: string | undefined;
  env?: Record<string, string | undefined> | undefined;
  maxBuffer?: number | undefined;
}

/** A denied command, as reported to the audit sink. */
export interface CommandDeniedEvent {
  command: string;
  reason: string;
  statusCode: number;
  source?: string | undefined;
}

export type CommandAuditSink = (event: CommandDeniedEvent) => void | Promise<void>;

const defaultAuditSink: CommandAuditSink = (event) => {
  console.warn(JSON.stringify({ audit: 'command.denied', ...event, timestamp: new Date().toISOString() }));
};

let auditSink: CommandAuditSink = defaultAuditSink;

/**
 * Register where denied command attempts are recorded (the server wires the
 * file-based audit log here). Pass undefined to restore the console default.
 */
export function setCommandAuditSink(sink: CommandAuditSink | undefined): void {
  auditSink = sink ?? defaultAuditSink;
}

function reportDenied(input: CommandInput, error: any, source?: string): void {
  const command =
    typeof input === 'string'
      ? input
      : [input?.command, ...(Array.isArray(input?.args) ? input.args : [])].join(' ');
  try {
    const result = auditSink({
      command: String(command).slice(0, 500),
      reason: error?.message ?? 'denied',
      statusCode: error?.statusCode ?? 403,
      source,
    });
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch(() => undefined);
    }
  } catch {
    // Auditing must never turn a denial into a different error.
  }
}

/**
 * Resolve a bare program name in the trusted directories, falling back to the
 * bare name for internal callers on hosts with an unusual layout.
 */
function resolveInternal(file: string): string {
  if (path.isAbsolute(file)) return file;
  return resolveExecutable(file, getCommandPolicyConfig().searchPath) ?? file;
}

function exitCodeOf(error: any): number {
  if (typeof error?.code === 'number') return error.code;
  if (error?.code === 'ENOENT') return 127;
  return 1;
}

/**
 * Run a program with a fixed argv and no shell. For internal callers whose
 * program and arguments are chosen by this codebase (with any user-supplied
 * values validated first). It never throws: failures come back as a non-zero
 * exitCode with stderr populated.
 */
export function runProcess(file: string, args: readonly string[] = [], options: CommandOptions = {}): Promise<CommandResult> {
  const startTime = Date.now();
  const timeout = options.timeout || 30000;

  return new Promise((resolve) => {
    execFile(
      resolveInternal(file),
      [...args],
      {
        timeout,
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        maxBuffer: options.maxBuffer || 1024 * 1024 * 10, // 10MB buffer
        shell: false,
        windowsHide: true,
      },
      (error: any, stdout: string | Buffer, stderr: string | Buffer) => {
        if (!error) {
          resolve({
            stdout: String(stdout ?? '').trim(),
            stderr: String(stderr ?? '').trim(),
            exitCode: 0,
            duration: Date.now() - startTime,
          });
          return;
        }
        resolve({
          stdout: String(error.stdout ?? stdout ?? '').trim(),
          stderr: String(error.stderr || stderr || '').trim() || error.message || 'Command failed',
          exitCode: exitCodeOf(error),
          duration: Date.now() - startTime,
        });
      }
    );
  });
}

/**
 * Authorize a caller-supplied command (string or { command, args }) against the
 * command policy, recording denials in the audit sink. Throws
 * CommandExecutionError (403 for policy denials, 400 for malformed input).
 */
export function authorizeRequestedCommand(
  input: CommandInput,
  env?: Record<string, unknown>,
  source?: string
): { authorized: AuthorizedCommand; env: Record<string, string> | undefined } {
  try {
    const authorized = authorizeCommand(input);
    return { authorized, env: sanitizeRequestEnv(env, authorized.display) };
  } catch (error) {
    reportDenied(input, error, source);
    throw error;
  }
}

/**
 * Execute a caller-supplied command. The command is parsed into argv, checked
 * against the allowlist (see commandPolicy.ts) and run with execFile, never a
 * shell. Policy denials throw; execution failures resolve with exitCode != 0.
 */
export async function executeCommand(
  input: CommandInput,
  options: CommandOptions & { source?: string | undefined } = {}
): Promise<CommandResult> {
  const { authorized, env } = authorizeRequestedCommand(input, options.env, options.source);
  return runProcess(authorized.file, authorized.args, {
    timeout: options.timeout,
    cwd: options.cwd,
    env,
    maxBuffer: options.maxBuffer,
  });
}

/**
 * Execute a caller-supplied command in streaming mode (long-running commands).
 * Same policy as executeCommand; spawned without a shell.
 */
export function executeStreamCommand(
  command: string,
  args: string[] = [],
  onData: (data: string) => void,
  onError: (data: string) => void,
  onClose: (code: number) => void
) {
  const { authorized } = authorizeRequestedCommand({ command, args }, undefined, 'stream');
  const child = spawn(authorized.file, authorized.args, {
    shell: false,
    windowsHide: true,
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
