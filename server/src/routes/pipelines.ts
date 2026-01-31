import { Elysia } from "elysia";
import {
  listPipelines,
  getPipeline,
  getPipelineVersions,
  getRunsForPipeline,
  updatePipeline,
} from "../lib/db";
import type { PipelineListItem, PipelineDetailResponse } from "../lib/types";

export const pipelinesRoutes = new Elysia()
  // GET /pipelines - List all pipelines
  .get("/pipelines", async (): Promise<PipelineListItem[]> => {
    const pipelines = await listPipelines();

    return pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      created_at: p.created_at,
      latest_version: p.latest_version,
      last_run: p.last_run_id
        ? {
            run_id: p.last_run_id,
            status: p.last_run_status!,
            created_at: p.last_run_at!,
          }
        : null,
    }));
  })

  // GET /pipelines/:id - Get pipeline details with versions
  .get("/pipelines/:id", async ({ params }): Promise<PipelineDetailResponse> => {
    const { id } = params;

    const pipeline = await getPipeline(id);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${id}`);
    }

    const versions = await getPipelineVersions(id);

    return {
      pipeline_id: pipeline.id,
      name: pipeline.name,
      description: pipeline.description,
      created_at: pipeline.created_at,
      versions: versions.map((v) => ({
        pipeline_version_id: v.id,
        version: v.version,
        created_at: v.created_at,
        source_prompt: v.source_prompt,
        spec_json: v.spec_json,
      })),
    };
  })

  // GET /pipelines/:id/runs - Get all runs for a pipeline
  .get("/pipelines/:id/runs", async ({ params }) => {
    const { id } = params;

    const pipeline = await getPipeline(id);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${id}`);
    }

    const runs = await getRunsForPipeline(id);

    return runs.map((r) => ({
      id: r.id,
      pipeline_id: r.pipeline_id,
      pipeline_version_id: r.pipeline_version_id,
      status: r.status,
      input_rows: r.input_rows,
      output_rows: r.output_rows,
      fix_iterations: r.fix_iterations,
      eval_score: r.eval_json?.score ?? null,
      constraint_pass: r.eval_json?.constraint_pass ?? null,
      keywords_trace_id: r.keywords_trace_id,
      created_at: r.created_at,
      finished_at: r.finished_at,
    }));
  })

  // PATCH /pipelines/:id - Update pipeline name/description
  .patch("/pipelines/:id", async ({ params, body }) => {
    const { id } = params;
    const { name, description } = body as { name?: string; description?: string };

    const pipeline = await getPipeline(id);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${id}`);
    }

    const updates: { name?: string; description?: string } = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length === 0) {
      return { success: true, pipeline };
    }

    const updated = await updatePipeline(id, updates);
    return { success: true, pipeline: updated };
  });
