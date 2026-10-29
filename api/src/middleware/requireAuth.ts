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
export function requireAuth<P>(req: Request<P>, res: Response, next: NextFunction) {
  const token = extractToken(req.headers.authorization);
  if (!isValidToken(token)) {
    // Never log the Authorization header or the token: only whether one was
    // sent. A leaked log line must not be usable as a credential.
    console.warn(
      `[requireAuth] Rejected ${req.method} ${req.originalUrl ?? req.url}: bearer token ${token ? 'present but invalid' : 'absent'}`
    );
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Valid API token required for this operation',
    });
  }
  next();
}
