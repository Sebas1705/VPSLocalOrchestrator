import { type Request, type Response, type NextFunction } from 'express';

/**
 * Middleware para validar que la petición viene de localhost.
 * Rechaza todas las peticiones que no originen desde 127.0.0.1, ::1, o localhost.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * @returns Response 403 si no es localhost, o llama a next() si es local
 * 
 * @example
 * ```typescript
 * app.use(localhostOnly); // Aplicar a todas las rutas
 * ```
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
 * Middleware para logging de requests HTTP.
 * Registra timestamp, método HTTP, URL y dirección IP del cliente.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 * 
 * @example
 * ```typescript
 * app.use(requestLogger); // Log all requests
 * ```
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
 * Middleware para validar el body de peticiones que contienen comandos.
 * Verifica que el comando existe, es un string válido, no está vacío y no excede el tamaño máximo.
 * 
 * @param req - Express request object con req.body.command
 * @param res - Express response object
 * @param next - Express next function
 * @returns Response 400/413 si validación falla, o llama a next() si es válido
 * 
 * @example
 * ```typescript
 * router.post('/command/execute', validateCommandBody, async (req, res) => {
 *   // req.body.command is guaranteed to be valid
 * });
 * ```
 */
export function validateCommandBody(req: Request, res: Response, next: NextFunction) {
  const { command } = req.body;
  const MAX_COMMAND_LENGTH = 10000; // Máximo 10KB para prevenir DoS

  if (!command || typeof command !== 'string') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Command is required and must be a string',
    });
  }

  const trimmedCommand = command.trim();
  
  if (trimmedCommand.length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Command cannot be empty',
    });
  }
  
  if (trimmedCommand.length > MAX_COMMAND_LENGTH) {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: `Command exceeds maximum length of ${MAX_COMMAND_LENGTH} characters`,
    });
  }

  next();
}

/**
 * Middleware global para manejo de errores.
 * Captura errores no manejados y retorna respuesta JSON apropiada.
 * En producción oculta detalles del error; en desarrollo muestra stack trace.
 * 
 * @param err - Error object capturado
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function (no utilizado)
 * @returns Response 500 con mensaje de error apropiado al entorno
 * 
 * @example
 * ```typescript
 * app.use(errorHandler); // Must be last middleware
 * ```
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Log error para debugging (nunca loguear mensaje completo en producción)
  if (isProduction) {
    // En producción, loguear mínimamente
    console.error('Internal Server Error');
  } else {
    // En desarrollo, loguear más detalles
    console.error('Error:', err.message, err.stack);
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: isProduction ? 'An unexpected error occurred' : err.message,
  });
}
