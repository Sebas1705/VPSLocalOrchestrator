import express, { type Request, type Response, type Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  listContainers,
  listImages,
  startContainer,
  stopContainer,
} from '../services/dockerManager.js';

const router: Router = express.Router();

router.use(requireAuth);

router.get('/containers', async (req: Request, res: Response) => {
  try {
    const containers = await listContainers();
    res.json({ success: true, count: containers.length, data: containers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/images', async (req: Request, res: Response) => {
  try {
    const images = await listImages();
    res.json({ success: true, count: images.length, data: images });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/containers/:id/start', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!id) {
      return res.status(400).json({ success: false, error: 'container id is required' });
    }
    const result = await startContainer(id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/containers/:id/stop', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!id) {
      return res.status(400).json({ success: false, error: 'container id is required' });
    }
    const result = await stopContainer(id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
