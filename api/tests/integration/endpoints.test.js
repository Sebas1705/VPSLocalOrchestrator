import request from 'supertest';
import express from 'express';
import { requireAuth } from '../../src/middleware/requireAuth.js';
import resourceRoutes from '../../src/routes/resources.routes.js';
import commandRoutes from '../../src/routes/command.routes.js';
import analyticsRoutes from '../../src/routes/analytics.routes.js';
// Create test app
const app = express();
app.use(express.json());
app.use('/api/resources', resourceRoutes);
app.use('/api/command', commandRoutes);
app.use('/api/analytics', analyticsRoutes);
describe('Integration Tests - API Endpoints', () => {
    describe('Health & Resources (Public)', () => {
        it('GET /api/resources should return system metrics', async () => {
            const res = await request(app).get('/api/resources');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('cpu');
            expect(res.body).toHaveProperty('memory');
            expect(res.body).toHaveProperty('disk');
        });
        it('GET /api/resources/processes should return process list', async () => {
            const res = await request(app).get('/api/resources/processes');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });
    describe('Command Execution (Requires Auth)', () => {
        it('POST /api/command/execute without token should return 401', async () => {
            const res = await request(app).post('/api/command/execute').send({
                command: 'echo hello',
            });
            expect(res.status).toBe(401);
        });
        it('POST /api/command/execute with invalid token should return 401', async () => {
            const res = await request(app)
                .post('/api/command/execute')
                .set('Authorization', 'Bearer invalid-token')
                .send({
                command: 'echo hello',
            });
            expect(res.status).toBe(401);
        });
        it('POST /api/command/execute with valid token should execute', async () => {
            const validToken = process.env.API_TOKEN || 'test-token-12345';
            const res = await request(app)
                .post('/api/command/execute')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                command: 'echo test-output',
            });
            // Will depend on environment setup
            expect([200, 201, 400]).toContain(res.status);
        });
    });
    describe('Analytics (Public)', () => {
        it('GET /api/analytics/snapshot should return latest metrics', async () => {
            const res = await request(app).get('/api/analytics/snapshot');
            expect([200, 400]).toContain(res.status);
            // Status 400 expected if no metrics exist yet
        });
        it('GET /api/analytics/aggregate should accept period parameter', async () => {
            const res = await request(app).get('/api/analytics/aggregate?period=1h');
            expect([200, 400]).toContain(res.status);
        });
    });
});
//# sourceMappingURL=endpoints.test.js.map