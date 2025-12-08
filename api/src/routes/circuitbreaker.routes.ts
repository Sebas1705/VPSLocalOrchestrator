/**
 * Circuit Breaker Routes
 * 
 * Management endpoints for circuit breakers and back-pressure
 * 
 * @module routes/circuitbreaker.routes
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  getCircuitBreakerRegistry,
  getBackPressureManager,
  CircuitState,
} from '../infrastructure/circuitbreaker/index.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getLogger } from '../config/index.js';

const logger = getLogger('circuitbreaker-routes');
const router = Router();

/**
 * GET /api/circuitbreakers
 * Get all circuit breakers status
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const registry = getCircuitBreakerRegistry();
    const stats = registry.getAllStats();

    res.json({
      count: stats.length,
      breakers: stats,
    });
  } catch (error) {
    logger.error('Failed to get circuit breakers', error as Error);
    res.status(500).json({ error: 'Failed to get circuit breakers' });
  }
});

/**
 * GET /api/circuitbreakers/:name
 * Get specific circuit breaker status
 */
router.get('/:name', (req: Request, res: Response) => {
  try {
    const { name } = req.params as { name?: string };
    if (!name) {
      res.status(400).json({ error: 'Name parameter required' });
      return;
    }

    const registry = getCircuitBreakerRegistry();
    const breaker = registry.getBreaker(name);
    const stats = breaker.getStats();

    res.json({
      name,
      ...stats,
    });
  } catch (error) {
    logger.error('Failed to get circuit breaker', error as Error, {
      name: req.params.name,
    });
    res.status(500).json({ error: 'Failed to get circuit breaker' });
  }
});

/**
 * POST /api/circuitbreakers/:name/reset
 * Reset circuit breaker (requires auth)
 */
router.post('/:name/reset', requireAuth, (req: Request, res: Response) => {
  try {
    const { name } = req.params as { name?: string };
    if (!name) {
      res.status(400).json({ error: 'Name parameter required' });
      return;
    }

    const registry = getCircuitBreakerRegistry();
    const breaker = registry.getBreaker(name);
    
    breaker.reset();

    logger.info('Circuit breaker reset', { name });

    res.json({
      message: 'Circuit breaker reset',
      name,
      state: breaker.getState(),
    });
  } catch (error) {
    logger.error('Failed to reset circuit breaker', error as Error, {
      name: req.params.name,
    });
    res.status(500).json({ error: 'Failed to reset circuit breaker' });
  }
});

/**
 * POST /api/circuitbreakers/:name/state
 * Force circuit breaker state (requires auth)
 */
router.post('/:name/state', requireAuth, (req: Request, res: Response) => {
  try {
    const { name } = req.params as { name?: string };
    if (!name) {
      res.status(400).json({ error: 'Name parameter required' });
      return;
    }

    const { state } = req.body;

    if (!state || !Object.values(CircuitState).includes(state)) {
      res.status(400).json({
        error: 'Invalid state',
        validStates: Object.values(CircuitState),
      });
      return;
    }

    const registry = getCircuitBreakerRegistry();
    const breaker = registry.getBreaker(name);
    
    breaker.forceState(state);

    logger.warn('Circuit breaker state forced', { name, state });

    res.json({
      message: 'Circuit breaker state changed',
      name,
      state: breaker.getState(),
    });
  } catch (error) {
    logger.error('Failed to change circuit breaker state', error as Error, {
      name: req.params.name,
    });
    res.status(500).json({ error: 'Failed to change circuit breaker state' });
  }
});

/**
 * POST /api/circuitbreakers/reset-all
 * Reset all circuit breakers (requires auth)
 */
router.post('/actions/reset-all', requireAuth, (req: Request, res: Response) => {
  try {
    const registry = getCircuitBreakerRegistry();
    registry.resetAll();

    logger.info('All circuit breakers reset');

    res.json({
      message: 'All circuit breakers reset',
      count: registry.getAllStats().length,
    });
  } catch (error) {
    logger.error('Failed to reset all circuit breakers', error as Error);
    res.status(500).json({ error: 'Failed to reset all circuit breakers' });
  }
});

/**
 * GET /api/backpressure
 * Get back-pressure system status
 */
router.get('/backpressure/status', (req: Request, res: Response) => {
  try {
    const backPressure = getBackPressureManager();
    const stats = backPressure.getStats();

    res.json(stats);
  } catch (error) {
    logger.error('Failed to get back-pressure status', error as Error);
    res.status(500).json({ error: 'Failed to get back-pressure status' });
  }
});

export default router;
