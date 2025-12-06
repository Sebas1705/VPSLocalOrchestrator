import { getConfig, Logger } from './config/index.js';
import { isValidToken, extractToken } from './middleware/auth.js';

const config = getConfig();
const logger = new Logger(config.api.logLevel);

export { config, logger };
