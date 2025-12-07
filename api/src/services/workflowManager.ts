import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeCommand } from './commandExecutor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.join(__dirname, '../../workflows');
const WORKFLOWS_FILE = path.join(STORAGE_DIR, 'workflows.json');
const WORKFLOW_RUNS_FILE = path.join(STORAGE_DIR, 'workflow-runs.json');
const MAX_HISTORY_PER_WORKFLOW = 50;

export type WorkflowStepType = 'command' | 'wait' | 'webhook';

export interface WorkflowStep {
  id: string;
  type: WorkflowStepType;
  command?: string;
  waitMs?: number;
  url?: string;
  method?: string;
  body?: Record<string, any>;
}

export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
}

export interface StepResult {
  stepId: string;
  type: WorkflowStepType;
  status: 'success' | 'failure';
  output?: any;
  error?: string;
  durationMs: number;
}

export interface RunResult {
  runId: string;
  workflowId: string;
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'partial' | 'failure';
  steps: StepResult[];
}

type WorkflowRuns = Record<string, RunResult[]>;

async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

async function loadWorkflows(): Promise<Workflow[]> {
  try {
    await ensureStorageDir();
    const content = await fs.readFile(WORKFLOWS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Failed to load workflows: ${error.message}`);
  }
}

async function saveWorkflows(workflows: Workflow[]): Promise<void> {
  await ensureStorageDir();
  await fs.writeFile(WORKFLOWS_FILE, JSON.stringify(workflows, null, 2));
}

async function loadWorkflowRuns(): Promise<WorkflowRuns> {
  try {
    await ensureStorageDir();
    const content = await fs.readFile(WORKFLOW_RUNS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`Failed to load workflow runs: ${error.message}`);
  }
}

async function saveWorkflowRuns(runs: WorkflowRuns): Promise<void> {
  await ensureStorageDir();
  await fs.writeFile(WORKFLOW_RUNS_FILE, JSON.stringify(runs, null, 2));
}

async function appendRunHistory(run: RunResult): Promise<void> {
  const runs = await loadWorkflowRuns();
  const list = runs[run.workflowId] ?? [];
  list.push(run);
  runs[run.workflowId] = list.slice(-MAX_HISTORY_PER_WORKFLOW);
  await saveWorkflowRuns(runs);
}

function validateStep(step: any): asserts step is WorkflowStep {
  if (!step || typeof step !== 'object') {
    throw new Error('step must be an object');
  }
  if (!['command', 'wait', 'webhook'].includes(step.type)) {
    throw new Error('step.type must be command|wait|webhook');
  }
  if (step.type === 'command') {
    if (!step.command || typeof step.command !== 'string') {
      throw new Error('command step requires command string');
    }
  }
  if (step.type === 'wait') {
    if (typeof step.waitMs !== 'number' || step.waitMs < 0 || step.waitMs > 300000) {
      throw new Error('wait step requires waitMs between 0 and 300000 ms');
    }
  }
  if (step.type === 'webhook') {
    if (!step.url || typeof step.url !== 'string') {
      throw new Error('webhook step requires url');
    }
    const method = step.method ?? 'POST';
    if (typeof method !== 'string') {
      throw new Error('webhook step method must be string');
    }
  }
}

function assignStepIds(steps: any[]): WorkflowStep[] {
  return steps.map((s) => ({
    ...s,
    id: s.id ?? crypto.randomUUID(),
    method: s.method ?? 'POST',
    body: s.body ?? undefined,
  }));
}

import crypto from 'crypto';

export async function createWorkflow(name: string, steps: any[]): Promise<Workflow> {
  if (!name || typeof name !== 'string') {
    throw new Error('name is required');
  }
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('steps array is required');
  }
  steps.forEach(validateStep);

  const workflows = await loadWorkflows();
  const now = new Date().toISOString();
  const workflow: Workflow = {
    id: crypto.randomBytes(8).toString('hex'),
    name,
    active: true,
    steps: assignStepIds(steps),
    createdAt: now,
    updatedAt: now,
  };
  workflows.push(workflow);
  await saveWorkflows(workflows);
  return workflow;
}

export async function listWorkflows(): Promise<Workflow[]> {
  return loadWorkflows();
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const workflows = await loadWorkflows();
  return workflows.find(w => w.id === id) ?? null;
}

export async function updateWorkflow(
  id: string,
  updates: Partial<Pick<Workflow, 'name' | 'active' | 'steps'>>
): Promise<Workflow | null> {
  const workflows = await loadWorkflows();
  const index = workflows.findIndex(w => w.id === id);
  if (index === -1) return null;

  const existing = workflows[index]!;

  if (updates.name !== undefined) {
    if (!updates.name || typeof updates.name !== 'string') {
      throw new Error('name must be non-empty string');
    }
    existing.name = updates.name;
  }

  if (updates.active !== undefined) {
    existing.active = !!updates.active;
  }

  if (updates.steps !== undefined) {
    if (!Array.isArray(updates.steps) || updates.steps.length === 0) {
      throw new Error('steps array must not be empty');
    }
    updates.steps.forEach(validateStep);
    existing.steps = assignStepIds(updates.steps);
  }

  existing.updatedAt = new Date().toISOString();
  workflows[index] = existing;
  await saveWorkflows(workflows);
  return existing;
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const workflows = await loadWorkflows();
  const filtered = workflows.filter(w => w.id !== id);
  if (filtered.length === workflows.length) return false;
  await saveWorkflows(filtered);
  return true;
}

async function runStep(step: WorkflowStep): Promise<StepResult> {
  const started = Date.now();
  try {
    if (step.type === 'command') {
      const result = await executeCommand(step.command!);
      const base: Omit<StepResult, 'status' | 'type'> & { status: StepResult['status']; type: WorkflowStepType } = {
        stepId: step.id,
        type: step.type,
        status: result.exitCode === 0 ? 'success' : 'failure',
        output: result,
        durationMs: Date.now() - started,
      };
      if (result.exitCode !== 0) {
        return { ...base, error: result.stderr || 'Command failed' };
      }
      return base;
    }
    if (step.type === 'wait') {
      await new Promise(resolve => setTimeout(resolve, step.waitMs));
      return {
        stepId: step.id,
        type: step.type,
        status: 'success',
        durationMs: Date.now() - started,
      };
    }
    if (step.type === 'webhook') {
      const response = await fetch(step.url!, {
        method: step.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: step.body ? JSON.stringify(step.body) : null,
      });
      const text = await response.text();
      const ok = response.ok;
      const base: Omit<StepResult, 'status' | 'type'> & { status: StepResult['status']; type: WorkflowStepType } = {
        stepId: step.id,
        type: step.type,
        status: ok ? 'success' : 'failure',
        output: { status: response.status, body: text },
        durationMs: Date.now() - started,
      };
      if (!ok) {
        return { ...base, error: `HTTP ${response.status}` };
      }
      return base;
    }
    throw new Error('Unsupported step type');
  } catch (error: any) {
    return {
      stepId: step.id,
      type: step.type,
      status: 'failure',
      error: error.message,
      durationMs: Date.now() - started,
    };
  }
}

export async function runWorkflow(id: string): Promise<RunResult> {
  const workflow = await getWorkflow(id);
  if (!workflow) throw new Error('Workflow not found');
  if (!workflow.active) throw new Error('Workflow is inactive');

  const startedAt = new Date().toISOString();
  const results: StepResult[] = [];

  for (const step of workflow.steps) {
    const result = await runStep(step);
    results.push(result);
    if (result.status === 'failure') {
      break; // stop on first failure
    }
  }

  const allSuccess = results.every(r => r.status === 'success');
  const status: RunResult['status'] = allSuccess ? 'success' : (results.some(r => r.status === 'success') ? 'partial' : 'failure');

  const runId = crypto.randomUUID();

  // update lastRunAt
  const workflows = await loadWorkflows();
  const index = workflows.findIndex(w => w.id === workflow.id);
  if (index !== -1) {
    workflows[index]!.lastRunAt = new Date().toISOString();
    await saveWorkflows(workflows);
  }
  const finishedAt = new Date().toISOString();

  const runResult: RunResult = {
    runId,
    workflowId: workflow.id,
    startedAt,
    finishedAt,
    status,
    steps: results,
  };

  await appendRunHistory(runResult);

  return runResult;
}

export async function getWorkflowHistory(id: string, limit = 20): Promise<RunResult[]> {
  const workflow = await getWorkflow(id);
  if (!workflow) {
    throw new Error('Workflow not found');
  }

  const runs = await loadWorkflowRuns();
  const list = runs[id] ?? [];
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.trunc(limit), MAX_HISTORY_PER_WORKFLOW) : 20;

  return list.slice(-safeLimit).reverse(); // most recent first
}
