/**
 * Resource Domain DTOs (Data Transfer Objects)
 *
 * Map between HTTP layer and domain/application layers.
 */

export interface SystemResourcesResponseDTO {
  success: boolean;
  data: {
    cpu: {
      cores: number;
      usage: number;
      model: string;
    };
    memory: {
      total: number;
      free: number;
      used: number;
      usagePercent: number;
    };
    disk: {
      total: number;
      free: number;
      used: number;
      usagePercent: number;
    };
    uptime: number;
    platform: string;
  };
  timestamp: string;
}

export interface ProcessInfoDTO {
  pid: number;
  name: string;
  user: string;
  cpuPercent: number;
  memoryMb: number;
  command: string;
}

export interface ProcessListResponseDTO {
  success: boolean;
  data: ProcessInfoDTO[];
  timestamp: string;
}

export interface KillProcessRequestDTO {
  pid: number;
  signal?: string;
}

export interface KillProcessResponseDTO {
  success: boolean;
  message: string;
  timestamp: string;
}

export interface SetProcessPriorityRequestDTO {
  priority: number;
}

export interface SetProcessPriorityResponseDTO {
  success: boolean;
  message: string;
  currentPriority?: number;
  timestamp: string;
}

export interface NetworkStatsResponseDTO {
  success: boolean;
  data: {
    interfaces: Array<{
      name: string;
      bytes_sent: number;
      bytes_recv: number;
      packets_sent: number;
      packets_recv: number;
    }>;
  };
  timestamp: string;
}
