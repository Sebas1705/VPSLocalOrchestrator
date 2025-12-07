import { executeCommand } from './commandExecutor.js';

export interface ContainerInfo {
  id: string;
  image: string;
  command: string;
  createdAt?: string;
  runningFor?: string;
  status: string;
  ports?: string;
  names: string;
}

export interface ImageInfo {
  id: string;
  repository: string;
  tag: string;
  createdSince?: string;
  size: string;
}

function parseLines<T>(stdout: string, mapper: (item: any) => T): T[] {
  const lines = stdout.split('\n').filter(Boolean);
  const result: T[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      result.push(mapper(parsed));
    } catch (error: any) {
      throw new Error(`Failed to parse docker output: ${error.message}`);
    }
  }

  return result;
}

function ensureOk(exitCode: number, stderr: string, stdout: string, fallback: string): void {
  if (exitCode !== 0) {
    const message = stderr || stdout || fallback;
    throw new Error(message);
  }
}

export async function listContainers(): Promise<ContainerInfo[]> {
  const result = await executeCommand('docker ps --format "{{json .}}"');
  ensureOk(result.exitCode, result.stderr, result.stdout, 'Failed to list containers');

  return parseLines(result.stdout, (item) => ({
    id: item.ID,
    image: item.Image,
    command: item.Command,
    createdAt: item.CreatedAt,
    runningFor: item.RunningFor,
    status: item.Status,
    ports: item.Ports || undefined,
    names: item.Names,
  }));
}

export async function listImages(): Promise<ImageInfo[]> {
  const result = await executeCommand('docker images --format "{{json .}}"');
  ensureOk(result.exitCode, result.stderr, result.stdout, 'Failed to list images');

  return parseLines(result.stdout, (item) => ({
    id: item.ID,
    repository: item.Repository,
    tag: item.Tag,
    createdSince: item.CreatedSince,
    size: item.Size,
  }));
}

async function runDockerAction(action: 'start' | 'stop', id: string): Promise<{ id: string; action: string; output: string; }>
{
  if (!id || typeof id !== 'string') {
    throw new Error('container id is required');
  }

  const cmd = `docker ${action} ${id}`;
  const result = await executeCommand(cmd);
  ensureOk(result.exitCode, result.stderr, result.stdout, `Failed to ${action} container`);

  return {
    id,
    action,
    output: result.stdout || `${action} executed`,
  };
}

export async function startContainer(id: string): Promise<{ id: string; action: string; output: string; }>
{
  return runDockerAction('start', id);
}

export async function stopContainer(id: string): Promise<{ id: string; action: string; output: string; }>
{
  return runDockerAction('stop', id);
}
