/**
 * Environment-Based Config Repository Adapter
 *
 * Reads configuration from environment variables.
 * Provides a simple contract for accessing config.
 */

import type { IConfigRepository } from '../ports.js';

export class EnvConfigRepository implements IConfigRepository {
  private env: Record<string, string>;

  constructor(env: Record<string, string> = process.env as Record<string, string>) {
    this.env = env;
  }

  get(key: string): string | undefined {
    return this.env[key];
  }

  getAll(): Record<string, string> {
    return { ...this.env };
  }
}
