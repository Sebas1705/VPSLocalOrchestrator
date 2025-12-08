import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getThreatDetector } from '../infrastructure/security/threat.js';
import type { ThreatType, ThreatSeverity, IncidentStatus } from '../infrastructure/security/threat.js';

const router = Router();

// Indicators
router.post('/indicators', requireAuth, (req: Request, res: Response): void => {
  try {
    const { type, severity, source, details } = req.body;
    if (!type || !severity || !source) {
      res.status(400).json({ error: 'type, severity, and source are required' });
      return;
    }
    const detector = getThreatDetector();
    const indicator = detector.recordIndicator({ type: type as ThreatType, severity: severity as ThreatSeverity, source, details: details || {} });
    res.json({ success: true, indicator });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record indicator', message: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/indicators', requireAuth, (req: Request, res: Response): void => {
  try {
    const detector = getThreatDetector();
    const indicators = detector.listIndicators();
    res.json({ success: true, total: indicators.length, indicators });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list indicators', message: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/indicators/:id', requireAuth, (req: Request, res: Response): void => {
  try {
    const detector = getThreatDetector();
    const indicator = detector.getIndicator(req.params.id || '');
    if (!indicator) {
      res.status(404).json({ error: 'Indicator not found' });
      return;
    }
    res.json({ success: true, indicator });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get indicator', message: error instanceof Error ? error.message : String(error) });
  }
});

// Incidents
router.post('/incidents', requireAuth, (req: Request, res: Response): void => {
  try {
    const { type, severity, indicators, source } = req.body;
    if (!type || !severity || !source) {
      res.status(400).json({ error: 'type, severity, and source are required' });
      return;
    }
    const detector = getThreatDetector();
    const incident = detector.createIncident({ type: type as ThreatType, severity: severity as ThreatSeverity, indicators: indicators || [], source });
    res.json({ success: true, incident });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create incident', message: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/incidents', requireAuth, (req: Request, res: Response): void => {
  try {
    const detector = getThreatDetector();
    const incidents = detector.listIncidents();
    res.json({ success: true, total: incidents.length, incidents });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list incidents', message: error instanceof Error ? error.message : String(error) });
  }
});

router.put('/incidents/:id', requireAuth, (req: Request, res: Response): void => {
  try {
    const detector = getThreatDetector();
    const incident = detector.updateIncident(req.params.id || '', req.body);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json({ success: true, incident });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update incident', message: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/incidents/:id/resolve', requireAuth, (req: Request, res: Response): void => {
  try {
    const { resolution } = req.body;
    if (!resolution) {
      res.status(400).json({ error: 'resolution is required' });
      return;
    }
    const detector = getThreatDetector();
    const incident = detector.resolveIncident(req.params.id || '', resolution);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json({ success: true, incident });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve incident', message: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/incidents/:id/notes', requireAuth, (req: Request, res: Response): void => {
  try {
    const { note } = req.body;
    if (!note) {
      res.status(400).json({ error: 'note is required' });
      return;
    }
    const detector = getThreatDetector();
    const success = detector.addIncidentNote(req.params.id || '', note);
    if (!success) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add note', message: error instanceof Error ? error.message : String(error) });
  }
});

// IP Management
router.get('/ip/:ip/reputation', requireAuth, (req: Request, res: Response): void => {
  try {
    const detector = getThreatDetector();
    const reputation = detector.getIPReputation(req.params.ip || '');
    if (!reputation) {
      res.status(404).json({ error: 'IP reputation not found' });
      return;
    }
    res.json({ success: true, reputation });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get IP reputation', message: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/ip/:ip/block', requireAuth, (req: Request, res: Response): void => {
  try {
    const { reason } = req.body;
    const detector = getThreatDetector();
    const reputation = detector.blockIP(req.params.ip || '', reason || 'Manual block');
    res.json({ success: true, reputation });
  } catch (error) {
    res.status(500).json({ error: 'Failed to block IP', message: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/ip/:ip/unblock', requireAuth, (req: Request, res: Response): void => {
  try {
    const detector = getThreatDetector();
    const success = detector.unblockIP(req.params.ip || '');
    if (!success) {
      res.status(404).json({ error: 'IP not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unblock IP', message: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/ip/:ip/whitelist', requireAuth, (req: Request, res: Response): void => {
  try {
    const detector = getThreatDetector();
    detector.whitelistIP(req.params.ip || '');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to whitelist IP', message: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/ip/blocked', requireAuth, (req: Request, res: Response): void => {
  try {
    const detector = getThreatDetector();
    const blocked = detector.listBlockedIPs();
    res.json({ success: true, total: blocked.length, ips: blocked });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list blocked IPs', message: error instanceof Error ? error.message : String(error) });
  }
});

// Alerts
router.get('/alerts', requireAuth, (req: Request, res: Response): void => {
  try {
    const detector = getThreatDetector();
    const alerts = detector.listAlerts();
    res.json({ success: true, total: alerts.length, alerts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list alerts', message: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/alerts/:id/acknowledge', requireAuth, (req: Request, res: Response): void => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    const detector = getThreatDetector();
    const success = detector.acknowledgeAlert(req.params.id || '', userId);
    if (!success) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to acknowledge alert', message: error instanceof Error ? error.message : String(error) });
  }
});

// Patterns
router.get('/patterns', requireAuth, (req: Request, res: Response): void => {
  try {
    const detector = getThreatDetector();
    const patterns = detector.listPatterns();
    res.json({ success: true, total: patterns.length, patterns });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list patterns', message: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/patterns/:id/enable', requireAuth, (req: Request, res: Response): void => {
  try {
    const detector = getThreatDetector();
    const success = detector.enablePattern(req.params.id || '');
    if (!success) {
      res.status(404).json({ error: 'Pattern not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to enable pattern', message: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/patterns/:id/disable', requireAuth, (req: Request, res: Response): void => {
  try {
    const detector = getThreatDetector();
    const success = detector.disablePattern(req.params.id || '');
    if (!success) {
      res.status(404).json({ error: 'Pattern not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disable pattern', message: error instanceof Error ? error.message : String(error) });
  }
});

// Stats & Health
router.get('/stats', requireAuth, (req: Request, res: Response): void => {
  try {
    const detector = getThreatDetector();
    const stats = detector.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats', message: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/health', (req: Request, res: Response): void => {
  try {
    const detector = getThreatDetector();
    const stats = detector.getStats();
    res.json({ status: 'healthy', stats, timestamp: new Date() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error instanceof Error ? error.message : String(error), timestamp: new Date() });
  }
});

export default router;
