import type { Request, Response, NextFunction } from 'express';
import { isValidToken, extractToken } from './auth.js';

/**
 * Middleware que exige autenticación por token para cualquier endpoint.
 * Valida el token en el header Authorization y deniega acceso si es inválido.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @returns Response 401 si no autorizado, o llama a next() si autorizado
 * 
 * @example
 * ```typescript
 * router.post('/protected', requireAuth, (req, res) => {
 *   res.json({ message: 'Access granted' });
 * });
 * ```
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req.headers.authorization);
  console.log('[requireAuth] Ejecutando middleware. Authorization:', req.headers.authorization, 'Token extraído:', token);
  if (!isValidToken(token)) {
    console.log('[requireAuth] Token inválido o ausente.');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Valid API token required for this operation',
    });
  }
  console.log('[requireAuth] Token válido, permitiendo acceso.');
  next();
}
