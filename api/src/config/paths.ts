import path from 'path';
import { fileURLToPath } from 'url';

/**
 * The API install directory: it holds package.json, dist/ and everything
 * written at runtime (logs/, secrets/, backups/, workflows/, ...). Both
 * src/config and dist/config are two levels below it.
 */
export const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
