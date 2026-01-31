"use client";

import { useEffect, useReducer, useRef, useCallback, useState } from "react";
import { X, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AgentStepper } from "./agent-stepper";
import { PipelineCanvas } from "./pipeline-canvas";
import { ValidationFeed } from "./validation-feed";
import { IterationProgress } from "./iteration-progress";
import { createAndRunPipeline } from "@/lib/api";
import type { LiveBuilderState, LiveBuilderEvent, PipelineSpec, AgentPhase, CreatePipelineResponse } from "@/lib/types";

interface LiveBuilderModalProps {
  isOpen: boolean;
  prompt: string;
  csvBase64: string;
  onComplete: (result: { runId: string; pipelineId: string; response: CreatePipelineResponse }) => void;
  onCancel: () => void;
}

type Action =
  | { type: "UPDATE"; payload: Partial<LiveBuilderState> }
  | { type: "SET_PREVIOUS_SPEC"; payload: PipelineSpec | null };

interface State extends LiveBuilderState {
  previousSpec: PipelineSpec | null;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "UPDATE":
      return {
        ...state,
        ...action.payload,
        previousSpec: action.payload.currentSpec !== undefined 
          ? state.currentSpec 
          : state.previousSpec,
      };
    case "SET_PREVIOUS_SPEC":
      return { ...state, previousSpec: action.payload };
    default:
      return state;
  }
}

function getInitialState(runId: string): State {
  return {
    runId,
    phase: "analyzing" as AgentPhase,
    currentIteration: 0,
    maxIterations: 3,
    currentSpec: null,
    validationErrors: [],
    isComplete: false,
    finalStatus: null,
    previousSpec: null,
  };
}

export function LiveBuilderModal({
  isOpen,
  prompt,
  csvBase64,
  onComplete,
  onCancel,
}: LiveBuilderModalProps) {
  const [state, dispatch] = useReducer(reducer, getInitialState("pending"));
  const [apiResponse, setApiResponse] = useState<CreatePipelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasStartedRef = useRef(false);

  // Simulate phase progression while API call is in progress
  const simulatePhases = useCallback(() => {
    const phases: { phase: AgentPhase; delay: number }[] = [
      { phase: "analyzing", delay: 0 },
      { phase: "generating", delay: 1500 },
      { phase: "validating", delay: 4000 },
      { phase: "executing", delay: 6000 },
      { phase: "evaluating", delay: 8000 },
    ];

    const timeouts: NodeJS.Timeout[] = [];

    phases.forEach(({ phase, delay }) => {
      const timeout = setTimeout(() => {
        dispatch({ type: "UPDATE", payload: { phase } });
      }, delay);
      timeouts.push(timeout);
    });

    return () => timeouts.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!isOpen || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const runPipeline = async () => {
      abortControllerRef.current = new AbortController();
      
      // Start phase simulation
      const cleanupPhases = simulatePhases();

      try {
        // Call the real API
        const response = await createAndRunPipeline({
          prompt,
          data: {
            format: "csv",
            content_base64: csvBase64,
          },
          options: {
            max_fix_iters: 3,
          },
        });

        setApiResponse(response);

        // Update state with real data
        dispatch({
          type: "UPDATE",
          payload: {
            runId: response.run_id,
            currentSpec: response.report.pipeline_spec,
            currentIteration: response.report.fix_iterations,
            phase: "complete",
            isComplete: true,
            finalStatus: "success",
            validationErrors: response.report.validation_errors.length > 0
              ? [{
                  iteration: response.report.fix_iterations,
                  errors: response.report.validation_errors,
                  timestamp: new Date().toISOString(),
                  fixed: true,
                }]
              : [],
          },
        });
      } catch (err) {
        console.error("Pipeline creation failed:", err);
        setError(err instanceof Error ? err.message : "Pipeline creation failed");
        dispatch({
          type: "UPDATE",
          payload: {
            phase: "failed",
            isComplete: true,
            finalStatus: "failed",
          },
        });
      } finally {
        cleanupPhases();
      }
    };

    runPipeline();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isOpen, prompt, csvBase64, simulatePhases]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      hasStartedRef.current = false;
      setApiResponse(null);
      setError(null);
      dispatch({ type: "UPDATE", payload: getInitialState("pending") });
    }
  }, [isOpen]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onCancel();
  };

  const handleViewResults = () => {
    if (apiResponse) {
      onComplete({
        runId: apiResponse.run_id,
        pipelineId: apiResponse.pipeline_id,
        response: apiResponse,
      });
    }
  };

  const isComplete = state.phase === "complete" || state.phase === "failed";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="!max-w-[1400px] !w-[95vw] h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-8 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-semibold">
              {isComplete ? (
                state.finalStatus === "success" ? (
                  <span className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                    Pipeline Built Successfully
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <XCircle className="h-6 w-6 text-destructive" />
                    Pipeline Build Failed
                  </span>
                )
              ) : (
                "Building Pipeline..."
              )}
            </DialogTitle>
            {!isComplete && (
              <Button variant="ghost" size="icon" onClick={handleCancel}>
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* Goal Summary */}
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm">
              <span className="font-medium">Goal: </span>
              <span className="text-muted-foreground">{prompt}</span>
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Progress Bar */}
          <IterationProgress
            currentIteration={state.currentIteration}
            maxIterations={state.maxIterations}
            phase={state.phase}
          />

          {/* Main Content */}
          <div className="grid gap-8 lg:grid-cols-[320px_1fr] min-h-[400px]">
            {/* Left Column - Agent Status & Validation */}
            <div className="space-y-6">
              <AgentStepper
                currentPhase={state.phase}
                currentIteration={state.currentIteration}
              />
              <ValidationFeed errors={state.validationErrors} />
            </div>

            {/* Right Column - Pipeline Canvas */}
            <div className="min-h-[400px]">
              <PipelineCanvas
                spec={state.currentSpec}
                previousSpec={state.previousSpec}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        {isComplete && (
          <div className="flex justify-end gap-3 px-8 py-4 border-t shrink-0 bg-background">
            {state.finalStatus === "failed" && (
              <Button variant="outline" onClick={handleCancel}>
                Close
              </Button>
            )}
            {state.finalStatus === "success" && apiResponse && (
              <Button size="lg" onClick={handleViewResults}>
                View Results
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
