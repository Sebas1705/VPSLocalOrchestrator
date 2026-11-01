import path from 'path';

/**
 * Jest runs this project as CommonJS, where `import.meta` does not parse, so
 * jest.config.js maps src/config/paths.ts to this file.
 */
export const API_ROOT = path.resolve(__dirname, '../..');
