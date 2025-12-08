/**
 * Controller Interfaces
 *
 * Define contracts for HTTP request handling.
 * All controllers implement these interfaces for consistency.
 */

import type { Request, Response } from 'express';

/**
 * Command Controller Interface
 * Handles all command execution operations
 */
export interface ICommandController {
  /**
   * Execute single command
   * POST /api/command/execute
   */
  executeCommand(req: Request, res: Response): Promise<void>;

  /**
   * Execute batch of commands
   * POST /api/command/batch
   */
  executeBatch(req: Request, res: Response): Promise<void>;

  /**
   * Manage systemd services
   * POST /api/command/service
   */
  manageService(req: Request, res: Response): Promise<void>;
}

/**
 * Resource Controller Interface
 * Handles system resource queries and process management
 */
export interface IResourceController {
  /**
   * Get system resources (CPU, memory, disk)
   * GET /api/resources
   */
  getResources(req: Request, res: Response): Promise<void>;

  /**
   * Get process list
   * GET /api/resources/processes
   */
  getProcesses(req: Request, res: Response): Promise<void>;

  /**
   * Kill a process
   * DELETE /api/resources/process/:pid
   */
  killProcess(req: Request, res: Response): Promise<void>;

  /**
   * Set process priority
   * POST /api/resources/process/:pid/priority
   */
  setPriority(req: Request, res: Response): Promise<void>;

  /**
   * Get network statistics
   * GET /api/resources/network
   */
  getNetwork(req: Request, res: Response): Promise<void>;
}

/**
 * Service Controller Interface
 * Handles service management and health checks
 */
export interface IServiceController {
  /**
   * List active services
   * GET /api/services
   */
  listServices(req: Request, res: Response): Promise<void>;

  /**
   * Get service health
   * GET /api/services/:name/health
   */
  getServiceHealth(req: Request, res: Response): Promise<void>;
}
