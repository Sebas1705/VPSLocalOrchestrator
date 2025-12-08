import type { ILogger } from '../logging/index.js';
import { LoggerFactory } from '../logging/index.js';
import { getAuditLogger } from '../audit/index.js';

/**
 * RBAC (Role-Based Access Control) - v8.2.0
 * 
 * Provides fine-grained access control:
 * - User roles and permissions
 * - Resource-based authorization
 * - Policy evaluation engine
 * - Permission inheritance
 * - Role hierarchy
 */

// ============================================================================
// RBAC TYPES
// ============================================================================

export enum Permission {
  // Resource permissions
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  EXECUTE = 'execute',
  
  // Admin permissions
  ADMIN = 'admin',
  MANAGE_USERS = 'manage_users',
  MANAGE_ROLES = 'manage_roles',
  MANAGE_PERMISSIONS = 'manage_permissions',
  
  // Service permissions
  START_SERVICE = 'start_service',
  STOP_SERVICE = 'stop_service',
  RESTART_SERVICE = 'restart_service',
  
  // Resource monitoring
  VIEW_METRICS = 'view_metrics',
  VIEW_LOGS = 'view_logs',
  
  // Job management
  CREATE_JOB = 'create_job',
  CANCEL_JOB = 'cancel_job',
  
  // Encryption
  ENCRYPT_DATA = 'encrypt_data',
  DECRYPT_DATA = 'decrypt_data',
  ROTATE_KEYS = 'rotate_keys'
}

export enum ResourceType {
  COMMAND = 'command',
  SERVICE = 'service',
  FILE = 'file',
  PROCESS = 'process',
  JOB = 'job',
  USER = 'user',
  ROLE = 'role',
  ENCRYPTION_KEY = 'encryption_key',
  SECRET = 'secret',
  METRICS = 'metrics',
  LOGS = 'logs',
  SYSTEM = 'system'
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  inheritsFrom?: string[]; // Parent role IDs
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  username: string;
  roles: string[]; // Role IDs
  createdAt: Date;
  updatedAt: Date;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  effect: 'allow' | 'deny';
  actions: Permission[];
  resources: {
    type: ResourceType;
    id?: string | string[]; // Specific resource(s) or * for all
  }[];
  conditions?: PolicyCondition[];
  priority: number; // Higher priority = evaluated first
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyCondition {
  type: 'time_range' | 'ip_range' | 'user_attribute' | 'resource_attribute';
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  key: string;
  value: any;
}

export interface AccessContext {
  userId: string;
  permission: Permission;
  resourceType: ResourceType;
  resourceId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AccessDecision {
  allowed: boolean;
  matchedPolicies: string[]; // Policy IDs
  deniedBy?: string; // Policy ID that denied access
  reason?: string;
  timestamp: Date;
}

// ============================================================================
// RBAC MANAGER
// ============================================================================

export class RBACManager {
  private roles: Map<string, Role> = new Map();
  private users: Map<string, User> = new Map();
  private policies: Map<string, Policy> = new Map();
  private logger: ILogger;
  private roleIdCounter = 0;
  private userIdCounter = 0;
  private policyIdCounter = 0;

  constructor() {
    this.logger = LoggerFactory.getInstance().getLogger();
    this.initializeDefaultRoles();
  }

  /**
   * Initialize default system roles
   */
  private initializeDefaultRoles(): void {
    // Admin role
    this.createRole({
      name: 'admin',
      description: 'Full system access',
      permissions: Object.values(Permission)
    });

    // Operator role
    this.createRole({
      name: 'operator',
      description: 'Can execute commands and manage services',
      permissions: [
        Permission.READ,
        Permission.EXECUTE,
        Permission.START_SERVICE,
        Permission.STOP_SERVICE,
        Permission.RESTART_SERVICE,
        Permission.VIEW_METRICS,
        Permission.VIEW_LOGS,
        Permission.CREATE_JOB,
        Permission.CANCEL_JOB
      ]
    });

    // Viewer role
    this.createRole({
      name: 'viewer',
      description: 'Read-only access',
      permissions: [
        Permission.READ,
        Permission.VIEW_METRICS,
        Permission.VIEW_LOGS
      ]
    });

    this.logger.info('Default RBAC roles initialized');
  }

  // ========================================
  // ROLE MANAGEMENT
  // ========================================

