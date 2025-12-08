/**
 * Resources Domain Entities and Value Objects
 *
 * Core models for system resource monitoring.
 */

/**
 * SystemResources: Value object capturing current system state.
 */
export class SystemResources {
  constructor(
    public readonly cpu: CPUMetrics,
    public readonly memory: MemoryMetrics,
    public readonly disk: DiskMetrics,
    public readonly uptime: number, // seconds
    public readonly timestamp: Date
  ) {}
}

/**
 * CPUMetrics: CPU usage breakdown.
 */
export class CPUMetrics {
  constructor(
    public readonly user: number, // %
    public readonly system: number, // %
    public readonly idle: number, // %
    public readonly cores: number
  ) {}

  get total(): number {
    return this.user + this.system;
  }
}

/**
 * MemoryMetrics: Memory usage breakdown.
 */
export class MemoryMetrics {
  constructor(
    public readonly total: number, // bytes
    public readonly used: number, // bytes
    public readonly free: number, // bytes
    public readonly available: number // bytes
  ) {}

  get usagePercent(): number {
    return this.total > 0 ? (this.used / this.total) * 100 : 0;
  }
}

/**
 * DiskMetrics: Disk usage breakdown.
 */
export class DiskMetrics {
  constructor(
    public readonly total: number, // bytes
    public readonly used: number, // bytes
    public readonly available: number // bytes
  ) {}

  get usagePercent(): number {
    return this.total > 0 ? (this.used / this.total) * 100 : 0;
  }
}

/**
 * Process: Represents a running process.
 */
export class Process {
  constructor(
    public readonly pid: number,
    public readonly name: string,
    public readonly user: string,
    public readonly cpuPercent: number,
    public readonly memoryMb: number,
    public readonly command: string
  ) {}

  static create(data: {
    pid: number;
    name: string;
    user: string;
    cpuPercent: number;
    memoryMb: number;
    command: string;
  }): Process {
    return new Process(
      data.pid,
      data.name,
      data.user,
      data.cpuPercent,
      data.memoryMb,
      data.command
    );
  }
}

/**
 * NetworkInterface: Represents a network interface.
 */
export class NetworkInterface {
  constructor(
    public readonly name: string,
    public readonly ipv4?: string,
    public readonly ipv6?: string,
    public readonly macAddress?: string,
    public readonly status: 'up' | 'down' = 'up'
  ) {}
}
