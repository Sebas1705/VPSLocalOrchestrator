/**
 * Unit tests - path containment for files, backups and database dumps
 */

import '../../support/env.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { API_ROOT } from '../../../src/config/paths.js';
import {
  getAllowedRoots,
  PathAccessDeniedError,
  pathErrorStatus,
  resolveAllowedEntry,
  resolveAllowedPath,
} from '../../../src/services/pathPolicy.js';
import {
  createDirectory,
  deleteDirectory,
  deleteFile,
  getFileStats,
  listDirectory,
  readFile,
  writeFile,
} from '../../../src/services/fileManager.js';
import { createBackup, restoreBackup } from '../../../src/services/backupManager.js';
import { backupDatabase } from '../../../src/services/databaseManager.js';
import fileRoutes from '../../../src/routes/file.routes.js';
import { API_TOKEN } from '../../../src/middleware/auth.js';

/** Creating symlinks needs a privilege on Windows; CI runs on Linux. */
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

describe('path policy', () => {
  let base: string;
  let root: string;
  let outside: string;
  const previousRoots = process.env.FILE_ALLOWED_ROOTS;

  beforeEach(() => {
    base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'path-policy-')));
    root = path.join(base, 'root');
    outside = path.join(base, 'outside');
    fs.mkdirSync(root);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(root, 'plain.txt'), 'inside');
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'outside');
    process.env.FILE_ALLOWED_ROOTS = root;
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
    if (previousRoots === undefined) delete process.env.FILE_ALLOWED_ROOTS;
    else process.env.FILE_ALLOWED_ROOTS = previousRoots;
  });

  describe('resolveAllowedPath', () => {
    it('accepts existing and not-yet-existing paths inside a root', async () => {
      await expect(resolveAllowedPath(path.join(root, 'plain.txt'))).resolves.toBe(path.join(root, 'plain.txt'));
      await expect(resolveAllowedPath(path.join(root, 'a', 'b', 'new.txt'))).resolves.toBe(path.join(root, 'a', 'b', 'new.txt'));
      await expect(resolveAllowedPath(root)).resolves.toBe(root);
    });

    it('refuses paths outside the roots', async () => {
      await expect(resolveAllowedPath(path.join(outside, 'secret.txt'))).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(resolveAllowedPath(`${root}${path.sep}..${path.sep}outside${path.sep}secret.txt`)).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(resolveAllowedPath(`${root}-sibling`)).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    it.each(['.env', '.ssh/authorized_keys', 'app/.env', 'app/.git/config', '.bashrc', '.config/systemd/user/x.service'])(
      'refuses hidden path %s',
      async (relative) => {
        await expect(resolveAllowedPath(path.join(root, relative))).rejects.toBeInstanceOf(PathAccessDeniedError);
      }
    );

    it('allows a root that is itself below a hidden directory', async () => {
      const hiddenRoot = path.join(base, '.local', 'share');
      fs.mkdirSync(hiddenRoot, { recursive: true });
      process.env.FILE_ALLOWED_ROOTS = hiddenRoot;
      await expect(resolveAllowedPath(path.join(hiddenRoot, 'x.txt'))).resolves.toBe(path.join(hiddenRoot, 'x.txt'));
    });

    it('refuses the API install directory, whatever the roots say', async () => {
      process.env.FILE_ALLOWED_ROOTS = path.dirname(API_ROOT);
      for (const target of ['package.json', 'dist/index.js', 'secrets/secrets.json', 'logs/audit.log']) {
        await expect(resolveAllowedPath(path.join(API_ROOT, target))).rejects.toThrow(/install directory/);
      }
    });

    it.each([[''], [42], [null], [undefined], [['/tmp']], ['/tmp/a\0b']])('refuses invalid input %j', async (value) => {
      await expect(resolveAllowedPath(value)).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    it('fails closed with no usable roots', async () => {
      process.env.FILE_ALLOWED_ROOTS = 'relative/path';
      await expect(getAllowedRoots()).resolves.toEqual([]);
      await expect(resolveAllowedPath(path.join(root, 'plain.txt'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    it('splits FILE_ALLOWED_ROOTS on the path delimiter and drops missing roots', async () => {
      process.env.FILE_ALLOWED_ROOTS = [root, outside, path.join(base, 'nope')].join(path.delimiter);
      await expect(getAllowedRoots()).resolves.toEqual([root, outside]);
    });

    itWithSymlinks('refuses a symlink that leaves the root', async () => {
      fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'link'));
      await expect(resolveAllowedPath(path.join(root, 'link'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    itWithSymlinks('refuses a path through a linked directory that leaves the root', async () => {
      fs.symlinkSync(outside, path.join(root, 'dir'));
      await expect(resolveAllowedPath(path.join(root, 'dir', 'secret.txt'))).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(resolveAllowedPath(path.join(root, 'dir', 'new', 'file.txt'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    itWithSymlinks('refuses a dangling symlink, which a write would otherwise create outside', async () => {
      fs.symlinkSync(path.join(outside, 'created-by-write'), path.join(root, 'dangling'));
      await expect(resolveAllowedPath(path.join(root, 'dangling'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    itWithSymlinks('refuses a symlink into a hidden file', async () => {
      fs.writeFileSync(path.join(root, '.env'), 'API_TOKEN=x');
      fs.symlinkSync(path.join(root, '.env'), path.join(root, 'innocent'));
      await expect(resolveAllowedPath(path.join(root, 'innocent'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    itWithSymlinks('refuses a symlink into the install directory', async () => {
      fs.symlinkSync(path.join(API_ROOT, 'package.json'), path.join(root, 'pkg'));
      await expect(resolveAllowedPath(path.join(root, 'pkg'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    itWithSymlinks('follows a symlink that stays inside the root', async () => {
      fs.symlinkSync(path.join(root, 'plain.txt'), path.join(root, 'alias'));
      await expect(resolveAllowedPath(path.join(root, 'alias'))).resolves.toBe(path.join(root, 'plain.txt'));
    });

    itWithSymlinks('resolves symlinks in the root itself', async () => {
      const linkedRoot = path.join(base, 'linked-root');
      fs.symlinkSync(root, linkedRoot);
      process.env.FILE_ALLOWED_ROOTS = linkedRoot;
      await expect(resolveAllowedPath(path.join(linkedRoot, 'plain.txt'))).resolves.toBe(path.join(root, 'plain.txt'));
    });
  });

  describe('resolveAllowedEntry', () => {
    it('applies the same limits as resolveAllowedPath', async () => {
      await expect(resolveAllowedEntry(path.join(outside, 'secret.txt'))).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(resolveAllowedEntry(path.join(root, '.env'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    itWithSymlinks('keeps the last component so a link can be removed', async () => {
      fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'link'));
      await expect(resolveAllowedEntry(path.join(root, 'link'))).resolves.toBe(path.join(root, 'link'));
    });

    itWithSymlinks('still resolves linked parents', async () => {
      fs.symlinkSync(outside, path.join(root, 'dir'));
      await expect(resolveAllowedEntry(path.join(root, 'dir', 'secret.txt'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });
  });

  describe('pathErrorStatus', () => {
    it('maps a denial to 403 and leaves other errors alone', () => {
      expect(pathErrorStatus(new PathAccessDeniedError())).toBe(403);
      expect(pathErrorStatus(new Error('boom'))).toBe(500);
    });
  });

  describe('fileManager', () => {
    it('reads, writes, appends, lists and deletes inside a root', async () => {
      const target = path.join(root, 'sub', 'note.txt');

      await expect(writeFile(target, 'one')).resolves.toMatchObject({ path: target, size: 3, written: 3 });
      await writeFile(target, 'two', { append: true });
      await expect(readFile(target)).resolves.toMatchObject({ content: 'onetwo', size: 6 });
      await writeFile(target, 'x');
      await expect(readFile(target)).resolves.toMatchObject({ content: 'x', size: 1 });

      const listing = await listDirectory(path.join(root, 'sub'));
      expect(listing.files.map((file) => file.name)).toEqual(['note.txt']);
      await expect(getFileStats(target)).resolves.toMatchObject({ type: 'file' });

      await expect(deleteFile(target)).resolves.toEqual({ path: target, deleted: true });
      await expect(deleteDirectory(path.join(root, 'sub'))).resolves.toMatchObject({ deleted: true });
      expect(fs.existsSync(path.join(root, 'sub'))).toBe(false);
    });

    it('creates directories', async () => {
      await expect(createDirectory(path.join(root, 'a', 'b'))).resolves.toMatchObject({ created: true });
    });

    it('applies an explicit mode', async () => {
      const target = path.join(root, 'moded.txt');
      await writeFile(target, 'x', { mode: 0o600 });
      if (process.platform !== 'win32') {
        expect(fs.statSync(target).mode & 0o777).toBe(0o600);
      }
    });

    it('denies every operation outside a root, keeping the error type', async () => {
      const target = path.join(outside, 'secret.txt');
      await expect(readFile(target)).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(writeFile(target, 'x')).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(deleteFile(target)).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(listDirectory(outside)).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(createDirectory(path.join(outside, 'x'))).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(getFileStats(target)).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(deleteDirectory(outside)).rejects.toBeInstanceOf(PathAccessDeniedError);
      expect(fs.readFileSync(target, 'utf8')).toBe('outside');
    });

    it('cannot overwrite an .env in a home-style root', async () => {
      const env = path.join(root, 'apps', 'api', '.env');
      fs.mkdirSync(path.dirname(env), { recursive: true });
      fs.writeFileSync(env, 'API_TOKEN=real');

      await expect(writeFile(env, 'API_TOKEN=attacker')).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(readFile(env)).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(deleteFile(env)).rejects.toBeInstanceOf(PathAccessDeniedError);
      expect(fs.readFileSync(env, 'utf8')).toBe('API_TOKEN=real');
    });

    it('still reports ordinary failures with their own message', async () => {
      await expect(readFile(path.join(root, 'missing.txt'))).rejects.toThrow(/Failed to read file: .*ENOENT/);
      await expect(deleteFile(path.join(root, 'missing.txt'))).rejects.toThrow(/Failed to delete file: .*ENOENT/);
      await expect(readFile(root)).rejects.toThrow('Path is not a file');
      await expect(deleteFile(root)).rejects.toThrow('Path is not a file');
    });

    itWithSymlinks('does not write through a link that leaves the root', async () => {
      fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'link'));
      await expect(writeFile(path.join(root, 'link'), 'overwritten')).rejects.toBeInstanceOf(PathAccessDeniedError);
      expect(fs.readFileSync(path.join(outside, 'secret.txt'), 'utf8')).toBe('outside');
    });

    itWithSymlinks('does not read through a link that leaves the root', async () => {
      fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'link'));
      await expect(readFile(path.join(root, 'link'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    itWithSymlinks('deletes a link, never its target', async () => {
      fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'link'));
      await deleteFile(path.join(root, 'link'));
      expect(fs.existsSync(path.join(root, 'link'))).toBe(false);
      expect(fs.existsSync(path.join(outside, 'secret.txt'))).toBe(true);
    });

    itWithSymlinks('lists a link as a link and does not stat its target', async () => {
      fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'link'));
      const listing = await listDirectory(root);
      expect(listing.files.find((file) => file.name === 'link')).toMatchObject({ type: 'symlink' });
    });
  });

  describe('backups and database dumps', () => {
    it('refuses to archive or restore outside the roots', async () => {
      await expect(createBackup([path.join(outside, 'secret.txt')])).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(createBackup([path.join(root, '.env')])).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(createBackup([API_ROOT])).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(restoreBackup('any', outside)).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(restoreBackup('any', path.join(root, '.ssh'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    it('refuses to dump a database outside the roots', async () => {
      await expect(backupDatabase('postgresql', 'app', outside)).rejects.toBeInstanceOf(PathAccessDeniedError);
      await expect(backupDatabase('postgresql', 'app', path.join(root, '.ssh'))).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    it('keeps /var/log off limits for dumps even when it is an allowed root', async () => {
      process.env.FILE_ALLOWED_ROOTS = '/var/log';
      await expect(backupDatabase('postgresql', 'app', '/var/log/x')).rejects.toBeInstanceOf(PathAccessDeniedError);
    });

    itWithSymlinks('refuses to archive through a link that leaves the root', async () => {
      fs.symlinkSync(outside, path.join(root, 'dir'));
      await expect(createBackup([path.join(root, 'dir')])).rejects.toBeInstanceOf(PathAccessDeniedError);
    });
  });

  describe('POST /api/files', () => {
    const app = express();
    app.use(express.json());
    app.use('/api/files', fileRoutes);

    function auth(req: request.Test): request.Test {
      return req.set('Authorization', `Bearer ${API_TOKEN}`);
    }

    it('answers 403 for the API env file and leaves it alone', async () => {
      const res = await auth(request(app).post('/api/files')).send({ path: path.join(API_ROOT, '.env'), content: 'API_TOKEN=x' });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('answers 403 for reads, deletes and non-string paths', async () => {
      const target = encodeURIComponent(path.join(outside, 'secret.txt'));
      expect((await auth(request(app).get(`/api/files?path=${target}`))).status).toBe(403);
      expect((await auth(request(app).delete(`/api/files?path=${target}`))).status).toBe(403);
      expect((await auth(request(app).post('/api/files')).send({ path: ['/tmp/x'], content: 'x' })).status).toBe(403);
    });

    it('still writes inside a root', async () => {
      const target = path.join(root, 'ok.txt');
      const res = await auth(request(app).post('/api/files')).send({ path: target, content: 'ok' });
      expect(res.status).toBe(201);
      expect(fs.readFileSync(target, 'utf8')).toBe('ok');
    });

    it('answers 404 for a missing file', async () => {
      const target = encodeURIComponent(path.join(root, 'missing.txt'));
      expect((await auth(request(app).get(`/api/files?path=${target}`))).status).toBe(404);
    });
  });
});
