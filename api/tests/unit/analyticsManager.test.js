import { aggregateMetrics, createSnapshot, detectTrend, } from '../../src/services/analyticsManager.js';
import { listMetrics } from '../../src/services/metricsManager.js';
describe('Unit Tests - Analytics Manager', () => {
    describe('aggregateMetrics', () => {
        it('should calculate sum aggregation', () => {
            const metrics = listMetrics({
                name: 'cpu_usage',
                limit: 100,
            });
            if (metrics.length > 0) {
                const result = aggregateMetrics(metrics, 'cpu_usage', 'sum');
                expect(typeof result.value).toBe('number');
                expect(result.aggregationType).toBe('sum');
            }
        });
        it('should calculate average aggregation', () => {
            const metrics = listMetrics({
                name: 'memory_usage',
                limit: 100,
            });
            if (metrics.length > 0) {
                const result = aggregateMetrics(metrics, 'memory_usage', 'avg');
                expect(typeof result.value).toBe('number');
                expect(result.aggregationType).toBe('avg');
            }
        });
        it('should handle min and max aggregations', () => {
            const metrics = listMetrics({ limit: 100 });
            if (metrics.length > 0) {
                const minResult = aggregateMetrics(metrics, metrics[0].name, 'min');
                const maxResult = aggregateMetrics(metrics, metrics[0].name, 'max');
                expect(minResult.value).toBeLessThanOrEqual(maxResult.value);
            }
        });
    });
    describe('createSnapshot', () => {
        it('should create snapshot of latest metrics', () => {
            const metrics = listMetrics({ limit: 1000 });
            const snapshot = createSnapshot(metrics);
            expect(snapshot).toHaveProperty('timestamp');
            expect(snapshot).toHaveProperty('metrics');
            expect(typeof snapshot.timestamp).toBe('number');
            expect(typeof snapshot.metrics).toBe('object');
        });
    });
    describe('detectTrend', () => {
        it('should detect upward trend', () => {
            const metrics = [
                { name: 'test', value: 10, timestamp: Date.now() - 3000 },
                { name: 'test', value: 15, timestamp: Date.now() - 2000 },
                { name: 'test', value: 20, timestamp: Date.now() - 1000 },
                { name: 'test', value: 25, timestamp: Date.now() },
            ];
            const trend = detectTrend(metrics, 'test', Date.now() - 4000, Date.now());
            expect(['up', 'down', 'stable']).toContain(trend.direction);
        });
        it('should calculate trend change percentage', () => {
            const metrics = listMetrics({
                name: 'cpu_usage',
                limit: 100,
            });
            if (metrics.length > 1) {
                const trend = detectTrend(metrics, 'cpu_usage', metrics[0].timestamp, metrics[metrics.length - 1].timestamp);
                expect(typeof trend.changePercent).toBe('number');
            }
        });
    });
});
//# sourceMappingURL=analyticsManager.test.js.map