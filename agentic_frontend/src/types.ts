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
  max_iterations: number;
  ponytail_mode?: boolean;
}

export interface GenerateResponse {
  draft_code: string;
  review_feedback: string;
  iterations: number;
  is_valid: boolean;
  logs: string[];
  ponytail_mode?: boolean;
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
