import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '../../metrics');
const METRICS_FILE = path.join(STORAGE_DIR, 'metrics.json');
const MAX_RESULTS = 500;

export interface Metric {
  id: string;
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: string;
}

interface MetricsPayload {
  metrics: Metric[];
}

async function ensureStorage(): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

async function loadMetrics(): Promise<Metric[]> {
  try {
    await ensureStorage();
    const content = await fs.readFile(METRICS_FILE, 'utf-8');
    const parsed: MetricsPayload = JSON.parse(content);
    return parsed.metrics ?? [];
  } catch (error: any) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Failed to load metrics: ${error.message}`);
  }
}

async function saveMetrics(metrics: Metric[]): Promise<void> {
  await ensureStorage();
  const payload: MetricsPayload = { metrics };
  await fs.writeFile(METRICS_FILE, JSON.stringify(payload, null, 2));
}

export async function addMetric(
  name: string,
  value: number,
  tags?: Record<string, string>,
  timestamp?: string
): Promise<Metric> {
  if (!name || typeof name !== 'string') {
    throw new Error('name is required');
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error('value must be a number');
  }
  if (tags && typeof tags !== 'object') {
    throw new Error('tags must be an object of string values');
  }

  const ts = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
  const metric: Metric = {
    id: crypto.randomUUID(),
    name,
    value,
    timestamp: ts,
  };

  if (tags) {
    metric.tags = tags;
  }

  const metrics = await loadMetrics();
  metrics.push(metric);
  await saveMetrics(metrics);

  return metric;
}

export interface MetricsQuery {
  name?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export async function listMetrics(query: MetricsQuery = {}): Promise<Metric[]> {
  const { name, from, to, limit } = query;
  const metrics = await loadMetrics();

  const fromTs = from ? Date.parse(from) : undefined;
  const toTs = to ? Date.parse(to) : undefined;

  let filtered = metrics;

  if (name) {
    filtered = filtered.filter(m => m.name === name);
  }

  if (fromTs !== undefined && !Number.isNaN(fromTs)) {
    filtered = filtered.filter(m => Date.parse(m.timestamp) >= fromTs);
  }

  if (toTs !== undefined && !Number.isNaN(toTs)) {
    filtered = filtered.filter(m => Date.parse(m.timestamp) <= toTs);
  }

  const safeLimit = Number.isFinite(limit) && limit! > 0 ? Math.min(Math.trunc(limit!), MAX_RESULTS) : 100;

  return filtered.slice(-safeLimit).reverse(); // most recent first
}
