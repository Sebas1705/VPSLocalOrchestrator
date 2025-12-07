import fs from 'fs';
import path from 'path';
/**
 * Limpiar directorios generados durante tests
 */
function cleanupTestDirectories() {
    const dirs = [
        'workflows',
        'metrics',
        'databases',
        'loadbalancer',
        'backups',
        'webhooks',
    ];
    dirs.forEach((dir) => {
        const dirPath = path.join(__dirname, '..', dir);
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
//# sourceMappingURL=setup.js.map