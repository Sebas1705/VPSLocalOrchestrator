/**
 * Resource DTO Mappers
 *
 * Map between HTTP DTOs and domain/service entities.
 */

import type { IMapper } from './mapper.interfaces.js';
import type {
  ProcessInfoDTO,
  SystemResourcesResponseDTO,
  KillProcessRequestDTO,
  SetProcessPriorityRequestDTO,
} from '../dtos/resources.dtos.js';

/**
 * Map ProcessInfo from service -> ProcessInfoDTO
 */
export class ProcessInfoMapper implements IMapper<
  {
    pid: number;
    name: string;
    user: string;
    cpuPercent: number;
    memoryMb: number;
    command: string;
  },
  ProcessInfoDTO
> {
  mapTo(source: {
    pid: number;
    name: string;
    user: string;
    cpuPercent: number;
    memoryMb: number;
    command: string;
  }): ProcessInfoDTO {
    return {
      pid: source.pid,
      name: source.name,
      user: source.user,
      cpuPercent: source.cpuPercent,
      memoryMb: source.memoryMb,
      command: source.command,
    };
  }

  mapFrom(dest: ProcessInfoDTO): {
    pid: number;
    name: string;
    user: string;
    cpuPercent: number;
    memoryMb: number;
    command: string;
  } {
    return {
      pid: dest.pid,
      name: dest.name,
      user: dest.user,
      cpuPercent: dest.cpuPercent,
      memoryMb: dest.memoryMb,
      command: dest.command,
    };
  }
}

/**
 * Map SystemResources from service -> SystemResourcesResponseDTO
 */
export class SystemResourcesMapper implements IMapper<
  {
    cpu: {
      usage: number;
      cores: number;
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
  },
  SystemResourcesResponseDTO
> {
  mapTo(source: {
    cpu: {
      usage: number;
      cores: number;
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
  }): SystemResourcesResponseDTO {
    return {
      success: true,
      data: {
        cpu: {
          cores: source.cpu.cores,
          usage: source.cpu.usage,
          model: source.cpu.model,
        },
        memory: {
          total: source.memory.total,
          free: source.memory.free,
          used: source.memory.used,
          usagePercent: source.memory.usagePercent,
        },
        disk: {
          total: source.disk.total,
          free: source.disk.free,
          used: source.disk.used,
          usagePercent: source.disk.usagePercent,
        },
        uptime: source.uptime,
        platform: source.platform,
      },
      timestamp: new Date().toISOString(),
    };
  }

  mapFrom(dest: SystemResourcesResponseDTO): {
    cpu: {
      usage: number;
      cores: number;
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
  } {
    return {
      cpu: {
        usage: dest.data.cpu.usage,
        cores: dest.data.cpu.cores,
        model: dest.data.cpu.model,
      },
      memory: {
        total: dest.data.memory.total,
        free: dest.data.memory.free,
        used: dest.data.memory.used,
        usagePercent: dest.data.memory.usagePercent,
      },
      disk: {
        total: dest.data.disk.total,
        free: dest.data.disk.free,
        used: dest.data.disk.used,
        usagePercent: dest.data.disk.usagePercent,
      },
      uptime: dest.data.uptime,
      platform: dest.data.platform,
    };
  }
}

/**
 * Map KillProcessRequestDTO -> process parameters
 */
export class KillProcessRequestMapper implements IMapper<
  KillProcessRequestDTO,
  { pid: number; signal: string }
> {
  mapTo(source: KillProcessRequestDTO): { pid: number; signal: string } {
    return {
      pid: source.pid,
      signal: source.signal || 'TERM',
    };
  }

  mapFrom(dest: { pid: number; signal: string }): KillProcessRequestDTO {
    return {
      pid: dest.pid,
      signal: dest.signal,
    };
  }
}

/**
 * Map SetProcessPriorityRequestDTO -> priority parameters
 */
export class SetProcessPriorityRequestMapper implements IMapper<
  SetProcessPriorityRequestDTO,
  { pid: number; priority: number }
> {
  mapTo(source: SetProcessPriorityRequestDTO): { pid: number; priority: number } {
    return {
      priority: source.priority,
      pid: 0, // Will be set from route parameter
    };
  }

  mapFrom(dest: { pid: number; priority: number }): SetProcessPriorityRequestDTO {
    return {
      priority: dest.priority,
    };
  }
}
