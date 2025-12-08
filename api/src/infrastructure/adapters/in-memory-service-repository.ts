/**
 * In-Memory Service Repository Adapter
 *
 * Simple implementation for testing and development.
 */

import type { Service } from '../../domain/services/entities.js';
import type { IServiceRepository } from '../ports.js';

export class InMemoryServiceRepository implements IServiceRepository {
  private services = new Map<string, Service>();

  async findByName(name: string): Promise<Service | null> {
    return this.services.get(name) ?? null;
  }

  async findAll(): Promise<Service[]> {
    return Array.from(this.services.values());
  }

  async save(service: Service): Promise<void> {
    this.services.set(service.name, service);
  }

  clear(): void {
    this.services.clear();
  }
}
