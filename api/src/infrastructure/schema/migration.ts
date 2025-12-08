/**
 * Schema Migration System
 * 
 * Manages API contract evolution with versioning
 * Tracks breaking changes and deprecated features
 * Enables API versioning strategies (header-based, path-based)
 * 
 * @module infrastructure/schema/migration
 */

import { getLogger } from '../../config/index.js';

const logger = getLogger('schema-migration');

/**
 * Schema version
 */
export interface SchemaVersion {
  version: string;
  releaseDate: string;
  status: 'draft' | 'stable' | 'deprecated' | 'sunset';
  changes: SchemaChange[];
  breakingChanges: BreakingChange[];
  deprecations: Deprecation[];
  sunsetDate?: string;
}

/**
 * Schema change
 */
export interface SchemaChange {
  type: 'added' | 'modified' | 'removed';
  endpoint: string;
  field?: string;
  description: string;
  migrateFrom?: string; // For field renames
}

/**
 * Breaking change
 */
export interface BreakingChange {
  endpoint: string;
  change: string;
  affectedClients: string[];
  migrationPath: string;
}

/**
 * Deprecation
 */
export interface Deprecation {
  endpoint: string;
  field?: string;
  deprecatedSince: string;
  sunsetDate: string;
  replacement?: string;
  reason: string;
}

/**
 * API Version strategy
 */
export type VersionStrategy = 'header' | 'path' | 'query' | 'hybrid';

/**
 * Schema Migration Manager
 */
export class SchemaMigrationManager {
  private versions: Map<string, SchemaVersion> = new Map();
  private versionOrder: string[] = [];
  private currentVersion: string;
  private strategy: VersionStrategy;

  constructor(
    currentVersion: string = '1.0.0',
    strategy: VersionStrategy = 'header'
  ) {
    this.currentVersion = currentVersion;
    this.strategy = strategy;

    logger.info('Schema migration manager initialized', {
      currentVersion,
      strategy,
    });
  }

  /**
   * Register schema version
   */
  registerVersion(version: SchemaVersion): void {
    this.versions.set(version.version, version);
    this.versionOrder.push(version.version);

    // Sort versions (simple semantic version sort)
    this.versionOrder.sort((a, b) => {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);

      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal !== bVal) {
          return aVal - bVal;
        }
      }

