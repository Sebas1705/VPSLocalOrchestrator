/**
 * Decides which host paths the API may touch on a caller's behalf.
 *
 * Used by every feature that takes a path from a request (files, backups,
 * database dumps), so they cannot drift apart. The checks run on the real path
 * after symlinks are resolved: a prefix check on the requested string is
 * defeated by `/tmp/link -> /etc`, or by a dangling link that a write would
 * create the target of.
 *
 * Denied, whatever the allowed roots are:
 *  - the API install directory: api/.env, secrets/, logs/, dist/ (writing to
 *    it would be code execution on the next restart);
 *  - anything with a path segment starting with `.` below the root: `.env`,
 *    `.ssh`, `.bashrc`, `.config`, `.git`, `.docker`, `.aws`, ...
 *
 * What remains cannot be closed here: hard links, and a symlink swapped in
 * between the check and the use (the last path component is opened with
 * O_NOFOLLOW by fileManager, parent directories are not).
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { API_ROOT } from '../config/paths.js';

export class PathAccessDeniedError extends Error {
  readonly statusCode = 403;

  constructor(reason = 'Path access denied') {
    super(reason);
    this.name = 'PathAccessDeniedError';
  }
}

const DEFAULT_ROOTS_MESSAGE = 'must be inside an allowed root (FILE_ALLOWED_ROOTS)';

function configuredRoots(env: NodeJS.ProcessEnv): string[] {
  const raw = env.FILE_ALLOWED_ROOTS;
  if (raw === undefined) return [os.homedir(), '/tmp', '/var/log', '/var/tmp'];
  return raw
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => path.isAbsolute(entry));
}

function isInside(candidate: string, directory: string): boolean {
  return candidate === directory || candidate.startsWith(directory.endsWith(path.sep) ? directory : directory + path.sep);
}

async function realpathOrNull(target: string): Promise<string | null> {
  try {
    return await fs.realpath(target);
  } catch {
    return null;
  }
}

/** Allowed roots with their own symlinks resolved. Roots that do not exist are dropped. */
export async function getAllowedRoots(env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const resolved = await Promise.all(configuredRoots(env).map(realpathOrNull));
  return resolved.filter((root): root is string => root !== null);
}

/**
 * Resolve symlinks in `absolute`, tolerating a tail that does not exist yet.
 * A dangling symlink is refused: following it would create a file at a target
 * that was never checked.
 */
async function resolveExistingPrefix(absolute: string): Promise<string> {
  const missing: string[] = [];
  let current = absolute;

  for (;;) {
    try {
      return path.join(await fs.realpath(current), ...missing);
    } catch (error: any) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
    }

    const isDanglingLink = await fs.lstat(current).then(
      () => true,
      () => false
    );
    if (isDanglingLink) {
      throw new PathAccessDeniedError('Path access denied: broken symbolic link');
    }

    const parent = path.dirname(current);
    if (parent === current) return absolute;
    missing.unshift(path.basename(current));
    current = parent;
  }
}

async function assertAllowed(real: string, roots: readonly string[]): Promise<void> {
  const apiRoot = (await realpathOrNull(API_ROOT)) ?? API_ROOT;
  if (isInside(real, apiRoot)) {
    throw new PathAccessDeniedError('Path access denied: the API install directory is off limits');
  }

  const matchingRoots = roots.filter((root) => isInside(real, root));
  if (matchingRoots.length === 0) {
    throw new PathAccessDeniedError(`Path access denied: ${DEFAULT_ROOTS_MESSAGE}`);
  }

  const passesDotRule = matchingRoots.some((root) =>
    path
      .relative(root, real)
      .split(path.sep)
      .every((segment) => !segment.startsWith('.') || segment === '')
  );
  if (!passesDotRule) {
    throw new PathAccessDeniedError('Path access denied: hidden files and directories are off limits');
  }
}

function toAbsolute(target: unknown): string {
  if (typeof target !== 'string' || target.length === 0 || target.includes('\0')) {
    throw new PathAccessDeniedError('Path access denied: invalid path');
  }
  return path.resolve(target);
}

/**
 * Return the real path of `target`, which may not exist yet, or throw
 * PathAccessDeniedError. Use the returned path, never the requested one.
 */
export async function resolveAllowedPath(target: unknown, roots?: readonly string[]): Promise<string> {
  const absolute = toAbsolute(target);
  const real = await resolveExistingPrefix(absolute);
  await assertAllowed(real, roots ?? (await getAllowedRoots()));
  return real;
}

/**
 * Like resolveAllowedPath, but leaves the last component unresolved. For
 * deleting: removing a symlink must remove the link, not what it points to.
 */
export async function resolveAllowedEntry(target: unknown, roots?: readonly string[]): Promise<string> {
  const absolute = toAbsolute(target);
  const parent = await resolveExistingPrefix(path.dirname(absolute));
  const entry = path.join(parent, path.basename(absolute));
  await assertAllowed(entry, roots ?? (await getAllowedRoots()));
  return entry;
}

/** HTTP status for an error thrown while handling a path from a request. */
export function pathErrorStatus(error: unknown, fallback = 500): number {
  return error instanceof PathAccessDeniedError ? error.statusCode : fallback;
}
