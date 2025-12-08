/**
 * Auth Domain Entities and Value Objects
 *
 * Core models for authentication and authorization.
 */

export type PrivilegeLevel = 'basic' | 'standard' | 'admin';

/**
 * Token: Immutable value object representing an API token.
 */
export class Token {
  constructor(
    public readonly value: string,
    public readonly privilege: PrivilegeLevel = 'basic',
    public readonly createdAt: Date = new Date(),
    public readonly expiresAt?: Date
  ) {
    if (!value || value.trim().length === 0) {
      throw new Error('Token value cannot be empty');
    }
  }

  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  isValid(): boolean {
    return !this.isExpired();
  }

  hasPrivilege(required: PrivilegeLevel): boolean {
    const levels: Record<PrivilegeLevel, number> = {
      basic: 1,
      standard: 2,
      admin: 3,
    };
    return levels[this.privilege] >= levels[required];
  }

  static create(
    value: string,
    privilege?: PrivilegeLevel,
    expiresAt?: Date
  ): Token {
    return new Token(value, privilege, new Date(), expiresAt);
  }
}

/**
 * Principal: Entity representing an authenticated user/client.
 */
export class Principal {
  constructor(
    public readonly id: string,
    public readonly token: Token,
    public readonly permissions: Set<string> = new Set()
  ) {}

  can(permission: string): boolean {
    return this.permissions.has(permission);
  }

  canExecuteCommand(): boolean {
    return this.token.hasPrivilege('standard') || this.can('command.execute');
  }

  canExecutePrivileged(): boolean {
    return this.token.hasPrivilege('admin') || this.can('command.execute.privileged');
  }

  canManageServices(): boolean {
    return this.token.hasPrivilege('admin') || this.can('services.manage');
  }

  static create(id: string, token: Token, permissions?: string[]): Principal {
    const perms = new Set(permissions || []);
    return new Principal(id, token, perms);
  }
}

/**
 * Permission: Value object for granular access control.
 */
export class Permission {
  constructor(
    public readonly resource: string,
    public readonly action: string,
    public readonly constraints?: Record<string, unknown>
  ) {}

  matches(resource: string, action: string): boolean {
    return this.resource === resource && this.action === action;
  }

  static create(resource: string, action: string): Permission {
    return new Permission(resource, action);
  }
}
