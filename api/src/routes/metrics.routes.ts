import express, { type Request, type Response, type Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { addMetric, listMetrics } from '../services/metricsManager.js';

const router: Router = express.Router();

router.use(requireAuth);

router.post('/custom', async (req: Request, res: Response) => {
  try {
    const { name, value, tags, timestamp } = req.body;
    const metric = await addMetric(name, value, tags, timestamp);
    res.status(201).json({ success: true, data: metric });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { name, from, to, limit } = req.query;
    let limitNum: number | undefined;
    if (limit !== undefined) {
      const parsed = Number(limit);
      if (Number.isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({ success: false, error: 'limit must be a positive number' });
      }
      limitNum = parsed;
    }

    const nameStr = typeof name === 'string' ? name : undefined;
    const fromStr = typeof from === 'string' ? from : undefined;
    const toStr = typeof to === 'string' ? to : undefined;

    const query: Parameters<typeof listMetrics>[0] = {};
    if (nameStr) query.name = nameStr;
    if (fromStr) query.from = fromStr;
    if (toStr) query.to = toStr;
    if (limitNum !== undefined) query.limit = limitNum;

    const metrics = await listMetrics(query);

    res.json({ success: true, count: metrics.length, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
