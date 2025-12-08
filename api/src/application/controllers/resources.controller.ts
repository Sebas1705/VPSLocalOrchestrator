/**
 * Resource Controller Implementation
 *
 * Handles HTTP requests for system resource queries.
 * Throws domain errors for proper error handling.
 */

import type { Request, Response } from 'express';
import type { IResourceController } from './controller.interfaces.js';
import type { IResourceRepository } from '../../domain/ports/repository.interfaces.js';
import { ResourceAccessError } from '../../domain/errors/index.js';
import { sendErrorResponse } from '../validation-middleware.js';
import { getSystemResources, getProcessList, killProcess, setProcessPriority } from '../../services/resourceMonitor.js';
import { getNetworkStats } from '../../services/networkMonitor.js';

export class ResourceController implements IResourceController {
  private resourceRepository: IResourceRepository;

  constructor(resourceRepository: IResourceRepository) {
    this.resourceRepository = resourceRepository;
  }

  async getResources(req: Request, res: Response): Promise<void> {
    const resources = await getSystemResources();
    
    // Persist metrics snapshot
    await this.resourceRepository.saveMetrics(Date.now(), resources);
    
    res.json({
      success: true,
      data: resources,
      timestamp: new Date().toISOString(),
    });
  }

  async getProcesses(req: Request, res: Response): Promise<void> {
    const limit = (req as any).validatedQuery?.limit || 10;
    
    if (limit < 1 || limit > 1000) {
      throw ResourceAccessError.invalid('process list', 'limit', limit);
    }

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
  }

  async killProcess(req: Request, res: Response): Promise<void> {
    const pid = parseInt(req.params.pid ?? '');
    const signal = (req.query.signal as string) || 'TERM';

    if (isNaN(pid) || pid <= 0) {
      throw ResourceAccessError.invalid('process', 'pid', req.params.pid);
    }

    const success = await killProcess(pid, signal);

    if (!success) {
      throw ResourceAccessError.notFound('process', String(pid));
    }

    res.json({
      success: true,
      message: `Process ${pid} killed successfully`,
      timestamp: new Date().toISOString(),
    });
  }

  async setPriority(req: Request, res: Response): Promise<void> {
    const pid = parseInt(req.params.pid ?? '');
    const { priority } = req.body;

    if (isNaN(pid) || pid <= 0) {
      throw ResourceAccessError.invalid('process', 'pid', req.params.pid);
    }

    if (typeof priority !== 'number' || priority < -20 || priority > 19) {
      throw ResourceAccessError.invalid('process priority', 'priority', priority);
    }

    const result = await setProcessPriority(pid, priority);

    if (!result.success) {
      throw ResourceAccessError.permissionDenied('process', 'set priority');
    }

    res.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  }

  async getNetwork(req: Request, res: Response): Promise<void> {
    const networkStats = await getNetworkStats();
    res.json({
      success: true,
      data: networkStats,
      timestamp: new Date().toISOString(),
    });
  }
}
