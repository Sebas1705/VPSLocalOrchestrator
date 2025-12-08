/**
 * Auth Domain Errors
 *
 * Domain-specific exceptions for authentication and authorization.
 */

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

export class InvalidTokenError extends AuthError {
  constructor(message: string = 'Invalid or expired token', details?: Record<string, unknown>) {
    super('INVALID_TOKEN_ERROR', message, details);
    this.name = 'InvalidTokenError';
  }
}

export class TokenExpiredError extends AuthError {
  constructor(message: string = 'Token has expired', details?: Record<string, unknown>) {
    super('TOKEN_EXPIRED_ERROR', message, details);
    this.name = 'TokenExpiredError';
  }
}

export class InsufficientPermissionsError extends AuthError {
  constructor(
    message: string = 'Insufficient permissions',
    details?: Record<string, unknown>
  ) {
    super('INSUFFICIENT_PERMISSIONS_ERROR', message, details);
    this.name = 'InsufficientPermissionsError';
  }
}

export class UnauthorizedAccessError extends AuthError {
  constructor(message: string = 'Unauthorized access', details?: Record<string, unknown>) {
    super('UNAUTHORIZED_ACCESS_ERROR', message, details);
    this.name = 'UnauthorizedAccessError';
  }
}
