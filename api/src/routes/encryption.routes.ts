import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getEncryptionService, getSecretVault } from '../infrastructure/encryption/index.js';
import type { EncryptedData } from '../infrastructure/encryption/index.js';

const router = Router();

// ============================================================================
// ENCRYPTION ENDPOINTS
// ============================================================================

/**
 * POST /api/encryption/encrypt
 * Encrypt data with current key
 */
router.post('/encrypt', requireAuth, (req: Request, res: Response): void => {
  try {
    const { data } = req.body;
    
    if (!data) {
      res.status(400).json({ error: 'Data is required' });
      return;
    }

    const encryption = getEncryptionService();
    const encrypted = encryption.encrypt(data);

    res.json({
      success: true,
      encrypted,
      keyVersion: encrypted.keyVersion
    });
  } catch (error) {
    console.error('Encryption failed:', error);
    res.status(500).json({
      error: 'Encryption failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/encryption/decrypt
 * Decrypt encrypted data
 */
router.post('/decrypt', requireAuth, (req: Request, res: Response): void => {
  try {
    const encryptedData = req.body as EncryptedData;
    
    if (!encryptedData.ciphertext || !encryptedData.iv) {
      res.status(400).json({ error: 'Invalid encrypted data format' });
      return;
    }

    const encryption = getEncryptionService();
    const decrypted = encryption.decrypt(encryptedData);

    res.json({
      success: true,
      data: decrypted
    });
  } catch (error) {
    console.error('Decryption failed:', error);
    res.status(500).json({
      error: 'Decryption failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/encryption/reencrypt
 * Re-encrypt data with current key (for key rotation)
 */
router.post('/reencrypt', requireAuth, (req: Request, res: Response): void => {
  try {
    const encryptedData = req.body as EncryptedData;
    
    if (!encryptedData.ciphertext || !encryptedData.iv) {
      res.status(400).json({ error: 'Invalid encrypted data format' });
      return;
    }

    const encryption = getEncryptionService();
    const reEncrypted = encryption.reEncrypt(encryptedData);

    res.json({
      success: true,
      encrypted: reEncrypted,
      oldKeyVersion: encryptedData.keyVersion,
      newKeyVersion: reEncrypted.keyVersion
    });
  } catch (error) {
    console.error('Re-encryption failed:', error);
    res.status(500).json({
      error: 'Re-encryption failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================================================
// KEY MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/encryption/keys/rotate
 * Rotate encryption key
 */
router.post('/keys/rotate', requireAuth, (req: Request, res: Response): void => {
  try {
    const { expiresInDays } = req.body;

    const encryption = getEncryptionService();
    const newKey = encryption.rotateKey(expiresInDays);

    res.json({
      success: true,
      newKeyVersion: newKey.version,
      previousKeyVersion: newKey.version - 1,
      createdAt: newKey.createdAt,
      expiresAt: newKey.expiresAt
    });
  } catch (error) {
    console.error('Key rotation failed:', error);
    res.status(500).json({
      error: 'Key rotation failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/encryption/keys
 * List all key versions
 */
router.get('/keys', requireAuth, (req: Request, res: Response): void => {
  try {
    const encryption = getEncryptionService();
    const versions = encryption.getAllKeyVersions();
    const currentVersion = encryption.getCurrentKeyVersion();

    const keys = versions.map((version: number) => encryption.getKeyInfo(version));

    res.json({
      success: true,
      currentKeyVersion: currentVersion,
      totalKeys: keys.length,
      keys
    });
  } catch (error) {
    console.error('Failed to list keys:', error);
    res.status(500).json({
      error: 'Failed to list keys',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/encryption/keys/:version
 * Get key information for specific version
 */
router.get('/keys/:version', requireAuth, (req: Request, res: Response): void => {
  try {
    const version = parseInt(req.params.version || '0', 10);
    
    if (isNaN(version)) {
      res.status(400).json({ error: 'Invalid key version' });
      return;
    }

    const encryption = getEncryptionService();
    const keyInfo = encryption.getKeyInfo(version);

    if (!keyInfo) {
      res.status(404).json({ error: 'Key version not found' });
      return;
    }

    res.json({
      success: true,
      key: keyInfo
    });
  } catch (error) {
    console.error('Failed to get key info:', error);
    res.status(500).json({
      error: 'Failed to get key info',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================================================
// SECRET VAULT ENDPOINTS
// ============================================================================

/**
 * POST /api/encryption/vault/store
 * Store secret in vault
 */
router.post('/vault/store', requireAuth, (req: Request, res: Response): void => {
  try {
    const { path, value, ttl, tags } = req.body;
    
    if (!path || !value) {
      res.status(400).json({ error: 'Path and value are required' });
      return;
    }

    const vault = getSecretVault();
    const options: any = {};
    
    if (ttl !== undefined) {
      options.ttl = ttl;
    }
    if (tags !== undefined) {
      options.tags = tags;
    }

    const metadata = vault.storeSecret(path, value, options);

    res.json({
      success: true,
      secret: metadata
    });
  } catch (error) {
    console.error('Failed to store secret:', error);
    res.status(500).json({
      error: 'Failed to store secret',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/encryption/vault/retrieve/:path
 * Retrieve secret from vault
 */
router.get('/vault/retrieve/:path', requireAuth, (req: Request, res: Response): void => {
  try {
    const path = req.params.path || '';
    
    if (!path) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const vault = getSecretVault();
    const value = vault.retrieveSecret(path);

    if (value === undefined) {
      res.status(404).json({ error: 'Secret not found or expired' });
      return;
    }

    res.json({
      success: true,
      path,
      value
    });
  } catch (error) {
    console.error('Failed to retrieve secret:', error);
    res.status(500).json({
      error: 'Failed to retrieve secret',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * PUT /api/encryption/vault/update
 * Update existing secret
 */
router.put('/vault/update', requireAuth, (req: Request, res: Response): void => {
  try {
    const { path, value, ttl, tags } = req.body;
    
    if (!path || !value) {
      res.status(400).json({ error: 'Path and value are required' });
      return;
    }

    const vault = getSecretVault();
    const options: any = {};
    
    if (ttl !== undefined) {
      options.ttl = ttl;
    }
    if (tags !== undefined) {
      options.tags = tags;
    }

    const metadata = vault.updateSecret(path, value, options);

    if (!metadata) {
      res.status(404).json({ error: 'Secret not found' });
      return;
    }

    res.json({
      success: true,
      secret: metadata
    });
  } catch (error) {
    console.error('Failed to update secret:', error);
    res.status(500).json({
      error: 'Failed to update secret',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /api/encryption/vault/delete/:path
 * Delete secret from vault
 */
router.delete('/vault/delete/:path', requireAuth, (req: Request, res: Response): void => {
  try {
    const path = req.params.path || '';
    
    if (!path) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const vault = getSecretVault();
    const deleted = vault.deleteSecret(path);

    if (!deleted) {
      res.status(404).json({ error: 'Secret not found' });
      return;
    }

    res.json({
      success: true,
      message: `Secret deleted: ${path}`
    });
  } catch (error) {
    console.error('Failed to delete secret:', error);
    res.status(500).json({
      error: 'Failed to delete secret',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/encryption/vault/list
 * List all secrets (with optional prefix filter)
 */
router.get('/vault/list', requireAuth, (req: Request, res: Response): void => {
  try {
    const prefix = req.query.prefix as string | undefined;

    const vault = getSecretVault();
    const secrets = vault.listSecrets(prefix);

    res.json({
      success: true,
      total: secrets.length,
      prefix: prefix || null,
      secrets
    });
  } catch (error) {
    console.error('Failed to list secrets:', error);
    res.status(500).json({
      error: 'Failed to list secrets',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/encryption/vault/search
 * Search secrets by tags
 */
router.post('/vault/search', requireAuth, (req: Request, res: Response): void => {
  try {
    const { tags } = req.body;
    
    if (!tags || !Array.isArray(tags)) {
      res.status(400).json({ error: 'Tags array is required' });
      return;
    }

    const vault = getSecretVault();
    const secrets = vault.searchByTags(tags);

    res.json({
      success: true,
      total: secrets.length,
      tags,
      secrets
    });
  } catch (error) {
    console.error('Failed to search secrets:', error);
    res.status(500).json({
      error: 'Failed to search secrets',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/encryption/vault/rotate-all
 * Rotate encryption for all secrets
 */
router.post('/vault/rotate-all', requireAuth, (req: Request, res: Response): void => {
  try {
    const vault = getSecretVault();
    const rotated = vault.rotateAllSecrets();

    res.json({
      success: true,
      rotatedCount: rotated,
      message: `Successfully rotated ${rotated} secrets`
    });
  } catch (error) {
    console.error('Failed to rotate secrets:', error);
    res.status(500).json({
      error: 'Failed to rotate secrets',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/encryption/vault/stats
 * Get vault statistics
 */
router.get('/vault/stats', requireAuth, (req: Request, res: Response): void => {
  try {
    const vault = getSecretVault();
    const stats = vault.getStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Failed to get vault stats:', error);
    res.status(500).json({
      error: 'Failed to get vault stats',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// ============================================================================
// HEALTH ENDPOINT
// ============================================================================

/**
 * GET /api/encryption/health
 * Health check for encryption service
 */
router.get('/health', (req: Request, res: Response): void => {
  try {
    const encryption = getEncryptionService();
    const vault = getSecretVault();

    const currentKeyVersion = encryption.getCurrentKeyVersion();
    const totalKeys = encryption.getAllKeyVersions().length;
    const vaultStats = vault.getStats();

    res.json({
      status: 'healthy',
      encryption: {
        currentKeyVersion,
        totalKeys
      },
      vault: vaultStats,
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