  createRole(params: {
    name: string;
    description: string;
    permissions: Permission[];
    inheritsFrom?: string[];
  }): Role {
    const role: any = {
      id: `role-${++this.roleIdCounter}`,
      name: params.name,
      description: params.description,
      permissions: params.permissions,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (params.inheritsFrom !== undefined) {
      role.inheritsFrom = params.inheritsFrom;
    }

    this.roles.set(role.id, role);
    this.logger.info(`Role created: ${role.name} (${role.id})`);

    return role;
  }

  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  getRoleByName(name: string): Role | undefined {
    for (const role of this.roles.values()) {
      if (role.name === name) {
        return role;
      }
    }
    return undefined;
  }

  updateRole(roleId: string, updates: Partial<Omit<Role, 'id' | 'createdAt'>>): Role | undefined {
    const role = this.roles.get(roleId);
    if (!role) return undefined;

    const updatedRole: Role = {
      ...role,
      ...updates,
      id: role.id,
      createdAt: role.createdAt,
      updatedAt: new Date()
    };

    this.roles.set(roleId, updatedRole);
    this.logger.info(`Role updated: ${updatedRole.name} (${roleId})`);

    return updatedRole;
  }

  deleteRole(roleId: string): boolean {
    const deleted = this.roles.delete(roleId);
    if (deleted) {
      this.logger.info(`Role deleted: ${roleId}`);
      
      // Remove role from users
      for (const user of this.users.values()) {
        user.roles = user.roles.filter(r => r !== roleId);
      }
    }
    return deleted;
  }

  listRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * Get all permissions for a role (including inherited)
   */
  getRolePermissions(roleId: string): Permission[] {
    const role = this.roles.get(roleId);
    if (!role) return [];

    const permissions = new Set<Permission>(role.permissions);

    // Add inherited permissions
    if (role.inheritsFrom) {
      for (const parentId of role.inheritsFrom) {
        const parentPermissions = this.getRolePermissions(parentId);
        for (const perm of parentPermissions) {
          permissions.add(perm);
        }
      }
    }

    return Array.from(permissions);
  }

  // ========================================
  // USER MANAGEMENT
  // ========================================

  createUser(params: {
    username: string;
    roles?: string[];
  }): User {
    const user: User = {
      id: `user-${++this.userIdCounter}`,
      username: params.username,
      roles: params.roles || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.users.set(user.id, user);
    this.logger.info(`User created: ${user.username} (${user.id})`);

    return user;
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  getUserByUsername(username: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  assignRoles(userId: string, roleIds: string[]): User | undefined {
    const user = this.users.get(userId);
    if (!user) return undefined;

    // Validate roles exist
    for (const roleId of roleIds) {
      if (!this.roles.has(roleId)) {
        throw new Error(`Role not found: ${roleId}`);
      }
    }

    user.roles = Array.from(new Set([...user.roles, ...roleIds]));
    user.updatedAt = new Date();

    this.logger.info(`Roles assigned to user ${user.username}: ${roleIds.join(', ')}`);

    return user;
  }

  revokeRoles(userId: string, roleIds: string[]): User | undefined {
    const user = this.users.get(userId);
    if (!user) return undefined;

    user.roles = user.roles.filter(r => !roleIds.includes(r));
    user.updatedAt = new Date();

    this.logger.info(`Roles revoked from user ${user.username}: ${roleIds.join(', ')}`);

    return user;
  }

  listUsers(): User[] {
    return Array.from(this.users.values());
  }

  /**
   * Get all permissions for a user (from all roles)
   */
  getUserPermissions(userId: string): Permission[] {
    const user = this.users.get(userId);
    if (!user) return [];

    const permissions = new Set<Permission>();

    for (const roleId of user.roles) {
      const rolePermissions = this.getRolePermissions(roleId);
      for (const perm of rolePermissions) {
        permissions.add(perm);
      }
    }

    return Array.from(permissions);
  }

  // ========================================
  // POLICY MANAGEMENT
  // ========================================

  createPolicy(params: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>): Policy {
    const policy: Policy = {
      id: `policy-${++this.policyIdCounter}`,
      ...params,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.policies.set(policy.id, policy);
    this.logger.info(`Policy created: ${policy.name} (${policy.id})`);

    return policy;
  }

  getPolicy(policyId: string): Policy | undefined {
    return this.policies.get(policyId);
  }

  updatePolicy(policyId: string, updates: Partial<Omit<Policy, 'id' | 'createdAt'>>): Policy | undefined {
    const policy = this.policies.get(policyId);
    if (!policy) return undefined;

    const updatedPolicy: Policy = {
      ...policy,
      ...updates,
      id: policy.id,
      createdAt: policy.createdAt,
      updatedAt: new Date()
    };

    this.policies.set(policyId, updatedPolicy);
    this.logger.info(`Policy updated: ${updatedPolicy.name} (${policyId})`);

    return updatedPolicy;
  }

  deletePolicy(policyId: string): boolean {
    const deleted = this.policies.delete(policyId);
    if (deleted) {
      this.logger.info(`Policy deleted: ${policyId}`);
    }
    return deleted;
  }

  listPolicies(): Policy[] {
    return Array.from(this.policies.values()).sort((a, b) => b.priority - a.priority);
  }

  // ========================================
  // ACCESS CONTROL
  // ========================================

  /**
   * Check if user has access based on roles and policies
   */
  checkAccess(context: AccessContext): AccessDecision {
    const user = this.users.get(context.userId);
    if (!user) {
      return {
        allowed: false,
        matchedPolicies: [],
        reason: 'User not found',
        timestamp: new Date()
      };
    }

    // Get user permissions from roles
    const userPermissions = this.getUserPermissions(context.userId);
    const hasPermissionFromRole = userPermissions.includes(context.permission);

    // Evaluate policies (sorted by priority)
    const policies = this.listPolicies();
    const matchedPolicies: string[] = [];
    let denied: string | undefined;

    for (const policy of policies) {
      if (this.policyMatches(policy, context)) {
        matchedPolicies.push(policy.id);

        if (policy.effect === 'deny') {
          denied = policy.id;
          break; // Deny takes precedence
        }
      }
    }

    // Decision logic:
    // 1. If explicitly denied by policy, deny
    // 2. If allowed by policy, allow
    // 3. If has permission from role and no deny, allow
    // 4. Otherwise, deny

    const allowed = !denied && (matchedPolicies.length > 0 || hasPermissionFromRole);

    const decision: any = {
      allowed,
      matchedPolicies,
      reason: denied ? 'Denied by policy' : allowed ? 'Allowed' : 'No matching permissions',
      timestamp: new Date()
    };

    if (denied !== undefined) {
      decision.deniedBy = denied;
    }

    // Audit log
    const auditLogger = getAuditLogger();
    auditLogger.log({
      type: 'SECURITY_VIOLATION' as any,
      severity: 'INFO' as any,
      actor: {
        type: 'user',
        id: context.userId
      },
      action: 'check_access',
      status: allowed ? 'success' : 'failure',
      metadata: {
        permission: context.permission,
        resourceType: context.resourceType,
        resourceId: context.resourceId,
        decision
      }
    });

    return decision;
  }

  /**
   * Check if policy matches access context
   */
  private policyMatches(policy: Policy, context: AccessContext): boolean {
    // Check if action matches
    if (!policy.actions.includes(context.permission)) {
      return false;
    }

    // Check if resource matches
    const resourceMatches = policy.resources.some(resource => {
      if (resource.type !== context.resourceType) {
        return false;
      }

      if (!resource.id || resource.id === '*') {
        return true; // Wildcard
      }

      if (Array.isArray(resource.id)) {
        return context.resourceId ? resource.id.includes(context.resourceId) : false;
      }

      return resource.id === context.resourceId;
    });

    if (!resourceMatches) {
      return false;
    }

    // Check conditions
    if (policy.conditions) {
      for (const condition of policy.conditions) {
        if (!this.evaluateCondition(condition, context)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Evaluate policy condition
   */
  private evaluateCondition(condition: PolicyCondition, context: AccessContext): boolean {
    let actualValue: any;

    switch (condition.type) {
      case 'time_range':
        actualValue = context.timestamp.getHours();
        break;
      case 'user_attribute':
        const user = this.users.get(context.userId);
        actualValue = user ? (user as any)[condition.key] : undefined;
        break;
      case 'resource_attribute':
        actualValue = context.metadata ? context.metadata[condition.key] : undefined;
        break;
      default:
        return false;
    }

    switch (condition.operator) {
      case 'equals':
        return actualValue === condition.value;
      case 'not_equals':
        return actualValue !== condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(actualValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(actualValue);
      case 'greater_than':
        return actualValue > condition.value;
      case 'less_than':
        return actualValue < condition.value;
      default:
        return false;
    }
  }

  /**
   * Get RBAC statistics
   */
  getStats(): {
    totalRoles: number;
    totalUsers: number;
    totalPolicies: number;
    usersPerRole: Record<string, number>;
  } {
    const usersPerRole: Record<string, number> = {};

    for (const role of this.roles.values()) {
      usersPerRole[role.name] = 0;
    }

    for (const user of this.users.values()) {
      for (const roleId of user.roles) {
        const role = this.roles.get(roleId);
        if (role) {
          usersPerRole[role.name] = (usersPerRole[role.name] || 0) + 1;
        }
      }
    }

    return {
      totalRoles: this.roles.size,
      totalUsers: this.users.size,
      totalPolicies: this.policies.size,
      usersPerRole
    };
  }
}

// ============================================================================
// GLOBAL SINGLETON
// ============================================================================

let rbacManager: RBACManager | undefined;

export function initializeRBAC(): RBACManager {
  if (rbacManager) {
    return rbacManager;
  }

  rbacManager = new RBACManager();
  
  const logger = LoggerFactory.getInstance().getLogger();
  logger.info('RBAC manager initialized');

  return rbacManager;
}

export function getRBACManager(): RBACManager {
  if (!rbacManager) {
    return initializeRBAC();
  }
  return rbacManager;
}
