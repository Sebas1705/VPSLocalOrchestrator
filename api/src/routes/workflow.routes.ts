import express, { type Request, type Response, type Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  createWorkflow,
  listWorkflows,
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  runWorkflow,
  getWorkflowHistory,
} from '../services/workflowManager.js';

const router: Router = express.Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  try {
    const workflows = await listWorkflows();
    res.json({ success: true, count: workflows.length, data: workflows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, steps } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    if (!steps) {
      return res.status(400).json({ success: false, error: 'steps are required' });
    }
    const workflow = await createWorkflow(name, steps);
    res.status(201).json({ success: true, data: workflow });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const limitRaw = req.query.limit;
    const limit = limitRaw !== undefined ? Number(limitRaw) : 20;

    if (Number.isNaN(limit) || limit <= 0) {
      return res.status(400).json({ success: false, error: 'limit must be a positive number' });
    }

    const history = await getWorkflowHistory(id, limit);
    res.json({ success: true, count: history.length, data: history });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const workflow = await getWorkflow(id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.json({ success: true, data: workflow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, active, steps } = req.body;
    if (name === undefined && active === undefined && steps === undefined) {
      return res.status(400).json({ success: false, error: 'At least one field (name, active, steps) is required' });
    }
    const updated = await updateWorkflow(id, { name, active, steps });
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const deleted = await deleteWorkflow(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/run', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await runWorkflow(id);
    res.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.message.includes('not found') || error.message.includes('inactive') ? 404 : 400;
    res.status(status).json({ success: false, error: error.message });
  }
});

export default router;
