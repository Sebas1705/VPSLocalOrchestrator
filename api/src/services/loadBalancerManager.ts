import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '../../loadbalancer');
const BACKENDS_FILE = path.join(STORAGE_DIR, 'backends.json');

export type BackendStatus = 'enabled' | 'draining';

export interface Backend {
  id: string;
  address: string; // host:port or URL
  status: BackendStatus;
  createdAt: string;
  updatedAt: string;
}

interface Persisted {
  backends: Backend[];
}

async function ensureStorage(): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

async function load(): Promise<Backend[]> {
  try {
    await ensureStorage();
    const content = await fs.readFile(BACKENDS_FILE, 'utf-8');
    const parsed: Persisted = JSON.parse(content);
    return parsed.backends ?? [];
  } catch (error: any) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Failed to load backends: ${error.message}`);
  }
}

async function save(backends: Backend[]): Promise<void> {
  await ensureStorage();
  const payload: Persisted = { backends };
  await fs.writeFile(BACKENDS_FILE, JSON.stringify(payload, null, 2));
}

function validateAddress(address: string): string {
  if (!address || typeof address !== 'string') {
    throw new Error('address is required');
  }
  if (!/^[^:\s]+:\d+$/.test(address) && !/^https?:\/\//.test(address)) {
    throw new Error('address must be host:port or URL');
  }
  return address.trim();
}

export async function listBackends(): Promise<Backend[]> {
  return load();
}

export async function addBackend(address: string): Promise<Backend> {
  const addr = validateAddress(address);
  const backends = await load();
  const now = new Date().toISOString();
  const backend: Backend = {
    id: crypto.randomUUID(),
    address: addr,
    status: 'enabled',
    createdAt: now,
    updatedAt: now,
  };
  backends.push(backend);
  await save(backends);
  return backend;
}

async function updateStatus(id: string, status: BackendStatus): Promise<Backend> {
  if (!id) throw new Error('id is required');
  const backends = await load();
  const index = backends.findIndex(b => b.id === id);
  if (index === -1) throw new Error('Backend not found');
  const updated: Backend = { ...backends[index]!, status, updatedAt: new Date().toISOString() };
  backends[index] = updated;
  await save(backends);
  return updated;
}

export async function drainBackend(id: string): Promise<Backend> {
  return updateStatus(id, 'draining');
}

export async function enableBackend(id: string): Promise<Backend> {
  return updateStatus(id, 'enabled');
}

export async function deleteBackend(id: string): Promise<boolean> {
  const backends = await load();
  const filtered = backends.filter(b => b.id !== id);
  if (filtered.length === backends.length) {
    throw new Error('Backend not found');
  }
  await save(filtered);
  return true;
}
