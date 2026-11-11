/**
 * Unit tests - destination policy and guarded HTTP client for workflow HTTP steps and webhooks
 */

import '../../support/env.js';
import http from 'http';
import type { AddressInfo } from 'net';
import {
  getOutboundConfig,
  guardedRequest,
  isBlockedAddress,
  isHostAllowlisted,
  OutboundBlockedError,
  parseIp,
  resolveDestination,
  type OutboundConfig,
  type Resolver,
} from '../../../src/services/outboundPolicy.js';

const baseConfig: OutboundConfig = {
  maxResponseBytes: 1024 * 1024,
  maxRedirects: 5,
  timeoutMs: 5000,
  allowedHosts: [],
};

const publicResolver: Resolver = async () => [{ address: '93.184.216.34', family: 4 }];

describe('outbound policy: address classification', () => {
  const blocked = [
    '127.0.0.1', '127.1.2.3', '0.0.0.0', '0.1.2.3', '10.0.0.1', '10.255.255.255',
    '172.16.0.1', '172.31.255.255', '192.168.0.1', '192.168.255.255',
    '169.254.169.254', '169.254.0.1', '100.64.0.1', '100.127.255.255',
    '192.0.0.1', '192.0.2.1', '198.18.0.1', '198.19.255.255', '198.51.100.1', '203.0.113.1',
    '224.0.0.1', '239.255.255.255', '240.0.0.1', '255.255.255.255',
    '::', '::1', '0:0:0:0:0:0:0:1',
    'fe80::1', 'febf::1', 'fc00::1', 'fd12:3456::1', 'fec0::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '::ffff:a00:1', '::ffff:169.254.169.254',
    '::ffff:a9fe:a9fe', '0:0:0:0:0:ffff:c0a8:1', '::127.0.0.1', '::10.0.0.1',
    '64:ff9b::7f00:1', '64:ff9b::a9fe:a9fe', '2002:7f00:1::', '2002:a9fe:a9fe::1',
    '2001:0:4136:e378:8000:63bf:3fff:fdd2', '2001:db8::1', 'fe80::1%eth0', '[::1]',
  ];
  const allowed = [
    '8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.255.255', '172.32.0.1', '100.63.255.255',
    '100.128.0.1', '169.253.0.1', '169.255.0.1', '192.169.0.1', '198.17.0.1', '198.20.0.1',
    '223.255.255.255', '2606:4700:4700::1111', '2001:4860:4860::8888',
    '::ffff:8.8.8.8', '::ffff:808:808', '64:ff9b::808:808', '2002:808:808::1',
  ];

  it.each(blocked)('blocks %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(allowed)('allows %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });

  it('treats something that is not an IP as blocked', () => {
    expect(isBlockedAddress('not-an-ip')).toBe(true);
    expect(isBlockedAddress('')).toBe(true);
    expect(isBlockedAddress('1.2.3')).toBe(true);
  });

  it('parses IPv4-mapped IPv6 in dotted and hex form to the same bytes', () => {
    expect(parseIp('::ffff:127.0.0.1')).toEqual(parseIp('::ffff:7f00:1'));
    expect(parseIp('::ffff:127.0.0.1')).toHaveLength(16);
    expect(parseIp('127.0.0.1')).toEqual([127, 0, 0, 1]);
    expect(parseIp('example.com')).toBeNull();
  });
});

