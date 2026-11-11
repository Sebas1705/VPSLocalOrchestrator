import fs from 'fs';
import path from 'path';
import { API_ROOT } from './config/paths.js';

/**
 * The API version, read once from api/package.json so there is a single place
 * to change it. API_ROOT is the same directory for src/ (tsx) and dist/
 * (compiled), and the Docker image copies package.json next to dist/.
 */
export function readVersion(root: string = API_ROOT): string {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
    if (typeof parsed?.version === 'string' && parsed.version.length > 0) return parsed.version;
  } catch {
    // fall through
  }
  return 'unknown';
}

export const VERSION: string = readVersion();
