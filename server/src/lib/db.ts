import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  DbPipeline,
  DbPipelineVersion,
  DbRun,
  PipelineSpec,
  RunStatus,
  RunMetrics,
  RunEval,
} from "./types";

// Singleton Supabase client
let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
      );
    }

    supabaseClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseClient;
}

// ============================================
// Pipeline Operations
// ============================================

export async function createPipeline(
  name: string,
  description?: string
): Promise<DbPipeline> {
  const { data, error } = await getSupabase()
    .from("pipelines")
    .insert({ name, description })
    .select()
    .single();

  if (error) throw new Error(`Failed to create pipeline: ${error.message}`);
  return data;
}

export async function getPipeline(id: string): Promise<DbPipeline | null> {
  const { data, error } = await getSupabase()
    .from("pipelines")
    .select()
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get pipeline: ${error.message}`);
  }
  return data;
}

export async function updatePipeline(
  id: string,
  updates: { name?: string; description?: string }
): Promise<DbPipeline> {
  const { data, error } = await getSupabase()
    .from("pipelines")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update pipeline: ${error.message}`);
  return data;
}

export async function listPipelines(): Promise<
  Array<{
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    latest_version: number | null;
    last_run_id: string | null;
    last_run_status: RunStatus | null;
    last_run_at: string | null;
  }>
> {
  const { data, error } = await getSupabase()
    .from("pipeline_list")
    .select("*");

  if (error) throw new Error(`Failed to list pipelines: ${error.message}`);
  return data || [];
}

// ============================================
// Pipeline Version Operations
// ============================================

export async function createPipelineVersion(
  pipelineId: string,
  sourcePrompt: string,
  specJson?: PipelineSpec | null
): Promise<DbPipelineVersion> {
  // Get the next version number
  const { data: maxVersion } = await getSupabase()
    .from("pipeline_versions")
    .select("version")
    .eq("pipeline_id", pipelineId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (maxVersion?.version || 0) + 1;

  const { data, error } = await getSupabase()
    .from("pipeline_versions")
    .insert({
      pipeline_id: pipelineId,
      version: nextVersion,
      source_prompt: sourcePrompt,
      spec_json: specJson,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create pipeline version: ${error.message}`);
  return data;
}

export async function updatePipelineVersionSpec(
  versionId: string,
  specJson: PipelineSpec
): Promise<void> {
  const { error } = await getSupabase()
    .from("pipeline_versions")
    .update({ spec_json: specJson })
    .eq("id", versionId);

  if (error) throw new Error(`Failed to update pipeline version: ${error.message}`);
}

export async function getPipelineVersion(
  id: string
): Promise<DbPipelineVersion | null> {
  const { data, error } = await getSupabase()
    .from("pipeline_versions")
    .select()
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get pipeline version: ${error.message}`);
  }
  return data;
}

export async function getPipelineVersions(
  pipelineId: string
): Promise<DbPipelineVersion[]> {
  const { data, error } = await getSupabase()
    .from("pipeline_versions")
    .select()
    .eq("pipeline_id", pipelineId)
    .order("version", { ascending: false });

  if (error) throw new Error(`Failed to get pipeline versions: ${error.message}`);
  return data || [];
}

// ============================================
// Run Operations
// ============================================

export async function createRun(
  pipelineId: string,
  pipelineVersionId: string,
  inputFormat: string = "csv",
  inputBytes?: number,
  inputHash?: string
): Promise<DbRun> {
  const { data, error } = await getSupabase()
    .from("runs")
    .insert({
      pipeline_id: pipelineId,
      pipeline_version_id: pipelineVersionId,
      status: "pending",
      input_format: inputFormat,
      input_bytes: inputBytes,
      input_hash: inputHash,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create run: ${error.message}`);
  return data;
}

export async function updateRunStatus(
  runId: string,
  status: RunStatus
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === "success" || status === "failed") {
    updates.finished_at = new Date().toISOString();
  }

  const { error } = await getSupabase()
    .from("runs")
    .update(updates)
    .eq("id", runId);

  if (error) throw new Error(`Failed to update run status: ${error.message}`);
}

export async function updateRunResults(
  runId: string,
  results: {
    status: RunStatus;
    input_rows?: number;
    output_rows?: number;
    output_base64?: string;
    fix_iterations?: number;
    exec_time_ms?: number;
    metrics_json?: RunMetrics;
    eval_json?: RunEval;
    validation_errors_json?: string[];
    keywords_trace_id?: string;
  }
): Promise<void> {
  const updates: Record<string, unknown> = { ...results };
  if (results.status === "success" || results.status === "failed") {
    updates.finished_at = new Date().toISOString();
  }

  const { error } = await getSupabase()
    .from("runs")
    .update(updates)
    .eq("id", runId);

  if (error) throw new Error(`Failed to update run results: ${error.message}`);
}

export async function getRun(id: string): Promise<DbRun | null> {
  const { data, error } = await getSupabase()
    .from("runs")
    .select()
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get run: ${error.message}`);
  }
  return data;
}

export async function getRunsForPipeline(pipelineId: string): Promise<DbRun[]> {
  const { data, error } = await getSupabase()
    .from("runs")
    .select()
    .eq("pipeline_id", pipelineId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to get runs: ${error.message}`);
  return data || [];
}

// ============================================
// Artifact Operations
// ============================================

export interface DbArtifact {
  id: string;
  run_id: string | null;
  kind: "output" | "export" | "log" | "other";
  storage_path: string | null;
  content_type: string | null;
  size_bytes: number | null;
  expires_at: string | null;
  created_at: string;
}

export async function createArtifact(artifact: {
  run_id: string;
  kind: "output" | "export" | "log" | "other";
  storage_path: string;
  content_type?: string;
  size_bytes?: number;
  expires_at?: string;
}): Promise<DbArtifact> {
  const { data, error } = await getSupabase()
    .from("artifacts")
    .insert(artifact)
    .select()
    .single();

  if (error) throw new Error(`Failed to create artifact: ${error.message}`);
  return data;
}

export async function getArtifact(id: string): Promise<DbArtifact | null> {
  const { data, error } = await getSupabase()
    .from("artifacts")
    .select()
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to get artifact: ${error.message}`);
  }
  return data;
}

export async function getExpiredArtifacts(): Promise<DbArtifact[]> {
  const { data, error } = await getSupabase()
    .from("artifacts")
    .select()
    .lt("expires_at", new Date().toISOString())
    .not("storage_path", "is", null);

  if (error) throw new Error(`Failed to get expired artifacts: ${error.message}`);
  return data || [];
}

export async function deleteArtifact(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("artifacts")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Failed to delete artifact: ${error.message}`);
}

export async function deleteExpiredArtifacts(): Promise<number> {
  const { data, error } = await getSupabase()
    .from("artifacts")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) throw new Error(`Failed to delete expired artifacts: ${error.message}`);
  return data?.length || 0;
}
