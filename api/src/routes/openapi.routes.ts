/**
 * OpenAPI Schema Routes
 * 
 * Endpoints for serving OpenAPI specification
 * Used for documentation and client generation
 * 
 * @module routes/openapi.routes
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getOpenAPIBuilder, initializeOpenAPI } from '../infrastructure/schema/openapi.js';
import { getLogger } from '../config/index.js';

const logger = getLogger('openapi-routes');
const router = Router();

// Initialize OpenAPI on module load
const openapi = initializeOpenAPI();

// Add endpoints to OpenAPI spec
openapi
  .addTag('Health', 'Health check endpoints')
  .addTag('Metrics', 'Metrics and monitoring')
  .addTag('Jobs', 'Job queue management')
  .addTag('Rate Limits', 'Rate limiting management')
  .addTag('Commands', 'Command execution')
  .addTag('Resources', 'System resource monitoring')
  .addTag('Circuit Breakers', 'Resilience patterns');

/**
 * GET /api/schema
 * Get OpenAPI specification as JSON
 */
router.get('/schema', (req: Request, res: Response) => {
  try {
    res.json(openapi.getSpec());
  } catch (error) {
    logger.error('Failed to get OpenAPI spec', error as Error);
    res.status(500).json({ error: 'Failed to get OpenAPI spec' });
  }
});

/**
 * GET /api/schema/json
 * Get OpenAPI specification as JSON (explicit)
 */
router.get('/schema/json', (req: Request, res: Response) => {
  try {
    res.type('application/json');
    res.send(openapi.toJSON());
  } catch (error) {
    logger.error('Failed to get OpenAPI schema', error as Error);
    res.status(500).json({ error: 'Failed to get OpenAPI schema' });
  }
});

/**
 * GET /api/schema/yaml
 * Get OpenAPI specification as YAML
 */
router.get('/schema/yaml', (req: Request, res: Response) => {
  try {
    res.type('application/x-yaml');
    res.send(openapi.toYAML());
  } catch (error) {
    logger.error('Failed to get OpenAPI schema', error as Error);
    res.status(500).json({ error: 'Failed to get OpenAPI schema' });
  }
});

/**
 * GET /api/schema/info
 * Get API info from schema
 */
router.get('/schema/info', (req: Request, res: Response) => {
  try {
    const spec = openapi.getSpec();
    res.json({
      title: spec.info.title,
      version: spec.info.version,
      description: spec.info.description,
      endpoints: Object.keys(spec.paths).length,
      tags: spec.tags?.length || 0,
    });
  } catch (error) {
    logger.error('Failed to get schema info', error as Error);
    res.status(500).json({ error: 'Failed to get schema info' });
  }
});

export default router;
