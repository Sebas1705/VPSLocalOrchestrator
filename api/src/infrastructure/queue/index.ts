/**
 * Job Queue Infrastructure
 * 
 * Abstraction for long-running command execution with queue semantics
 * Compatible with Redis/Kafka backends but starts with in-memory implementation
 * 
 * @module infrastructure/queue
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { getLogger } from '../../config/index.js';

const logger = getLogger('job-queue');

/**
 * Job status
 */
export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

/**
 * Job priority
 */
export enum JobPriority {
  LOW = 0,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 15,
}

/**
 * Job data
 */
export interface Job<T = any> {
  id: string;
  type: string;
  payload: T;
  priority: JobPriority;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  timeout: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
  abortController?: AbortController;
}

/**
 * Job processor function - receives abort signal for cancellation
 */
export type JobProcessor<T = any> = (
  job: Job<T>,
  signal: AbortSignal
) => Promise<any>;

/**
 * Queue options
 */
export interface QueueOptions {
  maxConcurrency?: number;
  defaultTimeout?: number;
  defaultMaxAttempts?: number;
  processingInterval?: number;
}

/**
 * Job Queue - manages job lifecycle
 */
export class JobQueue extends EventEmitter {
  private jobs: Map<string, Job> = new Map();
  private processors: Map<string, JobProcessor> = new Map();
  private runningJobs: Set<string> = new Set();
  private processingTimer?: NodeJS.Timeout;
  
  private readonly maxConcurrency: number;
  private readonly defaultTimeout: number;
  private readonly defaultMaxAttempts: number;
  private readonly processingInterval: number;

  constructor(options: QueueOptions = {}) {
    super();
    this.maxConcurrency = options.maxConcurrency || 10;
    this.defaultTimeout = options.defaultTimeout || 300000; // 5 minutes
    this.defaultMaxAttempts = options.defaultMaxAttempts || 3;
    this.processingInterval = options.processingInterval || 1000; // 1 second

    logger.info('Job queue initialized', {
      maxConcurrency: this.maxConcurrency,
      defaultTimeout: this.defaultTimeout,
      defaultMaxAttempts: this.defaultMaxAttempts,
    });
  }

  /**
   * Register job processor
   */
  registerProcessor(
    jobType: string,
    processor: JobProcessor
  ): void {
    this.processors.set(jobType, processor);
    logger.info('Registered job processor', { jobType });
  }

  /**
   * Add job to queue
   */
  async addJob<T = any>(
    type: string,
    payload: T,
    options: {
      priority?: JobPriority;
      timeout?: number;
      maxAttempts?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<Job<T>> {
    const job: Job<T> = {
      id: randomUUID(),
      type,
      payload,
      priority: options.priority || JobPriority.NORMAL,
      status: JobStatus.PENDING,
      attempts: 0,
      maxAttempts: options.maxAttempts || this.defaultMaxAttempts,
      timeout: options.timeout || this.defaultTimeout,
      createdAt: Date.now(),
    };

    // Only add metadata if provided
    if (options.metadata !== undefined) {
      job.metadata = options.metadata;
    }

    this.jobs.set(job.id, job);

    logger.info('Job added to queue', {
      jobId: job.id,
      type: job.type,
      priority: job.priority,
    });

    this.emit('job:added', job);

    // Start processing if not already running
    if (!this.processingTimer) {
      this.startProcessing();
    }

    return job;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: JobStatus): Job[] {
    return Array.from(this.jobs.values()).filter((job) => job.status === status);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === JobStatus.PENDING) {
      job.status = JobStatus.CANCELLED;
      job.completedAt = Date.now();

      logger.info('Job cancelled', { jobId });
      this.emit('job:cancelled', job);
      return true;
    }

    if (job.status === JobStatus.RUNNING) {
      // Trigger abort controller
      if (job.abortController) {
        job.abortController.abort();
      }
      
      // Mark for cancellation
      job.status = JobStatus.CANCELLED;
      job.completedAt = Date.now();

      logger.warn('Running job cancelled via abort signal', { jobId });
      this.emit('job:cancelled', job);
      return true;
    }

    return false;
  }

  /**
   * Cancel all jobs matching criteria
   */
  async cancelAllJobs(filter?: {
    type?: string;
    status?: JobStatus;
  }): Promise<number> {
    let cancelled = 0;

    for (const job of this.jobs.values()) {
      if (filter?.type && job.type !== filter.type) continue;
      if (filter?.status && job.status !== filter.status) continue;

      const result = await this.cancelJob(job.id);
      if (result) cancelled++;
    }

    logger.info('Bulk job cancellation', { cancelled, filter });
    return cancelled;
  }

  /**
   * Retry failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== JobStatus.FAILED) return false;

    if (job.attempts >= job.maxAttempts) {
      logger.warn('Job max attempts reached, cannot retry', {
        jobId,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
      });
      return false;
    }

    job.status = JobStatus.PENDING;
    delete job.error;
    delete job.result;

    logger.info('Job marked for retry', { jobId, attempts: job.attempts });
    this.emit('job:retry', job);

    return true;
  }

  /**
   * Clear completed jobs
   */
  clearCompleted(olderThanMs?: number): number {
    const now = Date.now();
    let cleared = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        job.status === JobStatus.COMPLETED ||
        job.status === JobStatus.FAILED ||
        job.status === JobStatus.CANCELLED
      ) {
        if (!olderThanMs || (job.completedAt && now - job.completedAt > olderThanMs)) {
          this.jobs.delete(jobId);
          cleared++;
        }
      }
    }

    if (cleared > 0) {
      logger.info('Cleared completed jobs', { count: cleared });
    }

