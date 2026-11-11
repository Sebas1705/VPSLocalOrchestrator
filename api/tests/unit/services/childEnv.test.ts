/**
 * Unit tests - child processes get a scrubbed environment, not the API's own
 */

import '../../support/env.js';
import { buildChildEnv } from '../../../src/services/childEnv.js';
import { runProcess } from '../../../src/services/commandExecutor.js';
import { ChildProcessCommandExecutor } from '../../../src/infrastructure/adapters/child-process-command-executor.js';

const apiEnv: NodeJS.ProcessEnv = {
  PATH: '/usr/bin:/bin',
  HOME: '/home/svc',
  USER: 'svc',
  LANG: 'en_US.UTF-8',
  LC_ALL: 'C',
  TZ: 'UTC',
  API_TOKEN: 'tok-123',
  SECRET_KEY: 'key-456',
  SUDO_PASSWORD: 'pw',
  ENCRYPTION_MASTER_KEY: 'master',
  API_HOST: '0.0.0.0',
  PORT: '3000',
  NODE_ENV: 'production',
  FILE_ALLOWED_ROOTS: '/srv',
  OUTBOUND_ALLOWED_HOSTS: 'x',
  AWS_SECRET_ACCESS_KEY: 'aws',
  GITHUB_TOKEN: 'gh',
  DB_PASSWORD: 'db',
  PGPASSWORD: 'pg',
  PGHOST: 'db.local',
  DOCKER_HOST: 'unix:///var/run/docker.sock',
  SOMETHING_ELSE: 'x',
};

describe('buildChildEnv', () => {
  it('copies only the safe variables by default', () => {
    expect(buildChildEnv(undefined, apiEnv)).toEqual({
      PATH: '/usr/bin:/bin',
      HOME: '/home/svc',
      USER: 'svc',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'C',
      TZ: 'UTC',
    });
  });

  it('never carries the API token, key or other credentials', () => {
    const env = buildChildEnv(undefined, apiEnv);
    for (const name of ['API_TOKEN', 'SECRET_KEY', 'SUDO_PASSWORD', 'ENCRYPTION_MASTER_KEY', 'AWS_SECRET_ACCESS_KEY', 'GITHUB_TOKEN', 'DB_PASSWORD', 'PGPASSWORD']) {
      expect(env).not.toHaveProperty(name);
    }
    expect(Object.values(env).join('|')).not.toMatch(/tok-123|key-456|master/);
  });

  it('passes variables the operator lists, by name or prefix', () => {
    const env = buildChildEnv(undefined, { ...apiEnv, CHILD_ENV_PASSTHROUGH: 'docker_host, PG*' });
    expect(env.DOCKER_HOST).toBe('unix:///var/run/docker.sock');
    expect(env.PGHOST).toBe('db.local');
    // Listed explicitly (by prefix), so the secret-looking name is the operator's call.
    expect(env.PGPASSWORD).toBe('pg');
    expect(env).not.toHaveProperty('SOMETHING_ELSE');
    expect(env).not.toHaveProperty('API_TOKEN');
  });

  it('does not pass the API own variables even when listed', () => {
    const env = buildChildEnv(undefined, {
      ...apiEnv,
      CHILD_ENV_PASSTHROUGH: 'API_TOKEN SECRET_KEY SUDO_PASSWORD ENCRYPTION_MASTER_KEY API_* FILE_ALLOWED_ROOTS CHILD_ENV_PASSTHROUGH',
    });
    for (const name of ['API_TOKEN', 'SECRET_KEY', 'SUDO_PASSWORD', 'ENCRYPTION_MASTER_KEY', 'API_HOST', 'FILE_ALLOWED_ROOTS', 'CHILD_ENV_PASSTHROUGH']) {
      expect(env).not.toHaveProperty(name);
    }
  });

  it('is case-insensitive about names (Windows) and keeps the original spelling', () => {
    const env = buildChildEnv(undefined, { Path: 'C:\Windows', SystemRoot: 'C:\Windows', Api_Token: 'x' });
    expect(env).toEqual({ Path: 'C:\Windows', SystemRoot: 'C:\Windows' });
  });

  it('adds caller variables on top and lets them win', () => {
    const env = buildChildEnv({ TZ: 'Europe/Madrid', MY_FLAG: '1', SKIPPED: undefined }, apiEnv);
    expect(env.TZ).toBe('Europe/Madrid');
    expect(env.MY_FLAG).toBe('1');
    expect(env).not.toHaveProperty('SKIPPED');
  });

  it('ignores undefined source values and does not mutate its inputs', () => {
    const source: NodeJS.ProcessEnv = { PATH: undefined, HOME: '/h' };
    const extra = { A: 'b' };
    expect(buildChildEnv(extra, source)).toEqual({ HOME: '/h', A: 'b' });
    expect(extra).toEqual({ A: 'b' });
    expect(source).toEqual({ PATH: undefined, HOME: '/h' });
  });

  it('reads process.env by default', () => {
    const saved = { token: process.env.API_TOKEN, marker: process.env.ZZ_MARKER };
    process.env.API_TOKEN = 'live-token';
    process.env.ZZ_MARKER = 'nope';
    try {
      const env = buildChildEnv();
      expect(env).not.toHaveProperty('API_TOKEN');
      expect(env).not.toHaveProperty('ZZ_MARKER');
    } finally {
      if (saved.token === undefined) delete process.env.API_TOKEN;
      else process.env.API_TOKEN = saved.token;
      delete process.env.ZZ_MARKER;
    }
  });
});

describe('real child processes', () => {
  const printEnv = ['-e', 'process.stdout.write(JSON.stringify(process.env))'];
  const saved: Record<string, string | undefined> = {};
  const names = ['API_TOKEN', 'SECRET_KEY', 'LEAK_PASSWORD', 'CHILD_ENV_PASSTHROUGH', 'KEEP_ME'];

  beforeEach(() => {
    for (const name of names) saved[name] = process.env[name];
    process.env.API_TOKEN = 'tok-real';
    process.env.SECRET_KEY = 'key-real';
    process.env.LEAK_PASSWORD = 'pw-real';
    process.env.KEEP_ME = 'kept';
  });

  afterEach(() => {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  it('runProcess does not expose the API environment to the child', async () => {
    const result = await runProcess(process.execPath, printEnv);
    expect(result.exitCode).toBe(0);
    const env = JSON.parse(result.stdout);
    expect(env).not.toHaveProperty('API_TOKEN');
    expect(env).not.toHaveProperty('SECRET_KEY');
    expect(env).not.toHaveProperty('LEAK_PASSWORD');
    expect(env).not.toHaveProperty('KEEP_ME');
    expect(result.stdout).not.toMatch(/tok-real|key-real|pw-real/);
  });

  it('runProcess honours the passthrough list and explicit options.env', async () => {
    process.env.CHILD_ENV_PASSTHROUGH = 'KEEP_ME';
    const result = await runProcess(process.execPath, printEnv, { env: { EXTRA: '1' } });
    const env = JSON.parse(result.stdout);
    expect(env.KEEP_ME).toBe('kept');
    expect(env.EXTRA).toBe('1');
    expect(env).not.toHaveProperty('API_TOKEN');
  });

  it('the hexagonal executor adapter is scrubbed too', async () => {
    const executor = new ChildProcessCommandExecutor();
    const result = await executor.execute(process.execPath, printEnv);
    expect(result.exitCode).toBe(0);
    const env = JSON.parse(result.stdout);
    expect(env).not.toHaveProperty('API_TOKEN');
    expect(env).not.toHaveProperty('SECRET_KEY');
  });
});
