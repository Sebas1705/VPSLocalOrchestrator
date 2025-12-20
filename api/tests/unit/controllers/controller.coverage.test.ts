import { CommandController } from '../../../src/application/controllers/command.controller.js';
import { ResourceController } from '../../../src/application/controllers/resources.controller.js';
import { CommandExecutionError, ResourceAccessError } from '../../../src/domain/errors/index.js';
import { CommandResultResponseMapper } from '../../../src/application/mappers/command.mappers.js';

jest.mock('../../../src/services/commandExecutor.js', () => ({
  executeCommand: jest.fn(),
}));

jest.mock('../../../src/services/resourceMonitor.js', () => ({
  getSystemResources: jest.fn(),
  getProcessList: jest.fn(),
  killProcess: jest.fn(),
  setProcessPriority: jest.fn(),
}));

jest.mock('../../../src/services/networkMonitor.js', () => ({
  getNetworkStats: jest.fn(),
}));

const mockRepo = () => ({
  create: jest.fn(),
  saveMetrics: jest.fn(),
  saveProcessSnapshot: jest.fn(),
});

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Controller coverage edge cases', () => {
  describe('CommandController', () => {
    let commandRepo: any;
    let controller: CommandController;

    beforeEach(() => {
      commandRepo = mockRepo();
      controller = new CommandController(commandRepo as any);
      jest.clearAllMocks();
    });

    test('executeCommand throws on empty command', async () => {
      const req: any = { validatedBody: { command: '   ' } };
      await expect(controller.executeCommand(req, {} as any)).rejects.toBeInstanceOf(CommandExecutionError);
    });

    test('executeCommand throws on permission denied stderr', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor.js');
      executeCommand.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'Permission denied', duration: 10 });
      const req: any = { validatedBody: { command: 'ls', timeout: 10, cwd: '/tmp', env: {} } };

      await expect(controller.executeCommand(req, {} as any)).rejects.toBeInstanceOf(CommandExecutionError);
    });

    test('executeCommand maps and persists on success', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor.js');
      executeCommand.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', duration: 5 });
      const res = makeRes();
      const req: any = { validatedBody: { command: 'echo hi', timeout: 1, cwd: '/tmp', env: {} } };

      await controller.executeCommand(req, res);

      expect(commandRepo.create).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, result: expect.any(Object) }));
    });

    test('executeBatch throws on empty array', async () => {
      const req: any = { validatedBody: { commands: [] } };
      await expect(controller.executeBatch(req, {} as any)).rejects.toBeInstanceOf(CommandExecutionError);
    });

    test('executeBatch throws when object command is empty', async () => {
      const req: any = { validatedBody: { commands: [{ command: '  ' }] } };
      await expect(controller.executeBatch(req, {} as any)).rejects.toBeInstanceOf(CommandExecutionError);
    });

    test('executeBatch executes string commands successfully', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor.js');
      executeCommand.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '', duration: 5 });
      const res = makeRes();
      const req: any = { validatedBody: { commands: ['echo hi', 'ls -la'] } };

      await controller.executeBatch(req, res);

      expect(commandRepo.create).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          results: expect.arrayContaining([
            expect.objectContaining({ command: 'echo hi', exitCode: 0 }),
            expect.objectContaining({ command: 'ls -la', exitCode: 0 })
          ]),
          timestamp: expect.any(String)
        })
      );
    });

    test('executeBatch executes object commands with config', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor.js');
      executeCommand.mockResolvedValue({ exitCode: 0, stdout: 'result', stderr: '', duration: 3 });
      const res = makeRes();
      const req: any = { validatedBody: { commands: [{ command: 'pwd', timeout: 5000, cwd: '/home', env: {} }] } };

      await controller.executeBatch(req, res);

      expect(commandRepo.create).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          results: expect.arrayContaining([
            expect.objectContaining({ command: 'pwd', exitCode: 0 })
          ])
        })
      );
    });

    test('manageService rejects empty service name', async () => {
      const req: any = { validatedBody: { service: ' ', action: 'start' } };
      await expect(controller.manageService(req, {} as any)).rejects.toBeInstanceOf(CommandExecutionError);
    });

    test('manageService rejects invalid action', async () => {
      const req: any = { validatedBody: { service: 'nginx', action: 'noop' } };
      await expect(controller.manageService(req, {} as any)).rejects.toBeInstanceOf(CommandExecutionError);
    });

    test('manageService throws denied when sudo required and fails', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor.js');
      executeCommand.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'sudo: password required', duration: 5 });
      const req: any = { validatedBody: { service: 'nginx', action: 'restart' } };

      await expect(controller.manageService(req, {} as any)).rejects.toBeInstanceOf(CommandExecutionError);
    });

    test('manageService allows status without sudo', async () => {
      const { executeCommand } = require('../../../src/services/commandExecutor.js');
      executeCommand.mockResolvedValue({ exitCode: 0, stdout: 'active', stderr: '', duration: 2 });
      const res = makeRes();
      const req: any = { validatedBody: { service: 'nginx', action: 'status' } };

      await controller.manageService(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, service: 'nginx' }));
    });
  });

  describe('ResourceController', () => {
    let resourceRepo: any;
    let controller: ResourceController;
    let getProcessList: any;
    let killProcess: any;
    let setProcessPriority: any;

    beforeEach(() => {
      resourceRepo = mockRepo();
      controller = new ResourceController(resourceRepo as any);
      ({ getProcessList, killProcess, setProcessPriority } = require('../../../src/services/resourceMonitor.js'));
      jest.clearAllMocks();
    });

    test('getProcesses rejects invalid low limit', async () => {
      const req: any = { validatedQuery: { limit: 0 } };
      await expect(controller.getProcesses(req, {} as any)).rejects.toBeInstanceOf(ResourceAccessError);
    });

    test('getProcesses rejects invalid high limit', async () => {
      const req: any = { validatedQuery: { limit: 5000 } };
      await expect(controller.getProcesses(req, {} as any)).rejects.toBeInstanceOf(ResourceAccessError);
    });

    test('getProcesses persists snapshot on success', async () => {
      getProcessList.mockResolvedValue([{ pid: 1, name: 'init', cpu: 0.1, memory: 1 }]);
      const res = makeRes();
      const req: any = { validatedQuery: { limit: 2 } };

      await controller.getProcesses(req, res);

      expect(resourceRepo.saveProcessSnapshot).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    test('killProcess throws when underlying kill fails', async () => {
      killProcess.mockResolvedValue(false);
      const req: any = { params: { pid: '99' }, query: {} };
      await expect(controller.killProcess(req, {} as any)).rejects.toBeInstanceOf(ResourceAccessError);
    });

    test('setPriority validates pid and priority bounds', async () => {
      const badPidReq: any = { params: { pid: 'abc' }, body: { priority: 0 } };
      await expect(controller.setPriority(badPidReq, {} as any)).rejects.toBeInstanceOf(ResourceAccessError);

      const badPriorityReq: any = { params: { pid: '10' }, body: { priority: 50 } };
      await expect(controller.setPriority(badPriorityReq, {} as any)).rejects.toBeInstanceOf(ResourceAccessError);
    });

    test('setPriority throws permissionDenied when service rejects', async () => {
      setProcessPriority.mockResolvedValue({ success: false, message: 'denied' });
      const req: any = { params: { pid: '5' }, body: { priority: 0 } };
      await expect(controller.setPriority(req, {} as any)).rejects.toBeInstanceOf(ResourceAccessError);
    });

    test('setPriority succeeds and persists when valid', async () => {
      setProcessPriority.mockResolvedValue({ success: true, message: 'priority set' });
      const res = makeRes();
      const req: any = { params: { pid: '5' }, body: { priority: 0 } };

      await controller.setPriority(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'priority set',
          timestamp: expect.any(String)
        })
      );
    });

    test('getNetwork returns network stats successfully', async () => {
      const { getNetworkStats } = require('../../../src/services/networkMonitor.js');
      getNetworkStats.mockResolvedValue({
        interfaces: [{ name: 'eth0', ipv4: '192.168.1.1', bytesIn: 100, bytesOut: 200, packetsIn: 50, packetsOut: 60, errors: 0, dropped: 0 }],
        connections: { established: 5, timeWait: 1, listening: 2, other: 0 },
        timestamp: new Date(),
      });
      const res = makeRes();
      const req: any = {};

      await controller.getNetwork(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ interfaces: expect.any(Array) }),
          timestamp: expect.any(String)
        })
      );
    });
  });
});
