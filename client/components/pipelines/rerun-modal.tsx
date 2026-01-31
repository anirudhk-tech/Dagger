"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CSVUpload } from "@/components/shared/csv-upload";
import { DataPreview } from "@/components/shared/data-preview";
import { rerunPipeline } from "@/lib/api";
import type { ParsedCSV } from "@/lib/types";

interface RerunModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipelineId: string;
  pipelineVersionId: string;
  pipelineName: string;
}

export function RerunModal({
  isOpen,
  onClose,
  pipelineId,
  pipelineVersionId,
  pipelineName,
}: RerunModalProps) {
  const router = useRouter();
  const [csvContent, setCsvContent] = useState<string>("");
  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDataParsed = (parsed: ParsedCSV, content: string) => {
    setCsvContent(content);
    setParsedData(parsed);
    setError(null);
  };

  const handleClear = () => {
    setCsvContent("");
    setParsedData(null);
    setError(null);
  };

  const handleRun = async () => {
    if (!csvContent) return;

    setIsRunning(true);
    setError(null);

    try {
      const csvBase64 = btoa(csvContent);
      const result = await rerunPipeline(pipelineId, pipelineVersionId, {
        format: "csv",
        content_base64: csvBase64,
      });

      // Navigate to the new run
      router.push(`/runs/${result.run_id}`);
      onClose();
    } catch (err) {
      console.error("Rerun failed:", err);
      setError(err instanceof Error ? err.message : "Failed to run pipeline");
    } finally {
      setIsRunning(false);
    }
  };

  const handleClose = () => {
    if (!isRunning) {
      handleClear();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Run Pipeline Again
          </DialogTitle>
          <DialogDescription>
            Upload new data to run through &quot;{pipelineName}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* CSV Upload */}
          {!parsedData ? (
            <CSVUpload onDataParsed={handleDataParsed} />
          ) : (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {parsedData.rows.length.toLocaleString()} rows, {parsedData.headers.length} columns
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClear} disabled={isRunning}>
                  Change file
                </Button>
              </div>

              {/* Preview */}
              <div className="max-h-[300px] overflow-auto rounded-lg border">
                <DataPreview data={parsedData} maxRows={5} />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} disabled={isRunning}>
              Cancel
            </Button>
            <Button onClick={handleRun} disabled={!parsedData || isRunning}>
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Pipeline
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
