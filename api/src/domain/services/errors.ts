/**
 * Services Domain Errors
 *
 * Domain-specific exceptions for service management.
 */

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ServiceError';
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}

export class ServiceNotFoundError extends ServiceError {
  constructor(serviceName: string, details?: Record<string, unknown>) {
    super('SERVICE_NOT_FOUND_ERROR', `Service '${serviceName}' not found`, details);
    this.name = 'ServiceNotFoundError';
  }
}

export class ServiceOperationError extends ServiceError {
  constructor(
    serviceName: string,
    operation: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(
      'SERVICE_OPERATION_ERROR',
      `Failed to ${operation} service '${serviceName}': ${message}`,
      details
    );
    this.name = 'ServiceOperationError';
  }
}

export class InvalidServiceStateError extends ServiceError {
  constructor(serviceName: string, state: string, details?: Record<string, unknown>) {
    super(
      'INVALID_SERVICE_STATE_ERROR',
      `Service '${serviceName}' is in invalid state: ${state}`,
      details
    );
    this.name = 'InvalidServiceStateError';
  }
}
