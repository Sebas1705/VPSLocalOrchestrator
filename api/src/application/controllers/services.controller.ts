/**
 * Service Controller Implementation
 *
 * Handles HTTP requests for service management.
 * Throws domain errors for proper error handling.
 */

import type { Request, Response } from 'express';
import type { IServiceController } from './controller.interfaces.js';
import type { IServiceRepository } from '../../domain/ports/repository.interfaces.js';
import { ServiceManagementError, ValidationError } from '../../domain/errors/index.js';
import { getServiceHealth, listActiveServices } from '../../services/healthMonitor.js';
import { ServiceNormalizer } from '../mappers/services.mappers.js';

export class ServiceController implements IServiceController {
  private serviceRepository: IServiceRepository;

  constructor(serviceRepository: IServiceRepository) {
    this.serviceRepository = serviceRepository;
  }

  async listServices(req: Request, res: Response): Promise<void> {
    const services = await listActiveServices();
    
    // Persist service registrations
    for (const svc of services) {
      const serviceId = (svc as any).name || 'unknown';
      await this.serviceRepository.registerService(serviceId, svc);
      await this.serviceRepository.saveHealthSnapshot(Date.now(), ServiceNormalizer.normalizeStatus(svc));
    }
    
    res.json({
      success: true,
      data: services.map((s) => ServiceNormalizer.normalizeStatus(s)),
      timestamp: new Date().toISOString(),
    });
  }

  async getServiceHealth(req: Request, res: Response): Promise<void> {
    const serviceName = req.params.name ?? '';

    if (!serviceName || serviceName.trim().length === 0) {
      throw ValidationError.missingRequired('name');
    }

    const health = await getServiceHealth(serviceName);
    if (!health) {
      throw ServiceManagementError.notFound(serviceName);
    }

    const normalized = ServiceNormalizer.normalizeStatus(health);

    // Persist health snapshot
    await this.serviceRepository.saveHealthSnapshot(Date.now(), normalized);

    res.json({
      success: normalized.status === 'active',
      data: normalized,
      timestamp: new Date().toISOString(),
    });
  }
}
