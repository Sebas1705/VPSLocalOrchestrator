import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { executeCommand } from './commandExecutor.js';

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
  const command = `pg_dump ${name} -f ${fullPath}`;

  const started = Date.now();
  const result = await executeCommand(command);
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
  const command = `pg_isready -d ${dbName}`;
  const result = await executeCommand(command);
  return {
    type: 'postgresql',
    name: dbName,
    status: result.exitCode === 0 ? 'ready' : 'unreachable',
    exitCode: result.exitCode,
    output: result.stdout || result.stderr,
  };
}
