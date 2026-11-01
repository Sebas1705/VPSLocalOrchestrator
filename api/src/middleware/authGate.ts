import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from './requireAuth.js';

/**
 * Routes reachable without a token. Everything else needs one, including
 * routes added later and paths that match nothing, so forgetting `requireAuth`
 * on a new route fails closed. Only liveness and API documentation belong here;
 * extending this list also means updating tests/integration/auth-gate.test.ts.
 *
 * Entries are "METHOD /path"; `:name` matches one path segment. A GET entry
 * also covers HEAD, as Express does.
 */
export const PUBLIC_ROUTES: readonly string[] = [
  'GET /',
  'GET /health',
  'GET /api/openapi.json',
  'GET /api/schema',
  'GET /api/schema/json',
  'GET /api/schema/yaml',
  'GET /api/schema/info',
  'GET /api/versions',
  'GET /api/versions/:version',
  'GET /api/supported',
  'GET /api/compatibility/:from/:to',
  'GET /api/guide/:from/:to',
  'GET /api/deprecations',
];

function compileRoute(route: string): { method: string; pattern: RegExp } {
  const [method = '', routePath = ''] = route.split(' ');
  const source = routePath
    .split('/')
    .map((segment) => (segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return { method, pattern: new RegExp(`^${source}$`) };
}

const compiledPublicRoutes = PUBLIC_ROUTES.map(compileRoute);

export function isPublicRoute(method: string, requestPath: string): boolean {
  const effectiveMethod = method === 'HEAD' ? 'GET' : method;
  return compiledPublicRoutes.some((route) => route.method === effectiveMethod && route.pattern.test(requestPath));
}

/** App-wide default-deny: public routes pass, everything else goes through requireAuth. */
export function authGate(req: Request, res: Response, next: NextFunction) {
  if (isPublicRoute(req.method, req.path)) {
    return next();
  }
  return requireAuth(req, res, next);
}
