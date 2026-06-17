import type {
  HealthResponse,
  ModelInfo,
  RagIngestRequest,
  RagIngestResponse,
  RagStatsResponse,
  DetectStructureResponse,
  UpdateBlacklistRequest,
  UpdateBlacklistResponse,
  GenerateRequest,
  GenerateResponse,
  StreamEvent,
  LaunchResponse,
  WorkspaceFileTree,
  WorkspaceFileContent,
  WorkspaceApplyResult,
  WorkspaceRevertResult,
  WorkspaceCleanupResult,
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

export function generateCodeStream(
  req: GenerateRequest,
  onEvent: (event: StreamEvent) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE}/api/v1/agent/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error');
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          for (const line of part.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const event = JSON.parse(trimmed.slice(6)) as StreamEvent;
                if (import.meta.env.DEV) {
                  // eslint-disable-next-line no-console
                  console.log('[SSE]', event.type, event);
                }
                onEvent(event);
              } catch {
                // skip malformed JSON
              }
              break;
            }
          }
        }
      }
      onDone();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        onError(err);
      }
    }
  })();

  return controller;
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

export async function detectRepoLanguages(repo_path: string): Promise<string[]> {
  const data = await request<{ languages: string[] }>(
    `/api/v1/rag/detect-languages?repo_path=${encodeURIComponent(repo_path)}`,
    { method: 'POST' },
  );
  return data.languages;
}

export async function detectRepoStructure(repo_path: string): Promise<DetectStructureResponse> {
  return request<DetectStructureResponse>('/api/v1/rag/detect-structure', {
    method: 'POST',
    body: JSON.stringify({ repo_path }),
  });
}

export async function updateBlacklist(req: UpdateBlacklistRequest): Promise<UpdateBlacklistResponse> {
  return request<UpdateBlacklistResponse>('/api/v1/rag/blacklist', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function launchProject(repo_path: string): Promise<LaunchResponse> {
  return request<LaunchResponse>('/api/v1/launch', {
    method: 'POST',
    body: JSON.stringify({ repo_path }),
  });
}

// ── Workspace (multi-file preview / apply / revert) ──────────────

export async function workspaceInit(): Promise<{ session_id: string }> {
  return request<{ session_id: string }>('/api/v1/workspace/init', { method: 'POST' });
}

export async function workspaceHeartbeat(session_id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/v1/workspace/heartbeat?session_id=${encodeURIComponent(session_id)}`, { method: 'POST' });
}

export async function workspaceSetFiles(session_id: string, files: Record<string, string>): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/v1/workspace/set-files', {
    method: 'POST',
    body: JSON.stringify({ session_id, files }),
  });
}

export async function workspaceGetFiles(session_id: string): Promise<WorkspaceFileTree> {
  return request<WorkspaceFileTree>(`/api/v1/workspace/files?session_id=${encodeURIComponent(session_id)}`);
}

export async function workspaceGetFile(session_id: string, path: string): Promise<WorkspaceFileContent> {
  return request<WorkspaceFileContent>(`/api/v1/workspace/file?session_id=${encodeURIComponent(session_id)}&path=${encodeURIComponent(path)}`);
}

export async function workspaceApply(session_id: string, base_dir?: string): Promise<WorkspaceApplyResult> {
  return request<WorkspaceApplyResult>('/api/v1/workspace/apply', {
    method: 'POST',
    body: JSON.stringify({ session_id, base_dir }),
  });
}

export async function workspaceRevert(session_id: string, base_dir?: string): Promise<WorkspaceRevertResult> {
  return request<WorkspaceRevertResult>('/api/v1/workspace/revert', {
    method: 'POST',
    body: JSON.stringify({ session_id, base_dir }),
  });
}

export async function workspaceCleanup(): Promise<WorkspaceCleanupResult> {
  return request<WorkspaceCleanupResult>('/api/v1/workspace/cleanup', { method: 'POST' });
}
