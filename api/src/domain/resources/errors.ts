/**
 * Resources Domain Errors
 *
 * Domain-specific exceptions for resource monitoring and reporting.
 */

export class ResourceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ResourceError';
    Object.setPrototypeOf(this, ResourceError.prototype);
  }
}

export class ResourceCollectionError extends ResourceError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('RESOURCE_COLLECTION_ERROR', message, details);
    this.name = 'ResourceCollectionError';
  }
}

export class ProcessNotFoundError extends ResourceError {
  constructor(pid: number, details?: Record<string, unknown>) {
    super('PROCESS_NOT_FOUND_ERROR', `Process with PID ${pid} not found`, details);
    this.name = 'ProcessNotFoundError';
  }
}

export class InvalidProcessOperationError extends ResourceError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_PROCESS_OPERATION_ERROR', message, details);
    this.name = 'InvalidProcessOperationError';
  }
}
