import { Router } from 'express';
import type { Request, Response } from 'express';
import { getEventProcessor, SagaStatus } from '../infrastructure/eventprocessor/index.js';
import { LoggerFactory } from '../infrastructure/logging/index.js';

const router = Router();
const logger = LoggerFactory.getInstance().getLogger();

/**
 * Event Processor Routes - v7.3.0
 * 
 * REST API for command execution and saga management
 */

// ============================================================================
// COMMAND EXECUTION
// ============================================================================

/**
 * POST /api/processor/commands
 * Execute a command (requires auth)
 */
router.post('/commands', async (req: Request, res: Response) => {
  const eventProcessor = getEventProcessor();
  const { type, aggregateId, payload, metadata } = req.body;

  if (!type || !aggregateId) {
    return res.status(400).json({ error: 'type and aggregateId are required' });
  }

  try {
    const commandRequest = {
      id: `cmd-${Date.now()}-${Math.random()}`,
      type,
      aggregateId,
      payload: payload || {},
      metadata: {
        ...metadata,
        correlationId: (req as any).correlationId
      },
      timestamp: new Date()
    };

    const result = await eventProcessor.executeCommand(commandRequest);

    const statusCode = result.status === 'success' ? 202 : 400;
    res.status(statusCode).json({
      commandId: result.commandId,
      status: result.status,
      eventId: result.eventId,
      error: result.error,
      result: result.result
    });
  } catch (error) {
    logger.error('Error executing command:', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Failed to execute command' });
  }
});

/**
 * GET /api/processor/commands/:commandId
 * Get command status (for reference)
 */
router.get('/commands/:commandId', (req: Request, res: Response) => {
  res.json({
    commandId: req.params.commandId,
    status: 'completed',
    message: 'Command execution status can be tracked via event store and event bus'
  });
});

// ============================================================================
// SAGA MANAGEMENT
// ============================================================================

/**
 * POST /api/processor/sagas
 * Start a saga (requires auth)
 */
router.post('/sagas', async (req: Request, res: Response) => {
  const eventProcessor = getEventProcessor();
  const { definitionId, aggregateId, metadata } = req.body;

  if (!definitionId || !aggregateId) {
    return res.status(400).json({ error: 'definitionId and aggregateId are required' });
  }

  try {
    const sagaMetadata = {
      ...metadata,
      correlationId: (req as any).correlationId
    };

    const sagaInstance = await eventProcessor.startSaga(definitionId, aggregateId, sagaMetadata);

    res.status(202).json({
      sagaId: sagaInstance.id,
      definitionId: sagaInstance.definitionId,
      aggregateId: sagaInstance.aggregateId,
      status: sagaInstance.status,
      currentStep: sagaInstance.currentStep,
      totalSteps: sagaInstance.steps.length,
      startedAt: sagaInstance.startedAt.toISOString(),
      links: {
        self: `/api/processor/sagas/${sagaInstance.id}`,
        events: `/api/processor/sagas/${sagaInstance.id}/events`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }
    logger.error('Error starting saga:', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Failed to start saga' });
  }
});

/**
 * GET /api/processor/sagas/:sagaId
 * Get saga instance status
 */
router.get('/sagas/:sagaId', (req: Request, res: Response) => {
  const eventProcessor = getEventProcessor();
  const sagaId = req.params.sagaId || '';
  const saga = eventProcessor.getSagaInstance(sagaId);

  if (!saga) {
    return res.status(404).json({ error: 'Saga not found' });
  }

  res.json({
    id: saga.id,
    definitionId: saga.definitionId,
    aggregateId: saga.aggregateId,
    status: saga.status,
    currentStep: saga.currentStep,
    totalSteps: saga.steps.length,
    completedSteps: saga.completedSteps,
    failedStep: saga.failedStep,
    startedAt: saga.startedAt.toISOString(),
    completedAt: saga.completedAt?.toISOString(),
    correlationId: saga.correlationId,
    progress: Math.round((saga.completedSteps.length / saga.steps.length) * 100)
  });
});

/**
 * GET /api/processor/sagas/:sagaId/steps
 * Get saga steps and current progress
 */
router.get('/sagas/:sagaId/steps', (req: Request, res: Response) => {
  const eventProcessor = getEventProcessor();
  const sagaId = req.params.sagaId || '';
  const saga = eventProcessor.getSagaInstance(sagaId);

  if (!saga) {
    return res.status(404).json({ error: 'Saga not found' });
  }

  res.json({
    sagaId: saga.id,
    currentStep: saga.currentStep,
    totalSteps: saga.steps.length,
    steps: saga.steps.map((step, index) => ({
      index,
      name: step.name,
      type: step.type,
      status: index < saga.currentStep ? 'completed' : index === saga.currentStep ? 'in-progress' : 'pending',
      compensatingEvent: step.compensatingEvent,
      timeout: step.timeout
    }))
  });
});

/**
 * GET /api/processor/sagas/by-aggregate/:aggregateId
 * Get active sagas for an aggregate
 */
router.get('/aggregates/:aggregateId/sagas', (req: Request, res: Response) => {
  const eventProcessor = getEventProcessor();
  const aggregateId = req.params.aggregateId || '';

  const activeSagas = eventProcessor.getActiveSagas(aggregateId);

  res.json({
    aggregateId,
    active: activeSagas.length,
    sagas: activeSagas.map(saga => ({
      id: saga.id,
      definitionId: saga.definitionId,
      status: saga.status,
      currentStep: saga.currentStep,
      totalSteps: saga.steps.length,
      startedAt: saga.startedAt.toISOString()
    }))
  });
});

// ============================================================================
// SAGA DEFINITIONS
// ============================================================================

/**
 * GET /api/processor/sagas/definitions
 * Get available saga definitions
 */
router.get('/definitions', (req: Request, res: Response) => {
  // This would normally fetch from the event processor's registered definitions
  // For now, return example definitions
  res.json({
    total: 0,
    definitions: [],
    message: 'Saga definitions are registered programmatically'
  });
});

/**
 * POST /api/processor/sagas/definitions
 * Register saga definition (requires auth)
 */
router.post('/definitions', (req: Request, res: Response) => {
  const eventProcessor = getEventProcessor();
  const { id, name, description, steps, timeout } = req.body;

  if (!id || !name || !steps || !Array.isArray(steps)) {
    return res.status(400).json({ error: 'id, name, and steps array are required' });
  }

  try {
    const definition = {
      id,
      name,
      description: description || '',
      steps,
      timeout: timeout || 300000
    };

    eventProcessor.registerSagaDefinition(definition);
    logger.info(`Saga definition registered: ${id}`);

    res.status(201).json({
      id: definition.id,
      name: definition.name,
      stepsCount: definition.steps.length,
      timeout: definition.timeout,
      message: 'Saga definition registered successfully'
    });
  } catch (error) {
    logger.error('Error registering saga definition:', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: 'Failed to register saga definition' });
  }
});

// ============================================================================
// MONITORING AND STATISTICS
// ============================================================================

/**
 * GET /api/processor/stats
 * Get processor statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  const eventProcessor = getEventProcessor();
  const stats = eventProcessor.getStats();

  res.json({
    summary: {
      totalSagas: stats.totalSagas,
      activeSagas: stats.activeSagas,
      completedSagas: stats.completedSagas,
      failedSagas: stats.failedSagas
    },
    handlers: {
      registered: stats.registeredHandlers,
      sagaDefinitions: stats.sagaDefinitions
    },
    successRate: stats.totalSagas > 0
      ? Math.round((stats.completedSagas / stats.totalSagas) * 100)
      : 0
  });
});

/**
 * GET /api/processor/sagas/history
 * Get saga execution history
 */
router.get('/history', (req: Request, res: Response) => {
  const eventProcessor = getEventProcessor();
  const aggregateId = req.query.aggregateId as string | undefined;

  const history = eventProcessor.getSagaHistory(aggregateId);

  const statusCounts: Record<string, number> = {};
  for (const saga of history) {
    statusCounts[saga.status] = (statusCounts[saga.status] || 0) + 1;
  }

  res.json({
    total: history.length,
    aggregateId: aggregateId || 'all',
    statuses: statusCounts,
    sagas: history.map(saga => ({
      id: saga.id,
      definitionId: saga.definitionId,
      aggregateId: saga.aggregateId,
      status: saga.status,
      startedAt: saga.startedAt.toISOString(),
      completedAt: saga.completedAt?.toISOString(),
      duration: saga.completedAt
        ? Math.round((saga.completedAt.getTime() - saga.startedAt.getTime()) / 1000)
        : null
    }))
  });
});

/**
 * GET /api/processor/health
 * Check processor health
 */
router.get('/health', (req: Request, res: Response) => {
  const eventProcessor = getEventProcessor();
  const stats = eventProcessor.getStats();

  const failureRate = stats.totalSagas > 0
    ? (stats.failedSagas / stats.totalSagas) * 100
    : 0;

  const healthy = failureRate < 10; // Less than 10% failure rate

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    metrics: {
      activeSagas: stats.activeSagas,
      completedSagas: stats.completedSagas,
      failedSagas: stats.failedSagas,
      failureRatePercent: Math.round(failureRate * 100) / 100,
      registeredHandlers: stats.registeredHandlers
    }
  });
});

export default router;
