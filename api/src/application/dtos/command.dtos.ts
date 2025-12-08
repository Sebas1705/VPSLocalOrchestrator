/**
 * Command Domain DTOs (Data Transfer Objects)
 *
 * Map between HTTP layer and domain/application layers.
 * Keep DTOs lean and separate from domain entities.
 */

/**
 * HTTP Request DTO
 * Received from client
 */
export interface ExecuteCommandRequestDTO {
  command: string;
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface BatchCommandRequestDTO {
  commands: (string | ExecuteCommandRequestDTO)[];
}

/**
 * HTTP Response DTO
 * Sent to client
 */
export interface CommandResultResponseDTO {
  success: boolean;
  result: {
    stdout: string;
    stderr: string;
    exitCode: number;
    duration: number;
  };
  timestamp: string;
}

export interface BatchCommandResponseDTO {
  success: boolean;
  results: CommandResultResponseDTO[];
  timestamp: string;
}

export interface ServiceActionRequestDTO {
  service: string;
  action: 'start' | 'stop' | 'restart' | 'status' | 'enable' | 'disable';
}

export interface ServiceActionResponseDTO {
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
