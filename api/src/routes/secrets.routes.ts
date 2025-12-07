import express, { type Request, type Response, type Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  createSecret,
  listSecrets,
  getSecret,
  updateSecret,
  deleteSecret,
} from '../services/secretsManager.js';

const router: Router = express.Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  try {
    const secrets = await listSecrets();
    res.json({ success: true, count: secrets.length, data: secrets });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, value, tags } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    if (typeof value !== 'string') {
      return res.status(400).json({ success: false, error: 'value is required' });
    }

    const secret = await createSecret(name, value, tags || []);
    res.status(201).json({ success: true, data: secret });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const secret = await getSecret(id);
    if (!secret) {
      return res.status(404).json({ success: false, error: 'Secret not found' });
    }
    res.json({ success: true, data: secret });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, value, tags } = req.body;

    if (name === undefined && value === undefined && tags === undefined) {
      return res.status(400).json({ success: false, error: 'At least one field (name, value, tags) is required' });
    }

    const secret = await updateSecret(id, { name, value, tags });
    if (!secret) {
      return res.status(404).json({ success: false, error: 'Secret not found' });
    }

    res.json({ success: true, data: secret });
  } catch (error: any) {
    const status = error.message.includes('10KB') || error.message.includes('name') || error.message.includes('tags') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const deleted = await deleteSecret(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Secret not found' });
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
