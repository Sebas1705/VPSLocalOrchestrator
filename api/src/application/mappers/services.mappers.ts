/**
 * Service DTO Mappers
 *
 * Map between HTTP DTOs and domain/service entities.
 * Note: Service entities have complex optional types that require careful handling.
 */

import type { IMapper } from './mapper.interfaces.js';

/**
 * Service Status Normalizer
 * Normalizes service data to consistent DTO format
 * This is a helper utility for controllers that work with various service formats
 */
export class ServiceNormalizer {
  static normalizeStatus(service: any): { name: string; status: string; enabled: boolean; uptime?: number } {
    return {
      name: service.name || 'unknown',
      status: service.active ? 'active' : (service.status || 'unknown'),
      enabled: service.enabled || false,
      uptime: service.uptime ? (typeof service.uptime === 'string' ? parseInt(service.uptime) : service.uptime) : undefined,
    };
  }
}
