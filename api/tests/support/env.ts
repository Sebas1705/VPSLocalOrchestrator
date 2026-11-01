/**
 * Required settings for suites that load the real config. getConfig() exits the
 * process when they are missing and runs at import time, so import this first.
 */
process.env.API_TOKEN ??= 'test-token-for-jest';
process.env.PORT ??= '3000';
process.env.SECRET_KEY ??= Buffer.alloc(32, 7).toString('base64');
