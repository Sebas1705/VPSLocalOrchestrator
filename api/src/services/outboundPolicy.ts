/**
 * Destination policy and guarded HTTP client for requests the API makes on a
 * caller's behalf (workflow HTTP steps, webhook delivery).
 *
 * Without it, a token holder can point the API at loopback, the cloud metadata
 * address (169.254.169.254), a private service or the Docker network and read
 * the answer. The policy:
 *
 *  - only http: and https:;
 *  - the host is resolved here and every address must be public: loopback,
 *    link-local, private, CGNAT, unspecified, multicast, reserved and
 *    documentation ranges are refused, as are IPv6 forms that embed an IPv4
 *    address (IPv4-mapped, NAT64, 6to4, IPv4-compatible);
 *  - the validated address is pinned: the socket connects to it, so a second
 *    DNS answer (rebinding) cannot change the destination;
 *  - redirects are followed by hand, at most OUTBOUND_MAX_REDIRECTS hops, and
 *    every hop goes through the same checks;
 *  - the response is capped at OUTBOUND_MAX_RESPONSE_BYTES;
 *  - OUTBOUND_ALLOWED_HOSTS lists internal hosts (hostnames or IP literals)
 *    an operator permits explicitly. Default: empty. Even then the response
 *    body of an internal destination is withheld: the caller gets the status
 *    and a note.
 */

import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';

export class OutboundBlockedError extends Error {
  readonly statusCode = 403;

  constructor(reason: string) {
    super(reason);
    this.name = 'OutboundBlockedError';
  }
}

export interface OutboundConfig {
  maxResponseBytes: number;
  maxRedirects: number;
  timeoutMs: number;
  /** Lower-case hostnames and IP literals, `*.suffix` wildcards allowed. */
  allowedHosts: string[];
}

const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 10_000;

function nonNegativeInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function normalizeHost(host: string): string {
  let value = host.trim().toLowerCase();
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);
  return value.replace(/\.$/, '');
}

export function getOutboundConfig(env: NodeJS.ProcessEnv = process.env): OutboundConfig {
  const maxBytes = nonNegativeInt(env.OUTBOUND_MAX_RESPONSE_BYTES, DEFAULT_MAX_RESPONSE_BYTES);
  const timeout = nonNegativeInt(env.OUTBOUND_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  return {
    maxResponseBytes: maxBytes > 0 ? maxBytes : DEFAULT_MAX_RESPONSE_BYTES,
    maxRedirects: nonNegativeInt(env.OUTBOUND_MAX_REDIRECTS, DEFAULT_MAX_REDIRECTS),
    timeoutMs: timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
    allowedHosts: (env.OUTBOUND_ALLOWED_HOSTS ?? '')
      .split(/[,\s]+/)
      .map((entry) => normalizeHost(entry))
      .filter((entry) => entry.length > 0),
  };
}

// ----- Address classification ------------------------------------------------

/** Parse an IPv4 or IPv6 literal into 4 or 16 bytes. Returns null when it is not an IP. */
export function parseIp(input: string): number[] | null {
  let ip = normalizeHost(input);
  const zone = ip.indexOf('%');
  if (zone !== -1) ip = ip.slice(0, zone);

  if (net.isIPv4(ip)) return ip.split('.').map(Number);
  if (!net.isIPv6(ip)) return null;

  // Replace an embedded dotted IPv4 tail (::ffff:1.2.3.4) by two zero groups and patch it in later.
  let tail: number[] = [];
  const lastColon = ip.lastIndexOf(':');
  const maybeV4 = ip.slice(lastColon + 1);
  if (maybeV4.includes('.')) {
    tail = maybeV4.split('.').map(Number);
    ip = `${ip.slice(0, lastColon + 1)}0:0`;
  }

  const hasGap = ip.includes('::');
  const [headRaw = '', tailRaw = ''] = ip.split('::');
  const head = headRaw ? headRaw.split(':') : [];
  const rest = hasGap && tailRaw ? tailRaw.split(':') : [];
  const groups = hasGap ? [...head, ...Array<string>(8 - head.length - rest.length).fill('0'), ...rest] : head;
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const group of groups) {
    const value = parseInt(group, 16);
    bytes.push((value >> 8) & 0xff, value & 0xff);
  }
  if (tail.length === 4) bytes.splice(12, 4, ...tail);
  return bytes;
}

