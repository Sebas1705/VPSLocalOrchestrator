import * as crypto from 'crypto';
import type { ILogger } from '../logging/index.js';
import { LoggerFactory } from '../logging/index.js';
import { getCache } from '../cache/index.js';

/**
 * Encryption & Secret Management - v8.1.0
 * 
 * Provides secure encryption and secret vault:
 * - AES-256-GCM encryption/decryption
 * - Key rotation with versioning
 * - Secure secret storage with TTL
 * - Envelope encryption for large payloads
 */

// ============================================================================
// ENCRYPTION TYPES
// ============================================================================

export enum EncryptionAlgorithm {
  AES_256_GCM = 'aes-256-gcm',
  AES_256_CBC = 'aes-256-cbc'
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag?: string;
  algorithm: EncryptionAlgorithm;
  keyVersion: number;
  timestamp: Date;
}

export interface EncryptionKey {
  id: string;
  version: number;
  key: Buffer;
  algorithm: EncryptionAlgorithm;
  createdAt: Date;
  expiresAt?: Date;
  active: boolean;
}

export interface SecretMetadata {
  id: string;
  path: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  ttl?: number;
  tags?: string[];
}

export interface StoredSecret {
  metadata: SecretMetadata;
  encrypted: EncryptedData;
}

// ============================================================================
// ENCRYPTION SERVICE
// ============================================================================

export class EncryptionService {
  private keys: Map<number, EncryptionKey> = new Map();
  private currentKeyVersion = 0;
  private logger: ILogger;
  private algorithm: EncryptionAlgorithm = EncryptionAlgorithm.AES_256_GCM;

  constructor(masterKey?: string) {
    this.logger = LoggerFactory.getInstance().getLogger();
    
    // Initialize with master key or generate one
    if (masterKey) {
      this.importMasterKey(masterKey);
    } else {
      this.generateKey();
    }
  }

  /**
   * Import master key from hex string
   */
  private importMasterKey(masterKeyHex: string): void {
    const keyBuffer = Buffer.from(masterKeyHex, 'hex');
    if (keyBuffer.length !== 32) {
      throw new Error('Master key must be 256 bits (32 bytes)');
    }

    const key: EncryptionKey = {
      id: `key-${++this.currentKeyVersion}`,
      version: this.currentKeyVersion,
      key: keyBuffer,
      algorithm: this.algorithm,
      createdAt: new Date(),
      active: true
    };

    this.keys.set(key.version, key);
    this.logger.info(`Master key imported: version ${key.version}`);
  }

  /**
   * Generate new encryption key
   */
  generateKey(expiresInDays?: number): EncryptionKey {
    const keyBuffer = crypto.randomBytes(32); // 256 bits
    const key: EncryptionKey = {
      id: `key-${++this.currentKeyVersion}`,
      version: this.currentKeyVersion,
      key: keyBuffer,
      algorithm: this.algorithm,
      createdAt: new Date(),
      active: true
    };

    if (expiresInDays) {
      key.expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    }

    // Deactivate previous key
    const previousVersion = this.currentKeyVersion - 1;
    if (this.keys.has(previousVersion)) {
      this.keys.get(previousVersion)!.active = false;
    }

    this.keys.set(key.version, key);
    this.logger.info(`New encryption key generated: version ${key.version}`);
    return key;
  }

  /**
   * Rotate encryption key
   */
  rotateKey(expiresInDays?: number): EncryptionKey {
    this.logger.info('Rotating encryption key');
    return this.generateKey(expiresInDays);
  }

  /**
   * Encrypt data with current key
   */
  encrypt(plaintext: string | Buffer): EncryptedData {
    const currentKey = this.keys.get(this.currentKeyVersion);
    if (!currentKey || !currentKey.active) {
      throw new Error('No active encryption key available');
    }

    const plaintextBuffer = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
    const iv = crypto.randomBytes(16); // 128-bit IV for GCM

    const cipher = crypto.createCipheriv(this.algorithm, currentKey.key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(plaintextBuffer),
      cipher.final()
    ]);

