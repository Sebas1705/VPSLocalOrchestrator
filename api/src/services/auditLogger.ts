import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.join(__dirname, '../../logs');
const AUDIT_LOG_FILE = path.join(LOGS_DIR, 'audit.log');

export interface AuditLog {
  timestamp: string;
  action: string;
  userId?: string;
  ipAddress?: string;
  details: Record<string, any>;
  status: 'success' | 'failure';
  errorMessage?: string;
}

/**
 * Asegura que el directorio de logs existe
 */
async function ensureLogsDir(): Promise<void> {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating logs directory:', error);
  }
}

/**
 * Registra una acción en el log de auditoría
 */
export async function logAction(
  action: string,
  details: Record<string, any>,
  status: 'success' | 'failure' = 'success',
  errorMessage?: string,
  userId?: string,
  ipAddress?: string
): Promise<void> {
  try {
    await ensureLogsDir();

    const log: AuditLog = {
      timestamp: new Date().toISOString(),
      action,
      details,
      status,
    };

    // Agregar campos opcionales solo si existen
    if (userId) log.userId = userId;
    if (ipAddress) log.ipAddress = ipAddress;
    if (errorMessage) log.errorMessage = errorMessage;

    // Append to file (cada línea es un JSON)
    await fs.appendFile(AUDIT_LOG_FILE, JSON.stringify(log) + '\n');
  } catch (error) {
    console.error('Error writing audit log:', error);
  }
}

/**
 * Obtiene todos los logs de auditoría
 */
export async function getLogs(limit?: number): Promise<AuditLog[]> {
  try {
    await ensureLogsDir();

    // Si el archivo no existe, retorna array vacío
    try {
      const content = await fs.readFile(AUDIT_LOG_FILE, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      let logs = lines.map(line => {
        try {
          return JSON.parse(line) as AuditLog;
        } catch {
          return null;
        }
      }).filter((log): log is AuditLog => log !== null);

      // Ordenar por timestamp descendente (más recientes primero)
      logs = logs.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Aplicar límite si se especifica
      if (limit && limit > 0) {
        logs = logs.slice(0, limit);
      }

      return logs;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  } catch (error) {
    console.error('Error reading audit logs:', error);
    return [];
  }
}

/**
 * Busca logs por criterios
 */
export async function searchLogs(
  query: {
    action?: string;
    status?: 'success' | 'failure';
    startDate?: string; // ISO string
    endDate?: string; // ISO string
    limit?: number;
  } = {}
): Promise<AuditLog[]> {
  try {
    const allLogs = await getLogs();

    let filtered = allLogs;

    // Filtrar por acción
    if (query.action) {
      filtered = filtered.filter(log =>
        log.action.toLowerCase().includes(query.action!.toLowerCase())
      );
    }

    // Filtrar por estado
    if (query.status) {
      filtered = filtered.filter(log => log.status === query.status);
    }

    // Filtrar por rango de fechas
    if (query.startDate) {
      const startTime = new Date(query.startDate).getTime();
      filtered = filtered.filter(log =>
        new Date(log.timestamp).getTime() >= startTime
      );
    }

    if (query.endDate) {
      const endTime = new Date(query.endDate).getTime();
      filtered = filtered.filter(log =>
        new Date(log.timestamp).getTime() <= endTime
      );
    }

    // Aplicar límite
    if (query.limit && query.limit > 0) {
      filtered = filtered.slice(0, query.limit);
    }

    return filtered;
  } catch (error) {
    console.error('Error searching audit logs:', error);
    return [];
  }
}

/**
 * Limpia logs antiguos (más viejos que N días)
 */
export async function cleanOldLogs(daysToKeep: number = 30): Promise<number> {
  try {
    const allLogs = await getLogs();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const recentLogs = allLogs.filter(log =>
      new Date(log.timestamp) > cutoffDate
    );

    if (recentLogs.length < allLogs.length) {
      await ensureLogsDir();
      const logsContent = recentLogs.map(log => JSON.stringify(log)).join('\n');
      await fs.writeFile(AUDIT_LOG_FILE, logsContent + '\n');
      return allLogs.length - recentLogs.length;
    }

    return 0;
  } catch (error) {
    console.error('Error cleaning old audit logs:', error);
    return 0;
  }
}
