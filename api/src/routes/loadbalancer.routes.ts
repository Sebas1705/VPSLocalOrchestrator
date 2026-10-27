import express, { type Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  listBackends,
  addBackend,
  drainBackend,
  enableBackend,
  deleteBackend,
} from '../services/loadBalancerManager.js';

const router: Router = express.Router();

router.use(requireAuth);

router.get('/backends', async (req, res) => {
  try {
    const backends = await listBackends();
    res.json({ success: true, count: backends.length, data: backends });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/backends', async (req, res) => {
  try {
    const { address } = req.body;
    const backend = await addBackend(address);
    res.status(201).json({ success: true, data: backend });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/backends/:id/drain', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'id is required' });
    }
    const backend = await drainBackend(id);
    res.json({ success: true, data: backend });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.post('/backends/:id/enable', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'id is required' });
    }
    const backend = await enableBackend(id);
    res.json({ success: true, data: backend });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.delete('/backends/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'id is required' });
    }
    await deleteBackend(id);
    res.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
});

export default router;
