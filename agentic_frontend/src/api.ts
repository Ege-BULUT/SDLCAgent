import type {
  HealthResponse,
  ModelInfo,
  RagIngestRequest,
  RagIngestResponse,
  RagStatsResponse,
  GenerateRequest,
  GenerateResponse,
  LaunchResponse,
} from './types';

const BASE = import.meta.env.VITE_BACKEND_URL || '';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (options?.headers) {
    const incoming = new Headers(options.headers);
    incoming.forEach((v, k) => headers.set(k, v));
  }
  const res = await fetch(`${BASE}${url}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

export async function getModels(): Promise<ModelInfo[]> {
  const data = await request<{ available_models: ModelInfo[] }>('/api/v1/models');
  return data.available_models || [];
}

export async function generateCode(req: GenerateRequest): Promise<GenerateResponse> {
  return request<GenerateResponse>('/api/v1/agent/generate', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function ingestRepo(req: RagIngestRequest): Promise<RagIngestResponse> {
  return request<RagIngestResponse>('/api/v1/rag/ingest', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function getRagStats(): Promise<RagStatsResponse> {
  return request<RagStatsResponse>('/api/v1/rag/stats');
}

export async function clearRag(): Promise<void> {
  await request<void>('/api/v1/rag/clear', { method: 'POST' });
}

export async function launchProject(repo_path: string): Promise<LaunchResponse> {
  return request<LaunchResponse>('/api/v1/launch', {
    method: 'POST',
    body: JSON.stringify({ repo_path }),
  });
}
