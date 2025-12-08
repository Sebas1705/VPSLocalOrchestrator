/**
 * Services Domain Entities and Value Objects
 *
 * Core models for system service management.
 */

export type ServiceStatus = 'active' | 'inactive' | 'failed' | 'restarting' | 'unknown';
export type ServiceType = 'systemd' | 'docker' | 'custom';

/**
 * Service: Entity representing a managed service.
 */
export class Service {
  constructor(
    public readonly name: string,
    public readonly type: ServiceType,
    public status: ServiceStatus = 'unknown',
    public lastChecked: Date = new Date(),
    public metadata?: Record<string, unknown>
  ) {}

  isRunning(): boolean {
    return this.status === 'active';
  }

  isFailed(): boolean {
    return this.status === 'failed';
  }

  static create(
    name: string,
    type: ServiceType,
    status?: ServiceStatus,
    metadata?: Record<string, unknown>
  ): Service {
    return new Service(name, type, status, new Date(), metadata);
  }
}

/**
 * ServiceEvent: Value object for service lifecycle events.
 */
export class ServiceEvent {
  constructor(
    public readonly serviceName: string,
    public readonly eventType: 'started' | 'stopped' | 'restarted' | 'failed',
    public readonly timestamp: Date,
    public readonly details?: string
  ) {}

  static started(serviceName: string, details?: string): ServiceEvent {
    return new ServiceEvent(serviceName, 'started', new Date(), details);
  }

  static stopped(serviceName: string, details?: string): ServiceEvent {
    return new ServiceEvent(serviceName, 'stopped', new Date(), details);
  }

  static restarted(serviceName: string, details?: string): ServiceEvent {
    return new ServiceEvent(serviceName, 'restarted', new Date(), details);
  }

  static failed(serviceName: string, details?: string): ServiceEvent {
    return new ServiceEvent(serviceName, 'failed', new Date(), details);
  }
}

/**
 * ServiceHealth: Value object representing service health status.
 */
export class ServiceHealth {
  constructor(
    public readonly serviceName: string,
    public readonly isHealthy: boolean,
    public readonly uptime?: number, // seconds
    public readonly lastRestart?: Date,
    public readonly restartCount: number = 0
  ) {}

  static healthy(serviceName: string, uptime?: number): ServiceHealth {
    return new ServiceHealth(serviceName, true, uptime);
  }

  static unhealthy(serviceName: string, restartCount: number = 0): ServiceHealth {
    return new ServiceHealth(serviceName, false, undefined, undefined, restartCount);
  }
}
