/**
 * Unit tests - workflow HTTP steps and webhook delivery go through the outbound destination policy
 */

import '../../support/env.js';
import http from 'http';
import type { AddressInfo } from 'net';
import { createWorkflow, deleteWorkflow, runWorkflow } from '../../../src/services/workflowManager.js';
import { deleteWebhook, registerWebhook, testWebhook } from '../../../src/services/webhookManager.js';

describe('outbound policy at the call sites', () => {
  let server: http.Server;
  let port: number;
  let hits: string[];
  const previousHosts = process.env.OUTBOUND_ALLOWED_HOSTS;
  const previousMax = process.env.OUTBOUND_MAX_RESPONSE_BYTES;

  beforeEach(async () => {
    hits = [];
    delete process.env.OUTBOUND_ALLOWED_HOSTS;
    delete process.env.OUTBOUND_MAX_RESPONSE_BYTES;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    server = http.createServer((req, res) => {
      hits.push(`${req.method} ${req.url}`);
      res.writeHead(200);
      res.end('secret-internal-body');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (previousHosts === undefined) delete process.env.OUTBOUND_ALLOWED_HOSTS;
    else process.env.OUTBOUND_ALLOWED_HOSTS = previousHosts;
    if (previousMax === undefined) delete process.env.OUTBOUND_MAX_RESPONSE_BYTES;
    else process.env.OUTBOUND_MAX_RESPONSE_BYTES = previousMax;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function runWebhookStep(url: string) {
    const workflow = await createWorkflow('ssrf-check', [{ type: 'webhook', url, method: 'GET' }]);
    try {
      const run = await runWorkflow(workflow.id);
      return run.steps[0]!;
    } finally {
      await deleteWorkflow(workflow.id);
    }
  }

  it('fails a workflow HTTP step aimed at loopback without contacting it', async () => {
    const step = await runWebhookStep(`http://127.0.0.1:${port}/admin`);
    expect(step.status).toBe('failure');
    expect(step.error).toMatch(/internal address/);
    expect(step.output).toBeUndefined();
    expect(hits).toEqual([]);
  });

  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'http://[::ffff:127.0.0.1]/',
    'http://10.0.0.1/',
    'file:///etc/passwd',
    'ftp://example.com/',
  ])('fails a workflow HTTP step aimed at %s', async (url) => {
    const step = await runWebhookStep(url);
    expect(step.status).toBe('failure');
    expect(step.error).toMatch(/blocked/);
  });

  it('with the host allowlisted, runs the step but returns status and a note instead of the body', async () => {
    process.env.OUTBOUND_ALLOWED_HOSTS = '127.0.0.1';
    const step = await runWebhookStep(`http://127.0.0.1:${port}/ok`);
    expect(step.status).toBe('success');
    expect(step.output.status).toBe(200);
    expect(step.output.body).toBeNull();
    expect(step.output.note).toMatch(/withheld/);
    expect(JSON.stringify(step)).not.toContain('secret-internal-body');
    expect(hits).toEqual(['GET /ok']);
  });

  it('refuses to deliver a webhook to an internal address', async () => {
    const webhook = await registerWebhook(`http://127.0.0.1:${port}/hook`, ['test']);
    try {
      await expect(testWebhook(webhook.id)).rejects.toThrow(/internal address/);
      expect(hits).toEqual([]);
    } finally {
      await deleteWebhook(webhook.id);
    }
  });

  it('delivers a webhook to an allowlisted internal host', async () => {
    process.env.OUTBOUND_ALLOWED_HOSTS = '127.0.0.1';
    const webhook = await registerWebhook(`http://127.0.0.1:${port}/hook`, ['test']);
    try {
      await testWebhook(webhook.id);
      expect(hits).toEqual(['POST /hook']);
    } finally {
      await deleteWebhook(webhook.id);
    }
  });
});
