import { readFileSync } from 'fs';
import path from 'path';
import { listMetrics, getMetricStats, searchMetrics, } from '../../src/services/metricsManager.js';
describe('Unit Tests - Metrics Manager', () => {
    describe('listMetrics', () => {
        it('should return array of metrics', () => {
            const metrics = listMetrics({ limit: 10 });
            expect(Array.isArray(metrics)).toBe(true);
        });
        it('should respect limit parameter', () => {
            const metrics = listMetrics({ limit: 5 });
            expect(metrics.length).toBeLessThanOrEqual(5);
        });
        it('should filter by metric name', () => {
            const metrics = listMetrics({
                name: 'cpu_usage',
                limit: 10,
            });
            metrics.forEach((m) => {
                expect(m.name).toBe('cpu_usage');
            });
        });
        it('should filter by time range', () => {
            const now = Date.now();
            const oneHourAgo = now - 60 * 60 * 1000;
            const metrics = listMetrics({
                from: oneHourAgo,
                to: now,
                limit: 100,
            });
            metrics.forEach((m) => {
                expect(m.timestamp).toBeGreaterThanOrEqual(oneHourAgo);
                expect(m.timestamp).toBeLessThanOrEqual(now);
            });
        });
    });
    describe('getMetricStats', () => {
        it('should calculate average of metrics', () => {
            const stats = getMetricStats('cpu_usage');
            if (stats) {
                expect(stats).toHaveProperty('avg');
                expect(typeof stats.avg).toBe('number');
            }
        });
        it('should calculate min and max', () => {
            const stats = getMetricStats('memory_usage');
            if (stats) {
                expect(stats).toHaveProperty('min');
                expect(stats).toHaveProperty('max');
                expect(stats.min).toBeLessThanOrEqual(stats.max);
            }
        });
    });
    describe('searchMetrics', () => {
        it('should search metrics by query', () => {
            const results = searchMetrics('cpu', 10);
            expect(Array.isArray(results)).toBe(true);
        });
        it('should return metrics matching pattern', () => {
            const results = searchMetrics('usage', 10);
            results.forEach((m) => {
                expect(m.name.toLowerCase()).toContain('usage');
            });
        });
    });
});
//# sourceMappingURL=metricsManager.test.js.map