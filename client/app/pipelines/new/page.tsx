"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PipelineForm } from "@/components/pipelines/pipeline-form";
import { LiveBuilderModal } from "@/components/live-builder/live-builder-modal";
import type { ParsedCSV, CreatePipelineResponse } from "@/lib/types";

export default function NewPipelinePage() {
  const router = useRouter();
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildData, setBuildData] = useState<{
    prompt: string;
    csvContent: string;
    csvBase64: string;
    parsedData: ParsedCSV;
  } | null>(null);

  const handleSubmit = (data: { prompt: string; csvContent: string; parsedData: ParsedCSV }) => {
    // Convert CSV content to base64
    const csvBase64 = btoa(data.csvContent);
    setBuildData({
      ...data,
      csvBase64,
    });
    setIsBuilding(true);
  };

  const handleBuildComplete = (result: { runId: string; pipelineId: string; response: CreatePipelineResponse }) => {
    setIsBuilding(false);
    // Navigate to the run details page
    router.push(`/runs/${result.runId}`);
  };

  const handleBuildCancel = () => {
    setIsBuilding(false);
    setBuildData(null);
  };

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/pipelines">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pipelines
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create Pipeline</h1>
        <p className="text-muted-foreground">
          Upload your data and describe what you want to do with it
        </p>
      </div>

      <PipelineForm onSubmit={handleSubmit} isSubmitting={isBuilding} />

      {isBuilding && buildData && (
        <LiveBuilderModal
          isOpen={isBuilding}
          prompt={buildData.prompt}
          csvBase64={buildData.csvBase64}
          onComplete={handleBuildComplete}
          onCancel={handleBuildCancel}
        />
      )}
    </div>
  );
}
