"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileInput, 
  FileOutput, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  ExternalLink,
  Sparkles
} from "lucide-react";
import type { Run } from "@/lib/types";

interface RunSummaryProps {
  run: Run;
}

export function RunSummary({ run }: RunSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Status</CardTitle>
          {run.status === "success" ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
        </CardHeader>
        <CardContent>
          <Badge variant={run.status === "success" ? "default" : "destructive"} className="text-lg">
            {run.status}
          </Badge>
        </CardContent>
      </Card>

      {/* Input/Output Rows */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Rows</CardTitle>
          <div className="flex items-center gap-1">
            <FileInput className="h-4 w-4 text-muted-foreground" />
            <FileOutput className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {run.input_rows.toLocaleString()} → {run.output_rows.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">
            {run.input_rows - run.output_rows > 0 
              ? `${(run.input_rows - run.output_rows).toLocaleString()} rows removed`
              : "No rows removed"}
          </p>
        </CardContent>
      </Card>

      {/* Fix Iterations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fix Iterations</CardTitle>
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{run.fix_iterations}</div>
          <p className="text-xs text-muted-foreground">
            {run.fix_iterations === 0 
              ? "No fixes needed"
              : `${run.fix_iterations} validation ${run.fix_iterations === 1 ? "fix" : "fixes"}`}
          </p>
        </CardContent>
      </Card>

      {/* Eval Score - Powered by Keywords AI */}
      <Card className="relative overflow-hidden">
        <div className="absolute right-0 top-0 h-16 w-16 bg-gradient-to-bl from-violet-500/10 to-transparent" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
            <Sparkles className="h-3 w-3 text-violet-500" />
          </div>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {run.eval_score !== null ? `${(run.eval_score * 100).toFixed(0)}%` : "N/A"}
          </div>
          <p className="text-xs text-muted-foreground">
            {run.constraint_pass 
              ? "All constraints passed"
              : "Some constraints failed"}
          </p>
        </CardContent>
      </Card>

      {/* Keywords AI Attribution */}
      <Card className="border-violet-200 bg-gradient-to-br from-violet-50/50 to-white dark:border-violet-900 dark:from-violet-950/20 dark:to-background md:col-span-2 lg:col-span-4">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/50">
              <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Evaluation powered by Keywords AI</p>
              <p className="text-xs text-muted-foreground">
                LLM orchestration, observability, and reliability scoring
              </p>
            </div>
          </div>
          {run.keywords_trace_id && (
            <a 
              href={`https://platform.keywordsai.co/platform/traces/${run.keywords_trace_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md bg-violet-100 px-3 py-1.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-200 dark:bg-violet-900/50 dark:text-violet-300 dark:hover:bg-violet-900"
            >
              View Trace
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
