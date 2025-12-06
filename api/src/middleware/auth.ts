import crypto from 'crypto';
import { getConfig } from '../config/index.js';

const config = getConfig();

// Token desde configuración
export const API_TOKEN = config.security.apiToken;

export interface AuthConfig {
  requiresAuth: boolean;
  allowedTokens: string[];
}

/**
 * Valida si un token es válido
 */
export function isValidToken(token: string | undefined): boolean {
  if (!token) return false;
  
  // Comparación segura para evitar timing attacks
  const providedToken = Buffer.from(token, 'utf-8');
  const validToken = Buffer.from(API_TOKEN, 'utf-8');
  
  if (providedToken.length !== validToken.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(providedToken, validToken);
}

/**
 * Extrae el token del header Authorization
 */
export function extractToken(authHeader: string | undefined): string | undefined {
  if (!authHeader) return undefined;
  
  // Soporta "Bearer TOKEN" o solo "TOKEN"
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return authHeader;
}

/**
 * Lista de comandos que requieren autenticación
 */
export const PRIVILEGED_COMMANDS = [
  /^sudo\s+/,
  /^systemctl\s+/,
  /^service\s+/,
  /^rm\s+-rf/,
  /^shutdown/,
  /^reboot/,
  /^poweroff/,
  /^halt/,
  /^kill\s+-9/,
  /^pkill/,
  /^dd\s+/,
  /^mkfs/,
  /^fdisk/,
  /^parted/,
  /^chmod\s+/,
  /^chown\s+/,
  /^passwd/,
  /^userdel/,
  /^useradd/,
];

/**
 * Verifica si un comando requiere privilegios
 */
export function requiresPrivileges(command: string): boolean {
  const trimmedCommand = command.trim();
  return PRIVILEGED_COMMANDS.some(pattern => pattern.test(trimmedCommand));
}
