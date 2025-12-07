import express, { type Request, type Response, type Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { backupDatabase, databaseStatus } from '../services/databaseManager.js';

const router: Router = express.Router();

router.use(requireAuth);

router.get('/status', async (req: Request, res: Response) => {
  try {
    const { type = 'postgresql', name } = req.query;
    const result = await databaseStatus(String(type), name as string | undefined);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/backup', async (req: Request, res: Response) => {
  try {
    const { type = 'postgresql', name, destination } = req.body;
    const result = await backupDatabase(String(type), name, destination);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message.includes('access denied') ? 403 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
});

export default router;
