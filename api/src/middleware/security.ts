import { type Request, type Response, type NextFunction } from 'express';

/**
 * Middleware para validar que la petición viene de localhost
 */
export function localhostOnly(req: Request, res: Response, next: NextFunction) {
  const clientIp = req.ip || req.socket.remoteAddress;
  
  // Verificar si la IP es localhost
  const isLocalhost = 
    clientIp === '127.0.0.1' ||
    clientIp === '::1' ||
    clientIp === '::ffff:127.0.0.1' ||
    clientIp === 'localhost';

  if (!isLocalhost) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This API is only accessible from localhost',
    });
  }

  next();
}

/**
 * Middleware para logging de requests
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.socket.remoteAddress;

  console.log(`[${timestamp}] ${method} ${url} - ${ip}`);
  next();
}

/**
 * Middleware para validar body de comandos
 */
export function validateCommandBody(req: Request, res: Response, next: NextFunction) {
  const { command } = req.body;

  if (!command || typeof command !== 'string') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Command is required and must be a string',
    });
  }

  if (command.trim().length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Command cannot be empty',
    });
  }

  next();
}

/**
 * Middleware global para manejo de errores
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', err);

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
}
