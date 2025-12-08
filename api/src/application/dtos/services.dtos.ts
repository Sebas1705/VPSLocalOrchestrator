/**
 * Service Domain DTOs (Data Transfer Objects)
 *
 * Map between HTTP layer and domain/application layers.
 */

export interface ListServicesResponseDTO {
  success: boolean;
  data: ServiceStatusDTO[];
  timestamp: string;
}

export interface ServiceStatusDTO {
  name: string;
  status: 'active' | 'inactive' | 'failed' | 'unknown';
  enabled: boolean;
  uptime?: number;
}

export interface ServiceHealthResponseDTO {
  success: boolean;
  data: ServiceStatusDTO;
  timestamp: string;
}

export interface ServiceControlRequestDTO {
  service: string;
  action: 'start' | 'stop' | 'restart' | 'status' | 'enable' | 'disable';
}

export interface ServiceControlResponseDTO {
  success: boolean;
  service: string;
  action: string;
  result: {
    stdout: string;
    stderr: string;
    exitCode: number;
    duration: number;
  };
  timestamp: string;
}
