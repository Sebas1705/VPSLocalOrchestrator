import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { runProcess } from './commandExecutor.js';
import { formatArgv } from './commandPolicy.js';

const ALLOWED_PREFIXES = [os.homedir(), '/tmp', '/var/tmp'];

function validatePath(target: string): string {
  const resolved = path.resolve(target);
  const allowed = ALLOWED_PREFIXES.some(prefix =>
    resolved === prefix || resolved.startsWith(prefix + path.sep)
  );
  if (!allowed || resolved.includes('..')) {
    throw new Error('Destination access denied: must be in home, /tmp, or /var/tmp');
  }
  return resolved;
}

async function ensureDir(target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
}

function timestampName(base: string): string {
  const safeBase = base.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '') || 'db';
  return `${safeBase}-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
}

export type DatabaseType = 'postgresql';

export interface BackupResult {
  type: DatabaseType;
  name: string;
  path: string;
  createdAt: string;
  durationMs: number;
  command: string;
}

export interface StatusResult {
  type: DatabaseType;
  name: string;
  status: 'ready' | 'unreachable';
  exitCode: number;
  output: string;
}

/** PostgreSQL database names: no leading dash (option injection), no control characters. */
function assertDatabaseName(name: string): void {
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.$-]{0,62}$/.test(name)) {
    throw new Error('invalid database name');
  }
}

function assertSupported(type: string): asserts type is DatabaseType {
  if (type !== 'postgresql') {
    throw new Error('Only postgresql is supported currently');
  }
}

export async function backupDatabase(type: string, name: string, destination?: string): Promise<BackupResult> {
  assertSupported(type);
  if (!name || typeof name !== 'string') {
    throw new Error('database name is required');
  }

  const destDir = validatePath(destination || path.join(os.tmpdir(), 'db-backups'));
  await ensureDir(destDir);

  const filename = timestampName(name);
  const fullPath = path.join(destDir, filename);
  assertDatabaseName(name);
  const argv = [name, '-f', fullPath];
  const command = formatArgv(['pg_dump', ...argv]);

  const started = Date.now();
  const result = await runProcess('pg_dump', argv);
  const durationMs = Date.now() - started;

  if (result.exitCode !== 0) {
    const msg = result.stderr || result.stdout || 'pg_dump failed';
    throw new Error(msg);
  }

  return {
    type: 'postgresql',
    name,
    path: fullPath,
    createdAt: new Date().toISOString(),
    durationMs,
    command,
  };
}

export async function databaseStatus(type: string, name?: string): Promise<StatusResult> {
  assertSupported(type);
  const dbName = name && typeof name === 'string' ? name : 'postgres';
  assertDatabaseName(dbName);
  const result = await runProcess('pg_isready', ['-d', dbName]);
  return {
    type: 'postgresql',
    name: dbName,
    status: result.exitCode === 0 ? 'ready' : 'unreachable',
    exitCode: result.exitCode,
    output: result.stdout || result.stderr,
  };
}
