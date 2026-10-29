/**
 * Command execution policy.
 *
 * Every caller-supplied command line (HTTP `/api/command/*`, queued `command` /
 * `batch-command` jobs, workflow `command` steps) is turned into an argv here
 * and checked before anything is spawned. Processes are always started with
 * `execFile`/`spawn` and no shell, so this module is the only place that
 * decides *what* may run:
 *
 *   1. A string command is split by a small quote-aware tokenizer. Shell
 *      metacharacters (`; & | $ \` < >`, newlines, NUL) are rejected outright:
 *      without a shell they would be passed literally, which is never what the
 *      caller meant, so failing loudly is safer than running something else.
 *   2. The executable must be on an explicit allowlist (`COMMAND_ALLOWLIST`,
 *      default `DEFAULT_COMMAND_ALLOWLIST`). Bare names are resolved to an
 *      absolute path inside a fixed set of trusted directories
 *      (`COMMAND_SEARCH_PATH`), never via the caller's or the process's `PATH`.
 *   3. `sudo` is never allowlisted on its own. `sudo [-n] <cmd> ...` is accepted
 *      only when `ALLOW_SUDO_COMMANDS` is not `false`, and `<cmd>` must itself
 *      pass the allowlist; it always runs as `sudo -n <absolute path> ...`.
 *   4. Caller-supplied environment variables cannot override `PATH`, loader or
 *      interpreter hooks (`LD_*`, `NODE_OPTIONS`, `BASH_ENV`, ...).
 *
 * Denials throw `CommandExecutionError` with HTTP 403 (400 for malformed input).
 */

import fs from 'fs';
import path from 'path';
import { CommandExecutionError } from '../domain/errors/index.js';

/** A command given as an executable plus an explicit argument vector. */
export interface CommandSpec {
  command: string;
  args?: string[] | undefined;
}

/** Either a single command line (tokenized here) or an explicit argv. */
export type CommandInput = string | CommandSpec;

export interface CommandPolicyConfig {
  /** Allowed executables: bare names (`docker`) or absolute paths (`/opt/app/deploy.sh`). */
  allowlist: ReadonlySet<string>;
  /** Trusted directories searched, in order, to resolve bare names. */
  searchPath: readonly string[];
  /** Whether `sudo -n <allowlisted command>` is permitted. */
  allowSudo: boolean;
}

export interface AuthorizedCommand {
  /** Absolute path handed to execFile/spawn. */
  file: string;
  /** Arguments handed to execFile/spawn, verbatim. */
  args: string[];
  /** The allowlisted program that will run (after stripping `sudo -n`). */
  executable: string;
  /** Whether the command runs through sudo or is classified as privileged. */
  privileged: boolean;
  /** Human-readable argv for logs and persistence. */
  display: string;
}

/**
 * Default allowlist: what the orchestrator's own features and documented API
 * examples use. Deliberately excludes shells and interpreters (sh, bash,
 * python, node, perl), `env`, `xargs`, `find`, `awk`, `git` and `sudo`, which can
 * all run arbitrary code from their arguments. Note that `docker` is
 * root-equivalent on a host where the API can reach the Docker socket.
 */
export const DEFAULT_COMMAND_ALLOWLIST: readonly string[] = [
  'docker',
  'systemctl',
  'journalctl',
  'df',
  'du',
  'free',
  'uptime',
  'ps',
  'ip',
  'ss',
  'ls',
  'echo',
  'date',
  'whoami',
  'hostname',
  'uname',
  'id',
  'pwd',
  'pg_isready',
];

/** Trusted directories used to resolve bare executable names. */
export const DEFAULT_COMMAND_SEARCH_PATH: readonly string[] = [
  '/usr/local/sbin',
  '/usr/local/bin',
  '/usr/sbin',
  '/usr/bin',
  '/sbin',
  '/bin',
];

