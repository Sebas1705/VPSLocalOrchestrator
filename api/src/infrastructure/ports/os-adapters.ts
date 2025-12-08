/**
 * OS Adapter Ports
 *
 * Define contracts for low-level OS interactions.
 * Keep domain/application layers independent of child_process, fs, etc.
 */

/**
 * CommandExecutor: Port for executing shell commands
 */
export interface ICommandExecutor {
  execute(command: string, options: CommandExecutionOptions): Promise<CommandExecutionResult>;
}

export interface CommandExecutionOptions {
  timeout?: number; // milliseconds
  cwd?: string; // working directory
  env?: Record<string, string>; // environment variables
  maxBuffer?: number; // max stdout/stderr size in bytes
}

export interface CommandExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number; // milliseconds
}

/**
 * ProcessManager: Port for process lifecycle management
 */
export interface IProcessManager {
  getProcessList(): Promise<ProcessInfo[]>;
  getProcessById(pid: number): Promise<ProcessInfo | null>;
  killProcess(pid: number, signal?: string): Promise<void>;
  getProcessStats(pid: number): Promise<ProcessStats | null>;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  user: string;
  cpuPercent: number;
  memoryMb: number;
  command: string;
}

export interface ProcessStats {
  pid: number;
  cpuUsage: number;
  memoryUsage: number;
  uptime: number;
  threads: number;
}

/**
 * SystemInfoProvider: Port for system information
 */
export interface ISystemInfoProvider {
  getCPUInfo(): Promise<CPUInfo>;
  getMemoryInfo(): Promise<MemoryInfo>;
  getDiskInfo(): Promise<DiskInfo>;
  getNetworkInterfaces(): Promise<NetworkInfo[]>;
  getSystemUptime(): Promise<number>;
}

export interface CPUInfo {
  cores: number;
  userPercent: number;
  systemPercent: number;
  idlePercent: number;
}

export interface MemoryInfo {
  total: number;
  used: number;
  free: number;
  available: number;
}

export interface DiskInfo {
  total: number;
  used: number;
  available: number;
}

export interface NetworkInfo {
  name: string;
  ipv4?: string;
  ipv6?: string;
  macAddress?: string;
  status: 'up' | 'down';
}

/**
 * ServiceManager: Port for system service control
 */
export interface IServiceManager {
  startService(name: string): Promise<void>;
  stopService(name: string): Promise<void>;
  restartService(name: string): Promise<void>;
  getServiceStatus(name: string): Promise<ServiceStatusInfo>;
  listServices(): Promise<ServiceStatusInfo[]>;
}

export interface ServiceStatusInfo {
  name: string;
  status: 'active' | 'inactive' | 'failed' | 'unknown';
  enabled: boolean;
  uptime?: number; // seconds
}
