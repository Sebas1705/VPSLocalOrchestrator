/**
 * Unit tests - writes are confined to FILE_WRITE_ROOTS, reads stay on FILE_ALLOWED_ROOTS
 */

import '../../support/env.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { API_ROOT } from '../../../src/config/paths.js';
import {
  DEFAULT_WRITE_DIR,
  getAllowedRoots,
  getWriteRoots,
  PathAccessDeniedError,
  resolveAllowedPath,
  resolveWritableEntry,
  resolveWritablePath,
} from '../../../src/services/pathPolicy.js';
import {
  createDirectory,
  deleteDirectory,
  deleteFile,
  readFile,
  writeFile,
} from '../../../src/services/fileManager.js';
import { createBackup, restoreBackup } from '../../../src/services/backupManager.js';
import { backupDatabase } from '../../../src/services/databaseManager.js';
import fileRoutes from '../../../src/routes/file.routes.js';
import { API_TOKEN } from '../../../src/middleware/auth.js';

function canSymlink(): boolean {
  const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'symlink-probe-'));
  try {
    fs.symlinkSync(probe, path.join(probe, 'link'));
    return true;
  } catch {
    return false;
  } finally {
    fs.rmSync(probe, { recursive: true, force: true });
  }
}
const itWithSymlinks = canSymlink() ? it : it.skip;

const REPO_ROOT = path.dirname(API_ROOT);

