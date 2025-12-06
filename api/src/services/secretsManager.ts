import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from '../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '../../secrets');
const SECRETS_FILE = path.join(STORAGE_DIR, 'secrets.json');
const MAX_VALUE_BYTES = 10 * 1024; // 10KB

export interface SecretMetadata {
  id: string;
  name: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface StoredSecret extends SecretMetadata {
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface SecretRecord extends SecretMetadata {
  value: string;
}

function getKey(): Buffer {
  const secretKey = getConfig().security.secretKey;
  const keyBuffer = Buffer.from(secretKey, 'base64');

  if (keyBuffer.length !== 32) {
    throw new Error('SECRET_KEY must be base64-encoded 32 bytes (AES-256)');
  }

  return keyBuffer;
}

async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

async function loadSecrets(): Promise<StoredSecret[]> {
  try {
    await ensureStorageDir();
    const content = await fs.readFile(SECRETS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw new Error(`Failed to load secrets: ${error.message}`);
  }
}

async function saveSecrets(secrets: StoredSecret[]): Promise<void> {
  await ensureStorageDir();
  await fs.writeFile(SECRETS_FILE, JSON.stringify(secrets, null, 2));
}

function encryptValue(value: string): { iv: string; authTag: string; ciphertext: string } {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: encrypted.toString('hex'),
  };
}

function decryptValue(ivHex: string, authTagHex: string, ciphertextHex: string): string {
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function validateInput(name: unknown, value: unknown, tags?: unknown): asserts name is string {
  if (!name || typeof name !== 'string' || name.length > 100) {
    throw new Error('name is required and must be <= 100 chars');
  }
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > MAX_VALUE_BYTES) {
    throw new Error('value is required, string, and <= 10KB');
  }
  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.some(t => typeof t !== 'string' || t.length > 50)) {
      throw new Error('tags must be an array of strings (<= 50 chars each)');
    }
  }
}

export async function createSecret(name: string, value: string, tags: string[] = []): Promise<SecretMetadata> {
  validateInput(name, value, tags);

  const { iv, authTag, ciphertext } = encryptValue(value);
  const now = new Date().toISOString();
  const secret: StoredSecret = {
    id: crypto.randomBytes(8).toString('hex'),
    name,
    tags,
    createdAt: now,
    updatedAt: now,
    iv,
    authTag,
    ciphertext,
  };

  const secrets = await loadSecrets();
  secrets.push(secret);
  await saveSecrets(secrets);

  return {
    id: secret.id,
    name: secret.name,
    tags: secret.tags,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
  };
}

export async function listSecrets(): Promise<SecretMetadata[]> {
  const secrets = await loadSecrets();
  return secrets.map(({ id, name, tags, createdAt, updatedAt }) => ({
    id,
    name,
    tags,
    createdAt,
    updatedAt,
  }));
}

export async function getSecret(id: string): Promise<SecretRecord | null> {
  const secrets = await loadSecrets();
  const secret = secrets.find(s => s.id === id);
  if (!secret) return null;

  const value = decryptValue(secret.iv, secret.authTag, secret.ciphertext);
  return {
    id: secret.id,
    name: secret.name,
    tags: secret.tags,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
    value,
  };
}

export async function updateSecret(
  id: string,
  updates: { name?: string; value?: string; tags?: string[] }
): Promise<SecretRecord | null> {
  const secrets = await loadSecrets();
  const index = secrets.findIndex(s => s.id === id);
  if (index === -1) return null;

  const existing = secrets[index]!;

  if (updates.name !== undefined) {
    if (!updates.name || typeof updates.name !== 'string' || updates.name.length > 100) {
      throw new Error('name must be a non-empty string <= 100 chars');
    }
    existing.name = updates.name;
  }

  if (updates.tags !== undefined) {
    if (!Array.isArray(updates.tags) || updates.tags.some(t => typeof t !== 'string' || t.length > 50)) {
      throw new Error('tags must be an array of strings (<= 50 chars each)');
    }
    existing.tags = updates.tags;
  }

  if (updates.value !== undefined) {
    if (typeof updates.value !== 'string' || Buffer.byteLength(updates.value, 'utf8') > MAX_VALUE_BYTES) {
      throw new Error('value must be string <= 10KB');
    }
    const encrypted = encryptValue(updates.value);
    existing.iv = encrypted.iv;
    existing.authTag = encrypted.authTag;
    existing.ciphertext = encrypted.ciphertext;
  }

  existing.updatedAt = new Date().toISOString();
  secrets[index] = existing;
  await saveSecrets(secrets);

  const value = decryptValue(existing.iv, existing.authTag, existing.ciphertext);
  return {
    id: existing.id,
    name: existing.name,
    tags: existing.tags,
    createdAt: existing.createdAt,
    updatedAt: existing.updatedAt,
    value,
  };
}

export async function deleteSecret(id: string): Promise<boolean> {
  const secrets = await loadSecrets();
  const filtered = secrets.filter(s => s.id !== id);
  if (filtered.length === secrets.length) {
    return false;
  }
  await saveSecrets(filtered);
  return true;
}
