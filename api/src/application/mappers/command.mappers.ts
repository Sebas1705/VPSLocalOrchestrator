/**
 * Command DTO Mappers
 *
 * Map between HTTP DTOs and domain entities.
 */

import type { IMapper } from './mapper.interfaces.js';
import type { ExecuteCommandRequestDTO, CommandResultResponseDTO } from '../dtos/command.dtos.js';
import { Command } from '../../domain/command/entities.js';

/**
 * Map ExecuteCommandRequestDTO -> Command domain entity
 */
export class ExecuteCommandRequestMapper implements IMapper<ExecuteCommandRequestDTO, Command> {
  mapTo(source: ExecuteCommandRequestDTO): Command {
    return new Command(
      source.command,
      source.timeout || 30000,
      source.cwd || '/tmp'
    );
  }

  mapFrom(dest: Command): ExecuteCommandRequestDTO {
    return {
      command: dest.value,
      timeout: dest.timeout,
      cwd: dest.workingDir,
    };
  }
}

/**
 * Map command execution result -> CommandResultResponseDTO
 */
export class CommandResultResponseMapper implements IMapper<
  {
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
  },
  CommandResultResponseDTO
> {
  mapTo(source: {
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
  }): CommandResultResponseDTO {
    return {
      success: source.exitCode === 0,
      result: {
        exitCode: source.exitCode,
        stdout: source.stdout,
        stderr: source.stderr,
        duration: source.duration,
      },
      timestamp: new Date().toISOString(),
    };
  }

  mapFrom(dest: CommandResultResponseDTO): {
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
  } {
    return {
      exitCode: dest.result.exitCode,
      stdout: dest.result.stdout,
      stderr: dest.result.stderr,
      duration: dest.result.duration,
    };
  }
}
