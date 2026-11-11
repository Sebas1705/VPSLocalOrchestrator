/**
 * Unit tests - the API version is single-sourced from package.json
 */

import '../support/env.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { API_ROOT } from '../../src/config/paths.js';
import { readVersion, VERSION } from '../../src/version.js';

describe('version', () => {
  it('matches api/package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(API_ROOT, 'package.json'), 'utf-8'));
    expect(VERSION).toBe(pkg.version);
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('matches the root package of the lockfile', () => {
    const lock = JSON.parse(fs.readFileSync(path.join(API_ROOT, 'package-lock.json'), 'utf-8'));
    expect(lock.version).toBe(VERSION);
    expect(lock.packages[''].version).toBe(VERSION);
  });

  it('reads the version from the given directory (src and dist share one layout)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'version-'));
    try {
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '9.8.7' }));
      expect(readVersion(dir)).toBe('9.8.7');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to "unknown" when package.json is missing or malformed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'version-'));
    try {
      expect(readVersion(dir)).toBe('unknown');
      fs.writeFileSync(path.join(dir, 'package.json'), '{not json');
      expect(readVersion(dir)).toBe('unknown');
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: 3 }));
      expect(readVersion(dir)).toBe('unknown');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is what GET / reports', async () => {
    const app = createApp({ commandRepository: {} as any, resourceRepository: {} as any, serviceRepository: {} as any }, { rateLimit: false });
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(VERSION);
    expect(res.body.description).toContain(`v${VERSION}`);
  });
});
