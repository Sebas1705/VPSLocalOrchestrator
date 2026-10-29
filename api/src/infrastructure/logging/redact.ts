/**
 * Helpers to keep credentials out of logs.
 *
 * Never log a token, header value or key directly. When correlating log lines
 * is useful, log `secretFingerprint(value)` instead: a short SHA-256 prefix
 * that identifies the same value across lines without revealing it.
 */

import crypto from 'crypto';

/** Short, non-reversible identifier for a secret value (e.g. "sha256:1a2b3c4d"). */
export function secretFingerprint(value: string | undefined | null): string {
  if (!value) return 'none';
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 8)}`;
}