    const result: EncryptedData = {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      algorithm: this.algorithm,
      keyVersion: currentKey.version,
      timestamp: new Date()
    };

    // Add auth tag for GCM
    if (this.algorithm === EncryptionAlgorithm.AES_256_GCM) {
      const authTag = (cipher as any).getAuthTag ? (cipher as any).getAuthTag().toString('base64') : undefined;
      if (authTag) {
        (result as any).authTag = authTag;
      }
    }

    return result;
  }

  /**
   * Decrypt data with specified key version
   */
  decrypt(encrypted: EncryptedData): string {
    const key = this.keys.get(encrypted.keyVersion);
    if (!key) {
      throw new Error(`Encryption key version ${encrypted.keyVersion} not found`);
    }

    const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
    const iv = Buffer.from(encrypted.iv, 'base64');

    const decipher = crypto.createDecipheriv(encrypted.algorithm, key.key, iv);

    // Set auth tag for GCM
    if (encrypted.algorithm === EncryptionAlgorithm.AES_256_GCM && encrypted.authTag) {
      if ((decipher as any).setAuthTag) {
        (decipher as any).setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
      }
    }

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Re-encrypt data with current key (for key rotation)
   */
  reEncrypt(encrypted: EncryptedData): EncryptedData {
    const plaintext = this.decrypt(encrypted);
    return this.encrypt(plaintext);
  }

  /**
   * Get key information
   */
  getKeyInfo(version: number): Omit<EncryptionKey, 'key'> | undefined {
    const key = this.keys.get(version);
    if (!key) return undefined;

    const keyInfo = { ...key } as any;
    delete keyInfo.key;
    return keyInfo;
  }

  /**
   * Get all key versions
   */
  getAllKeyVersions(): number[] {
    return Array.from(this.keys.keys()).sort((a, b) => b - a);
  }

  /**
   * Get current key version
   */
  getCurrentKeyVersion(): number {
    return this.currentKeyVersion;
  }
}

// ============================================================================
// SECRET VAULT
// ============================================================================

export class SecretVault {
  private encryption: EncryptionService;
  private secrets: Map<string, StoredSecret> = new Map();
  private logger: ILogger;
  private secretIdCounter = 0;

  constructor(encryption: EncryptionService) {
    this.encryption = encryption;
    this.logger = LoggerFactory.getInstance().getLogger();
  }