function isBlockedIpv4(b: readonly number[]): boolean {
  const a = b[0] ?? 0;
  const o2 = b[1] ?? 0;
  const o3 = b[2] ?? 0;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // private
  if (a === 100 && o2 >= 64 && o2 <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 127) return true; // loopback
  if (a === 169 && o2 === 254) return true; // link-local, cloud metadata
  if (a === 172 && o2 >= 16 && o2 <= 31) return true; // private
  if (a === 192 && o2 === 0 && o3 === 0) return true; // IETF protocol assignments
  if (a === 192 && o2 === 0 && o3 === 2) return true; // TEST-NET-1
  if (a === 192 && o2 === 168) return true; // private
  if (a === 198 && (o2 === 18 || o2 === 19)) return true; // benchmarking
  if (a === 198 && o2 === 51 && o3 === 100) return true; // TEST-NET-2
  if (a === 203 && o2 === 0 && o3 === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

function isBlockedIpv6(b: readonly number[]): boolean {
  const at = (i: number) => b[i] ?? 0;
  const zeroUpTo = (end: number) => b.slice(0, end).every((x) => x === 0);

  if (zeroUpTo(15) && (at(15) === 0 || at(15) === 1)) return true; // :: and ::1
  if (zeroUpTo(10) && at(10) === 0xff && at(11) === 0xff) return isBlockedIpv4(b.slice(12)); // ::ffff:a.b.c.d
  if (zeroUpTo(12)) return isBlockedIpv4(b.slice(12)); // IPv4-compatible ::a.b.c.d
  if (zeroUpTo(8) && at(8) === 0xff && at(9) === 0xff) return true; // ::ffff:0:a.b.c.d (SIIT)
  if (at(0) === 0x00 && at(1) === 0x64 && at(2) === 0xff && at(3) === 0x9b && b.slice(4, 12).every((x) => x === 0)) {
    return isBlockedIpv4(b.slice(12)); // NAT64 64:ff9b::/96
  }
  if (at(0) === 0x20 && at(1) === 0x02) return isBlockedIpv4(b.slice(2, 6)); // 6to4 2002::/16
  if (at(0) === 0x20 && at(1) === 0x01 && at(2) === 0x00 && at(3) === 0x00) return true; // Teredo 2001::/32
  if (at(0) === 0x20 && at(1) === 0x01 && at(2) === 0x0d && at(3) === 0xb8) return true; // documentation
  if ((at(0) & 0xfe) === 0xfc) return true; // unique local fc00::/7
  if (at(0) === 0xfe && (at(1) & 0xc0) === 0x80) return true; // link-local fe80::/10
  if (at(0) === 0xfe && (at(1) & 0xc0) === 0xc0) return true; // site-local fec0::/10
  if (at(0) === 0xff) return true; // multicast
  return false;
}

/** True when the address must not be reached by default. Unparseable input counts as blocked. */
export function isBlockedAddress(address: string): boolean {
  const bytes = parseIp(address);
  if (!bytes) return true;
  return bytes.length === 4 ? isBlockedIpv4(bytes) : isBlockedIpv6(bytes);
}

export function isHostAllowlisted(hostname: string, allowedHosts: readonly string[]): boolean {
  const host = normalizeHost(hostname);
  return allowedHosts.some((entry) => {
    if (entry.startsWith('*.')) {
      const suffix = entry.slice(1); // ".example.com"
      return host.length > suffix.length && host.endsWith(suffix);
    }
    return host === entry;
  });
}

// ----- Destination resolution -------------------------------------------------

export interface ResolvedDestination {
  url: URL;
  address: string;
  /** True when the address is in a blocked range and is reached only because the host is allowlisted. */
  internal: boolean;
}

export type Resolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const defaultResolver: Resolver = (hostname) => dns.promises.lookup(hostname, { all: true, verbatim: true });

export function parseOutboundUrl(raw: unknown): URL {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new OutboundBlockedError('Outbound request blocked: url is required');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new OutboundBlockedError('Outbound request blocked: invalid url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new OutboundBlockedError(`Outbound request blocked: scheme "${url.protocol.replace(':', '')}" is not allowed`);
  }
  if (url.username || url.password) {
    throw new OutboundBlockedError('Outbound request blocked: credentials in the url are not allowed');
  }
  return url;
}

/**
 * Resolve the URL host and decide whether it may be contacted. All answers must
 * pass, so a name that returns one public and one internal address is refused.
 */
export async function resolveDestination(
  rawUrl: unknown,
  config: OutboundConfig = getOutboundConfig(),
  resolver: Resolver = defaultResolver
): Promise<ResolvedDestination> {
  const url = parseOutboundUrl(rawUrl);
  const hostname = normalizeHost(url.hostname);
  const allowlisted = isHostAllowlisted(hostname, config.allowedHosts);

  let answers: Array<{ address: string; family: number }>;
  if (net.isIP(hostname)) {
    answers = [{ address: hostname, family: net.isIPv6(hostname) ? 6 : 4 }];
  } else {
    try {
      answers = await resolver(hostname);
    } catch {
      throw new OutboundBlockedError('Outbound request failed: host could not be resolved');
    }
  }
  if (answers.length === 0) {
    throw new OutboundBlockedError('Outbound request failed: host could not be resolved');
  }

  const blocked = answers.some((answer) => isBlockedAddress(answer.address));
  if (blocked && !allowlisted) {
    throw new OutboundBlockedError(
      'Outbound request blocked: destination is an internal address (see OUTBOUND_ALLOWED_HOSTS)'
    );
  }

  return { url, address: answers[0]!.address, internal: blocked };
}

// ----- Guarded request ---------------------------------------------------------

export interface OutboundRequest {
  method?: string;
  headers?: Record<string, string>;
  body?: string | null;
}

export interface OutboundResponse {
  status: number;
  ok: boolean;
  /** Response body, or null when it was withheld (internal destination). */
  body: string | null;
  truncated: boolean;
  /** Present when the body was withheld or truncated. */
  note?: string;
  finalUrl: string;
  redirects: number;
}

export interface OutboundDeps {
  resolver?: Resolver;
  config?: OutboundConfig;
  /** Tests only: change the address the socket connects to after validation. */
  connectAddress?: (validated: string) => string;
}

const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

interface RawResponse {
  status: number;
  location: string | undefined;
  body: string;
  truncated: boolean;
}

function requestOnce(
  url: URL,
  method: string,
  headers: Record<string, string>,
  body: string | null,
  config: OutboundConfig,
  connectAddress: string
): Promise<RawResponse> {
  const transport = url.protocol === 'https:' ? https : http;
  const family = net.isIPv6(connectAddress) ? 6 : 4;
  const hostname = normalizeHost(url.hostname);

  return new Promise((resolve, reject) => {
    const payload = body === null ? null : Buffer.from(body);
    const options: https.RequestOptions = {
      protocol: url.protocol,
      hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method,
      headers: {
        ...headers,
        Host: url.host,
        ...(payload ? { 'Content-Length': String(payload.length) } : {}),
      },
      // Pin: connect to the validated address and never resolve the name again.
      lookup: ((_host: string, lookupOptions: { all?: boolean }, callback: (...args: unknown[]) => void) => {
        if (lookupOptions?.all) callback(null, [{ address: connectAddress, family }]);
        else callback(null, connectAddress, family);
      }) as unknown as net.LookupFunction,
      signal: AbortSignal.timeout(config.timeoutMs),
    };
    // TLS validates the name in the URL, not the pinned address.
    if (url.protocol === 'https:' && !net.isIP(hostname)) options.servername = hostname;

    const req = transport.request(options, (res) => {
      const chunks: Buffer[] = [];
      let received = 0;
      let truncated = false;
      let settled = false;
      const location = Array.isArray(res.headers.location) ? res.headers.location[0] : res.headers.location;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve({
          status: res.statusCode ?? 0,
          location,
          body: Buffer.concat(chunks).toString('utf-8'),
          truncated,
        });
      };

      res.on('data', (chunk: Buffer) => {
        if (settled) return;
        const room = config.maxResponseBytes - received;
        if (chunk.length > room) {
          if (room > 0) chunks.push(chunk.subarray(0, room));
          received = config.maxResponseBytes;
          truncated = true;
          finish();
          res.destroy();
          return;
        }
        chunks.push(chunk);
        received += chunk.length;
      });
      res.on('end', finish);
      res.on('error', (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Make an HTTP request under the destination policy. Throws OutboundBlockedError
 * when a hop is refused; other failures (timeouts, connection errors) are plain Errors.
 */
export async function guardedRequest(
  rawUrl: unknown,
  init: OutboundRequest = {},
  deps: OutboundDeps = {}
): Promise<OutboundResponse> {
  const config = deps.config ?? getOutboundConfig();
  let method = (init.method ?? 'GET').toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    throw new OutboundBlockedError(`Outbound request blocked: method "${method}" is not allowed`);
  }
  let headers = { ...(init.headers ?? {}) };
  let body: string | null = init.body ?? null;
  let current: unknown = rawUrl;
  let anyInternal = false;

  for (let hop = 0; ; hop++) {
    const destination = await resolveDestination(current, config, deps.resolver);
    anyInternal ||= destination.internal;
    const connect = deps.connectAddress ? deps.connectAddress(destination.address) : destination.address;
    const raw = await requestOnce(destination.url, method, headers, body, config, connect);

    if (REDIRECT_STATUSES.has(raw.status) && raw.location) {
      if (hop >= config.maxRedirects) {
        throw new OutboundBlockedError(`Outbound request blocked: more than ${config.maxRedirects} redirects`);
      }
      try {
        current = new URL(raw.location, destination.url).toString();
      } catch {
        throw new OutboundBlockedError('Outbound request blocked: invalid redirect location');
      }
      // Like browsers: 303, and 301/302 after a POST, become a body-less GET.
      if (raw.status === 303 || ((raw.status === 301 || raw.status === 302) && method === 'POST')) {
        if (method !== 'HEAD') method = 'GET';
        body = null;
        headers = Object.fromEntries(
          Object.entries(headers).filter(([key]) => key.toLowerCase() !== 'content-type')
        );
      }
      continue;
    }

    const response: OutboundResponse = {
      status: raw.status,
      ok: raw.status >= 200 && raw.status < 300,
      body: anyInternal ? null : raw.body,
      truncated: anyInternal ? false : raw.truncated,
      finalUrl: destination.url.toString(),
      redirects: hop,
    };
    if (anyInternal) {
      response.note = 'Destination is an internal host allowed by OUTBOUND_ALLOWED_HOSTS; the response body is withheld.';
    } else if (raw.truncated) {
      response.note = `Response body truncated at ${config.maxResponseBytes} bytes (OUTBOUND_MAX_RESPONSE_BYTES).`;
    }
    return response;
  }
}
