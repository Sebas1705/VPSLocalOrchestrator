import fs from 'fs';
import path from 'path';
import { dirname } from 'path';

/**
 * Limpiar directorios generados durante tests
 */
function cleanupTestDirectories() {
  const baseDir = process.cwd();
  const dirs = [
    'workflows',
    'metrics',
    'databases',
    'loadbalancer',
    'backups',
    'webhooks',
  ];

  dirs.forEach((dir) => {
    const dirPath = path.join(baseDir, 'api', dir);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  });
}

// Limpiar antes de tests
cleanupTestDirectories();

// Limpiar después de todos los tests
afterAll(() => {
  cleanupTestDirectories();
});