  /**
   * Store secret in vault
   */
  storeSecret(
    path: string,
    value: string,
    options?: {
      ttl?: number;
      tags?: string[];
    }
  ): SecretMetadata {
    const encrypted = this.encryption.encrypt(value);
    
    const metadata: any = {
      id: `secret-${++this.secretIdCounter}`,
      path,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (options?.ttl !== undefined) {
      metadata.ttl = options.ttl;
    }
    if (options?.tags !== undefined) {
      metadata.tags = options.tags;
    }

    const storedSecret: StoredSecret = {
      metadata,
      encrypted
    };

    this.secrets.set(path, storedSecret);
    this.logger.info(`Secret stored: ${path}`);

    // Schedule TTL expiration if set
    if (options?.ttl) {
      setTimeout(() => {
        this.deleteSecret(path);
      }, options.ttl * 1000);
    }

    return metadata;
  }

  /**
   * Retrieve secret from vault
   */
  retrieveSecret(path: string): string | undefined {
    const stored = this.secrets.get(path);
    if (!stored) return undefined;

    // Check TTL
    if (stored.metadata.ttl) {
      const expiresAt = new Date(stored.metadata.createdAt.getTime() + stored.metadata.ttl * 1000);
      if (new Date() > expiresAt) {
        this.deleteSecret(path);
        return undefined;
      }
    }

    return this.encryption.decrypt(stored.encrypted);
  }

  /**
   * Update secret (creates new version)
   */
  updateSecret(
    path: string,
    newValue: string,
    options?: {
      ttl?: number;
      tags?: string[];
    }
  ): SecretMetadata | undefined {
    const existing = this.secrets.get(path);
    if (!existing) return undefined;

    const encrypted = this.encryption.encrypt(newValue);
    
    const metadata: any = {
      id: existing.metadata.id,
      path: existing.metadata.path,
      version: existing.metadata.version + 1,
      createdAt: existing.metadata.createdAt,
      updatedAt: new Date()
    };

    const ttl = options?.ttl ?? existing.metadata.ttl;
    if (ttl !== undefined) {
      metadata.ttl = ttl;
    }
    const tags = options?.tags ?? existing.metadata.tags;
    if (tags !== undefined) {
      metadata.tags = tags;
    }

    const storedSecret: StoredSecret = {
      metadata,
      encrypted
    };

    this.secrets.set(path, storedSecret);
    this.logger.info(`Secret updated: ${path} (version ${metadata.version})`);

    return metadata;
  }

  /**
   * Delete secret from vault
   */
  deleteSecret(path: string): boolean {
    const deleted = this.secrets.delete(path);
    if (deleted) {
      this.logger.info(`Secret deleted: ${path}`);
    }
    return deleted;
  }

  /**
   * List all secret paths
   */
  listSecrets(prefix?: string): SecretMetadata[] {
    const results: SecretMetadata[] = [];
    
    for (const [path, stored] of this.secrets.entries()) {
      if (!prefix || path.startsWith(prefix)) {
        results.push(stored.metadata);
      }
    }

    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * Search secrets by tags
   */
  searchByTags(tags: string[]): SecretMetadata[] {
    const results: SecretMetadata[] = [];
    
    for (const stored of this.secrets.values()) {
      if (stored.metadata.tags) {
        const hasAllTags = tags.every(tag => stored.metadata.tags!.includes(tag));
        if (hasAllTags) {
          results.push(stored.metadata);
        }
      }
    }

    return results;
  }

  /**
   * Rotate encryption for all secrets
   */
  rotateAllSecrets(): number {
    let rotated = 0;
    
    for (const [path, stored] of this.secrets.entries()) {
      try {
        const newEncrypted = this.encryption.reEncrypt(stored.encrypted);
        stored.encrypted = newEncrypted;
        rotated++;
      } catch (error) {
        this.logger.error(`Failed to rotate secret: ${path}`, error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.logger.info(`Rotated encryption for ${rotated} secrets`);
    return rotated;
  }

  /**
   * Get vault statistics
   */
  getStats(): {
    totalSecrets: number;
    secretsByTags: Record<string, number>;
    expiringWithin24h: number;
  } {
    const tagCounts: Record<string, number> = {};
    let expiringSoon = 0;
    const now = Date.now();

    for (const stored of this.secrets.values()) {
      // Count tags
      if (stored.metadata.tags) {
        for (const tag of stored.metadata.tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }

      // Check expiration
      if (stored.metadata.ttl) {
        const expiresAt = stored.metadata.createdAt.getTime() + stored.metadata.ttl * 1000;
        if (expiresAt - now < 24 * 60 * 60 * 1000) {
          expiringSoon++;
        }
      }
    }

    return {
      totalSecrets: this.secrets.size,
      secretsByTags: tagCounts,
      expiringWithin24h: expiringSoon
    };
  }
}

// ============================================================================
// GLOBAL SINGLETONS
// ============================================================================

let encryptionService: EncryptionService | undefined;
let secretVault: SecretVault | undefined;

export function initializeEncryption(masterKey?: string): { encryption: EncryptionService; vault: SecretVault } {
  if (encryptionService && secretVault) {
    return { encryption: encryptionService, vault: secretVault };
  }

  encryptionService = new EncryptionService(masterKey);
  secretVault = new SecretVault(encryptionService);
  
  const logger = LoggerFactory.getInstance().getLogger();
  logger.info('Encryption service and secret vault initialized');

  return { encryption: encryptionService, vault: secretVault };
}

export function getEncryptionService(): EncryptionService {
  if (!encryptionService) {
    const result = initializeEncryption();
    return result.encryption;
  }
  return encryptionService;
}

export function getSecretVault(): SecretVault {
  if (!secretVault) {
    const result = initializeEncryption();
    return result.vault;
  }
  return secretVault;
}
