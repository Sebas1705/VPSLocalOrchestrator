/**
 * Resource Controller Implementation
 *
 * Handles HTTP requests for system resource queries.
 * Persists resource metrics via repository.
 */

import type { Request, Response } from 'express';
import type { IResourceController } from './controller.interfaces.js';
import type { IResourceRepository } from '../../domain/ports/repository.interfaces.js';
import { sendErrorResponse } from '../validation-middleware.js';
import { getSystemResources, getProcessList, killProcess, setProcessPriority } from '../../services/resourceMonitor.js';
import { getNetworkStats } from '../../services/networkMonitor.js';

export class ResourceController implements IResourceController {
  private resourceRepository: IResourceRepository;

  constructor(resourceRepository: IResourceRepository) {
    this.resourceRepository = resourceRepository;
  }

  async getResources(req: Request, res: Response): Promise<void> {
    try {
      const resources = await getSystemResources();
      
      // Persist metrics snapshot
      await this.resourceRepository.saveMetrics(Date.now(), resources);
      
      res.json({
        success: true,
        data: resources,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      sendErrorResponse(res, 'RESOURCE_FETCH_ERROR', error.message, 500);
    }
  }

  async getProcesses(req: Request, res: Response): Promise<void> {
    try {
      const limit = (req as any).validatedQuery?.limit || 10;
      const processes = await getProcessList(limit);

      const processData = processes.map((p) => ({
        pid: p.pid,
        name: p.name,
        user: 'unknown',
        cpuPercent: p.cpu,
        memoryMb: p.memory,
        command: p.name,
      }));

      // Persist process snapshot
      await this.resourceRepository.saveProcessSnapshot(Date.now(), processData);

      res.json({
        success: true,
        data: processData,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      sendErrorResponse(res, 'PROCESS_LIST_ERROR', error.message, 500);
    }
  }

  async killProcess(req: Request, res: Response): Promise<void> {
    try {
      const pid = parseInt(req.params.pid ?? '');
      const signal = (req.query.signal as string) || 'TERM';

      if (isNaN(pid)) {
        sendErrorResponse(res, 'INVALID_PID', 'Invalid PID', 400);
        return;
      }

      const success = await killProcess(pid, signal);

      res.json({
        success,
        message: success ? `Process ${pid} killed successfully` : `Failed to kill process ${pid}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      sendErrorResponse(res, 'KILL_PROCESS_ERROR', error.message, 500);
    }
  }

  async setPriority(req: Request, res: Response): Promise<void> {
    try {
      const pid = parseInt(req.params.pid ?? '');
      const { priority } = req.body;

      if (isNaN(pid)) {
        sendErrorResponse(res, 'INVALID_PID', 'Invalid PID', 400);
        return;
      }

      if (typeof priority !== 'number' || isNaN(priority)) {
        sendErrorResponse(res, 'INVALID_PRIORITY', 'Priority must be a number between -20 and 19', 400);
        return;
      }

      const result = await setProcessPriority(pid, priority);

      if (result.success) {
        res.json({
          ...result,
          timestamp: new Date().toISOString(),
        });
      } else {
        sendErrorResponse(res, 'PROCESS_PRIORITY_ERROR', 'Failed to set process priority', 400);
      }
    } catch (error: any) {
      sendErrorResponse(res, 'PRIORITY_ERROR', error.message, 500);
    }
  }

  async getNetwork(req: Request, res: Response): Promise<void> {
    try {
      const networkStats = await getNetworkStats();
      res.json({
        success: true,
        data: networkStats,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      sendErrorResponse(res, 'NETWORK_STATS_ERROR', error.message, 500);
    }
  }
}
