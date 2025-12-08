import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getRBACManager } from '../infrastructure/rbac/index.js';
import type { Permission, ResourceType, AccessContext } from '../infrastructure/rbac/index.js';

const router = Router();

// ============================================================================
// ROLE MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/rbac/roles
 * Create new role
 */
router.post('/roles', requireAuth, (req: Request, res: Response): void => {
  try {
    const { name, description, permissions, inheritsFrom } = req.body;
    
    if (!name || !description || !permissions) {
      res.status(400).json({ error: 'Name, description, and permissions are required' });
      return;
    }

    const rbac = getRBACManager();
    const role = rbac.createRole({
      name,
      description,
      permissions,
      inheritsFrom
    });

    res.json({
      success: true,
      role
    });
  } catch (error) {
    console.error('Failed to create role:', error);
    res.status(500).json({
      error: 'Failed to create role',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/rbac/roles
 * List all roles
 */
router.get('/roles', requireAuth, (req: Request, res: Response): void => {
  try {
    const rbac = getRBACManager();
    const roles = rbac.listRoles();

    res.json({
      success: true,
      total: roles.length,
      roles
    });
  } catch (error) {
    console.error('Failed to list roles:', error);
    res.status(500).json({
      error: 'Failed to list roles',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/rbac/roles/:id
 * Get role details
 */
router.get('/roles/:id', requireAuth, (req: Request, res: Response): void => {
  try {
    const roleId = req.params.id || '';

    const rbac = getRBACManager();
    const role = rbac.getRole(roleId);

    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    const permissions = rbac.getRolePermissions(roleId);

    res.json({
      success: true,
      role: {
        ...role,
        effectivePermissions: permissions
      }
    });
  } catch (error) {
    console.error('Failed to get role:', error);
    res.status(500).json({
      error: 'Failed to get role',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/rbac/roles/:id
 * Update role
 */
router.put('/roles/:id', requireAuth, (req: Request, res: Response): void => {
  try {
    const roleId = req.params.id || '';
    const updates = req.body;

    const rbac = getRBACManager();
    const role = rbac.updateRole(roleId, updates);

    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    res.json({
      success: true,
      role
    });
  } catch (error) {
    console.error('Failed to update role:', error);
    res.status(500).json({
      error: 'Failed to update role',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /api/rbac/roles/:id
 * Delete role
 */
router.delete('/roles/:id', requireAuth, (req: Request, res: Response): void => {
  try {
    const roleId = req.params.id || '';

    const rbac = getRBACManager();
    const deleted = rbac.deleteRole(roleId);

    if (!deleted) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    res.json({
      success: true,
      message: `Role ${roleId} deleted`
    });
  } catch (error) {
    console.error('Failed to delete role:', error);
    res.status(500).json({
      error: 'Failed to delete role',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================================================
// USER MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/rbac/users
 * Create new user
 */
router.post('/users', requireAuth, (req: Request, res: Response): void => {
  try {
    const { username, roles } = req.body;
    
    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const rbac = getRBACManager();
    const user = rbac.createUser({ username, roles });

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Failed to create user:', error);
    res.status(500).json({
      error: 'Failed to create user',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/rbac/users
 * List all users
 */
router.get('/users', requireAuth, (req: Request, res: Response): void => {
  try {
    const rbac = getRBACManager();
    const users = rbac.listUsers();

    res.json({
      success: true,
      total: users.length,
      users
    });
  } catch (error) {
    console.error('Failed to list users:', error);
    res.status(500).json({
      error: 'Failed to list users',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/rbac/users/:id
 * Get user details
 */
router.get('/users/:id', requireAuth, (req: Request, res: Response): void => {
  try {
    const userId = req.params.id || '';

    const rbac = getRBACManager();
    const user = rbac.getUser(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const permissions = rbac.getUserPermissions(userId);

    res.json({
      success: true,
      user: {
        ...user,
        effectivePermissions: permissions
      }
    });
  } catch (error) {
    console.error('Failed to get user:', error);
    res.status(500).json({
      error: 'Failed to get user',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/rbac/users/:id/roles
 * Assign roles to user
 */
router.post('/users/:id/roles', requireAuth, (req: Request, res: Response): void => {
  try {
    const userId = req.params.id || '';
    const { roleIds } = req.body;

    if (!roleIds || !Array.isArray(roleIds)) {
      res.status(400).json({ error: 'roleIds array is required' });
      return;
    }

    const rbac = getRBACManager();
    const user = rbac.assignRoles(userId, roleIds);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Failed to assign roles:', error);
    res.status(500).json({
      error: 'Failed to assign roles',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /api/rbac/users/:id/roles
 * Revoke roles from user
 */
router.delete('/users/:id/roles', requireAuth, (req: Request, res: Response): void => {
  try {
    const userId = req.params.id || '';
    const { roleIds } = req.body;

    if (!roleIds || !Array.isArray(roleIds)) {
      res.status(400).json({ error: 'roleIds array is required' });
      return;
    }

    const rbac = getRBACManager();
    const user = rbac.revokeRoles(userId, roleIds);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Failed to revoke roles:', error);
    res.status(500).json({
      error: 'Failed to revoke roles',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================================================
// POLICY MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/rbac/policies
 * Create new policy
 */
router.post('/policies', requireAuth, (req: Request, res: Response): void => {
  try {
    const { name, description, effect, actions, resources, conditions, priority } = req.body;
    
    if (!name || !description || !effect || !actions || !resources) {
      res.status(400).json({ error: 'Name, description, effect, actions, and resources are required' });
      return;
    }

    const rbac = getRBACManager();
    const policy = rbac.createPolicy({
      name,
      description,
      effect,
      actions,
      resources,
      conditions,
      priority: priority || 0
    });

    res.json({
      success: true,
      policy
    });
  } catch (error) {
    console.error('Failed to create policy:', error);
    res.status(500).json({
      error: 'Failed to create policy',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/rbac/policies
 * List all policies
 */
router.get('/policies', requireAuth, (req: Request, res: Response): void => {
  try {
    const rbac = getRBACManager();
    const policies = rbac.listPolicies();

    res.json({
      success: true,
      total: policies.length,
      policies
    });
  } catch (error) {
    console.error('Failed to list policies:', error);
    res.status(500).json({
      error: 'Failed to list policies',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/rbac/policies/:id
 * Get policy details
 */
router.get('/policies/:id', requireAuth, (req: Request, res: Response): void => {
  try {
    const policyId = req.params.id || '';

    const rbac = getRBACManager();
    const policy = rbac.getPolicy(policyId);

    if (!policy) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }

    res.json({
      success: true,
      policy
    });
  } catch (error) {
    console.error('Failed to get policy:', error);
    res.status(500).json({
      error: 'Failed to get policy',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/rbac/policies/:id
 * Update policy
 */
router.put('/policies/:id', requireAuth, (req: Request, res: Response): void => {
  try {
    const policyId = req.params.id || '';
    const updates = req.body;

    const rbac = getRBACManager();
    const policy = rbac.updatePolicy(policyId, updates);

    if (!policy) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }

    res.json({
      success: true,
      policy
    });
  } catch (error) {
    console.error('Failed to update policy:', error);
    res.status(500).json({
      error: 'Failed to update policy',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /api/rbac/policies/:id
 * Delete policy
 */
router.delete('/policies/:id', requireAuth, (req: Request, res: Response): void => {
  try {
    const policyId = req.params.id || '';

    const rbac = getRBACManager();
    const deleted = rbac.deletePolicy(policyId);

    if (!deleted) {
      res.status(404).json({ error: 'Policy not found' });
      return;
    }

    res.json({
      success: true,
      message: `Policy ${policyId} deleted`
    });
  } catch (error) {
    console.error('Failed to delete policy:', error);
    res.status(500).json({
      error: 'Failed to delete policy',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================================================
// ACCESS CONTROL ENDPOINTS
// ============================================================================

/**
 * POST /api/rbac/check-access
 * Check if user has access to resource
 */
router.post('/check-access', requireAuth, (req: Request, res: Response): void => {
  try {
    const { userId, permission, resourceType, resourceId, metadata } = req.body;
    
    if (!userId || !permission || !resourceType) {
      res.status(400).json({ error: 'userId, permission, and resourceType are required' });
      return;
    }

    const context: AccessContext = {
      userId,
      permission: permission as Permission,
      resourceType: resourceType as ResourceType,
      resourceId,
      timestamp: new Date(),
      metadata
    };

    const rbac = getRBACManager();
    const decision = rbac.checkAccess(context);

    res.json({
      success: true,
      decision
    });
  } catch (error) {
    console.error('Failed to check access:', error);
    res.status(500).json({
      error: 'Failed to check access',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/rbac/permissions
 * List all available permissions
 */
router.get('/permissions', requireAuth, (req: Request, res: Response): void => {
  try {
    const { Permission } = require('../infrastructure/rbac/index.js');
    const permissions = Object.values(Permission);

    res.json({
      success: true,
      total: permissions.length,
      permissions
    });
  } catch (error) {
    console.error('Failed to list permissions:', error);
    res.status(500).json({
      error: 'Failed to list permissions',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/rbac/resource-types
 * List all resource types
 */
router.get('/resource-types', requireAuth, (req: Request, res: Response): void => {
  try {
    const { ResourceType } = require('../infrastructure/rbac/index.js');
    const resourceTypes = Object.values(ResourceType);

    res.json({
      success: true,
      total: resourceTypes.length,
      resourceTypes
    });
  } catch (error) {
    console.error('Failed to list resource types:', error);
    res.status(500).json({
      error: 'Failed to list resource types',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================================================
// STATS ENDPOINT
// ============================================================================

/**
 * GET /api/rbac/stats
 * Get RBAC statistics
 */
router.get('/stats', requireAuth, (req: Request, res: Response): void => {
  try {
    const rbac = getRBACManager();
    const stats = rbac.getStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Failed to get RBAC stats:', error);
    res.status(500).json({
      error: 'Failed to get RBAC stats',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================================================
// HEALTH ENDPOINT
// ============================================================================

/**
 * GET /api/rbac/health
 * Health check for RBAC system
 */
router.get('/health', (req: Request, res: Response): void => {
  try {
    const rbac = getRBACManager();
    const stats = rbac.getStats();

    res.json({
      status: 'healthy',
      stats,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date()
    });
  }
});

export default router;
