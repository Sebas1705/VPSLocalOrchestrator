/**
 * Schema Migration Routes
 * 
 * Endpoints for managing API schema versions and migrations
 * 
 * @module routes/migration.routes
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  getSchemaMigrationManager,
  initializeSchemaMigrations,
} from '../infrastructure/schema/migration.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getLogger } from '../config/index.js';

const logger = getLogger('migration-routes');
const router = Router();

// Initialize with current API version
const migrationManager = initializeSchemaMigrations('6.2.0', 'header');

/**
 * GET /api/migrations/versions
 * Get all registered schema versions
 */
router.get('/versions', (req: Request, res: Response) => {
  try {
    const versions = migrationManager.getAllVersions();

    res.json({
      versions: versions.map((v) => ({
        version: v.version,
        status: v.status,
        releaseDate: v.releaseDate,
        changes: v.changes.length,
        breakingChanges: v.breakingChanges?.length || 0,
        deprecations: v.deprecations?.length || 0,
        sunsetDate: v.sunsetDate,
      })),
    });
  } catch (error) {
    logger.error('Failed to get versions', error as Error);
    res.status(500).json({ error: 'Failed to get versions' });
  }
});

/**
 * GET /api/migrations/versions/:version
 * Get specific version details
 */
router.get('/versions/:version', (req: Request, res: Response) => {
  try {
    const { version } = req.params as { version?: string };
    if (!version) {
      res.status(400).json({ error: 'Version required' });
      return;
    }

    const versionInfo = migrationManager.getVersion(version);

    if (!versionInfo) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }

    const status = migrationManager.getVersionStatus(version);

    res.json({
      ...versionInfo,
      status: status?.status,
      daysUntilSunset: status?.daysUntilSunset,
      supported: migrationManager.isSupported(version),
    });
  } catch (error) {
    logger.error('Failed to get version', error as Error);
    res.status(500).json({ error: 'Failed to get version' });
  }
});

/**
 * GET /api/migrations/supported
 * Get supported versions
 */
router.get('/supported', (req: Request, res: Response) => {
  try {
    const supported = migrationManager.getSupportedVersions();

    res.json({
      count: supported.length,
      versions: supported,
    });
  } catch (error) {
    logger.error('Failed to get supported versions', error as Error);
    res.status(500).json({ error: 'Failed to get supported versions' });
  }
});

/**
 * GET /api/migrations/compatibility/:from/:to
 * Check compatibility between versions
 */
router.get('/compatibility/:from/:to', (req: Request, res: Response) => {
  try {
    const { from, to } = req.params as { from?: string; to?: string };

    if (!from || !to) {
      res.status(400).json({ error: 'From and to versions required' });
      return;
    }

    const compatibility = migrationManager.checkCompatibility(from, to);

    res.json({
      from,
      to,
      compatible: compatibility.compatible,
      breakingChanges: compatibility.breaking,
      deprecations: compatibility.deprecations,
    });
  } catch (error) {
    logger.error('Failed to check compatibility', error as Error);
    res.status(500).json({ error: 'Failed to check compatibility' });
  }
});

/**
 * GET /api/migrations/guide/:from/:to
 * Get migration guide
 */
router.get('/guide/:from/:to', (req: Request, res: Response) => {
  try {
    const { from, to } = req.params as { from?: string; to?: string };

    if (!from || !to) {
      res.status(400).json({ error: 'From and to versions required' });
      return;
    }

    const guide = migrationManager.generateMigrationGuide(from, to);

    res.type('text/markdown').send(guide);
  } catch (error) {
    logger.error('Failed to generate migration guide', error as Error);
    res.status(500).json({ error: 'Failed to generate migration guide' });
  }
});

/**
 * GET /api/migrations/deprecations
 * Get deprecation schedule
 */
router.get('/deprecations', (req: Request, res: Response) => {
  try {
    const schedule = migrationManager.getDeprecationSchedule();

    res.json({
      count: schedule.length,
      schedule,
    });
  } catch (error) {
    logger.error('Failed to get deprecation schedule', error as Error);
    res.status(500).json({ error: 'Failed to get deprecation schedule' });
  }
});

/**
 * POST /api/migrations/validate
 * Validate request against schema version
 */
router.post('/validate', requireAuth, (req: Request, res: Response) => {
  try {
    const { version, endpoint } = req.body as {
      version?: string;
      endpoint?: string;
    };

    if (!version || !endpoint) {
      res.status(400).json({ error: 'Version and endpoint required' });
      return;
    }

    const validation = migrationManager.validateRequest(version, endpoint);

    res.json({
      version,
      endpoint,
      valid: validation.valid,
      warnings: validation.warnings,
      errors: validation.errors,
    });
  } catch (error) {
    logger.error('Failed to validate request', error as Error);
    res.status(500).json({ error: 'Failed to validate request' });
  }
});

/**
 * POST /api/migrations/register
 * Register new schema version (requires auth)
 */
router.post('/register', requireAuth, (req: Request, res: Response) => {
  try {
    const { version, releaseDate, status, changes, breakingChanges, deprecations } = req.body as any;

    if (!version || !releaseDate || !status) {
      res.status(400).json({ error: 'Version, releaseDate, and status required' });
      return;
    }

    migrationManager.registerVersion({
      version,
      releaseDate,
      status,
      changes: changes || [],
      breakingChanges: breakingChanges || [],
      deprecations: deprecations || [],
    });

    logger.info('Schema version registered', { version });

    res.json({
      message: 'Schema version registered',
      version,
    });
  } catch (error) {
    logger.error('Failed to register version', error as Error);
    res.status(500).json({ error: 'Failed to register version' });
  }
});

export default router;
