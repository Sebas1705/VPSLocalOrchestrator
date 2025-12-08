/**
 * Rate Limit Routes
 * 
 * Endpoints for managing and monitoring rate limits:
 * - GET /api/ratelimits/stats - Get rate limit stats for current token
 * - GET /api/ratelimits/all - Get all rate limit stats (admin)
 * - POST /api/ratelimits/config - Set rate limit config for token
 * - DELETE /api/ratelimits/reset - Reset rate limit for token
 * 
 * @module routes/ratelimits
 */

import { Router, type Request, type Response } from 'express';
import { getRateLimiter, RateLimitTiers } from '../infrastructure/ratelimit/index.js';
import { extractToken } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getLogger } from '../config/index.js';

const router = Router();
const logger = getLogger('ratelimits-routes');
const rateLimiter = getRateLimiter();

/**
 * Get rate limit stats for current token
 * GET /api/ratelimits/stats
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractToken(authHeader);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const stats = rateLimiter.getStats(token);

    res.json({
      token: token.substring(0, 10) + '...',
      stats: {
        tokensRemaining: stats.tokensRemaining,
        requestsInWindow: stats.requestsInWindow,
        concurrent: stats.concurrent,
        limits: {
          maxRequests: stats.config.maxRequests,
          maxConcurrent: stats.config.maxConcurrent,
          windowSize: stats.config.windowSize,
          refillRate: stats.config.refillRate,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get rate limit stats', error as Error);
    res.status(500).json({ error: 'Failed to get rate limit stats' });
  }
});

/**
 * Get all rate limit stats (admin endpoint)
 * GET /api/ratelimits/all
 */
router.get('/all', requireAuth, async (req: Request, res: Response) => {
  try {
    const allStats = rateLimiter.getAllStats();

    res.json({
      total: allStats.length,
      stats: allStats,
    });
  } catch (error) {
    logger.error('Failed to get all rate limit stats', error as Error);
    res.status(500).json({ error: 'Failed to get all rate limit stats' });
  }
});

/**
 * Set rate limit config for token
 * POST /api/ratelimits/config
 */
router.post('/config', requireAuth, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractToken(authHeader);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { tier, custom } = req.body;

    if (tier) {
      // Use predefined tier
      const config = RateLimitTiers[tier as keyof typeof RateLimitTiers];
      if (!config) {
        return res.status(400).json({
          error: 'Invalid tier',
          availableTiers: Object.keys(RateLimitTiers),
        });
      }

      rateLimiter.setConfig(token, config);

      logger.info('Rate limit tier set', {
        token: token.substring(0, 10) + '...',
        tier,
      });

      return res.json({
        message: 'Rate limit tier set successfully',
        tier,
        config,
      });
    }

    if (custom) {
      // Use custom config
      const { maxTokens, refillRate, windowSize, maxRequests, maxConcurrent } = custom;

      if (
        typeof maxTokens !== 'number' ||
        typeof refillRate !== 'number' ||
        typeof windowSize !== 'number' ||
        typeof maxRequests !== 'number' ||
        typeof maxConcurrent !== 'number'
      ) {
        return res.status(400).json({
          error: 'Invalid custom config',
          required: {
            maxTokens: 'number',
            refillRate: 'number',
            windowSize: 'number',
            maxRequests: 'number',
            maxConcurrent: 'number',
          },
        });
      }

      rateLimiter.setConfig(token, {
        maxTokens,
        refillRate,
        windowSize,
        maxRequests,
        maxConcurrent,
      });

      logger.info('Custom rate limit config set', {
        token: token.substring(0, 10) + '...',
        custom,
      });

      return res.json({
        message: 'Custom rate limit config set successfully',
        config: custom,
      });
    }

    res.status(400).json({
      error: 'Either tier or custom config is required',
      example: {
        tier: 'standard', // or 'free', 'premium', 'unlimited'
        // OR
        custom: {
          maxTokens: 50,
          refillRate: 5,
          windowSize: 60000,
          maxRequests: 300,
          maxConcurrent: 10,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to set rate limit config', error as Error);
    res.status(500).json({ error: 'Failed to set rate limit config' });
  }
});

/**
 * Reset rate limit for token
 * DELETE /api/ratelimits/reset
 */
router.delete('/reset', requireAuth, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractToken(authHeader);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    rateLimiter.reset(token);

    logger.info('Rate limit reset', {
      token: token.substring(0, 10) + '...',
    });

    res.json({
      message: 'Rate limit reset successfully',
    });
  } catch (error) {
    logger.error('Failed to reset rate limit', error as Error);
    res.status(500).json({ error: 'Failed to reset rate limit' });
  }
});

/**
 * Get available tiers
 * GET /api/ratelimits/tiers
 */
router.get('/tiers', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json({
      tiers: RateLimitTiers,
    });
  } catch (error) {
    logger.error('Failed to get rate limit tiers', error as Error);
    res.status(500).json({ error: 'Failed to get rate limit tiers' });
  }
});

export default router;
