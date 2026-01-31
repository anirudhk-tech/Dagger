import type { 
  Pipeline, 
  PipelineVersion, 
  Run, 
  CreatePipelineRequest, 
  CreatePipelineResponse,
} from "./types";

// API Base URL - defaults to local server
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ============================================
// Helper Functions
// ============================================

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}

// ============================================
// Pipeline API
// ============================================

interface PipelineListItem {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  latest_version: number | null;
  last_run: {
    run_id: string;
    status: string;
    created_at: string;
  } | null;
}

export async function getPipelines(): Promise<Pipeline[]> {
  const data = await fetchAPI<PipelineListItem[]>("/pipelines");
  
  // Transform to client Pipeline format
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description || "",
    created_at: p.created_at,
    last_run_at: p.last_run?.created_at || null,
    last_run_status: p.last_run?.status === "success" ? "success" 
      : p.last_run?.status === "failed" ? "failed" 
      : null,
  }));
}

interface PipelineDetailResponse {
  pipeline_id: string;
  name: string;
  description: string | null;
  created_at: string;
  versions: {
    pipeline_version_id: string;
    version: number;
    created_at: string;
    source_prompt: string;
    spec_json: { nodes: Array<{ id: string; op: string; config: Record<string, unknown>; inputs?: string[] }> } | null;
  }[];
}

interface RunListItem {
  id: string;
  pipeline_id: string;
  pipeline_version_id: string;
  status: string;
  input_rows: number | null;
  output_rows: number | null;
  fix_iterations: number;
  eval_score: number | null;
  constraint_pass: boolean | null;
  keywords_trace_id: string | null;
  created_at: string;
  finished_at: string | null;
}

export async function getPipeline(id: string): Promise<{ pipeline: Pipeline; versions: PipelineVersion[]; runs: Run[] } | null> {
  try {
    // Fetch pipeline details and runs in parallel
    const [detail, runs] = await Promise.all([
      fetchAPI<PipelineDetailResponse>(`/pipelines/${id}`),
      fetchAPI<RunListItem[]>(`/pipelines/${id}/runs`),
    ]);

    const pipeline: Pipeline = {
      id: detail.pipeline_id,
      name: detail.name,
      description: detail.description || "",
      created_at: detail.created_at,
      last_run_at: runs[0]?.created_at || null,
      last_run_status: runs[0]?.status === "success" ? "success"
        : runs[0]?.status === "failed" ? "failed"
        : null,
    };

    const versions: PipelineVersion[] = detail.versions.map((v) => ({
      id: v.pipeline_version_id,
      pipeline_id: detail.pipeline_id,
      version: v.version,
      spec: v.spec_json || { nodes: [] },
      created_at: v.created_at,
    }));

    const formattedRuns: Run[] = runs.map((r) => ({
      id: r.id,
      pipeline_id: r.pipeline_id,
      pipeline_version_id: r.pipeline_version_id,
      status: r.status as Run["status"],
      input_rows: r.input_rows || 0,
      output_rows: r.output_rows || 0,
      fix_iterations: r.fix_iterations,
      eval_score: r.eval_score,
      constraint_pass: r.constraint_pass,
      keywords_trace_id: r.keywords_trace_id,
      created_at: r.created_at,
      output_base64: null, // Not included in list response
    }));

    return { pipeline, versions, runs: formattedRuns };
  } catch (error) {
    console.error("Failed to fetch pipeline:", error);
    return null;
  }
}

// ============================================
// Run API
// ============================================

interface RunDetailResponse {
  id: string;
  pipeline_id: string;
  pipeline_version_id: string;
  status: string;
  input_rows: number | null;
  output_rows: number | null;
  fix_iterations: number;
  eval_score: number | null;
  constraint_pass: boolean | null;
  keywords_trace_id: string | null;
  created_at: string;
  finished_at: string | null;
  output_base64: string | null;
  validation_errors: string[] | null;
  metrics: { input_rows: number; output_rows: number; null_rate?: number; exec_time_ms: number } | null;
}

export async function getRun(id: string): Promise<Run | null> {
  try {
    const data = await fetchAPI<RunDetailResponse>(`/runs/${id}`);
    
    return {
      id: data.id,
      pipeline_id: data.pipeline_id,
      pipeline_version_id: data.pipeline_version_id,
      status: data.status as Run["status"],
      input_rows: data.input_rows || 0,
      output_rows: data.output_rows || 0,
      fix_iterations: data.fix_iterations,
      eval_score: data.eval_score,
      constraint_pass: data.constraint_pass,
      keywords_trace_id: data.keywords_trace_id,
      created_at: data.created_at,
      output_base64: data.output_base64,
    };
  } catch (error) {
    console.error("Failed to fetch run:", error);
    return null;
  }
}

// ============================================
// Create & Run Pipeline
// ============================================

export async function createAndRunPipeline(
  request: CreatePipelineRequest
): Promise<CreatePipelineResponse> {
  return fetchAPI<CreatePipelineResponse>("/run", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// ============================================
// Re-run Pipeline
// ============================================

interface RerunResponse {
  run_id: string;
  output: {
    format: "csv";
    content_base64: string;
  };
  report: {
    metrics: {
      input_rows: number;
      output_rows: number;
    };
    eval: {
      constraint_pass: boolean;
      score: number;
    };
  };
}

export async function rerunPipeline(
  pipelineId: string,
  pipelineVersionId: string,
  data: { format: "csv"; content_base64: string }
): Promise<RerunResponse> {
  return fetchAPI<RerunResponse>(`/pipelines/${pipelineId}/run`, {
    method: "POST",
    body: JSON.stringify({
      pipeline_version_id: pipelineVersionId,
      data,
    }),
  });
}

// ============================================
// Export Docker
// ============================================

export async function exportDocker(pipelineVersionId: string): Promise<{ download_url: string }> {
  return fetchAPI<{ download_url: string }>("/export/docker", {
    method: "POST",
    body: JSON.stringify({
      pipeline_version_id: pipelineVersionId,
    }),
  });
}

// ============================================
// Download API
// ============================================

interface DownloadResponse {
  download_url: string;
  expires_at: string;
  filename: string;
}

/**
 * Get a temporary download URL for run output.
 * The URL expires after 3 minutes.
 */
export async function getDownloadUrl(runId: string): Promise<DownloadResponse> {
  return fetchAPI<DownloadResponse>(`/runs/${runId}/download`, {
    method: "POST",
  });
}

/**
 * Check if download is available for a run
 */
export async function checkDownloadStatus(runId: string): Promise<{ available: boolean; reason?: string }> {
  return fetchAPI<{ available: boolean; reason?: string }>(`/download/status/${runId}`);
}
