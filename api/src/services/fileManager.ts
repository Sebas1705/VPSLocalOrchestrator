import fs from 'fs/promises';
import path from 'path';
import os from 'os';

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

/**
 * Valida que el path no escape del directorio base permitido
 * Solo permite acceso dentro de /home/*, /tmp/, /var/log
 */
function validatePath(filePath: string): boolean {
  try {
    const resolved = path.resolve(filePath);
    const home = os.homedir();
    
    // Permitir directorios seguros
    const allowedPrefixes = [
      home,              // /home/usuario
      '/tmp',
      '/var/log',
      '/var/tmp',
    ];

    const isAllowed = allowedPrefixes.some(prefix => 
      resolved === prefix || resolved.startsWith(prefix + path.sep)
    );

    if (!isAllowed) {
      return false;
    }

    // Evitar path traversal
    if (resolved.includes('..')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Lee el contenido de un archivo
 */
export async function readFile(filePath: string): Promise<FileReadResult> {
  try {
    if (!validatePath(filePath)) {
      throw new Error('Path access denied: must be in /home, /tmp, or /var/log');
    }

    const resolved = path.resolve(filePath);
    const stats = await fs.stat(resolved);

    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }

    // Limitar tamaño de lectura (10MB)
    if (stats.size > 10 * 1024 * 1024) {
      throw new Error('File too large (max 10MB)');
    }

    const content = await fs.readFile(resolved, 'utf-8');

    return {
      path: resolved,
      content,
      size: stats.size,
      type: content.length === Buffer.byteLength(content) ? 'text' : 'binary',
    };
  } catch (error: any) {
    throw new Error(`Failed to read file: ${error.message}`);
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
    if (!validatePath(filePath)) {
      throw new Error('Path access denied: must be in /home, /tmp, or /var/log');
    }

    // Limitar tamaño de escritura (50MB)
    if (Buffer.byteLength(content) > 50 * 1024 * 1024) {
      throw new Error('Content too large (max 50MB)');
    }

    const resolved = path.resolve(filePath);

    // Crear directorio padre si no existe
    const dir = path.dirname(resolved);
    await fs.mkdir(dir, { recursive: true });

    if (options?.append) {
      await fs.appendFile(resolved, content, 'utf-8');
    } else {
      await fs.writeFile(resolved, content, 'utf-8');
    }

    // Set permisos si se especifican
    if (options?.mode) {
      await fs.chmod(resolved, options.mode);
    }

    const stats = await fs.stat(resolved);

    return {
      path: resolved,
      size: stats.size,
      written: Buffer.byteLength(content),
    };
  } catch (error: any) {
    throw new Error(`Failed to write file: ${error.message}`);
  }
}

/**
 * Elimina un archivo
 */
export async function deleteFile(filePath: string): Promise<{ path: string; deleted: boolean }> {
  try {
    if (!validatePath(filePath)) {
      throw new Error('Path access denied: must be in /home, /tmp, or /var/log');
    }

    const resolved = path.resolve(filePath);
    const stats = await fs.stat(resolved);

    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }

    await fs.unlink(resolved);

    return {
      path: resolved,
      deleted: true,
    };
  } catch (error: any) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Lista contenido de un directorio
 */
export async function listDirectory(dirPath: string): Promise<DirectoryListing> {
  try {
    if (!validatePath(dirPath)) {
      throw new Error('Path access denied: must be in /home, /tmp, or /var/log');
    }

    const resolved = path.resolve(dirPath);
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
          const entryStats = await fs.stat(fullPath);
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
    throw new Error(`Failed to list directory: ${error.message}`);
  }
}

/**
 * Crea un directorio
 */
export async function createDirectory(dirPath: string): Promise<{ path: string; created: boolean }> {
  try {
    if (!validatePath(dirPath)) {
      throw new Error('Path access denied: must be in /home, /tmp, or /var/log');
    }

    const resolved = path.resolve(dirPath);

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
    throw new Error(`Failed to create directory: ${error.message}`);
  }
}

/**
 * Obtiene información sobre un archivo o directorio
 */
export async function getFileStats(filePath: string): Promise<FileInfo> {
  try {
    if (!validatePath(filePath)) {
      throw new Error('Path access denied: must be in /home, /tmp, or /var/log');
    }

    const resolved = path.resolve(filePath);
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
    throw new Error(`Failed to get file stats: ${error.message}`);
  }
}

/**
 * Elimina un directorio vacío
 */
export async function deleteDirectory(dirPath: string): Promise<{ path: string; deleted: boolean }> {
  try {
    if (!validatePath(dirPath)) {
      throw new Error('Path access denied: must be in /home, /tmp, or /var/log');
    }

    const resolved = path.resolve(dirPath);
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
    throw new Error(`Failed to delete directory: ${error.message}`);
  }
}
