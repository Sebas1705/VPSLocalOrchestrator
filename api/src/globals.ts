import { getConfig, initializeLogger } from './config/index.js';
import { isValidToken, extractToken } from './middleware/auth.js';

const config = getConfig();
const logger = initializeLogger(config);

export { config, logger };
