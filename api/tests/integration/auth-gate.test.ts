/**
 * Integration tests - authentication and rate limiting across the whole app.
 *
 * The route list is read from the real Express app, so a route added anywhere
 * is covered without touching this file. If it is reachable without the token
 * and is not in EXPECTED_PUBLIC_ROUTES, this suite fails.
 */

import '../support/env.js';
import crypto from 'crypto';
import express, { type Application } from 'express';
import request from 'supertest';
import { createApp, type ApiMount } from '../../src/app.js';
import { authGate, PUBLIC_ROUTES } from '../../src/middleware/authGate.js';
import { rateLimitMiddleware } from '../../src/middleware/ratelimit.js';
import { API_TOKEN } from '../../src/middleware/auth.js';
import { getRateLimiter, RateLimitTiers } from '../../src/infrastructure/ratelimit/index.js';
import { initializeOpenAPI } from '../../src/infrastructure/schema/openapi.js';
import { initializeSchemaMigrations } from '../../src/infrastructure/schema/migration.js';

/** Changing this list is a security decision: review it as one. */
const EXPECTED_PUBLIC_ROUTES = [
  'GET /',
  'GET /api/compatibility/:from/:to',
  'GET /api/deprecations',
  'GET /api/guide/:from/:to',
  'GET /api/openapi.json',
  'GET /api/schema',
  'GET /api/schema/info',
  'GET /api/schema/json',
  'GET /api/schema/yaml',
  'GET /api/supported',
  'GET /api/versions',
  'GET /api/versions/:version',
  'GET /health',
];

const dependencies = {
  commandRepository: {} as any,
  resourceRepository: {} as any,
  serviceRepository: {} as any,
};

interface DiscoveredRoute {
  method: string;
  path: string;
}

function joinPath(prefix: string, route: string): string {
  const joined = `${prefix}${route}`.replace(/\/+$/, '');
  return joined || '/';
}

function routesInStack(stack: any[], prefix: string): DiscoveredRoute[] {
  return stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map((method) => ({
        method: method.toUpperCase(),
        path: joinPath(prefix, layer.route.path),
      }))
    );
}

function discoverRoutes(app: Application): DiscoveredRoute[] {
  const mounts: ApiMount[] = app.locals.apiMounts;
  const found = [
    ...routesInStack((app as any).router.stack, ''),
    ...mounts.flatMap(({ path, router }) => routesInStack((router as any).stack, path)),
  ];
  const unique = new Map(found.map((route) => [`${route.method} ${route.path}`, route]));
  return [...unique.values()];
}

function concretePath(routePath: string): string {
  return routePath.replace(/:[^/]+/g, '1');
}

function send(app: Application, route: DiscoveredRoute): request.Test {
  const verb = route.method.toLowerCase() as 'get';
  return request(app)[verb](concretePath(route.path));
}

function findUnprotected(routes: DiscoveredRoute[], statuses: Map<string, number>, publicRoutes: readonly string[]): string[] {
  return routes
    .map((route) => `${route.method} ${route.path}`)
    .filter((name) => !publicRoutes.includes(name) && statuses.get(name) !== 401);
}