describe('outbound policy: configuration', () => {
  it('has safe defaults', () => {
    expect(getOutboundConfig({})).toEqual({
      maxResponseBytes: 1048576,
      maxRedirects: 5,
      timeoutMs: 10000,
      allowedHosts: [],
    });
  });

  it('reads the environment and ignores junk', () => {
    expect(
      getOutboundConfig({
        OUTBOUND_MAX_RESPONSE_BYTES: '2048',
        OUTBOUND_MAX_REDIRECTS: '1',
        OUTBOUND_TIMEOUT_MS: '500',
        OUTBOUND_ALLOWED_HOSTS: ' N8N.internal, 10.0.0.5 [::1] *.corp.example ',
      })
    ).toEqual({
      maxResponseBytes: 2048,
      maxRedirects: 1,
      timeoutMs: 500,
      allowedHosts: ['n8n.internal', '10.0.0.5', '::1', '*.corp.example'],
    });
    const junk = getOutboundConfig({
      OUTBOUND_MAX_RESPONSE_BYTES: 'abc',
      OUTBOUND_MAX_REDIRECTS: '-3',
      OUTBOUND_TIMEOUT_MS: '0',
    });
    expect(junk.maxResponseBytes).toBe(1048576);
    expect(junk.maxRedirects).toBe(5);
    expect(junk.timeoutMs).toBe(10000);
  });

  it('matches allowlist entries exactly and by wildcard suffix', () => {
    expect(isHostAllowlisted('N8N.internal.', ['n8n.internal'])).toBe(true);
    expect(isHostAllowlisted('evil-n8n.internal', ['n8n.internal'])).toBe(false);
    expect(isHostAllowlisted('a.corp.example', ['*.corp.example'])).toBe(true);
    expect(isHostAllowlisted('corp.example', ['*.corp.example'])).toBe(false);
    expect(isHostAllowlisted('xcorp.example', ['*.corp.example'])).toBe(false);
    expect(isHostAllowlisted('::1', ['::1'])).toBe(true);
  });
});

describe('outbound policy: destination resolution', () => {
  const resolveWith = (answers: Array<{ address: string; family: number }>): Resolver => async () => answers;

  it.each([
    'file:///etc/passwd',
    'ftp://example.com/',
    'gopher://example.com/',
    'data:text/plain,hi',
    'javascript:alert(1)',
  ])('refuses scheme in %s', async (url) => {
    await expect(resolveDestination(url, baseConfig, publicResolver)).rejects.toThrow(OutboundBlockedError);
  });

  it('refuses missing, non-string, malformed and credentialed urls', async () => {
    for (const url of [undefined, null, 42, '', '   ', 'not a url', 'http://user:pw@example.com/']) {
      await expect(resolveDestination(url, baseConfig, publicResolver)).rejects.toThrow(OutboundBlockedError);
    }
  });

  it.each([
    'http://127.0.0.1/',
    'http://127.1/',
    'http://2130706433/',
    'http://0x7f000001/',
    'http://0177.0.0.1/',
    'http://0.0.0.0/',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.1.2.3:8080/',
    'http://192.168.1.1/',
    'http://172.20.0.2/',
    'http://100.100.100.100/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:7f00:1]/',
    'http://[fe80::1]/',
    'http://[fd00::1]/',
    'http://[64:ff9b::7f00:1]/',
  ])('blocks the literal address in %s', async (url) => {
    const resolver = jest.fn(publicResolver);
    await expect(resolveDestination(url, baseConfig, resolver)).rejects.toThrow(/internal address/);
    expect(resolver).not.toHaveBeenCalled();
  });

  it('blocks names that resolve to an internal address, including localhost', async () => {
    await expect(
      resolveDestination('http://localhost:3000/', baseConfig, resolveWith([{ address: '127.0.0.1', family: 4 }]))
    ).rejects.toThrow(/internal address/);
    await expect(
      resolveDestination('http://metadata.example/', baseConfig, resolveWith([{ address: '169.254.169.254', family: 4 }]))
    ).rejects.toThrow(/internal address/);
    await expect(
      resolveDestination('http://v6.example/', baseConfig, resolveWith([{ address: '::ffff:10.0.0.1', family: 6 }]))
    ).rejects.toThrow(/internal address/);
  });

  it('blocks a name when any answer is internal (mixed DNS answers)', async () => {
    await expect(
      resolveDestination(
        'http://mixed.example/',
        baseConfig,
        resolveWith([
          { address: '93.184.216.34', family: 4 },
          { address: '127.0.0.1', family: 4 },
        ])
      )
    ).rejects.toThrow(/internal address/);
  });

  it('fails closed when the name does not resolve', async () => {
    await expect(
      resolveDestination('http://nope.example/', baseConfig, async () => {
        throw new Error('ENOTFOUND');
      })
    ).rejects.toThrow(/could not be resolved/);
    await expect(resolveDestination('http://empty.example/', baseConfig, resolveWith([]))).rejects.toThrow(
      /could not be resolved/
    );
  });

  it('accepts a public host and reports the address to pin', async () => {
    const destination = await resolveDestination('https://example.com/x?y=1', baseConfig, publicResolver);
    expect(destination.address).toBe('93.184.216.34');
    expect(destination.internal).toBe(false);
    expect(destination.url.pathname).toBe('/x');
  });

  it('lets an allowlisted internal host through and marks it internal', async () => {
    const config = { ...baseConfig, allowedHosts: ['n8n.internal', '10.0.0.5'] };
    const byName = await resolveDestination(
      'http://n8n.internal/hook',
      config,
      resolveWith([{ address: '172.18.0.4', family: 4 }])
    );
    expect(byName.internal).toBe(true);
    expect((await resolveDestination('http://10.0.0.5/', config, publicResolver)).internal).toBe(true);
    await expect(resolveDestination('http://10.0.0.6/', config, publicResolver)).rejects.toThrow(/internal address/);
  });

  it('does not let an allowlist entry for one host open another', async () => {
    const config = { ...baseConfig, allowedHosts: ['n8n.internal'] };
    await expect(
      resolveDestination('http://other.internal/', config, resolveWith([{ address: '10.0.0.9', family: 4 }]))
    ).rejects.toThrow(/internal address/);
  });
});

