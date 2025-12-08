/**
 * In-Memory Repository Implementations
 * Lightweight storage for development and testing
 * No external database dependency required
 * 
 * @module infrastructure/repositories
 */

import type { CommandExecution } from '../../domain/command/entities.js';
import type { 
  ICommandRepository, 
  IResourceRepository, 
  IServiceRepository 
} from '../../domain/ports/repository.interfaces.js';

/**
 * In-memory command execution repository
 * Stores command execution records with metadata
 * Note: Stores as plain objects, not domain entity instances
 */
export class InMemoryCommandRepository implements ICommandRepository {
  private executions: Map<string, any> = new Map();
  private idCounter: number = 0;

  async create(execution: Partial<CommandExecution>): Promise<CommandExecution> {
    const id = `exec_${++this.idCounter}_${Date.now()}`;
    
    // Store as plain object (avoid entity methods)
    const record = {
      id,
      command: execution.command!,
      userId: execution.userId || 'system',
      startedAt: execution.startedAt || new Date(),
      status: execution.status || 'pending',
      stdout: execution.stdout || '',
      stderr: execution.stderr || '',
      exitCode: execution.exitCode,
      endedAt: execution.endedAt,
    };
    
    this.executions.set(id, record);
    return record as any;
  }

  async findById(executionId: string): Promise<CommandExecution | null> {
    return (this.executions.get(executionId) ?? null) as any;
  }

  async findAll(limit?: number): Promise<CommandExecution[]> {
    const all = Array.from(this.executions.values());
    return (limit ? all.slice(-limit) : all) as any;
  }

  async findByStatus(status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout'): Promise<CommandExecution[]> {
    return (Array.from(this.executions.values())
      .filter(exec => exec.status === status)) as any;
  }

  async update(executionId: string, updates: Partial<CommandExecution>): Promise<CommandExecution> {
    const existing = this.executions.get(executionId);
    if (!existing) throw new Error(`Execution ${executionId} not found`);
    
    const updated = { ...existing, ...updates };
    this.executions.set(executionId, updated);
    return updated as any;
  }

  async delete(executionId: string): Promise<boolean> {
    return this.executions.delete(executionId);
  }

  async clear(): Promise<void> {
    this.executions.clear();
  }

  /** Get repository size for diagnostics */
  size(): number {
    return this.executions.size;
  }
}

/**
 * In-memory resource metrics repository
 * Stores system resource snapshots with timestamps
 */
export class InMemoryResourceRepository implements IResourceRepository {
  private metrics: Array<{ timestamp: number; data: any }> = [];
  private processSnapshots: Array<{ timestamp: number; processes: any[] }> = [];
  private maxSnapshots: number = 1000;

  async saveMetrics(timestamp: number, metrics: any): Promise<void> {
    this.metrics.push({ timestamp, data: metrics });
    
    // Keep only last maxSnapshots entries
    if (this.metrics.length > this.maxSnapshots) {
      this.metrics = this.metrics.slice(-this.maxSnapshots);
    }
  }

  async getMetrics(startTime: number, endTime: number): Promise<any[]> {
    return this.metrics
      .filter(m => m.timestamp >= startTime && m.timestamp <= endTime)
      .map(m => ({ ...m.data, timestamp: m.timestamp }));
  }

  async getLatestSnapshot(): Promise<any | null> {
    if (this.metrics.length === 0) return null;
    const latest = this.metrics[this.metrics.length - 1];
    return latest ? { ...latest.data } : null;
  }

  async saveProcessSnapshot(timestamp: number, processes: any[]): Promise<void> {
    this.processSnapshots.push({ timestamp, processes });
    
    if (this.processSnapshots.length > this.maxSnapshots) {
      this.processSnapshots = this.processSnapshots.slice(-this.maxSnapshots);
    }
  }

  async getProcessHistory(limit?: number): Promise<any[]> {
    const all = this.processSnapshots.map(snap => ({
      timestamp: snap.timestamp,
      processes: snap.processes,
    }));
    
    return limit ? all.slice(-limit) : all;
  }

  /** Get repository size for diagnostics */
  size(): number {
    return this.metrics.length;
  }
}

/**
 * In-memory service management repository
 * Stores service definitions and health snapshots
 */
export class InMemoryServiceRepository implements IServiceRepository {
  private services: Map<string, any> = new Map();
  private healthSnapshots: Map<string, Array<{ timestamp: number; health: any }>> = new Map();
  private maxHistorySize: number = 500;

  async registerService(serviceId: string, definition: any): Promise<void> {
    this.services.set(serviceId, {
      id: serviceId,
      ...definition,
      registeredAt: new Date(),
    });
  }

  async getService(serviceId: string): Promise<any | null> {
    return this.services.get(serviceId) ?? null;
  }

  async listServices(): Promise<any[]> {
    return Array.from(this.services.values());
  }

  async updateService(serviceId: string, updates: any): Promise<void> {
    const existing = this.services.get(serviceId);
    if (!existing) throw new Error(`Service ${serviceId} not found`);
    
    this.services.set(serviceId, { ...existing, ...updates });
  }

  async unregisterService(serviceId: string): Promise<boolean> {
    this.healthSnapshots.delete(serviceId);
    return this.services.delete(serviceId);
  }

  async saveHealthSnapshot(timestamp: number, health: any): Promise<void> {
    const serviceId = health.id || health.name || 'unknown';
    
    if (!this.healthSnapshots.has(serviceId)) {
      this.healthSnapshots.set(serviceId, []);
    }
    
    const snapshots = this.healthSnapshots.get(serviceId);
    if (snapshots) {
      snapshots.push({ timestamp, health });
      
      // Keep only last maxHistorySize entries
      if (snapshots.length > this.maxHistorySize) {
        this.healthSnapshots.set(serviceId, snapshots.slice(-this.maxHistorySize));
      }
    }
  }

  async getHealthHistory(serviceId: string, limit?: number): Promise<any[]> {
    const snapshots = this.healthSnapshots.get(serviceId) || [];
    const all = snapshots.map(snap => ({
      timestamp: snap.timestamp,
      ...snap.health,
    }));
    
    return limit ? all.slice(-limit) : all;
  }

  /** Get repository size for diagnostics */
  size(): number {
    return this.services.size;
  }
}
