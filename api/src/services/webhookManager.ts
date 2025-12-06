import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '../../webhooks');
const WEBHOOKS_FILE = path.join(STORAGE_DIR, 'webhooks.json');

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
  secret?: string;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

/**
 * Asegura que el directorio de almacenamiento existe
 */
async function ensureStorageDir(): Promise<void> {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating webhooks storage directory:', error);
  }
}

/**
 * Carga los webhooks desde almacenamiento
 */
async function loadWebhooks(): Promise<Webhook[]> {
  try {
    await ensureStorageDir();
    const content = await fs.readFile(WEBHOOKS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error('Error loading webhooks:', error);
    return [];
  }
}

/**
 * Guarda los webhooks en almacenamiento
 */
async function saveWebhooks(webhooks: Webhook[]): Promise<void> {
  try {
    await ensureStorageDir();
    await fs.writeFile(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2));
  } catch (error) {
    console.error('Error saving webhooks:', error);
  }
}

/**
 * Registra un nuevo webhook
 */
export async function registerWebhook(
  url: string,
  events: string[],
  secret?: string
): Promise<Webhook> {
  try {
    // Validar URL
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid webhook URL');
    }

    // Validar eventos
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error('At least one event must be specified');
    }

    const webhooks = await loadWebhooks();
    const id = crypto.randomBytes(8).toString('hex');

    const webhook: Webhook = {
      id,
      url,
      events,
      active: true,
      createdAt: new Date().toISOString(),
    };

    // Agregar secret solo si se proporciona
    if (secret) {
      webhook.secret = secret;
    }

    webhooks.push(webhook);
    await saveWebhooks(webhooks);

    return webhook;
  } catch (error: any) {
    throw new Error(`Failed to register webhook: ${error.message}`);
  }
}

/**
 * Obtiene todos los webhooks
 */
export async function listWebhooks(): Promise<Webhook[]> {
  try {
    return await loadWebhooks();
  } catch (error: any) {
    throw new Error(`Failed to list webhooks: ${error.message}`);
  }
}

/**
 * Obtiene un webhook específico
 */
export async function getWebhook(id: string): Promise<Webhook | null> {
  try {
    const webhooks = await loadWebhooks();
    return webhooks.find(w => w.id === id) || null;
  } catch (error: any) {
    throw new Error(`Failed to get webhook: ${error.message}`);
  }
}

/**
 * Elimina un webhook
 */
export async function deleteWebhook(id: string): Promise<boolean> {
  try {
    const webhooks = await loadWebhooks();
    const filtered = webhooks.filter(w => w.id !== id);

    if (filtered.length === webhooks.length) {
      throw new Error('Webhook not found');
    }

    await saveWebhooks(filtered);
    return true;
  } catch (error: any) {
    throw new Error(`Failed to delete webhook: ${error.message}`);
  }
}

/**
 * Actualiza el estado de un webhook
 */
export async function updateWebhook(
  id: string,
  updates: Partial<Webhook>
): Promise<Webhook | null> {
  try {
    const webhooks = await loadWebhooks();
    const index = webhooks.findIndex(w => w.id === id);

    if (index === -1) {
      throw new Error('Webhook not found');
    }

    const existing = webhooks[index]!;
    const updated: Webhook = {
      id: existing.id,
      url: existing.url,
      events: existing.events,
      active: updates.active ?? existing.active,
      createdAt: existing.createdAt,
      ...(existing.lastTriggeredAt && { lastTriggeredAt: existing.lastTriggeredAt }),
      ...(existing.secret && { secret: existing.secret }),
      ...(updates.lastTriggeredAt && { lastTriggeredAt: updates.lastTriggeredAt }),
      ...(updates.secret && { secret: updates.secret }),
    };

    // Actualizar eventos si se proporcionan
    if (updates.events) {
      updated.events = updates.events;
    }

    // Actualizar URL si se proporciona
    if (updates.url) {
      updated.url = updates.url;
    }

    webhooks[index] = updated;
    await saveWebhooks(webhooks);

    return updated;
  } catch (error: any) {
    throw new Error(`Failed to update webhook: ${error.message}`);
  }
}

/**
 * Envía un evento a todos los webhooks interesados
 */
export async function triggerEvent(
  event: string,
  data: Record<string, any>
): Promise<void> {
  try {
    const webhooks = await loadWebhooks();

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    // Filtrar webhooks que escuchen este evento
    const relevantWebhooks = webhooks.filter(
      w => w.active && w.events.includes(event)
    );

    // Enviar a cada webhook (async, sin esperar)
    for (const webhook of relevantWebhooks) {
      sendWebhook(webhook, payload).catch(err => {
        console.error(`Failed to send webhook ${webhook.id}:`, err);
      });
    }
  } catch (error) {
    console.error('Error triggering event:', error);
  }
}

/**
 * Envía un payload a un webhook específico
 */
async function sendWebhook(webhook: Webhook, payload: WebhookPayload): Promise<void> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'VPS-Orchestrator-Webhook/1.0',
    };

    // Si hay secret, agregar header de firma
    if (webhook.secret) {
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      headers['X-Webhook-Signature'] = signature;
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    // Actualizar último trigger
    if (response.ok) {
      await updateWebhook(webhook.id, {
        lastTriggeredAt: new Date().toISOString(),
      });
    } else {
      console.warn(
        `Webhook ${webhook.id} returned status ${response.status}`
      );
    }
  } catch (error: any) {
    console.error(`Error sending webhook to ${webhook.url}:`, error.message);
    throw error;
  }
}

/**
 * Envía un webhook de prueba
 */
export async function testWebhook(id: string): Promise<void> {
  try {
    const webhook = await getWebhook(id);

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload: WebhookPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook',
      },
    };

    await sendWebhook(webhook, testPayload);
  } catch (error: any) {
    throw new Error(`Failed to test webhook: ${error.message}`);
  }
}