/** Characters that only make sense to a shell. Rejected in string commands. */
const SHELL_METACHARACTERS = /[;&|$`<>\r\n\0]/;
/** Control characters that are never valid inside an argument. */
const FORBIDDEN_ARG_CHARACTERS = /[\r\n\0]/;
const BARE_NAME = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_ARGS = 256;
const MAX_ARG_LENGTH = 4096;

/** Environment variables a caller may never set for a child process. */
const PROTECTED_ENV_KEYS = new Set([
  'PATH',
  'IFS',
  'ENV',
  'BASH_ENV',
  'SHELLOPTS',
  'BASHOPTS',
  'PS4',
  'PROMPT_COMMAND',
  'GCONV_PATH',
  'HOSTALIASES',
  'NODE_OPTIONS',
  'NODE_PATH',
  'PYTHONPATH',
  'PYTHONSTARTUP',
  'PERL5LIB',
  'PERL5OPT',
  'RUBYOPT',
  'RUBYLIB',
]);
const PROTECTED_ENV_PREFIXES = ['LD_', 'DYLD_'];

/** systemctl/service verbs that only read state. Anything else is privileged. */
const READ_ONLY_SERVICE_VERBS = new Set([
  'status',
  'show',
  'cat',
  'is-active',
  'is-enabled',
  'is-failed',
  'list-units',
  'list-unit-files',
  'list-timers',
  'list-sockets',
  'list-dependencies',
  '--version',
]);

/** Programs whose execution is classified as privileged for audit purposes. */
const PRIVILEGED_PROGRAMS = new Set([
  'shutdown',
  'reboot',
  'poweroff',
  'halt',
  'kill',
  'pkill',
  'killall',
  'rm',
  'dd',
  'mkfs',
  'fdisk',
  'parted',
  'chmod',
  'chown',
  'passwd',
  'useradd',
  'userdel',
  'usermod',
]);

function denied(command: string, reason: string): CommandExecutionError {
  return CommandExecutionError.denied(command, reason);
}

/**
 * Split a command line into argv without invoking a shell.
 *
 * Supports single quotes (fully literal), double quotes (only `\"` and `\\`
 * are escapes) and backslash escapes outside quotes. Any shell metacharacter,
 * quoted or not, is rejected: there is no shell to interpret it, so its
 * presence means the caller expected shell behaviour this API does not offer.
 */
export function tokenizeCommand(input: string): string[] {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw CommandExecutionError.invalidSyntax(String(input ?? ''), 'Command cannot be empty');
  }
  if (SHELL_METACHARACTERS.test(input)) {
    throw denied(input, 'shell metacharacters (; & | $ ` < > newline) are not allowed; send { command, args } instead');
  }

  const tokens: string[] = [];
  let current = '';
  let inToken = false;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i] as string;

    if (quote === "'") {
      if (ch === "'") quote = null;
      else current += ch;
      continue;
    }

    if (quote === '"') {
      if (ch === '"') {
        quote = null;
      } else if (ch === '\\' && (input[i + 1] === '"' || input[i + 1] === '\\')) {
        current += input[i + 1];
        i++;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === ' ' || ch === '\t') {
      if (inToken) {
        tokens.push(current);
        current = '';
        inToken = false;
      }
      continue;
    }

    inToken = true;
    if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === '\\') {
      if (i + 1 >= input.length) {
        throw CommandExecutionError.invalidSyntax(input, 'trailing backslash');
      }
      current += input[i + 1];
      i++;
    } else {
      current += ch;
    }
  }

  if (quote) {
    throw CommandExecutionError.invalidSyntax(input, 'unterminated quote');
  }
  if (inToken) tokens.push(current);
  if (tokens.length === 0) {
    throw CommandExecutionError.invalidSyntax(input, 'Command cannot be empty');
  }
  return tokens;
}