describe('auth gate', () => {
  let app: Application;
  let routes: DiscoveredRoute[];

  beforeAll(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    initializeOpenAPI('Test', '0.0.0');
    initializeSchemaMigrations('0.0.0', 'header');
    app = createApp(dependencies, { rateLimit: false });
    routes = discoverRoutes(app);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('finds the whole route table', () => {
    expect(routes.length).toBeGreaterThan(180);
    const names = routes.map((route) => `${route.method} ${route.path}`);
    for (const route of [
      'DELETE /api/resources/process/:pid',
      'POST /api/resources/process/:pid/priority',
      'GET /api/logs',
      'POST /api/events/publish',
    ]) {
      expect(names).toContain(route);
    }
  });

  it('keeps the public list exactly as reviewed', () => {
    expect([...PUBLIC_ROUTES].sort()).toEqual(EXPECTED_PUBLIC_ROUTES);
  });

  it('runs before every route and router, so nothing can be mounted ahead of it', () => {
    const stack: any[] = (app as any).router.stack;
    const gate = stack.findIndex((layer) => layer.handle === authGate);
    const firstHandler = stack.findIndex((layer) => layer.route || layer.name === 'router');
    expect(gate).toBeGreaterThanOrEqual(0);
    expect(gate).toBeLessThan(firstHandler);
    expect(stack.filter((layer) => layer.name === 'router')).toHaveLength(app.locals.apiMounts.length);
  });

  it('answers 401 on every route outside the public list, without a token', async () => {
    const statuses = new Map<string, number>();
    for (const route of routes) {
      const res = await send(app, route);
      statuses.set(`${route.method} ${route.path}`, res.status);
    }
    expect(findUnprotected(routes, statuses, PUBLIC_ROUTES)).toEqual([]);
  });

  it('answers 401 on every route outside the public list, with a wrong token', async () => {
    const statuses = new Map<string, number>();
    for (const route of routes) {
      const res = await send(app, route).set('Authorization', 'Bearer not-the-token');
      statuses.set(`${route.method} ${route.path}`, res.status);
    }
    expect(findUnprotected(routes, statuses, PUBLIC_ROUTES)).toEqual([]);
  });

  it('detects a route that bypasses the gate', async () => {
    const leaky = express();
    leaky.locals.apiMounts = [];
    leaky.delete('/api/new-thing', (_req, res) => {
      res.json({ done: true });
    });

    const discovered = discoverRoutes(leaky);
    const statuses = new Map<string, number>();
    for (const route of discovered) {
      statuses.set(`${route.method} ${route.path}`, (await send(leaky, route)).status);
    }
    expect(findUnprotected(discovered, statuses, PUBLIC_ROUTES)).toEqual(['DELETE /api/new-thing']);
  });

  it.each(EXPECTED_PUBLIC_ROUTES)('leaves %s reachable', async (route) => {
    const [method = '', routePath = ''] = route.split(' ');
    const res = await send(app, { method, path: routePath });
    expect(res.status).not.toBe(401);
  });

  it.each([
    ['DELETE', '/api/resources/process/1'],
    ['POST', '/api/resources/process/1/priority'],
    ['GET', '/api/logs'],
    ['POST', '/api/logs/search'],
    ['GET', '/api/events/history'],
    ['POST', '/api/events/publish'],
    ['GET', '/api/eventstore/aggregates'],
    ['POST', '/api/processor/commands'],
    ['GET', '/metrics'],
    ['GET', '/api/does-not-exist'],
    ['GET', '/API/LOGS'],
    ['GET', '/api/logs/'],
    ['GET', '/%61pi/logs'],
  ])('refuses %s %s without a token', async (method, routePath) => {
    const res = await send(app, { method, path: routePath });
    expect(res.status).toBe(401);
  });

  it('lets the token through', async () => {
    const res = await request(app).get('/api/logs').set('Authorization', `Bearer ${API_TOKEN}`);
    expect(res.status).toBe(200);
  });

  it('rejects before reading the body', async () => {
    const res = await request(app).post('/api/files').set('Content-Type', 'application/json').send('{ not json');
    expect(res.status).toBe(401);
  });
});

describe('rate limiting', () => {
  let app: Application;

  beforeAll(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    app = createApp(dependencies);
  });

  beforeEach(() => {
    const limiter = getRateLimiter() as any;
    limiter.windows.clear();
    limiter.concurrent.clear();
    delete process.env.RATE_LIMIT_TIER;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  async function burst(count: number, build: (index: number) => request.Test): Promise<number[]> {
    const statuses: number[] = [];
    for (let i = 0; i < count; i++) {
      statuses.push((await build(i)).status);
    }
    return statuses;
  }

  it('runs ahead of the auth gate', () => {
    const stack: any[] = (app as any).router.stack;
    const limiter = stack.findIndex((layer) => layer.handle === rateLimitMiddleware);
    const gate = stack.findIndex((layer) => layer.handle === authGate);
    expect(limiter).toBeGreaterThanOrEqual(0);
    expect(limiter).toBeLessThan(gate);
  });

  it('throttles guessing even when every guess is a different token', async () => {
    const attempts = RateLimitTiers.free.maxTokens + 5;
    const statuses = await burst(attempts, () =>
      request(app).get('/api/logs').set('Authorization', `Bearer ${crypto.randomUUID()}`)
    );

    expect(statuses.slice(0, RateLimitTiers.free.maxTokens).every((status) => status === 401)).toBe(true);
    expect(statuses).toContain(429);
    expect((getRateLimiter() as any).windows.size).toBe(1);
  });

  it('throttles requests without a token', async () => {
    const statuses = await burst(RateLimitTiers.free.maxTokens + 5, () => request(app).get('/api/logs'));
    expect(statuses).toContain(429);
  });

  it('does not let failed attempts use up the real token', async () => {
    await burst(RateLimitTiers.free.maxTokens + 5, () => request(app).get('/api/logs'));
    const res = await request(app).get('/api/logs').set('Authorization', `Bearer ${API_TOKEN}`);
    expect(res.status).toBe(200);
  });

  it('gives the token a larger budget and reports it in the headers', async () => {
    const statuses = await burst(RateLimitTiers.free.maxTokens + 5, () =>
      request(app).get('/api/logs').set('Authorization', `Bearer ${API_TOKEN}`)
    );
    expect(statuses.every((status) => status === 200)).toBe(true);

    const res = await request(app).get('/api/logs').set('Authorization', `Bearer ${API_TOKEN}`);
    expect(res.headers['x-ratelimit-limit']).toBe(String(RateLimitTiers.standard.maxRequests));
  });

  it('honours RATE_LIMIT_TIER and ignores unknown values', async () => {
    process.env.RATE_LIMIT_TIER = 'premium';
    let res = await request(app).get('/api/logs').set('Authorization', `Bearer ${API_TOKEN}`);
    expect(res.headers['x-ratelimit-limit']).toBe(String(RateLimitTiers.premium.maxRequests));

    process.env.RATE_LIMIT_TIER = 'constructor';
    res = await request(app).get('/api/logs').set('Authorization', `Bearer ${API_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe(String(RateLimitTiers.standard.maxRequests));
  });

  it('does not throttle liveness probes', async () => {
    const statuses = await burst(RateLimitTiers.free.maxTokens + 5, () => request(app).get('/health'));
    expect(statuses.every((status) => status === 200)).toBe(true);
  });

  it('releases the concurrency slot exactly once per response', async () => {
    await request(app).get('/api/logs').set('Authorization', `Bearer ${API_TOKEN}`);
    await new Promise((resolve) => setImmediate(resolve));
    expect(getRateLimiter().getConcurrentCount(API_TOKEN)).toBe(0);
  });

  it('answers concurrent requests instead of hanging', async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => request(app).get('/api/logs').set('Authorization', `Bearer ${API_TOKEN}`))
    );
    expect(responses.every((res) => res.status === 200)).toBe(true);
  });
});
