import express, { type Request, type Response, type Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  createBackup,
  listBackups,
  getBackupPath,
  getBackupMeta,
  deleteBackup,
  restoreBackup,
} from '../services/backupManager.js';
import path from 'path';

const router: Router = express.Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  try {
    const backups = await listBackups();
    res.json({ success: true, count: backups.length, data: backups });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { paths, name } = req.body;

    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ success: false, error: 'paths array is required' });
    }

    const backup = await createBackup(paths, name);
    res.status(201).json({ success: true, data: backup });
  } catch (error: any) {
    const status = error.message.includes('Path access denied') || error.message.includes('not found')
      ? 400
      : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.post('/:name/restore', async (req: Request, res: Response) => {
  try {
    const name = req.params.name as string;
    const { destination } = req.body;

    if (!destination) {
      return res.status(400).json({ success: false, error: 'destination is required' });
    }

    const result = await restoreBackup(name, destination);
    res.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message.includes('denied') || error.message.includes('required') || error.message.includes('not found')
      ? 400
      : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.get('/:name', async (req: Request, res: Response) => {
  try {
    const name = req.params.name as string;
    if (req.query.info === 'true') {
      const meta = await getBackupMeta(name);
      return res.json({ success: true, data: meta });
    }
    const backupPath = await getBackupPath(name);
    return res.download(backupPath, path.basename(backupPath));
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.delete('/:name', async (req: Request, res: Response) => {
  try {
    const name = req.params.name as string;
    await deleteBackup(name);
    res.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

export default router;