    return cleared;
  }

  /**
   * Start processing jobs
   */
  private startProcessing(): void {
    this.processingTimer = setInterval(() => {
      this.processNextJobs().catch((error) => {
        logger.error('Error processing jobs', error);
      });
    }, this.processingInterval);

    logger.info('Job processing started');
  }

  /**
   * Stop processing jobs
   */
  stopProcessing(): void {
    if (this.processingTimer !== undefined) {
      clearInterval(this.processingTimer);
      delete (this as any).processingTimer;
      logger.info('Job processing stopped');
    }
  }

  /**
   * Process next available jobs
   */
  private async processNextJobs(): Promise<void> {
    // Check if we can process more jobs
    const availableSlots = this.maxConcurrency - this.runningJobs.size;
    if (availableSlots <= 0) return;

    // Get pending jobs sorted by priority
    const pendingJobs = Array.from(this.jobs.values())
      .filter((job) => job.status === JobStatus.PENDING)
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)
      .slice(0, availableSlots);

    // Process jobs
    for (const job of pendingJobs) {
      this.processJob(job).catch((error) => {
        logger.error('Unhandled error processing job', error, { jobId: job.id });
      });
    }
  }

  /**
   * Process individual job
   */
  private async processJob(job: Job): Promise<void> {
    const processor = this.processors.get(job.type);
    if (!processor) {
      job.status = JobStatus.FAILED;
      job.error = `No processor registered for job type: ${job.type}`;
      job.completedAt = Date.now();
      this.emit('job:failed', job);
      return;
    }

    // Create abort controller for cancellation
    job.abortController = new AbortController();

    // Mark as running
    job.status = JobStatus.RUNNING;
    job.startedAt = Date.now();
    job.attempts++;
    this.runningJobs.add(job.id);

    logger.info('Processing job', {
      jobId: job.id,
      type: job.type,
      attempt: job.attempts,
    });

    this.emit('job:started', job);

    try {
      // Execute with timeout and abort signal
      const result = await this.executeWithTimeout(
        processor(job, job.abortController.signal),
        job.timeout
      );

      // Check if cancelled during execution (status can change externally)
      // @ts-expect-error - Status can be changed to CANCELLED by cancelJob during execution
      if (job.status === JobStatus.CANCELLED) {
        logger.info('Job was cancelled during execution', { jobId: job.id });
        return;
      }

      // Mark as completed
      job.status = JobStatus.COMPLETED;
      job.result = result;
      job.completedAt = Date.now();

      logger.info('Job completed', {
        jobId: job.id,
        duration: job.completedAt - (job.startedAt || job.createdAt),
      });

      this.emit('job:completed', job);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('timeout')) {
        job.status = JobStatus.TIMEOUT;
        job.error = `Job timed out after ${job.timeout}ms`;
      } else if (job.attempts >= job.maxAttempts) {
        job.status = JobStatus.FAILED;
        job.error = errorMessage;
      } else {
        // Retry
        job.status = JobStatus.PENDING;
        job.error = errorMessage;
        logger.warn('Job failed, will retry', {
          jobId: job.id,
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
          error: errorMessage,
        });
        this.emit('job:retry', job);
        return;
      }

      job.completedAt = Date.now();

      logger.error('Job failed permanently', error as Error, {
        jobId: job.id,
        attempts: job.attempts,
      });

      this.emit('job:failed', job);
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  /**
   * Execute promise with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Get queue statistics
   */
  getStatistics(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
    timeout: number;
  } {
    const jobs = Array.from(this.jobs.values());

    return {
      total: jobs.length,
      pending: jobs.filter((j) => j.status === JobStatus.PENDING).length,
      running: jobs.filter((j) => j.status === JobStatus.RUNNING).length,
      completed: jobs.filter((j) => j.status === JobStatus.COMPLETED).length,
      failed: jobs.filter((j) => j.status === JobStatus.FAILED).length,
      cancelled: jobs.filter((j) => j.status === JobStatus.CANCELLED).length,
      timeout: jobs.filter((j) => j.status === JobStatus.TIMEOUT).length,
    };
  }

  /**
   * Wait for job completion
   */
  async waitForJob(jobId: string, timeoutMs = 60000): Promise<Job> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Already completed
    if (
      job.status === JobStatus.COMPLETED ||
      job.status === JobStatus.FAILED ||
      job.status === JobStatus.CANCELLED ||
      job.status === JobStatus.TIMEOUT
    ) {
      return job;
    }

    // Wait for completion
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for job ${jobId}`));
      }, timeoutMs);

      const onCompleted = (completedJob: Job) => {
        if (completedJob.id === jobId) {
          cleanup();
          resolve(completedJob);
        }
      };

      const onFailed = (failedJob: Job) => {
        if (failedJob.id === jobId) {
          cleanup();
          resolve(failedJob);
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.off('job:completed', onCompleted);
        this.off('job:failed', onFailed);
        this.off('job:cancelled', onFailed);
        this.off('job:timeout', onFailed);
      };

      this.on('job:completed', onCompleted);
      this.on('job:failed', onFailed);
      this.on('job:cancelled', onFailed);
    });
  }
}

/**
 * Global job queue instance
 */
let globalQueue: JobQueue | null = null;

/**
 * Initialize global job queue
 */
export function initializeJobQueue(options?: QueueOptions): JobQueue {
  if (!globalQueue) {
    globalQueue = new JobQueue(options);
  }
  return globalQueue;
}

/**
 * Get global job queue instance
 */
export function getJobQueue(): JobQueue {
  if (!globalQueue) {
    return initializeJobQueue();
  }
  return globalQueue;
}
