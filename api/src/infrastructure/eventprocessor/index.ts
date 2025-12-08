import type { ILogger } from '../logging/index.js';
import { LoggerFactory } from '../logging/index.js';
import { getEventStore } from '../eventstore/index.js';
import { getEventBus } from '../events/index.js';

/**
 * Event-driven Command Processing - v7.3.0
 * 
 * Converts commands into events and manages sagas:
 * - Command routing to event creation
 * - Multi-step saga workflows
 * - Compensating transactions for failures
 * - Distributed coordination
 */

// ============================================================================
// COMMAND AND EVENT MAPPING
// ============================================================================

export interface CommandRequest {
  id: string;
  type: string;
  aggregateId: string;
  payload: any;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface CommandResult {
  commandId: string;
  status: 'success' | 'failure' | 'pending';
  eventId?: string;
  error?: string;
  result?: any;
}

export interface CommandHandler {
  canHandle(command: CommandRequest): boolean;
  handle(command: CommandRequest): Promise<any>;
}

// ============================================================================
// SAGA TYPES
// ============================================================================

export enum SagaStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated'
}

export interface SagaStep {
  name: string;
  type: 'event' | 'command' | 'action';
  input: any;
  compensatingEvent?: string;
  timeout?: number;
}

export interface SagaDefinition {
  id: string;
  name: string;
  description: string;
  steps: SagaStep[];
  correlationId?: string;
  timeout?: number;
}

export interface SagaInstance {
  id: string;
  definitionId: string;
  aggregateId: string;
  status: SagaStatus;
  currentStep: number;
  steps: SagaStep[];
  completedSteps: string[];
  failedStep?: string;
  startedAt: Date;
  completedAt?: Date;
  correlationId?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// EVENT PROCESSOR
// ============================================================================

export class EventProcessor {
  private commandHandlers: Map<string, CommandHandler[]> = new Map();
  private sagaDefinitions: Map<string, SagaDefinition> = new Map();
  private activeSagas: Map<string, SagaInstance> = new Map();
  private logger: ILogger;
  private commandIdCounter = 0;
  private sagaIdCounter = 0;

  constructor() {
    this.logger = LoggerFactory.getInstance().getLogger();
  }

  /**
   * Register command handler
   */
  registerCommandHandler(handler: CommandHandler): void {
    // Find all command types this handler can handle
    for (const eventType of this.getAllCommandTypes()) {
      const testCommand: CommandRequest = {
        id: 'test',
        type: eventType,
        aggregateId: 'test',
        payload: {},
        timestamp: new Date()
      };
      
      if (handler.canHandle(testCommand)) {
        if (!this.commandHandlers.has(eventType)) {
          this.commandHandlers.set(eventType, []);
        }
        this.commandHandlers.get(eventType)!.push(handler);
      }
    }
  }

  /**
   * Register saga definition
   */
  registerSagaDefinition(definition: SagaDefinition): void {
    this.sagaDefinitions.set(definition.id, definition);
    this.logger.info(`Saga definition registered: ${definition.id}`);
  }

  /**
   * Execute command and convert to events
   */
  async executeCommand(request: CommandRequest): Promise<CommandResult> {
    const result: CommandResult = {
      commandId: request.id,
      status: 'pending'
    };

    try {
      const handlers = this.commandHandlers.get(request.type) || [];
      if (handlers.length === 0) {
        result.status = 'failure';
        result.error = `No handler for command type: ${request.type}`;
        return result;
      }

      // Execute first matching handler
      const handler = handlers[0]!;
      const eventPayload = await handler.handle(request);

      // Convert command to event in event store
      const eventStore = getEventStore();
      const event = eventStore.appendEvent(
        request.aggregateId,
        'command-event',
        `command.${request.type}.executed`,
        eventPayload,
        {
          metadata: { commandId: request.id, ...request.metadata },
          correlationId: request.metadata?.correlationId
        }
      );

      // Publish event to event bus
      const eventBus = getEventBus();
      await eventBus.publish(`command.${request.type}.executed`, eventPayload, {
        source: 'command-processor',
        correlationId: request.metadata?.correlationId
      });

      result.status = 'success';
      result.eventId = event.id;
      result.result = eventPayload;

      this.logger.info(`Command executed: ${request.id} -> ${event.id}`);
    } catch (error) {
      result.status = 'failure';
      result.error = error instanceof Error ? error.message : String(error);
      this.logger.error(`Command execution failed: ${request.id}`, error instanceof Error ? error : new Error(String(error)));
    }

    return result;
  }

  /**
   * Start saga instance
   */
  async startSaga(definitionId: string, aggregateId: string, metadata?: Record<string, any>): Promise<SagaInstance> {
    const definition = this.sagaDefinitions.get(definitionId);
    if (!definition) {
      throw new Error(`Saga definition not found: ${definitionId}`);
    }

    const sagaInstance: SagaInstance = {
      id: `saga-${++this.sagaIdCounter}`,
      definitionId,
      aggregateId,
      status: SagaStatus.IN_PROGRESS,
      currentStep: 0,
      steps: definition.steps,
      completedSteps: [],
      startedAt: new Date(),
      correlationId: metadata?.correlationId
    };

    // Add metadata if provided
    if (metadata) (sagaInstance as any).metadata = metadata;

    this.activeSagas.set(sagaInstance.id, sagaInstance);
    this.logger.info(`Saga started: ${sagaInstance.id} (${definitionId})`);

    // Execute first step
    await this.executeSagaStep(sagaInstance);

    return sagaInstance;
  }

