/**
 * Job Queue Routes
 * 
 * Endpoints for managing long-running jobs:
 * - POST /api/jobs - Create new job
 * - GET /api/jobs - List all jobs
 * - GET /api/jobs/:id - Get job details
 * - DELETE /api/jobs/:id - Cancel job
 * - POST /api/jobs/:id/retry - Retry failed job
 * - GET /api/jobs/stats - Queue statistics
 * 
 * @module routes/jobs
 */

import { Router, type Request, type Response } from 'express';
import { getJobQueue, JobPriority, JobStatus } from '../infrastructure/queue/index.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getLogger } from '../config/index.js';

const router = Router();
const logger = getLogger('jobs-routes');
const queue = getJobQueue();

/**
 * Create new job
 * POST /api/jobs
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { type, payload, priority, timeout, maxAttempts, metadata } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Job type is required' });
    }

    if (!payload) {
      return res.status(400).json({ error: 'Job payload is required' });
    }

    const job = await queue.addJob(type, payload, {
      priority: priority !== undefined ? priority : JobPriority.NORMAL,
      timeout,
      maxAttempts,
      metadata,
    });

    logger.info('Job created via API', {
      jobId: job.id,
      type: job.type,
      priority: job.priority,
    });

    res.status(201).json({
      id: job.id,
      type: job.type,
      status: job.status,
      priority: job.priority,
      createdAt: new Date(job.createdAt).toISOString(),
      message: 'Job created successfully',
    });
  } catch (error) {
    logger.error('Failed to create job', error as Error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

/**
 * List all jobs with optional filtering
 * GET /api/jobs?status=pending&type=command
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, type, limit } = req.query;

    let jobs = queue.getAllJobs();

    // Filter by status
    if (status) {
      jobs = jobs.filter((job) => job.status === status);
    }

    // Filter by type
    if (type) {
      jobs = jobs.filter((job) => job.type === type);
    }

    // Limit results
    if (limit) {
      const limitNum = parseInt(limit as string, 10);
      jobs = jobs.slice(0, limitNum);
    }

    // Sort by creation date (newest first)
    jobs.sort((a, b) => b.createdAt - a.createdAt);

    res.json({
      total: jobs.length,
      jobs: jobs.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        priority: job.priority,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        createdAt: new Date(job.createdAt).toISOString(),
        startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : undefined,
        completedAt: job.completedAt ? new Date(job.completedAt).toISOString() : undefined,
        duration: job.completedAt && job.startedAt
          ? job.completedAt - job.startedAt
          : undefined,
        error: job.error,
        metadata: job.metadata,
      })),
    });
  } catch (error) {
    logger.error('Failed to list jobs', error as Error);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

/**
 * Get job by ID
 * GET /api/jobs/:id
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const job = queue.getJob(id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      id: job.id,
      type: job.type,
      status: job.status,
      priority: job.priority,
      payload: job.payload,
      result: job.result,
      error: job.error,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      timeout: job.timeout,
      createdAt: new Date(job.createdAt).toISOString(),
      startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : undefined,
      completedAt: job.completedAt ? new Date(job.completedAt).toISOString() : undefined,
      duration: job.completedAt && job.startedAt
        ? job.completedAt - job.startedAt
        : undefined,
      metadata: job.metadata,
    });
  } catch (error) {
    logger.error('Failed to get job', error as Error);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

/**
 * Cancel job
 * DELETE /api/jobs/:id
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const cancelled = await queue.cancelJob(id);

    if (!cancelled) {
      return res.status(400).json({ error: 'Job cannot be cancelled (not found or already completed)' });
    }

    logger.info('Job cancelled via API', { jobId: id });

    res.json({
      id,
      message: 'Job cancelled successfully',
    });
  } catch (error) {
    logger.error('Failed to cancel job', error as Error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

/**
 * Retry failed job
 * POST /api/jobs/:id/retry
 */
router.post('/:id/retry', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const retried = await queue.retryJob(id);

    if (!retried) {
      return res.status(400).json({
        error: 'Job cannot be retried (not found, not failed, or max attempts reached)',
      });
    }

    logger.info('Job retry requested via API', { jobId: id });

    res.json({
      id,
      message: 'Job marked for retry',
    });
  } catch (error) {
    logger.error('Failed to retry job', error as Error);
    res.status(500).json({ error: 'Failed to retry job' });
  }
});

/**
 * Get queue statistics
 * GET /api/jobs/stats
 */
router.get('/stats/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = queue.getStatistics();

    res.json({
      timestamp: new Date().toISOString(),
      statistics: stats,
    });
  } catch (error) {
    logger.error('Failed to get queue statistics', error as Error);
    res.status(500).json({ error: 'Failed to get queue statistics' });
  }
});

/**
 * Clear completed jobs
 * DELETE /api/jobs/completed
 */
router.delete('/completed/clear', requireAuth, async (req: Request, res: Response) => {
  try {
    const { olderThanMs } = req.query;
    const olderThan = olderThanMs && typeof olderThanMs === 'string' 
      ? parseInt(olderThanMs, 10) 
      : undefined;

    const cleared = queue.clearCompleted(olderThan);

    logger.info('Completed jobs cleared via API', { count: cleared });

    res.json({
      message: 'Completed jobs cleared',
      count: cleared,
    });
  } catch (error) {
    logger.error('Failed to clear completed jobs', error as Error);
    res.status(500).json({ error: 'Failed to clear completed jobs' });
  }
});

export default router;
