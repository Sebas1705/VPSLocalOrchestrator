import crypto from 'crypto';
import { getConfig } from '../config/index.js';
import { isPrivilegedArgv, tokenizeCommand } from '../services/commandPolicy.js';

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
 * Classify a command as privileged (sudo, mutating systemctl/service verbs,
 * destructive tools such as rm, dd, kill, shutdown).
 *
 * This is a classification helper, not a security control: commands are
 * authorized by the allowlist in services/commandPolicy.ts and always run
 * without a shell. The former regex denylist (PRIVILEGED_COMMANDS) was
 * trivially bypassable (`/bin/rm -rf`, `x; rm -rf`, `$(...)`) and was removed.
 */
export function requiresPrivileges(command: string): boolean {
  try {
    return isPrivilegedArgv(tokenizeCommand(command));
  } catch {
    // Input the tokenizer rejects (metacharacters, bad quoting) is treated as
    // privileged; the command policy denies it anyway.
    return true;
  }
}
