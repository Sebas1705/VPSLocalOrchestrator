import express, { type Request, type Response, type Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { listMetrics } from '../services/metricsManager.js';
import {
  aggregateMetrics,
  createSnapshot,
  detectTrend,
  type AggregationType,
} from '../services/analyticsManager.js';

const router: Router = express.Router();

router.use(requireAuth);

function getPeriodDates(period?: string): { from: string; to: string } {
  const now = new Date();
  let from = now;

  if (period === '1h') from = new Date(now.getTime() - 3600000);
  else if (period === '24h') from = new Date(now.getTime() - 86400000);
  else if (period === '7d') from = new Date(now.getTime() - 604800000);
  else from = new Date(now.getTime() - 3600000); // default 1h

  return {
    from: from.toISOString(),
    to: now.toISOString(),
  };
}

router.get('/snapshot', async (req: Request, res: Response) => {
  try {
    const allMetrics = await listMetrics({});
    const snapshot = createSnapshot(allMetrics);
    res.json({ success: true, data: snapshot });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/aggregate', async (req: Request, res: Response) => {
  try {
    const { metric, type = 'avg', period = '1h' } = req.query;

    if (!metric || typeof metric !== 'string') {
      return res.status(400).json({ success: false, error: 'metric name is required' });
    }

    const aggType = (type as string).toLowerCase();
    if (!['sum', 'avg', 'count', 'min', 'max'].includes(aggType)) {
      return res.status(400).json({ success: false, error: 'invalid aggregation type' });
    }

    const { from, to } = getPeriodDates(period as string);
    const allMetrics = await listMetrics({});
    const aggregate = aggregateMetrics(allMetrics, metric, aggType as AggregationType, from, to);

    res.json({ success: true, data: aggregate });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/trend', async (req: Request, res: Response) => {
  try {
    const { metric, period = '1h' } = req.query;

    if (!metric || typeof metric !== 'string') {
      return res.status(400).json({ success: false, error: 'metric name is required' });
    }

    const { from, to } = getPeriodDates(period as string);
    const allMetrics = await listMetrics({});
    const trend = detectTrend(allMetrics, metric, from, to);

    res.json({ success: true, data: trend });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
