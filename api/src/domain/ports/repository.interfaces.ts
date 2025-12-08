/**
 * Repository Pattern - Domain Ports Layer
 * Defines contracts for data access abstraction
 * Decouples domain logic from infrastructure persistence
 * 
 * @module domain/ports/repository.interfaces
 */

import type { CommandExecution } from '../command/entities.js';

/**
 * Generic repository interface for CRUD operations
 * Establishes contract for data access implementations
 */
export interface IRepository<T> {
  create(entity: Partial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  update(id: string, entity: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}

/**
 * Command execution repository
 * Manages command history and execution records
 */
export interface ICommandRepository {
  /** Store command execution record */
  create(execution: Partial<CommandExecution>): Promise<CommandExecution>;
  
  /** Retrieve command by execution ID */
  findById(executionId: string): Promise<CommandExecution | null>;
  
  /** Retrieve all executed commands (with optional limit) */
  findAll(limit?: number): Promise<CommandExecution[]>;
  
  /** Retrieve commands by status */
  findByStatus(status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout'): Promise<CommandExecution[]>;
  
  /** Update command execution record */
  update(executionId: string, updates: Partial<CommandExecution>): Promise<CommandExecution>;
  
  /** Delete command record */
  delete(executionId: string): Promise<boolean>;
  
  /** Clear all execution history */
  clear(): Promise<void>;
}

/**
 * Resource metrics repository
 * Manages system resource snapshots and metrics
 */
export interface IResourceRepository {
  /** Store system resource snapshot */
  saveMetrics(timestamp: number, metrics: any): Promise<void>;
  
  /** Retrieve metrics for time range */
  getMetrics(startTime: number, endTime: number): Promise<any[]>;
  
  /** Get latest resource snapshot */
  getLatestSnapshot(): Promise<any | null>;
  
  /** Store process snapshot */
  saveProcessSnapshot(timestamp: number, processes: any[]): Promise<void>;
  
  /** Get process history */
  getProcessHistory(limit?: number): Promise<any[]>;
}

/**
 * Service management repository
 * Manages service definitions and status
 */
export interface IServiceRepository {
  /** Register service definition */
  registerService(serviceId: string, definition: any): Promise<void>;
  
  /** Retrieve service definition */
  getService(serviceId: string): Promise<any | null>;
  
  /** List all registered services */
  listServices(): Promise<any[]>;
  
  /** Update service metadata */
  updateService(serviceId: string, updates: any): Promise<void>;
  
  /** Remove service definition */
  unregisterService(serviceId: string): Promise<boolean>;
  
  /** Store service health snapshot */
  saveHealthSnapshot(timestamp: number, health: any): Promise<void>;
  
  /** Get service health history */
  getHealthHistory(serviceId: string, limit?: number): Promise<any[]>;
}

/**
 * Abstract repository base class for common CRUD patterns
 */
export abstract class BaseRepository<T> implements IRepository<T> {
  protected store: Map<string, T> = new Map();
  protected idCounter: number = 0;

  async create(entity: Partial<T>): Promise<T> {
    const id = (++this.idCounter).toString();
    const fullEntity = { ...entity, id } as T;
    this.store.set(id, fullEntity);
    return fullEntity;
  }

  async findById(id: string): Promise<T | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<T[]> {
    return Array.from(this.store.values());
  }

  async update(id: string, entity: Partial<T>): Promise<T> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`Entity with id ${id} not found`);
    
    const updated = { ...existing, ...entity } as T;
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}
