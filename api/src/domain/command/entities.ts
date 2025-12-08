/**
 * Command Domain Entities and Value Objects
 *
 * Core domain models for command execution. These are independent
 * of HTTP, databases, or any framework.
 */

/**
 * Command: Immutable value object representing a shell command.
 */
export class Command {
  constructor(
    public readonly value: string,
    public readonly timeout: number = 30000, // ms
    public readonly workingDir: string = '/tmp'
  ) {
    if (!value || value.trim().length === 0) {
      throw new Error('Command value cannot be empty');
    }
    if (timeout <= 0) {
      throw new Error('Timeout must be positive');
    }
  }

  isPrivileged(): boolean {
    return this.value.trim().startsWith('sudo ');
  }

  static create(value: string, timeout?: number, workingDir?: string): Command {
    return new Command(value, timeout, workingDir);
  }
}

/**
 * CommandExecution: Entity tracking a single command invocation.
 */
export class CommandExecution {
  public readonly id: string;
  public readonly startedAt: Date;
  public endedAt?: Date;
  public stdout: string = '';
  public stderr: string = '';
  public exitCode?: number;
  public status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' = 'pending';

  constructor(
    id: string,
    public readonly command: Command,
    public readonly userId: string
  ) {
    this.id = id;
    this.startedAt = new Date();
  }

  start(): void {
    this.status = 'running';
  }

  complete(exitCode: number, stdout: string, stderr: string): void {
    this.status = exitCode === 0 ? 'completed' : 'failed';
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
    this.endedAt = new Date();
  }

  timeout(): void {
    this.status = 'timeout';
    this.endedAt = new Date();
  }

  getDuration(): number {
    const end = this.endedAt || new Date();
    return end.getTime() - this.startedAt.getTime();
  }

  isSuccess(): boolean {
    return this.status === 'completed' && this.exitCode === 0;
  }
}

/**
 * CommandResult: Immutable value object with execution outcome.
 */
export class CommandResult {
  constructor(
    public readonly exitCode: number,
    public readonly stdout: string,
    public readonly stderr: string,
    public readonly durationMs: number
  ) {}

  isSuccess(): boolean {
    return this.exitCode === 0;
  }

  static success(stdout: string, durationMs: number): CommandResult {
    return new CommandResult(0, stdout, '', durationMs);
  }

  static failure(exitCode: number, stderr: string, durationMs: number): CommandResult {
    return new CommandResult(exitCode, '', stderr, durationMs);
  }
}
