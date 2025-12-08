/**
 * Unit Tests - Command Controller
 * Tests command execution and batch command handling
 */

import { CommandController } from '../../../src/application/controllers/command.controller.js';
import { CommandExecutionError } from '../../../src/domain/errors/index.js';
import type { ICommandRepository } from '../../../src/domain/ports/repository.interfaces.js';
import type { Request, Response } from 'express';

// Mock repository
const mockRepository: ICommandRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// Mock request and response
const mockRequest = (body: any = {}, query: any = {}, params: any = {}): Partial<Request> => ({
  body,
  query,
  params,
  validatedBody: body,
  validatedQuery: query,
} as any);

const mockResponse = (): Partial<Response> => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

describe('Unit Tests - Command Controller', () => {
  let controller: CommandController;

  beforeEach(() => {
    controller = new CommandController(mockRepository);
    jest.clearAllMocks();
  });

  describe('executeCommand', () => {
    it('should execute a valid command successfully', async () => {
      const req = mockRequest({ command: 'echo test', timeout: 5000 });
      const res = mockResponse();

      // Mock executeCommand to return success
      jest.spyOn(require('../../../src/services/commandExecutor.js'), 'executeCommand')
        .mockResolvedValue({
          stdout: 'test',
          stderr: '',
          exitCode: 0,
          duration: 100,
        });

      await controller.executeCommand(req as Request, res as Response);

      expect(mockRepository.create).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it('should throw error for empty command', async () => {
      const req = mockRequest({ command: '' });
      const res = mockResponse();

      await expect(
        controller.executeCommand(req as Request, res as Response)
      ).rejects.toThrow(CommandExecutionError);
    });

    it('should throw error for whitespace-only command', async () => {
      const req = mockRequest({ command: '   ' });
      const res = mockResponse();

      await expect(
        controller.executeCommand(req as Request, res as Response)
      ).rejects.toThrow(CommandExecutionError);
    });

    it('should handle permission denied errors', async () => {
      const req = mockRequest({ command: 'sudo systemctl restart nginx' });
      const res = mockResponse();

      jest.spyOn(require('../../../src/services/commandExecutor.js'), 'executeCommand')
        .mockResolvedValue({
          stdout: '',
          stderr: 'Permission denied',
          exitCode: 1,
          duration: 50,
        });

      await expect(
        controller.executeCommand(req as Request, res as Response)
      ).rejects.toThrow(CommandExecutionError);
    });

    it('should use default timeout if not provided', async () => {
      const req = mockRequest({ command: 'ls' });
      const res = mockResponse();

      jest.spyOn(require('../../../src/services/commandExecutor.js'), 'executeCommand')
        .mockResolvedValue({
          stdout: 'file1\nfile2',
          stderr: '',
          exitCode: 0,
          duration: 75,
        });

      await controller.executeCommand(req as Request, res as Response);

      expect(mockRepository.create).toHaveBeenCalled();
    });
  });

  describe('executeBatch', () => {
    it('should execute multiple commands successfully', async () => {
      const req = mockRequest({
        commands: ['echo hello', 'echo world', 'pwd'],
      });
      const res = mockResponse();

      jest.spyOn(require('../../../src/services/commandExecutor.js'), 'executeCommand')
        .mockResolvedValue({
          stdout: 'output',
          stderr: '',
          exitCode: 0,
          duration: 50,
        });

      await controller.executeBatch(req as Request, res as Response);

      expect(mockRepository.create).toHaveBeenCalledTimes(3);
      expect(res.json).toHaveBeenCalled();
    });

    it('should throw error for empty commands array', async () => {
      const req = mockRequest({ commands: [] });
      const res = mockResponse();

      await expect(
        controller.executeBatch(req as Request, res as Response)
      ).rejects.toThrow(CommandExecutionError);
    });

    it('should throw error for non-array commands', async () => {
      const req = mockRequest({ commands: 'not-an-array' });
      const res = mockResponse();

      await expect(
        controller.executeBatch(req as Request, res as Response)
      ).rejects.toThrow(CommandExecutionError);
    });

    it('should throw error for empty string in commands array', async () => {
      const req = mockRequest({ commands: ['echo hello', '', 'pwd'] });
      const res = mockResponse();

      jest.spyOn(require('../../../src/services/commandExecutor.js'), 'executeCommand')
        .mockResolvedValue({
          stdout: 'output',
          stderr: '',
          exitCode: 0,
          duration: 50,
        });

      await expect(
        controller.executeBatch(req as Request, res as Response)
      ).rejects.toThrow(CommandExecutionError);
    });

    it('should handle object format commands', async () => {
      const req = mockRequest({
        commands: [
          { command: 'echo test1', timeout: 3000 },
          { command: 'echo test2', timeout: 5000 },
        ],
      });
      const res = mockResponse();

      jest.spyOn(require('../../../src/services/commandExecutor.js'), 'executeCommand')
        .mockResolvedValue({
          stdout: 'output',
          stderr: '',
          exitCode: 0,
          duration: 50,
        });

      await controller.executeBatch(req as Request, res as Response);

      expect(mockRepository.create).toHaveBeenCalledTimes(2);
    });

    it('should persist each command execution to repository', async () => {
      const req = mockRequest({
        commands: ['ls', 'pwd'],
      });
      const res = mockResponse();

      jest.spyOn(require('../../../src/services/commandExecutor.js'), 'executeCommand')
        .mockResolvedValue({
          stdout: 'output',
          stderr: '',
          exitCode: 0,
          duration: 50,
        });

      await controller.executeBatch(req as Request, res as Response);

      expect(mockRepository.create).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('Integration with CommandRepository', () => {
    it('should call repository.create with CommandExecution', async () => {
      const req = mockRequest({ command: 'whoami' });
      const res = mockResponse();

      jest.spyOn(require('../../../src/services/commandExecutor.js'), 'executeCommand')
        .mockResolvedValue({
          stdout: 'root',
          stderr: '',
          exitCode: 0,
          duration: 25,
        });

      await controller.executeCommand(req as Request, res as Response);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          command: expect.any(Object),
          userId: 'api-user',
        })
      );
    });
  });
});