function parseList(value: string, separator: RegExp): string[] {
  return value
    .split(separator)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Read the policy from the environment.
 *
 * - `COMMAND_ALLOWLIST`: comma/space separated executables. When set it
 *   replaces the default list; set it to an empty string to deny everything.
 *   Entries must be bare names or absolute paths; anything else is ignored.
 * - `COMMAND_SEARCH_PATH`: trusted directories (separated by the platform path
 *   delimiter, `:` on Linux) used to resolve bare names.
 * - `ALLOW_SUDO_COMMANDS`: `false` disables the `sudo -n <cmd>` form.
 */
export function getCommandPolicyConfig(env: NodeJS.ProcessEnv = process.env): CommandPolicyConfig {
  const rawAllowlist = env.COMMAND_ALLOWLIST;
  const entries = rawAllowlist === undefined ? [...DEFAULT_COMMAND_ALLOWLIST] : parseList(rawAllowlist, /[\s,]+/);
  const allowlist = new Set(
    entries.filter((entry) => entry !== 'sudo' && (BARE_NAME.test(entry) || isCleanAbsolutePath(entry)))
  );

  const rawSearchPath = env.COMMAND_SEARCH_PATH;
  const searchPath = rawSearchPath
    ? parseList(rawSearchPath, new RegExp(`\\${path.delimiter}`)).filter((dir) => path.isAbsolute(dir))
    : [...DEFAULT_COMMAND_SEARCH_PATH];

  return {
    allowlist,
    searchPath,
    allowSudo: env.ALLOW_SUDO_COMMANDS !== 'false',
  };
}

function isCleanAbsolutePath(candidate: string): boolean {
  if (!path.isAbsolute(candidate)) return false;
  if (candidate.split(/[\\/]/).some((segment) => segment === '..' || segment === '.')) return false;
  return !SHELL_METACHARACTERS.test(candidate);
}

function isExecutableFile(candidate: string): boolean {
  try {
    if (!fs.statSync(candidate).isFile()) return false;
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a bare executable name inside the given trusted directories.
 * Returns null when it is not found there (the caller's PATH is never used).
 */
export function resolveExecutable(
  name: string,
  searchPath: readonly string[] = DEFAULT_COMMAND_SEARCH_PATH
): string | null {
  if (!BARE_NAME.test(name)) return null;
  for (const dir of searchPath) {
    const candidate = path.join(dir, name);
    if (isExecutableFile(candidate)) return candidate;
  }
  return null;
}

/**
 * Check one executable against the allowlist and return its absolute path.
 * Accepts a bare allowlisted name, an absolute path listed verbatim, or the
 * absolute path that an allowlisted bare name resolves to.
 */
function authorizeExecutable(executable: string, original: string, config: CommandPolicyConfig): string {
  if (ENV_ASSIGNMENT.test(executable)) {
    throw denied(original, 'environment assignments (NAME=value cmd) are not allowed');
  }

  if (BARE_NAME.test(executable)) {
    if (!config.allowlist.has(executable)) {
      throw denied(original, `executable "${executable}" is not in the command allowlist`);
    }
    const resolved = resolveExecutable(executable, config.searchPath);
    if (!resolved) {
      throw denied(original, `executable "${executable}" was not found in the trusted directories`);
    }
    return resolved;
  }

  if (!isCleanAbsolutePath(executable)) {
    throw denied(original, `executable "${executable}" must be an allowlisted name or absolute path`);
  }

  if (config.allowlist.has(executable)) {
    if (!isExecutableFile(executable)) {
      throw denied(original, `executable "${executable}" does not exist or is not executable`);
    }
    return executable;
  }

  // `/usr/bin/docker` is fine when `docker` is allowlisted and resolves there;
  // `/tmp/docker` or `/bin/rm` are not.
  const base = path.basename(executable);
  if (config.allowlist.has(base) && resolveExecutable(base, config.searchPath) === executable) {
    return executable;
  }
  throw denied(original, `executable "${executable}" is not in the command allowlist`);
}

function validateArgs(args: unknown, original: string): string[] {
  if (!Array.isArray(args)) {
    throw CommandExecutionError.invalidSyntax(original, 'args must be an array of strings');
  }
  if (args.length > MAX_ARGS) {
    throw CommandExecutionError.invalidSyntax(original, `at most ${MAX_ARGS} arguments are allowed`);
  }
  return args.map((arg) => {
    if (typeof arg !== 'string') {
      throw CommandExecutionError.invalidSyntax(original, 'args must be an array of strings');
    }
    if (arg.length > MAX_ARG_LENGTH) {
      throw CommandExecutionError.invalidSyntax(original, `arguments are limited to ${MAX_ARG_LENGTH} characters`);
    }
    if (FORBIDDEN_ARG_CHARACTERS.test(arg)) {
      throw denied(original, 'arguments may not contain newlines or NUL bytes');
    }
    return arg;
  });
}

/** Render an argv for logs: quote anything that is not a plain word. */
export function formatArgv(argv: readonly string[]): string {
  return argv.map((arg) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, "'\\''")}'`)).join(' ');
}

/** Classify an argv as privileged (sudo, mutating service verbs, destructive tools). */
export function isPrivilegedArgv(argv: readonly string[]): boolean {
  const [first, ...rest] = argv;
  if (!first) return false;
  const program = path.basename(first);
  if (program === 'sudo') return true;
  if (program === 'systemctl' || program === 'service') {
    const verb = program === 'service' ? rest[1] : rest.find((arg) => !arg.startsWith('-')) ?? rest[0];
    return !(verb && READ_ONLY_SERVICE_VERBS.has(verb));
  }
  if (program.startsWith('mkfs')) return true;
  return PRIVILEGED_PROGRAMS.has(program);
}

/**
 * Turn a caller-supplied command into an authorized argv, or throw.
 */
export function authorizeCommand(
  input: CommandInput,
  config: CommandPolicyConfig = getCommandPolicyConfig()
): AuthorizedCommand {
  let argv: string[];
  let original: string;

  if (typeof input === 'string') {
    original = input;
    argv = tokenizeCommand(input);
  } else if (input && typeof input === 'object' && typeof input.command === 'string') {
    const command = input.command.trim();
    original = [command, ...(Array.isArray(input.args) ? input.args.map(String) : [])].join(' ');
    if (!command) {
      throw CommandExecutionError.invalidSyntax(original, 'Command cannot be empty');
    }
    if (/\s/.test(command) || SHELL_METACHARACTERS.test(command)) {
      throw denied(original, 'command must be a single executable name or absolute path when args is used');
    }
    argv = [command, ...validateArgs(input.args ?? [], original)];
  } else {
    throw CommandExecutionError.invalidSyntax(String(input), 'command must be a string or { command, args }');
  }

  let privileged = false;
  let prefix: string[] = [];
  let rest = argv;

  if (argv[0] === 'sudo' || (argv[0] && path.isAbsolute(argv[0]) && path.basename(argv[0]) === 'sudo')) {
    if (!config.allowSudo) {
      throw denied(original, 'sudo commands are disabled (ALLOW_SUDO_COMMANDS=false)');
    }
    rest = argv.slice(1);
    if (rest[0] === '-n') rest = rest.slice(1);
    if (rest[0]?.startsWith('-')) {
      throw denied(original, 'only "sudo -n <command>" is supported; other sudo options are not allowed');
    }
    if (!rest[0]) {
      throw denied(original, 'sudo requires a command');
    }
    const sudoPath = resolveExecutable('sudo', config.searchPath);
    if (!sudoPath) {
      throw denied(original, 'sudo was not found in the trusted directories');
    }
    prefix = [sudoPath, '-n'];
    privileged = true;
  }

  const executable = rest[0] as string;
  const resolved = authorizeExecutable(executable, original, config);
  const args = rest.slice(1);
  privileged = privileged || isPrivilegedArgv([resolved, ...args]);

  const fullArgv = [...prefix, resolved, ...args];
  return {
    file: fullArgv[0] as string,
    args: fullArgv.slice(1),
    executable: path.basename(resolved),
    privileged,
    display: formatArgv(fullArgv),
  };
}

/**
 * Validate caller-supplied environment variables for a child process.
 * Returns a copy containing only string values; throws on protected keys.
 */
export function sanitizeRequestEnv(
  env: Record<string, unknown> | undefined,
  commandForErrors = 'env'
): Record<string, string> | undefined {
  if (env === undefined || env === null) return undefined;
  if (typeof env !== 'object' || Array.isArray(env)) {
    throw CommandExecutionError.invalidSyntax(commandForErrors, 'env must be an object of strings');
  }
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!ENV_KEY.test(key)) {
      throw denied(commandForErrors, `invalid environment variable name "${key}"`);
    }
    const upper = key.toUpperCase();
    if (PROTECTED_ENV_KEYS.has(upper) || PROTECTED_ENV_PREFIXES.some((prefix) => upper.startsWith(prefix))) {
      throw denied(commandForErrors, `environment variable "${key}" cannot be overridden`);
    }
    if (typeof value !== 'string' || FORBIDDEN_ARG_CHARACTERS.test(value)) {
      throw denied(commandForErrors, `environment variable "${key}" must be a single-line string`);
    }
    clean[key] = value;
  }
  return clean;
}

// ----- Validators for internal, fixed-argv callers --------------------------

const SERVICE_NAME = /^[A-Za-z0-9@_][A-Za-z0-9@._:\\-]*$/;
const CONTAINER_REF = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const SIGNAL = /^(SIG)?[A-Z0-9]{1,10}$/i;

/** systemd unit names: letters, digits, `@ . _ : - \`, never a leading dash. */
export function assertServiceName(name: unknown): string {
  if (typeof name !== 'string' || name.length > 256 || !SERVICE_NAME.test(name)) {
    throw CommandExecutionError.invalidSyntax(String(name), 'invalid service name');
  }
  return name;
}

/** Docker container IDs or names. */
export function assertContainerRef(ref: unknown): string {
  if (typeof ref !== 'string' || ref.length > 256 || !CONTAINER_REF.test(ref)) {
    throw CommandExecutionError.invalidSyntax(String(ref), 'invalid container id or name');
  }
  return ref;
}

/** Positive integer process IDs. */
export function assertPid(pid: unknown): number {
  const value = typeof pid === 'string' && /^\d+$/.test(pid) ? Number(pid) : pid;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw CommandExecutionError.invalidSyntax(String(pid), 'invalid pid');
  }
  return value;
}

/** Signal names (TERM, SIGKILL, HUP) or numbers (9, 15). */
export function assertSignal(signal: unknown): string {
  if (typeof signal !== 'string' || !SIGNAL.test(signal)) {
    throw CommandExecutionError.invalidSyntax(String(signal), 'invalid signal');
  }
  return signal;
}

/** Human-readable form of a command input, for persistence and responses. */
export function describeCommandInput(input: CommandInput): string {
  if (typeof input === 'string') return input;
  return formatArgv([input.command, ...(Array.isArray(input.args) ? input.args.map(String) : [])]);
}
