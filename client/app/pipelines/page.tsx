"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineCard } from "@/components/pipelines/pipeline-card";
import { getPipelines } from "@/lib/api";
import type { Pipeline } from "@/lib/types";

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPipelines().then((data) => {
      setPipelines(data);
      setLoading(false);
    });
  }, []);

  const handlePipelineUpdate = (updated: Pipeline) => {
    setPipelines((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
  };

  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipelines</h1>
          <p className="text-muted-foreground">
            Create and manage your data transformation pipelines
          </p>
        </div>
        <Button asChild>
          <Link href="/pipelines/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Pipeline
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-[140px] w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : pipelines.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <div className="text-center">
            <h3 className="text-lg font-semibold">No pipelines yet</h3>
            <p className="mb-4 text-muted-foreground">
              Create your first pipeline to get started
            </p>
            <Button asChild>
              <Link href="/pipelines/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Pipeline
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pipelines.map((pipeline) => (
            <PipelineCard 
              key={pipeline.id} 
              pipeline={pipeline} 
              onUpdate={handlePipelineUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
