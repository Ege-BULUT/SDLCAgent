export interface HealthResponse {
  status: string;
  version: string;
  project_name: string;
  current_coder: string;
  current_reviewer: string;
  available_models: ModelInfo[];
}

export interface ModelInfo {
  name: string;
  type: string;
  size: string;
  role: string;
  description: string;
}

export interface RagIngestRequest {
  repo_path: string;
  languages: string[];
}

export interface RagIngestResponse {
  status: string;
  files_processed: number;
  chunks_created: number;
  logs?: string[];
}

export interface RepoItem {
  path: string;
  is_dir: boolean;
  blacklisted: boolean;
}

export interface DetectStructureResponse {
  repo_path: string;
  items: RepoItem[];
  patterns: string[];
}

export interface UpdateBlacklistRequest {
  repo_path: string;
  patterns: string[];
}

export interface UpdateBlacklistResponse {
  repo_path: string;
  patterns: string[];
  saved: boolean;
}

export interface RagStatsResponse {
  total_chunks: number;
  total_files: number;
  files: string[];
}

export interface GenerateRequest {
  task: string;
  language: string;
  coder_model?: string;
  reviewer_model?: string;
  judge_model?: string;
  max_iterations: number;
  ponytail_mode?: boolean;
  session_id?: string;
}

export interface GenerateResponse {
  draft_code: string;
  review_feedback: string;
  iterations: number;
  is_valid: boolean;
  logs: string[];
  ponytail_mode?: boolean;
  files?: Record<string, string>;
}

export interface WorkspaceFileTree {
  session_id: string;
  files: string[];
  file_count: number;
  has_backups: boolean;
  applied: boolean;
}

export interface WorkspaceFileContent {
  path: string;
  content: string;
}

export interface WorkspaceApplyResult {
  ok: boolean;
  applied: string[];
  errors: { file: string; error: string }[];
}

export interface WorkspaceRevertResult {
  ok: boolean;
  reverted: string[];
  errors: { file: string; error: string }[];
}

export interface WorkspaceCleanupResult {
  cleaned: number;
  skipped_active: number;
}

export interface LaunchResponse {
  url?: string | null;
  info?: string | null;
  launch_type: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

// ── SSE streaming events ──

export interface StreamEventNodeStart {
  type: 'node_start';
  node: 'coder' | 'reviewer';
  iteration: number;
}

export interface StreamEventJudgeStart {
  type: 'node_start';
  node: 'judge';
  iteration: number;
}

export interface StreamEventThoughtToken {
  type: 'thought_token';
  text: string;
  iteration: number;
}

export interface StreamEventCoderToken {
  type: 'coder_token';
  text: string;
  iteration: number;
}

export interface StreamEventReviewerToken {
  type: 'reviewer_token';
  text: string;
  iteration: number;
}

export interface StreamEventJudgeToken {
  type: 'judge_token';
  text: string;
  iteration: number;
}

export interface StreamEventNodeEnd {
  type: 'node_end';
  node: 'coder' | 'reviewer';
  iteration: number;
  // coder end fields:
  draft_code?: string;
  files?: Record<string, string>;
  file_list?: string[];
  // reviewer end fields:
  feedback?: string;
  is_valid?: boolean;
}

export interface StreamEventJudgeEnd {
  type: 'node_end';
  node: 'judge';
  iteration: number;
  evaluation?: string;
}

export interface StreamEventError {
  type: 'error';
  message: string;
  iteration?: number;
}

export interface StreamEventDone {
  type: 'done';
  iterations: number;
  is_valid: boolean;
  draft_code: string;
  review_feedback: string;
  judge_evaluation?: string | null;
  files: Record<string, string>;
}

export type StreamEvent =
  | StreamEventNodeStart
  | StreamEventJudgeStart
  | StreamEventThoughtToken
  | StreamEventCoderToken
  | StreamEventReviewerToken
  | StreamEventJudgeToken
  | StreamEventNodeEnd
  | StreamEventJudgeEnd
  | StreamEventError
  | StreamEventDone;
