import { constants as fsConstants } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { PathAccessDeniedError, resolveAllowedEntry, resolveAllowedPath } from './pathPolicy.js';

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size?: number;
  modified?: string;
  permissions?: string;
}

export interface FileReadResult {
  path: string;
  content: string;
  size: number;
  type: 'text' | 'binary';
}

export interface DirectoryListing {
  path: string;
  files: FileInfo[];
  totalSize?: number;
}

/** Refuse a symlink swapped in as the last component after the path was checked. */
const O_NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0;

/** Keep the policy error as it is so routes can answer 403; wrap everything else. */
function wrapError(prefix: string, error: any): Error {
  if (error instanceof PathAccessDeniedError) return error;
  return new Error(`${prefix}: ${error.message}`);
}

/**
 * Lee el contenido de un archivo
 */
export async function readFile(filePath: string): Promise<FileReadResult> {
  try {
    const resolved = await resolveAllowedPath(filePath);
    const stats = await fs.stat(resolved);

    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }

    // Limitar tamaño de lectura (10MB)
    if (stats.size > 10 * 1024 * 1024) {
      throw new Error('File too large (max 10MB)');
    }

    const handle = await fs.open(resolved, fsConstants.O_RDONLY | O_NOFOLLOW);
    let content: string;
    try {
      content = await handle.readFile('utf-8');
    } finally {
      await handle.close();
    }

    return {
      path: resolved,
      content,
      size: stats.size,
      type: content.length === Buffer.byteLength(content) ? 'text' : 'binary',
    };
  } catch (error: any) {
    throw wrapError('Failed to read file', error);
  }
}

/**
 * Escribe contenido en un archivo
 */
export async function writeFile(
  filePath: string,
  content: string,
  options?: { mode?: number; append?: boolean }
): Promise<{ path: string; size: number; written: number }> {
  try {
    // Limitar tamaño de escritura (50MB)
    if (Buffer.byteLength(content) > 50 * 1024 * 1024) {
      throw new Error('Content too large (max 50MB)');
    }

    const resolved = await resolveAllowedPath(filePath);

    // Crear directorio padre si no existe
    await fs.mkdir(path.dirname(resolved), { recursive: true });

    const mode = options?.append ? fsConstants.O_APPEND : fsConstants.O_TRUNC;
    const handle = await fs.open(resolved, fsConstants.O_WRONLY | fsConstants.O_CREAT | mode | O_NOFOLLOW, 0o644);
    let size: number;
    try {
      await handle.writeFile(content, 'utf-8');

      // Set permisos si se especifican
      if (options?.mode) {
        await handle.chmod(options.mode);
      }

      size = (await handle.stat()).size;
    } finally {
      await handle.close();
    }

    return {
      path: resolved,
      size,
      written: Buffer.byteLength(content),
    };
  } catch (error: any) {
    throw wrapError('Failed to write file', error);
  }
}

/**
 * Elimina un archivo
 */
export async function deleteFile(filePath: string): Promise<{ path: string; deleted: boolean }> {
  try {
    const resolved = await resolveAllowedEntry(filePath);
    const stats = await fs.lstat(resolved);

    if (!stats.isFile() && !stats.isSymbolicLink()) {
      throw new Error('Path is not a file');
    }

    await fs.unlink(resolved);

    return {
      path: resolved,
      deleted: true,
    };
  } catch (error: any) {
    throw wrapError('Failed to delete file', error);
  }
}

/**
 * Lista contenido de un directorio
 */
export async function listDirectory(dirPath: string): Promise<DirectoryListing> {
  try {
    const resolved = await resolveAllowedPath(dirPath);
    const stats = await fs.stat(resolved);

    if (!stats.isDirectory()) {
      throw new Error('Path is not a directory');
    }

    const entries = await fs.readdir(resolved, { withFileTypes: true });
    let totalSize = 0;

    const files: FileInfo[] = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(resolved, entry.name);
        try {
          const entryStats = await fs.lstat(fullPath);
          const type = entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file';

          if (type === 'file') {
            totalSize += entryStats.size;
          }

          return {
            name: entry.name,
            path: fullPath,
            type,
            size: entryStats.size,
            modified: entryStats.mtime.toISOString(),
            permissions: entryStats.mode.toString(8).slice(-3),
          };
        } catch {
          return {
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'directory' : 'file',
          };
        }
      })
    );

    // Ordenar: directorios primero, luego archivos alfabéticamente
    files.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });

    const listing: DirectoryListing = {
      path: resolved,
      files,
    };

    if (totalSize > 0) {
      listing.totalSize = totalSize;
    }

    return listing;
  } catch (error: any) {
    throw wrapError('Failed to list directory', error);
  }
}

/**
 * Crea un directorio
 */
export async function createDirectory(dirPath: string): Promise<{ path: string; created: boolean }> {
  try {
    const resolved = await resolveAllowedPath(dirPath);

    try {
      await fs.mkdir(resolved, { recursive: true });
      return {
        path: resolved,
        created: true,
      };
    } catch (error: any) {
      if (error.code === 'EEXIST') {
        return {
          path: resolved,
          created: false,
        };
      }
      throw error;
    }
  } catch (error: any) {
    throw wrapError('Failed to create directory', error);
  }
}

/**
 * Obtiene información sobre un archivo o directorio
 */
export async function getFileStats(filePath: string): Promise<FileInfo> {
  try {
    const resolved = await resolveAllowedPath(filePath);
    const stats = await fs.stat(resolved);

    const type = stats.isDirectory() ? 'directory' : stats.isSymbolicLink() ? 'symlink' : 'file';

    return {
      name: path.basename(resolved),
      path: resolved,
      type,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      permissions: stats.mode.toString(8).slice(-3),
    };
  } catch (error: any) {
    throw wrapError('Failed to get file stats', error);
  }
}

/**
 * Elimina un directorio vacío
 */
export async function deleteDirectory(dirPath: string): Promise<{ path: string; deleted: boolean }> {
  try {
    const resolved = await resolveAllowedPath(dirPath);
    const stats = await fs.stat(resolved);

    if (!stats.isDirectory()) {
      throw new Error('Path is not a directory');
    }

    await fs.rmdir(resolved);

    return {
      path: resolved,
      deleted: true,
    };
  } catch (error: any) {
    throw wrapError('Failed to delete directory', error);
  }
}