describe('write roots', () => {
  let base: string;
  let readRoot: string; // readable, not writable
  let writeRoot: string; // readable and writable
  const saved = { read: process.env.FILE_ALLOWED_ROOTS, write: process.env.FILE_WRITE_ROOTS };

  beforeEach(() => {
    base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'write-roots-')));
    readRoot = path.join(base, 'home');
    writeRoot = path.join(base, 'data');
    fs.mkdirSync(readRoot);
    fs.mkdirSync(writeRoot);
    fs.writeFileSync(path.join(readRoot, 'app.txt'), 'app');
    process.env.FILE_ALLOWED_ROOTS = [readRoot, writeRoot].join(path.delimiter);
    process.env.FILE_WRITE_ROOTS = writeRoot;
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
    if (saved.read === undefined) delete process.env.FILE_ALLOWED_ROOTS;
    else process.env.FILE_ALLOWED_ROOTS = saved.read;
    if (saved.write === undefined) delete process.env.FILE_WRITE_ROOTS;
    else process.env.FILE_WRITE_ROOTS = saved.write;
  });

  describe('configuration', () => {
    it('defaults to one dedicated directory under the API data directory', async () => {
      delete process.env.FILE_WRITE_ROOTS;
      try {
        expect(DEFAULT_WRITE_DIR).toBe(path.join(API_ROOT, 'data', 'files'));
        const roots = await getWriteRoots();
        expect(roots).toHaveLength(1);
        expect(fs.existsSync(DEFAULT_WRITE_DIR)).toBe(true);
        expect(roots[0]).toBe(fs.realpathSync(DEFAULT_WRITE_DIR));
      } finally {
        fs.rmSync(path.join(API_ROOT, 'data'), { recursive: true, force: true });
      }
    });

    it('an empty FILE_WRITE_ROOTS disables writes', async () => {
      process.env.FILE_WRITE_ROOTS = '';
      await expect(getWriteRoots()).resolves.toEqual([]);
      await expect(writeFile(path.join(writeRoot, 'x.txt'), 'x')).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    it('splits on the path delimiter and drops relative and missing roots', async () => {
      const second = path.join(base, 'second');
      fs.mkdirSync(second);
      process.env.FILE_WRITE_ROOTS = [writeRoot, 'relative/dir', path.join(base, 'nope'), second].join(path.delimiter);
      await expect(getWriteRoots()).resolves.toEqual([writeRoot, second]);
    });

    it('write roots are readable even when FILE_ALLOWED_ROOTS does not list them', async () => {
      process.env.FILE_ALLOWED_ROOTS = readRoot;
      await expect(getAllowedRoots()).resolves.toEqual([readRoot, writeRoot]);
      await writeFile(path.join(writeRoot, 'note.txt'), 'hi');
      await expect(readFile(path.join(writeRoot, 'note.txt'))).resolves.toMatchObject({ content: 'hi' });
    });

    it.each([
      ['the API install directory', () => API_ROOT],
      ['a directory inside the install directory', () => path.join(API_ROOT, 'webhooks')],
      ['the directory that holds the install directory (repo root)', () => REPO_ROOT],
      ['the filesystem root', () => path.parse(API_ROOT).root],
      ['the repo scripts directory', () => path.join(REPO_ROOT, 'scripts')],
    ])('ignores a write root that is %s', async (_label, target) => {
      const directory = target();
      expect(fs.existsSync(directory)).toBe(true);
      process.env.FILE_WRITE_ROOTS = directory;
      await expect(getWriteRoots()).resolves.toEqual([]);
    });

    it('ignores a write root that contains the install directory, keeping the others', async () => {
      process.env.FILE_WRITE_ROOTS = [REPO_ROOT, writeRoot].join(path.delimiter);
      await expect(getWriteRoots()).resolves.toEqual([writeRoot]);
    });
  });

  describe('resolveWritablePath / resolveWritableEntry', () => {
    it('accepts new and existing paths inside a write root', async () => {
      await expect(resolveWritablePath(path.join(writeRoot, 'a', 'b.txt'))).resolves.toBe(path.join(writeRoot, 'a', 'b.txt'));
      await expect(resolveWritableEntry(path.join(writeRoot, 'b.txt'))).resolves.toBe(path.join(writeRoot, 'b.txt'));
    });

    it('refuses readable paths outside a write root', async () => {
      await expect(resolveAllowedPath(path.join(readRoot, 'app.txt'))).resolves.toBe(path.join(readRoot, 'app.txt'));
      await expect(resolveWritablePath(path.join(readRoot, 'app.txt'))).rejects.toThrow(/FILE_WRITE_ROOTS/);
      await expect(resolveWritableEntry(path.join(readRoot, 'app.txt'))).rejects.toThrow(/FILE_WRITE_ROOTS/);
      await expect(resolveWritablePath(path.join(readRoot, 'new.txt'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    it('rejects .. traversal out of the write root', async () => {
      await expect(resolveWritablePath(path.join(writeRoot, '..', 'home', 'evil.txt'))).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(resolveWritablePath(`${writeRoot}${path.sep}..${path.sep}..${path.sep}x`)).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(resolveWritableEntry(path.join(writeRoot, 'sub', '..', '..', 'home', 'app.txt'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    it('does not treat a sibling with the same prefix as inside the root', async () => {
      const sibling = `${writeRoot}-other`;
      fs.mkdirSync(sibling);
      await expect(resolveWritablePath(path.join(sibling, 'x.txt'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    it('still refuses hidden files below the write root', async () => {
      await expect(resolveWritablePath(path.join(writeRoot, '.env'))).rejects.toThrow(/hidden/);
      await expect(resolveWritablePath(path.join(writeRoot, '.ssh', 'authorized_keys'))).rejects.toThrow(/hidden/);
    });

    it('refuses invalid targets', async () => {
      for (const target of [undefined, null, '', 42, ['x'], `${writeRoot}/a\0b`]) {
        await expect(resolveWritablePath(target)).rejects.toBeInstanceOf(PathAccessDeniedError);
      }
    });

    it('refuses the API directory and every deploy file, even if a caller passes the repo as a root', async () => {
      const roots = [REPO_ROOT];
      for (const target of [
        path.join(API_ROOT, '.env'),
        path.join(API_ROOT, 'package.json'),
        path.join(API_ROOT, 'dist', 'index.js'),
        path.join(REPO_ROOT, 'docker-compose.yml'),
        path.join(REPO_ROOT, 'vps-orchestrator.service'),
        path.join(REPO_ROOT, 'Dockerfile'),
        path.join(REPO_ROOT, 'scripts', 'test-api-complete.sh'),
        path.join(REPO_ROOT, '.git', 'config'),
        path.join(REPO_ROOT, '.github', 'workflows', 'ci.yml'),
      ]) {
        await expect(resolveWritablePath(target, roots)).rejects.toBeInstanceOf(PathAccessDeniedError);
        await expect(resolveWritableEntry(target, roots)).rejects.toBeInstanceOf(PathAccessDeniedError);
      }
    });

    it('lets the default data directory work although it lives inside the install directory', async () => {
      delete process.env.FILE_WRITE_ROOTS;
      try {
        const target = path.join(DEFAULT_WRITE_DIR, 'report.txt');
        // The first write creates the directory on demand.
        const resolved = await resolveWritablePath(target);
        expect(resolved).toBe(path.join(fs.realpathSync(DEFAULT_WRITE_DIR), 'report.txt'));
        await expect(resolveWritablePath(path.join(API_ROOT, 'data', 'other.txt'))).rejects.toBeInstanceOf(PathAccessDeniedError);
        await expect(resolveWritablePath(path.join(API_ROOT, 'secrets', 'secrets.json'))).rejects.toBeInstanceOf(PathAccessDeniedError);
        await expect(resolveWritablePath(path.join(DEFAULT_WRITE_DIR, '..', '..', 'package.json'))).rejects.toBeInstanceOf(PathAccessDeniedError);
      } finally {
        fs.rmSync(path.join(API_ROOT, 'data'), { recursive: true, force: true });
      }
    });

    itWithSymlinks('refuses a symlink in the write root that points to a readable path outside it', async () => {
      fs.symlinkSync(path.join(readRoot, 'app.txt'), path.join(writeRoot, 'link'));
      await expect(resolveWritablePath(path.join(writeRoot, 'link'))).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(writeFile(path.join(writeRoot, 'link'), 'overwritten')).rejects.toBeInstanceOf(PathAccessDeniedError);
      expect(fs.readFileSync(path.join(readRoot, 'app.txt'), 'utf8')).toBe('app');
    });

    itWithSymlinks('refuses a symlinked directory in the write root that leaves it', async () => {
      fs.symlinkSync(readRoot, path.join(writeRoot, 'dir'));
      await expect(writeFile(path.join(writeRoot, 'dir', 'evil.txt'), 'x')).rejects.toBeInstanceOf(PathAccessDeniedError);
      expect(fs.existsSync(path.join(readRoot, 'evil.txt'))).toBe(false);
    });

    itWithSymlinks('refuses a symlink in the write root that points to a deploy file', async () => {
      fs.symlinkSync(path.join(REPO_ROOT, 'docker-compose.yml'), path.join(writeRoot, 'compose'));
      await expect(writeFile(path.join(writeRoot, 'compose'), 'x')).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    itWithSymlinks('refuses a write root that is a symlink to a protected directory', async () => {
      const link = path.join(base, 'scripts-link');
      fs.symlinkSync(path.join(REPO_ROOT, 'scripts'), link);
      process.env.FILE_WRITE_ROOTS = link;
      await expect(getWriteRoots()).resolves.toEqual([]);
    });
  });

  describe('file operations', () => {
    it('writes, appends and reads inside the write root', async () => {
      const target = path.join(writeRoot, 'out.txt');
      await writeFile(target, 'a');
      await writeFile(target, 'b', { append: true });
      await expect(readFile(target)).resolves.toMatchObject({ content: 'ab' });
    });

    it('refuses write, delete, mkdir and rmdir in a read-only root, and changes nothing', async () => {
      const target = path.join(readRoot, 'app.txt');
      await expect(writeFile(target, 'overwritten')).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(writeFile(path.join(readRoot, 'new.txt'), 'x')).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(deleteFile(target)).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(createDirectory(path.join(readRoot, 'sub'))).rejects.toBeInstanceOf(PathAccessDeniedError);
      fs.mkdirSync(path.join(readRoot, 'empty'));
      await expect(deleteDirectory(path.join(readRoot, 'empty'))).rejects.toBeInstanceOf(PathAccessDeniedError);

      expect(fs.readFileSync(target, 'utf8')).toBe('app');
      expect(fs.existsSync(path.join(readRoot, 'new.txt'))).toBe(false);
      expect(fs.existsSync(path.join(readRoot, 'sub'))).toBe(false);
      expect(fs.existsSync(path.join(readRoot, 'empty'))).toBe(true);
    });

    it('still reads from the read-only root', async () => {
      await expect(readFile(path.join(readRoot, 'app.txt'))).resolves.toMatchObject({ content: 'app' });
    });

    it('creates and removes directories in the write root', async () => {
      const dir = path.join(writeRoot, 'made');
      await expect(createDirectory(dir)).resolves.toMatchObject({ created: true });
      await expect(deleteDirectory(dir)).resolves.toMatchObject({ deleted: true });
    });

    it('cannot reach the deploy files by traversal from the write root', async () => {
      const compose = path.join(REPO_ROOT, 'docker-compose.yml');
      const before = fs.readFileSync(compose, 'utf8');
      const relative = path.relative(writeRoot, compose);
      await expect(writeFile(path.join(writeRoot, relative), 'services: {}')).rejects.toBeInstanceOf(PathAccessDeniedError);
      expect(fs.readFileSync(compose, 'utf8')).toBe(before);
    });
  });

  describe('backups and database dumps', () => {
    it('restores only into a write root', async () => {
      await expect(restoreBackup('any', readRoot)).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(restoreBackup('any', path.join(REPO_ROOT, 'scripts'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    it('still archives from the read roots', async () => {
      await expect(createBackup([path.join(readRoot, 'missing.txt')])).rejects.toThrow('Path not found');
      await expect(createBackup([path.join(base, '..', 'definitely-outside')])).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    it('dumps databases only into a write root', async () => {
      await expect(backupDatabase('postgresql', 'app', readRoot)).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(backupDatabase('postgresql', 'app', path.join(os.tmpdir(), 'db-backups'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    it('refuses the default dump directory when no write root is configured', async () => {
      process.env.FILE_WRITE_ROOTS = '';
      await expect(backupDatabase('postgresql', 'app')).rejects.toThrow(/FILE_WRITE_ROOTS/);
    });
  });

  describe('HTTP', () => {
    const app = express();
    app.use(express.json());
    app.use('/api/files', fileRoutes);
    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${API_TOKEN}`);

    it('answers 403 for write, delete, mkdir and rmdir outside the write roots, 201 inside', async () => {
      const outside = path.join(readRoot, 'app.txt');
      expect((await auth(request(app).post('/api/files')).send({ path: outside, content: 'x' })).status).toBe(403);
      expect((await auth(request(app).delete(`/api/files?path=${encodeURIComponent(outside)}`))).status).toBe(403);
      expect((await auth(request(app).post('/api/files/mkdir')).send({ path: path.join(readRoot, 'd') })).status).toBe(403);
      expect((await auth(request(app).delete(`/api/files/rmdir?path=${encodeURIComponent(readRoot)}`))).status).toBe(403);
      expect(fs.readFileSync(outside, 'utf8')).toBe('app');

      const inside = path.join(writeRoot, 'ok.txt');
      expect((await auth(request(app).post('/api/files')).send({ path: inside, content: 'ok' })).status).toBe(201);
      expect(fs.readFileSync(inside, 'utf8')).toBe('ok');
    });

    it('answers 403 for a write that targets the repo deploy files', async () => {
      const res = await auth(request(app).post('/api/files')).send({ path: path.join(REPO_ROOT, 'docker-compose.yml'), content: 'x' });
      expect(res.status).toBe(403);
    });
  });
});
