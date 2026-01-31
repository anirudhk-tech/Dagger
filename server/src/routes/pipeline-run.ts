import { Elysia, t } from "elysia";
import {
  getPipelineVersion,
  createRun,
  updateRunStatus,
  updateRunResults,
} from "../lib/db";
import { base64Decode, parseCSV, serializeCSV, base64Encode, getCSVHash } from "../lib/csv";
import { validatePipeline, runPipeline } from "../../engine_wasm/bindings";
import { computeMetrics, evaluateRun } from "../lib/eval";
import type { RerunPipelineRequest, RerunPipelineResponse } from "../lib/types";

const MAX_INPUT_BYTES = parseInt(process.env.MAX_INPUT_BYTES || "10000000", 10); // 10MB default

export const pipelineRunRoutes = new Elysia()
  // POST /pipelines/:id/run - Re-run a saved version on new data
  .post(
    "/pipelines/:id/run",
    async ({ params, body }): Promise<RerunPipelineResponse> => {
      const startTime = Date.now();
      const { id: pipelineId } = params;
      const { pipeline_version_id, data } = body as RerunPipelineRequest;

      // 1. Load the pipeline version
      const version = await getPipelineVersion(pipeline_version_id);
      if (!version) {
        throw new Error(`Pipeline version not found: ${pipeline_version_id}`);
      }

      if (version.pipeline_id !== pipelineId) {
        throw new Error(`Version ${pipeline_version_id} does not belong to pipeline ${pipelineId}`);
      }

      if (!version.spec_json) {
        throw new Error(`Pipeline version ${pipeline_version_id} has no spec`);
      }

      // 2. Parse and validate input
      const csvContent = base64Decode(data.content_base64);
      const inputBytes = Buffer.byteLength(csvContent, "utf-8");

      if (inputBytes > MAX_INPUT_BYTES) {
        throw new Error(`Input too large: ${inputBytes} bytes (max: ${MAX_INPUT_BYTES})`);
      }

      const inputCSV = parseCSV(csvContent);
      if (inputCSV.headers.length === 0) {
        throw new Error("Invalid CSV: no headers found");
      }

      const inputHash = getCSVHash(csvContent);

      // 3. Create run record
      const run = await createRun(
        pipelineId,
        pipeline_version_id,
        "csv",
        inputBytes,
        inputHash
      );

      try {
        // 4. Validate spec (fast check)
        await updateRunStatus(run.id, "validating");
        const validation = validatePipeline(version.spec_json);

        if (!validation.valid) {
          await updateRunResults(run.id, {
            status: "failed",
            input_rows: inputCSV.rows.length,
            validation_errors_json: validation.errors,
          });

          throw new Error(`Stored spec invalid: ${validation.errors.join(", ")}`);
        }

        // 5. Execute pipeline
        await updateRunStatus(run.id, "running");
        const outputCSV = runPipeline(version.spec_json, inputCSV);

        // 6. Compute metrics and evaluation
        const execTimeMs = Date.now() - startTime;
        const metrics = computeMetrics(inputCSV, outputCSV, execTimeMs);
        const evalResult = evaluateRun(version.spec_json, inputCSV, outputCSV, []);

        // 7. Serialize output
        const outputContent = serializeCSV(outputCSV);
        const outputBase64 = base64Encode(outputContent);

        // 8. Persist results
        await updateRunResults(run.id, {
          status: "success",
          input_rows: inputCSV.rows.length,
          output_rows: outputCSV.rows.length,
          output_base64: outputBase64,
          fix_iterations: 0,
          exec_time_ms: execTimeMs,
          metrics_json: metrics,
          eval_json: evalResult,
          validation_errors_json: [],
        });

        // 9. Return response
        return {
          run_id: run.id,
          output: {
            format: "csv",
            content_base64: outputBase64,
          },
          report: {
            metrics: {
              input_rows: metrics.input_rows,
              output_rows: metrics.output_rows,
            },
            eval: {
              constraint_pass: evalResult.constraint_pass,
              score: evalResult.score,
            },
          },
        };
      } catch (error) {
        await updateRunResults(run.id, {
          status: "failed",
          input_rows: inputCSV.rows.length,
          validation_errors_json: [(error as Error).message],
        });

        throw error;
      }
    },
    {
      body: t.Object({
        pipeline_version_id: t.String(),
        data: t.Object({
          format: t.Literal("csv"),
          content_base64: t.String(),
        }),
        options: t.Optional(
          t.Object({
            output_format: t.Optional(t.Literal("csv")),
          })
        ),
      }),
    }
  );