      return 0;
    });

    logger.info('Schema version registered', {
      version: version.version,
      status: version.status,
      changes: version.changes.length,
    });
  }

  /**
   * Get version
   */
  getVersion(version?: string): SchemaVersion | null {
    const v = version ?? this.currentVersion;
    return this.versions.get(v) ?? null;
  }

  /**
   * Get all versions
   */
  getAllVersions(): SchemaVersion[] {
    return this.versionOrder.map((v) => this.versions.get(v)!);
  }

  /**
   * Check if version is supported
   */
  isSupported(version: string): boolean {
    const v = this.versions.get(version);
    if (!v) return false;
    return v.status !== 'sunset';
  }

  /**
   * Get migration path between versions
   */
  getMigrationPath(fromVersion: string, toVersion: string): SchemaChange[] {
    const fromIdx = this.versionOrder.indexOf(fromVersion);
    const toIdx = this.versionOrder.indexOf(toVersion);

    if (fromIdx === -1 || toIdx === -1) {
      return [];
    }

    const changes: SchemaChange[] = [];
    const start = Math.min(fromIdx, toIdx);
    const end = Math.max(fromIdx, toIdx);

    for (let i = start; i < end; i++) {
      const version = this.versionOrder[i + 1];
      if (!version) continue;

      const schemaVersion = this.versions.get(version);

      if (schemaVersion) {
        changes.push(...schemaVersion.changes);
      }
    }

    return changes;
  }

  /**
   * Check compatibility between versions
   */
  checkCompatibility(
    fromVersion: string,
    toVersion: string
  ): {
    compatible: boolean;
    breaking: BreakingChange[];
    deprecations: Deprecation[];
  } {
    const targetVersion = this.versions.get(toVersion);

    if (!targetVersion) {
      return { compatible: false, breaking: [], deprecations: [] };
    }

    const breaking = targetVersion.breakingChanges || [];
    const deprecations = targetVersion.deprecations || [];

    return {
      compatible: breaking.length === 0,
      breaking,
      deprecations,
    };
  }

  /**
   * Get deprecation schedule
   */
  getDeprecationSchedule(): Array<{
    feature: string;
    deprecatedSince: string;
    sunsetDate: string;
    daysRemaining: number;
  }> {
    const now = new Date();
    const schedule: Array<{
      feature: string;
      deprecatedSince: string;
      sunsetDate: string;
      daysRemaining: number;
    }> = [];

    for (const version of this.versions.values()) {
      for (const dep of version.deprecations || []) {
        const sunsetDate = new Date(dep.sunsetDate);
        const daysRemaining = Math.ceil(
          (sunsetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        schedule.push({
          feature: dep.field
            ? `${dep.endpoint}.${dep.field}`
            : dep.endpoint,
          deprecatedSince: dep.deprecatedSince,
          sunsetDate: dep.sunsetDate,
          daysRemaining,
        });
      }
    }

    return schedule.sort(
      (a, b) =>
        new Date(a.sunsetDate).getTime() - new Date(b.sunsetDate).getTime()
    );
  }

  /**
   * Generate migration guide
   */
  generateMigrationGuide(fromVersion: string, toVersion: string): string {
    const compatibility = this.checkCompatibility(fromVersion, toVersion);
    const changes = this.getMigrationPath(fromVersion, toVersion);

    let guide = `# Migration Guide: ${fromVersion} → ${toVersion}\n\n`;

    if (!compatibility.compatible) {
      guide += '## ⚠️ Breaking Changes\n\n';
      for (const change of compatibility.breaking) {
        guide += `- **${change.endpoint}**: ${change.change}\n`;
        guide += `  Migration: ${change.migrationPath}\n`;
      }
      guide += '\n';
    }

    if (compatibility.deprecations.length > 0) {
      guide += '## 📋 Deprecations\n\n';
      for (const dep of compatibility.deprecations) {
        const field = dep.field ? `.${dep.field}` : '';
        guide += `- **${dep.endpoint}${field}** (deprecated: ${dep.deprecatedSince})\n`;
        guide += `  Reason: ${dep.reason}\n`;
        if (dep.replacement) {
          guide += `  Replacement: ${dep.replacement}\n`;
        }
        guide += `  Sunset: ${dep.sunsetDate}\n`;
      }
      guide += '\n';
    }

    if (changes.length > 0) {
      guide += '## 📝 Changes\n\n';
      for (const change of changes) {
        const field = change.field ? `.${change.field}` : '';
        guide += `- ${change.type.toUpperCase()}: **${change.endpoint}${field}**\n`;
        guide += `  ${change.description}\n`;
        if (change.migrateFrom) {
          guide += `  Migrate from: ${change.migrateFrom}\n`;
        }
      }
    }

    return guide;
  }

  /**
   * Validate request against schema version
   */
  validateRequest(version: string, endpoint: string): {
    valid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const schemaVersion = this.versions.get(version);

    if (!schemaVersion) {
      return {
        valid: false,
        warnings: [],
        errors: [`Version ${version} not found`],
      };
    }

    const warnings: string[] = [];
    const errors: string[] = [];

    // Check if endpoint exists in version
    const endpointExists = schemaVersion.changes.some(
      (c) => c.endpoint === endpoint
    );

    if (!endpointExists && version !== this.currentVersion) {
      warnings.push(`Endpoint ${endpoint} may not exist in version ${version}`);
    }

    // Check for deprecations
    for (const dep of schemaVersion.deprecations || []) {
      if (dep.endpoint === endpoint) {
        warnings.push(`Endpoint ${endpoint} is deprecated since ${dep.deprecatedSince}`);
        if (dep.sunsetDate) {
          warnings.push(`Will be removed on ${dep.sunsetDate}`);
        }
      }
    }

    // Check for breaking changes
    for (const breaking of schemaVersion.breakingChanges || []) {
      if (breaking.endpoint === endpoint) {
        errors.push(`Breaking change in ${endpoint}: ${breaking.change}`);
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Get supported versions
   */
  getSupportedVersions(): string[] {
    return this.versionOrder.filter((v) => this.isSupported(v));
  }

  /**
   * Get version status
   */
  getVersionStatus(version: string): {
    version: string;
    status: string;
    releaseDate: string;
    sunsetDate?: string;
    daysUntilSunset?: number;
  } | null {
    const v = this.versions.get(version);

    if (!v) return null;

    const result: any = {
      version: v.version,
      status: v.status,
      releaseDate: v.releaseDate,
    };

    if (v.sunsetDate) {
      result.sunsetDate = v.sunsetDate;
      const now = new Date();
      const sunsetDate = new Date(v.sunsetDate);
      result.daysUntilSunset = Math.ceil(
        (sunsetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    return result;
  }
}

/**
 * Global migration manager instance
 */
let globalMigrationManager: SchemaMigrationManager | null = null;

/**
 * Initialize schema migration manager
 */
export function initializeSchemaMigrations(
  currentVersion?: string,
  strategy?: VersionStrategy
): SchemaMigrationManager {
  if (!globalMigrationManager) {
    globalMigrationManager = new SchemaMigrationManager(
      currentVersion,
      strategy
    );
  }
  return globalMigrationManager;
}

/**
 * Get migration manager
 */
export function getSchemaMigrationManager(): SchemaMigrationManager {
  if (!globalMigrationManager) {
    return initializeSchemaMigrations();
  }
  return globalMigrationManager;
}
