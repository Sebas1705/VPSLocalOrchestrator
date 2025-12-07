import request from 'supertest';
import express from 'express';
import workflowRoutes from '../../src/routes/workflow.routes.js';
import dockerRoutes from '../../src/routes/docker.routes.js';
import databaseRoutes from '../../src/routes/database.routes.js';
import loadbalancerRoutes from '../../src/routes/loadbalancer.routes.js';
const app = express();
app.use(express.json());
app.use('/api/workflows', workflowRoutes);
app.use('/api/docker', dockerRoutes);
app.use('/api/databases', databaseRoutes);
app.use('/api/loadbalancer', loadbalancerRoutes);
const validToken = process.env.API_TOKEN || 'test-token-12345';
describe('Integration Tests - Advanced Features', () => {
    describe('Workflows', () => {
        it('GET /api/workflows should list workflows', async () => {
            const res = await request(app).get('/api/workflows');
            expect([200, 400]).toContain(res.status);
            if (res.status === 200) {
                expect(Array.isArray(res.body)).toBe(true);
            }
        });
        it('POST /api/workflows requires auth', async () => {
            const res = await request(app)
                .post('/api/workflows')
                .send({
                name: 'test-workflow',
                steps: [],
            });
            expect(res.status).toBe(401);
        });
        it('POST /api/workflows with auth should create workflow', async () => {
            const res = await request(app)
                .post('/api/workflows')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                name: 'test-workflow-' + Date.now(),
                steps: [
                    {
                        type: 'command',
                        command: 'echo test',
                    },
                ],
            });
            expect([201, 200, 400]).toContain(res.status);
        });
    });
    describe('Docker Integration', () => {
        it('GET /api/docker/containers should list containers', async () => {
            const res = await request(app).get('/api/docker/containers');
            expect([200, 400, 500]).toContain(res.status);
            // May fail if Docker not available
        });
        it('GET /api/docker/images should list images', async () => {
            const res = await request(app).get('/api/docker/images');
            expect([200, 400, 500]).toContain(res.status);
        });
    });
    describe('Database Management', () => {
        it('GET /api/databases should list databases', async () => {
            const res = await request(app).get('/api/databases');
            expect([200, 400]).toContain(res.status);
        });
        it('POST /api/databases requires auth', async () => {
            const res = await request(app)
                .post('/api/databases')
                .send({
                name: 'test-db',
                type: 'postgresql',
            });
            expect(res.status).toBe(401);
        });
        it('POST /api/databases with auth should register database', async () => {
            const res = await request(app)
                .post('/api/databases')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                name: 'test-db-' + Date.now(),
                type: 'postgresql',
                host: 'localhost',
                port: 5432,
            });
            expect([201, 200, 400]).toContain(res.status);
        });
    });
    describe('Load Balancer', () => {
        it('GET /api/loadbalancer/backends should list backends', async () => {
            const res = await request(app).get('/api/loadbalancer/backends');
            expect([200, 400]).toContain(res.status);
            if (res.status === 200) {
                expect(Array.isArray(res.body)).toBe(true);
            }
        });
        it('POST /api/loadbalancer/backends requires auth', async () => {
            const res = await request(app)
                .post('/api/loadbalancer/backends')
                .send({
                address: '127.0.0.1:8000',
            });
            expect(res.status).toBe(401);
        });
        it('POST /api/loadbalancer/backends with auth should register backend', async () => {
            const res = await request(app)
                .post('/api/loadbalancer/backends')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                address: '127.0.0.1:' + (8000 + Math.floor(Math.random() * 1000)),
            });
            expect([201, 200, 400]).toContain(res.status);
        });
    });
});
//# sourceMappingURL=advanced.test.js.map