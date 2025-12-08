/**
 * Command Domain Errors
 *
 * Domain-specific exceptions for command execution, validation, and lifecycle.
 * No framework/transport details here—keep domain-agnostic.
 */

export class CommandError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CommandError';
    Object.setPrototypeOf(this, CommandError.prototype);
  }
}

export class CommandValidationError extends CommandError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('COMMAND_VALIDATION_ERROR', message, details);
    this.name = 'CommandValidationError';
  }
}

export class CommandExecutionError extends CommandError {
  constructor(
    message: string,
    public readonly exitCode?: number,
    details?: Record<string, unknown>
  ) {
    super('COMMAND_EXECUTION_ERROR', message, details);
    this.name = 'CommandExecutionError';
  }
}

export class CommandTimeoutError extends CommandError {
  constructor(
    message: string,
    public readonly timeout: number,
    details?: Record<string, unknown>
  ) {
    super('COMMAND_TIMEOUT_ERROR', message, details);
    this.name = 'CommandTimeoutError';
  }
}

export class CommandNotFoundError extends CommandError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('COMMAND_NOT_FOUND_ERROR', message, details);
    this.name = 'CommandNotFoundError';
  }
}

export class PermissionDeniedError extends CommandError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('PERMISSION_DENIED_ERROR', message, details);
    this.name = 'PermissionDeniedError';
  }
}