  /**
   * Execute current saga step
   */
  private async executeSagaStep(saga: SagaInstance): Promise<void> {
    if (saga.currentStep >= saga.steps.length) {
      saga.status = SagaStatus.COMPLETED;
      saga.completedAt = new Date();
      this.logger.info(`Saga completed: ${saga.id}`);
      return;
    }

    const step = saga.steps[saga.currentStep]!;
    this.logger.info(`Executing saga step: ${saga.id} -> ${step.name}`);

    try {
      switch (step.type) {
        case 'event':
          // Publish event
          const eventBus = getEventBus();
          const publishOptions: any = { source: 'saga-processor' };
          if (saga.correlationId) publishOptions.correlationId = saga.correlationId;
          await eventBus.publish(step.name, step.input, publishOptions);
          break;

        case 'command':
          // Execute command
          await this.executeCommand({
            id: `cmd-${saga.id}-${step.name}`,
            type: step.name,
            aggregateId: saga.aggregateId,
            payload: step.input,
            metadata: { sagaId: saga.id, ...saga.metadata },
            timestamp: new Date()
          });
          break;

        case 'action':
          // Custom action (logged for now)
          this.logger.info(`Saga action: ${step.name}`, step.input);
          break;
      }

      saga.completedSteps.push(step.name);
      saga.currentStep++;

      // Execute next step
      if (saga.currentStep < saga.steps.length) {
        await this.executeSagaStep(saga);
      } else {
        saga.status = SagaStatus.COMPLETED;
        saga.completedAt = new Date();
        this.logger.info(`Saga completed: ${saga.id}`);
      }
    } catch (error) {
      this.logger.error(`Saga step failed: ${saga.id} -> ${step.name}`, error instanceof Error ? error : new Error(String(error)));
      saga.status = SagaStatus.FAILED;
      saga.failedStep = step.name;

      // Start compensation
      await this.compensateSaga(saga);
    }
  }

  /**
   * Compensate saga (undo steps in reverse order)
   */
  private async compensateSaga(saga: SagaInstance): Promise<void> {
    saga.status = SagaStatus.COMPENSATING;
    this.logger.info(`Compensating saga: ${saga.id}`);

    // Execute compensating events in reverse
    for (let i = saga.completedSteps.length - 1; i >= 0; i--) {
      const completedStep = saga.completedSteps[i];
      const stepDef = saga.steps.find(s => s.name === completedStep);

      if (stepDef?.compensatingEvent) {
        try {
          const eventBus = getEventBus();
          const compensateOptions: any = { source: 'saga-compensation' };
          if (saga.correlationId) compensateOptions.correlationId = saga.correlationId;
          await eventBus.publish(stepDef.compensatingEvent, { originalStep: completedStep }, compensateOptions);
          this.logger.info(`Compensation executed for step: ${completedStep}`);
        } catch (error) {
          this.logger.error(`Compensation failed for step: ${completedStep}`, error instanceof Error ? error : new Error(String(error)));
        }
      }
    }

    saga.status = SagaStatus.COMPENSATED;
    saga.completedAt = new Date();
  }

  /**
   * Get saga instance
   */
  getSagaInstance(sagaId: string): SagaInstance | undefined {
    return this.activeSagas.get(sagaId);
  }

  /**
   * Get all active sagas
   */
  getActiveSagas(aggregateId?: string): SagaInstance[] {
    const sagas = Array.from(this.activeSagas.values());
    if (aggregateId) {
      return sagas.filter(s => s.aggregateId === aggregateId && s.status === SagaStatus.IN_PROGRESS);
    }
    return sagas.filter(s => s.status === SagaStatus.IN_PROGRESS);
  }

  /**
   * Get saga history
   */
  getSagaHistory(aggregateId?: string): SagaInstance[] {
    const sagas = Array.from(this.activeSagas.values());
    if (aggregateId) {
      return sagas.filter(s => s.aggregateId === aggregateId);
    }
    return sagas;
  }

  /**
   * Get all command types
   */
  private getAllCommandTypes(): string[] {
    return [
      'create',
      'update',
      'delete',
      'execute',
      'process',
      'validate',
      'publish',
      'archive'
    ];
  }

  /**
   * Get processor statistics
   */
  getStats(): {
    totalSagas: number;
    activeSagas: number;
    completedSagas: number;
    failedSagas: number;
    registeredHandlers: number;
    sagaDefinitions: number;
  } {
    const allSagas = Array.from(this.activeSagas.values());
    return {
      totalSagas: allSagas.length,
      activeSagas: allSagas.filter(s => s.status === SagaStatus.IN_PROGRESS).length,
      completedSagas: allSagas.filter(s => s.status === SagaStatus.COMPLETED).length,
      failedSagas: allSagas.filter(s => s.status === SagaStatus.FAILED).length,
      registeredHandlers: Array.from(this.commandHandlers.values()).reduce((sum, handlers) => sum + handlers.length, 0),
      sagaDefinitions: this.sagaDefinitions.size
    };
  }
}

// ============================================================================
// GLOBAL SINGLETON
// ============================================================================

let eventProcessor: EventProcessor | undefined;

export function initializeEventProcessor(): EventProcessor {
  if (eventProcessor) {
    return eventProcessor;
  }

  eventProcessor = new EventProcessor();
  const logger = LoggerFactory.getInstance().getLogger();
  logger.info('Event Processor initialized');

  return eventProcessor;
}

export function getEventProcessor(): EventProcessor {
  if (!eventProcessor) {
    return initializeEventProcessor();
  }
  return eventProcessor;
}