describe('outbound policy: guarded requests', () => {
  let server: http.Server;
  let port: number;
  let seen: Array<{ method?: string; url?: string; host?: string; body: string; contentType?: string }>;
  const toLoopback = (_validated: string) => '127.0.0.1';

  beforeEach(async () => {
    seen = [];
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        seen.push({
          method: req.method,
          url: req.url,
          host: req.headers.host,
          body: Buffer.concat(chunks).toString(),
          contentType: req.headers['content-type'],
        });
        const url = req.url ?? '/';
        if (url === '/ok') {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('hello');
        } else if (url === '/fail') {
          res.writeHead(500);
          res.end('boom');
        } else if (url === '/big') {
          res.writeHead(200);
          res.end('x'.repeat(5000));
        } else if (url === '/to-ok') {
          res.writeHead(302, { Location: '/ok' });
          res.end();
        } else if (url === '/to-allowed-internal') {
          res.writeHead(302, { Location: `http://n8n.internal:${port}/ok` });
          res.end();
        } else if (url === '/to-internal') {
          res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' });
          res.end();
        } else if (url === '/to-loopback-name') {
          res.writeHead(307, { Location: 'http://localhost:1/' });
          res.end();
        } else if (url === '/to-file') {
          res.writeHead(302, { Location: 'file:///etc/passwd' });
          res.end();
        } else if (url === '/loop') {
          res.writeHead(302, { Location: '/loop' });
          res.end();
        } else if (url === '/post-redirect') {
          res.writeHead(302, { Location: '/ok' });
          res.end();
        } else if (url === '/keep-method') {
          res.writeHead(307, { Location: '/ok' });
          res.end();
        } else {
          res.writeHead(404);
          res.end('missing');
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const publicUrl = (p: string) => `http://public.example:${port}${p}`;

  it('returns status and body from a public destination, connecting to the pinned address', async () => {
    const resolver = jest.fn(publicResolver);
    const res = await guardedRequest(publicUrl('/ok'), {}, { resolver, config: baseConfig, connectAddress: toLoopback });
    expect(res).toMatchObject({ status: 200, ok: true, body: 'hello', truncated: false, redirects: 0 });
    expect(res.note).toBeUndefined();
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(seen[0]?.host).toBe(`public.example:${port}`);
  });

  it('refuses an internal destination before any connection is made', async () => {
    await expect(guardedRequest(`http://127.0.0.1:${port}/ok`, {}, { config: baseConfig })).rejects.toThrow(
      OutboundBlockedError
    );
    expect(seen).toHaveLength(0);
  });

  it('refuses unsupported methods', async () => {
    await expect(
      guardedRequest(publicUrl('/ok'), { method: 'CONNECT' }, { resolver: publicResolver, config: baseConfig })
    ).rejects.toThrow(/method "CONNECT"/);
    expect(seen).toHaveLength(0);
  });

  it('reports non-2xx statuses as not ok, with the body', async () => {
    const res = await guardedRequest(publicUrl('/fail'), {}, { resolver: publicResolver, config: baseConfig, connectAddress: toLoopback });
    expect(res).toMatchObject({ status: 500, ok: false, body: 'boom' });
  });

  it('sends the method, headers and body', async () => {
    await guardedRequest(
      publicUrl('/ok'),
      { method: 'post', headers: { 'Content-Type': 'application/json' }, body: '{"a":1}' },
      { resolver: publicResolver, config: baseConfig, connectAddress: toLoopback }
    );
    expect(seen[0]).toMatchObject({ method: 'POST', body: '{"a":1}', contentType: 'application/json' });
  });

  it('caps the response body and says so', async () => {
    const config = { ...baseConfig, maxResponseBytes: 100 };
    const res = await guardedRequest(publicUrl('/big'), {}, { resolver: publicResolver, config, connectAddress: toLoopback });
    expect(res.status).toBe(200);
    expect(res.truncated).toBe(true);
    expect(res.body).toBe('x'.repeat(100));
    expect(res.note).toMatch(/OUTBOUND_MAX_RESPONSE_BYTES/);
  });

  it('does not truncate a body that fits exactly', async () => {
    const config = { ...baseConfig, maxResponseBytes: 5000 };
    const res = await guardedRequest(publicUrl('/big'), {}, { resolver: publicResolver, config, connectAddress: toLoopback });
    expect(res.truncated).toBe(false);
    expect(res.body).toHaveLength(5000);
  });

  it('follows a redirect to another public path and checks it again', async () => {
    const resolver = jest.fn(publicResolver);
    const res = await guardedRequest(publicUrl('/to-ok'), {}, { resolver, config: baseConfig, connectAddress: toLoopback });
    expect(res).toMatchObject({ status: 200, body: 'hello', redirects: 1 });
    expect(res.finalUrl).toBe(publicUrl('/ok'));
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it('blocks a redirect to the metadata address', async () => {
    await expect(
      guardedRequest(publicUrl('/to-internal'), {}, { resolver: publicResolver, config: baseConfig, connectAddress: toLoopback })
    ).rejects.toThrow(/internal address/);
    expect(seen.map((entry) => entry.url)).toEqual(['/to-internal']);
  });

  it('blocks a redirect to a name that resolves internally', async () => {
    const resolver: Resolver = async (host) =>
      host === 'localhost' ? [{ address: '127.0.0.1', family: 4 }] : [{ address: '93.184.216.34', family: 4 }];
    await expect(
      guardedRequest(publicUrl('/to-loopback-name'), {}, { resolver, config: baseConfig, connectAddress: toLoopback })
    ).rejects.toThrow(/internal address/);
  });

  it('blocks a redirect to a non-http scheme', async () => {
    await expect(
      guardedRequest(publicUrl('/to-file'), {}, { resolver: publicResolver, config: baseConfig, connectAddress: toLoopback })
    ).rejects.toThrow(/scheme "file"/);
  });

  it('stops after the maximum number of redirects', async () => {
    const config = { ...baseConfig, maxRedirects: 3 };
    await expect(
      guardedRequest(publicUrl('/loop'), {}, { resolver: publicResolver, config, connectAddress: toLoopback })
    ).rejects.toThrow(/more than 3 redirects/);
    expect(seen).toHaveLength(4);
  });

  it('turns POST into GET without body on 302, but keeps it on 307', async () => {
    const options = { resolver: publicResolver, config: baseConfig, connectAddress: toLoopback };
    await guardedRequest(publicUrl('/post-redirect'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"x":1}' }, options);
    expect(seen[1]).toMatchObject({ method: 'GET', url: '/ok', body: '', contentType: undefined });

    seen.length = 0;
    await guardedRequest(publicUrl('/keep-method'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"x":1}' }, options);
    expect(seen[1]).toMatchObject({ method: 'POST', url: '/ok', body: '{"x":1}' });
  });

  it('pins the validated address: a second DNS answer is never used', async () => {
    let calls = 0;
    const rebinding: Resolver = async () => {
      calls += 1;
      return calls === 1 ? [{ address: '93.184.216.34', family: 4 }] : [{ address: '127.0.0.1', family: 4 }];
    };
    const connected: string[] = [];
    const res = await guardedRequest(publicUrl('/ok'), {}, {
      resolver: rebinding,
      config: baseConfig,
      connectAddress: (validated) => {
        connected.push(validated);
        return '127.0.0.1';
      },
    });
    expect(res.status).toBe(200);
    expect(calls).toBe(1);
    expect(connected).toEqual(['93.184.216.34']);
  });

  it('withholds the body of an allowlisted internal host and says why', async () => {
    const config = { ...baseConfig, allowedHosts: ['n8n.internal'] };
    const resolver: Resolver = async () => [{ address: '127.0.0.1', family: 4 }];
    const res = await guardedRequest(`http://n8n.internal:${port}/ok`, {}, { resolver, config });
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.body).toBeNull();
    expect(res.note).toMatch(/withheld/);
    expect(seen).toHaveLength(1);
  });

  it('withholds the body when a public host redirects to an allowlisted internal one', async () => {
    const config = { ...baseConfig, allowedHosts: ['n8n.internal'] };
    const resolver: Resolver = async (host) =>
      host === 'n8n.internal' ? [{ address: '172.18.0.4', family: 4 }] : [{ address: '93.184.216.34', family: 4 }];
    const res = await guardedRequest(publicUrl('/to-allowed-internal'), {}, { resolver, config, connectAddress: toLoopback });
    expect(res).toMatchObject({ status: 200, body: null, redirects: 1 });
    expect(res.note).toMatch(/withheld/);
  });

  it('keeps blocking redirect targets that are not on the allowlist', async () => {
    const config = { ...baseConfig, allowedHosts: ['10.9.9.9'] };
    await expect(
      guardedRequest(publicUrl('/to-internal'), {}, { resolver: publicResolver, config, connectAddress: toLoopback })
    ).rejects.toThrow(/internal address/);
  });

  it('fails with a plain error when the connection is refused or times out', async () => {
    const closed = http.createServer();
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
    const closedPort = (closed.address() as AddressInfo).port;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    await expect(
      guardedRequest(`http://public.example:${closedPort}/`, {}, { resolver: publicResolver, config: baseConfig, connectAddress: toLoopback })
    ).rejects.toThrow();

    const slow = http.createServer(() => undefined);
    await new Promise<void>((resolve) => slow.listen(0, '127.0.0.1', resolve));
    const slowPort = (slow.address() as AddressInfo).port;
    try {
      await expect(
        guardedRequest(
          `http://public.example:${slowPort}/`,
          {},
          { resolver: publicResolver, config: { ...baseConfig, timeoutMs: 200 }, connectAddress: toLoopback }
        )
      ).rejects.toThrow();
    } finally {
      slow.closeAllConnections();
      await new Promise<void>((resolve) => slow.close(() => resolve()));
    }
  });
});
