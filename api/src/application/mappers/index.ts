/**
 * Mapper Registry Initialization
 *
 * Centralized registration of all mappers.
 */

import { MapperRegistry } from './mapper.interfaces.js';
import { ExecuteCommandRequestMapper, CommandResultResponseMapper } from './command.mappers.js';
import { ProcessInfoMapper, SystemResourcesMapper, KillProcessRequestMapper, SetProcessPriorityRequestMapper } from './resources.mappers.js';

/**
 * Initialize all mappers
 * Call this once on application startup
 */
export function initializeMappers(): void {
  // Command mappers
  MapperRegistry.register('ExecuteCommandRequest', new ExecuteCommandRequestMapper());
  MapperRegistry.register('CommandResultResponse', new CommandResultResponseMapper());

  // Resource mappers
  MapperRegistry.register('ProcessInfo', new ProcessInfoMapper());
  MapperRegistry.register('SystemResources', new SystemResourcesMapper());
  MapperRegistry.register('KillProcessRequest', new KillProcessRequestMapper());
  MapperRegistry.register('SetProcessPriorityRequest', new SetProcessPriorityRequestMapper());

  // Service mappers are handled inline in controllers due to type complexity
  // See ServiceNormalizer in services.mappers.ts
}

// Export all mappers for use in controllers
export {
  ExecuteCommandRequestMapper,
  CommandResultResponseMapper,
} from './command.mappers.js';

export {
  ProcessInfoMapper,
  SystemResourcesMapper,
  KillProcessRequestMapper,
  SetProcessPriorityRequestMapper,
} from './resources.mappers.js';

export { ServiceNormalizer } from './services.mappers.js';

export { MapperRegistry, type IMapper } from './mapper.interfaces.js';
