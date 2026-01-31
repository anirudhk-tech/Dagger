import { Elysia, t } from "elysia";
import {
  createPipeline,
  createPipelineVersion,
  createRun,
  updatePipelineVersionSpec,
  updateRunResults,
  updateRunStatus,
} from "../lib/db";
import { generatePipelineSpec, repairPipelineSpec } from "../lib/keywords";
import { base64Decode, parseCSV, serializeCSV, base64Encode, getCSVHash } from "../lib/csv";
import { validatePipeline, runPipeline } from "../../engine_wasm/bindings";
import { computeMetrics, evaluateRun } from "../lib/eval";
import type { CreatePipelineRequest, CreatePipelineResponse, PipelineSpec } from "../lib/types";

const MAX_INPUT_BYTES = parseInt(process.env.MAX_INPUT_BYTES || "10000000", 10); // 10MB default
const MAX_FIX_ITERS_DEFAULT = parseInt(process.env.MAX_FIX_ITERS_DEFAULT || "3", 10);

export const runRoutes = new Elysia().post(
  "/run",
  async ({ body }): Promise<CreatePipelineResponse> => {
    const startTime = Date.now();

    // 1. Parse and validate input
    const { prompt, data, options } = body as CreatePipelineRequest;

    // Decode base64 input
    const csvContent = base64Decode(data.content_base64);
    const inputBytes = Buffer.byteLength(csvContent, "utf-8");

    // Check size limit
    if (inputBytes > MAX_INPUT_BYTES) {
      throw new Error(`Input too large: ${inputBytes} bytes (max: ${MAX_INPUT_BYTES})`);
    }

    // Parse CSV
    const inputCSV = parseCSV(csvContent);
    if (inputCSV.headers.length === 0) {
      throw new Error("Invalid CSV: no headers found");
    }

    const inputHash = getCSVHash(csvContent);
    const maxFixIters = options?.max_fix_iters ?? MAX_FIX_ITERS_DEFAULT;

    // 2. Create database records
    // Generate pipeline name from first 6 words of prompt
    const pipelineName = prompt.split(/\s+/).slice(0, 6).join(" ");

    const pipeline = await createPipeline(pipelineName, prompt);
    const pipelineVersion = await createPipelineVersion(pipeline.id, prompt, null);
    const run = await createRun(
      pipeline.id,
      pipelineVersion.id,
      "csv",
      inputBytes,
      inputHash
    );

    // Update run status to validating
    await updateRunStatus(run.id, "validating");

    let currentSpec: PipelineSpec | null = null;
    let validationErrors: string[] = [];
    let fixIterations = 0;
    let traceId = "";

    try {
      // 3. Generate initial spec via Keywords AI
      const generateResult = await generatePipelineSpec(
        prompt,
        inputCSV,
        {
          run_id: run.id,
          pipeline_id: pipeline.id,
          pipeline_version_id: pipelineVersion.id,
          stage: "spec_generate",
          iteration: 0,
        }
      );

      currentSpec = generateResult.spec;
      traceId = generateResult.traceId;

      // 4. Validation and repair loop
      for (let i = 0; i <= maxFixIters; i++) {
        const validation = validatePipeline(currentSpec);

        if (validation.valid) {
          validationErrors = [];
          break;
        }

        validationErrors = validation.errors;

        if (i < maxFixIters) {
          // Attempt repair
          fixIterations++;
          const repairResult = await repairPipelineSpec(
            currentSpec,
            validationErrors,
            {
              run_id: run.id,
              pipeline_id: pipeline.id,
              pipeline_version_id: pipelineVersion.id,
              stage: "spec_repair",
              iteration: i + 1,
            }
          );

          currentSpec = repairResult.spec;
          traceId = repairResult.traceId;
        }
      }

      // If still invalid after all iterations, throw
      if (validationErrors.length > 0) {
        await updateRunResults(run.id, {
          status: "failed",
          input_rows: inputCSV.rows.length,
          fix_iterations: fixIterations,
          validation_errors_json: validationErrors,
          keywords_trace_id: traceId,
        });

        throw new Error(`Pipeline validation failed after ${fixIterations} repair attempts: ${validationErrors.join(", ")}`);
      }

      // 5. Update pipeline version with final spec
      await updatePipelineVersionSpec(pipelineVersion.id, currentSpec);

      // 6. Execute pipeline
      await updateRunStatus(run.id, "running");

      const outputCSV = runPipeline(currentSpec, inputCSV);

      // 7. Compute metrics and evaluation
      const execTimeMs = Date.now() - startTime;
      const metrics = computeMetrics(inputCSV, outputCSV, execTimeMs);
      const evalResult = evaluateRun(currentSpec, inputCSV, outputCSV, validationErrors);

      // 8. Serialize output
      const outputContent = serializeCSV(outputCSV);
      const outputBase64 = base64Encode(outputContent);

      // 9. Persist results
      await updateRunResults(run.id, {
        status: "success",
        input_rows: inputCSV.rows.length,
        output_rows: outputCSV.rows.length,
        output_base64: outputBase64,
        fix_iterations: fixIterations,
        exec_time_ms: execTimeMs,
        metrics_json: metrics,
        eval_json: evalResult,
        validation_errors_json: validationErrors,
        keywords_trace_id: traceId,
      });

      // 10. Return response
      return {
        pipeline_id: pipeline.id,
        pipeline_version_id: pipelineVersion.id,
        run_id: run.id,
        output: {
          format: "csv",
          content_base64: outputBase64,
        },
        report: {
          pipeline_spec: currentSpec,
          validation_errors: validationErrors,
          fix_iterations: fixIterations,
          metrics: {
            input_rows: metrics.input_rows,
            output_rows: metrics.output_rows,
          },
          eval: {
            constraint_pass: evalResult.constraint_pass,
            score: evalResult.score,
          },
          keywords_trace_id: traceId,
        },
      };
    } catch (error) {
      // Update run as failed
      await updateRunResults(run.id, {
        status: "failed",
        input_rows: inputCSV.rows.length,
        fix_iterations: fixIterations,
        validation_errors_json: validationErrors.length > 0 ? validationErrors : [(error as Error).message],
        keywords_trace_id: traceId,
      });

      throw error;
    }
  },
  {
    body: t.Object({
      prompt: t.String(),
      data: t.Object({
        format: t.Literal("csv"),
        content_base64: t.String(),
      }),
      options: t.Optional(
        t.Object({
          output_format: t.Optional(t.Literal("csv")),
          max_fix_iters: t.Optional(t.Number()),
          strict: t.Optional(t.Boolean()),
        })
      ),
    }),
  }
);
