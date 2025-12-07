import { analyzeCommand, executeBatch } from '../../src/services/commandExecutor.js';
describe('Unit Tests - Command Executor', () => {
    describe('analyzeCommand', () => {
        it('should identify safe commands', () => {
            const result = analyzeCommand('ls -la');
            expect(result.safe).toBe(true);
        });
        it('should identify dangerous commands', () => {
            const result = analyzeCommand('rm -rf /');
            expect(result.safe).toBe(false);
        });
        it('should detect command injection attempts', () => {
            const result = analyzeCommand('echo test && rm -rf /');
            expect(result.safe).toBe(false);
        });
    });
    describe('executeBatch', () => {
        it('should execute multiple commands', async () => {
            const commands = ['echo hello', 'echo world'];
            const results = await executeBatch(commands);
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(2);
        });
        it('should stop on dangerous command', async () => {
            const commands = ['echo hello', 'rm -rf /'];
            const results = await executeBatch(commands);
            expect(results.some((r) => r.blocked === true)).toBe(true);
        });
    });
});
//# sourceMappingURL=commandExecutor.test.js.map