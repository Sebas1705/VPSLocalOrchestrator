import { ExecuteCommandRequestMapper, CommandResultResponseMapper } from '../../../src/application/mappers/command.mappers.js';
import { Command } from '../../../src/domain/command/entities.js';

describe('command mappers', () => {
  it('maps execute request dto to Command with defaults', () => {
    const mapper = new ExecuteCommandRequestMapper();
    const cmd = mapper.mapTo({ command: 'echo hi' });

    expect(cmd).toBeInstanceOf(Command);
    expect(cmd.timeout).toBe(30000);
    expect(cmd.workingDir).toBe('/tmp');

    const dto = mapper.mapFrom(cmd);
    expect(dto.command).toBe('echo hi');
    expect(dto.timeout).toBe(30000);
    expect(dto.cwd).toBe('/tmp');
  });

  it('maps command result to response dto and back', () => {
    const mapper = new CommandResultResponseMapper();
    const dto = mapper.mapTo({ exitCode: 0, stdout: 'ok', stderr: '', duration: 5 });

    expect(dto.success).toBe(true);
    expect(dto.result.exitCode).toBe(0);
    expect(typeof dto.timestamp).toBe('string');

    const back = mapper.mapFrom(dto);
    expect(back.stdout).toBe('ok');
    expect(back.duration).toBe(5);
  });
});
