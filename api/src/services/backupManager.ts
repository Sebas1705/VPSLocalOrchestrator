import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { API_ROOT } from '../config/paths.js';
import { resolveAllowedPath } from './pathPolicy.js';

const STORAGE_DIR = path.join(API_ROOT, 'backups');

export interface BackupMetadata {
  name: string;
  path: string;
  size: number;
  createdAt: string;
}

export interface RestoreResult {
  name: string;
  destination: string;
  restoredAt: string;
}

async function ensureDirectory(targetDir: string): Promise<void> {
  await fs.mkdir(targetDir, { recursive: true });
}

function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || `backup-${Date.now()}`;
}

async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function createBackup(paths: string[], name?: string): Promise<BackupMetadata> {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('paths array is required');
  }

  // Validar paths
  const resolvedPaths: string[] = [];
  for (const p of paths) {
    if (typeof p !== 'string' || p.trim() === '') {
      throw new Error('each path must be a non-empty string');
    }
    const resolved = await resolveAllowedPath(p);
    try {
      await fs.stat(resolved);
    } catch {
      throw new Error(`Path not found: ${p}`);
    }
    resolvedPaths.push(resolved);
  }

  await ensureStorageDir();

  const safeName = sanitizeName(name || `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const archivePath = path.join(STORAGE_DIR, `${safeName}.tar.gz`);

  await new Promise<void>((resolve, reject) => {
    const tar = spawn('tar', ['-czf', archivePath, ...resolvedPaths], {
      stdio: 'inherit',
    });

    tar.on('error', (err) => reject(new Error(`tar execution failed: ${err.message}`)));
    tar.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tar exited with code ${code}`));
    });
  });

  const stats = await fs.stat(archivePath);

  return {
    name: `${safeName}.tar.gz`,
    path: archivePath,
    size: stats.size,
    createdAt: stats.birthtime.toISOString(),
  };
}

export async function listBackups(): Promise<BackupMetadata[]> {
  await ensureStorageDir();
  const entries = await fs.readdir(STORAGE_DIR, { withFileTypes: true });
  const backups: BackupMetadata[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.tar.gz')) continue;
    const fullPath = path.join(STORAGE_DIR, entry.name);
    const stats = await fs.stat(fullPath);
    backups.push({
      name: entry.name,
      path: fullPath,
      size: stats.size,
      createdAt: stats.birthtime.toISOString(),
    });
  }

  backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return backups;
}

export async function getBackupPath(name: string): Promise<string> {
  const safeName = sanitizeName(name.replace(/\.tar\.gz$/, '')) + '.tar.gz';
  const target = path.join(STORAGE_DIR, safeName);
  if (!(await fileExists(target))) {
    throw new Error('Backup not found');
  }
  return target;
}

export async function getBackupMeta(name: string): Promise<BackupMetadata> {
  const backupPath = await getBackupPath(name);
  const stats = await fs.stat(backupPath);
  return {
    name: path.basename(backupPath),
    path: backupPath,
    size: stats.size,
    createdAt: stats.birthtime.toISOString(),
  };
}

export async function deleteBackup(name: string): Promise<boolean> {
  const backupPath = await getBackupPath(name);
  await fs.unlink(backupPath);
  return true;
}

export async function restoreBackup(name: string, destination: string): Promise<RestoreResult> {
  if (!destination || typeof destination !== 'string') {
    throw new Error('destination is required');
  }

  const destResolved = await resolveAllowedPath(destination);
  await ensureDirectory(destResolved);

  const backupPath = await getBackupPath(name);

  await new Promise<void>((resolve, reject) => {
    const tar = spawn('tar', ['-xzf', backupPath, '-C', destResolved], {
      stdio: 'inherit',
    });

    tar.on('error', (err) => reject(new Error(`tar execution failed: ${err.message}`)));
    tar.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tar exited with code ${code}`));
    });
  });

  return {
    name: path.basename(backupPath),
    destination: destResolved,
    restoredAt: new Date().toISOString(),
  };
}
