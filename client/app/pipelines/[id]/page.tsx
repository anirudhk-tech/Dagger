"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, Download, ChevronRight, Code, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VersionList } from "@/components/pipelines/version-list";
import { RerunModal } from "@/components/pipelines/rerun-modal";
import { getPipeline, updatePipeline } from "@/lib/api";
import { formatDate, formatDistanceToNow } from "@/lib/date-utils";
import type { Pipeline, PipelineVersion, Run } from "@/lib/types";

export default function PipelineDetailPage() {
  const params = useParams();
  const pipelineId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [versions, setVersions] = useState<PipelineVersion[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [showSpec, setShowSpec] = useState(false);
  const [showRerunModal, setShowRerunModal] = useState(false);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getPipeline(pipelineId).then((data) => {
      if (data) {
        setPipeline(data.pipeline);
        setVersions(data.versions);
        setRuns(data.runs);
        if (data.versions.length > 0) {
          setSelectedVersionId(data.versions[0].id);
        }
      }
      setLoading(false);
    });
  }, [pipelineId]);

  const startEditing = () => {
    if (pipeline) {
      setEditName(pipeline.name);
      setEditDescription(pipeline.description);
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditName("");
    setEditDescription("");
  };

  const saveChanges = async () => {
    if (!pipeline || !editName.trim()) return;
    
    setIsSaving(true);
    try {
      await updatePipeline(pipelineId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setPipeline({
        ...pipeline,
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update pipeline:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);

  if (loading) {
    return (
      <div className="container py-8">
        <Skeleton className="mb-4 h-8 w-32" />
        <Skeleton className="mb-2 h-10 w-64" />
        <Skeleton className="mb-8 h-5 w-96" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="container py-8">
        <p>Pipeline not found</p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/pipelines">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pipelines
          </Link>
        </Button>
        
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-4">
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Pipeline name"
                  className="text-2xl font-bold h-auto py-1"
                />
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="min-h-[60px] resize-none"
                />
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    onClick={saveChanges}
                    disabled={!editName.trim() || isSaving}
                  >
                    <Check className="mr-1 h-4 w-4" />
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={cancelEditing}
                    disabled={isSaving}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="group">
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight">{pipeline.name}</h1>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={startEditing}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-muted-foreground">{pipeline.description || "No description"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Created {formatDate(pipeline.created_at)}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {versions.length > 0 && (
              <VersionList
                versions={versions}
                selectedVersionId={selectedVersionId}
                onVersionSelect={setSelectedVersionId}
              />
            )}
            <Button onClick={() => setShowRerunModal(true)} disabled={!selectedVersionId}>
              <Play className="mr-2 h-4 w-4" />
              Run Again
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Pipeline Spec (Collapsible) */}
      {selectedVersion && (
        <Card className="mb-8">
          <CardHeader 
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => setShowSpec(!showSpec)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                <CardTitle className="text-base">Pipeline Spec</CardTitle>
                <Badge variant="secondary">Advanced</Badge>
              </div>
              <ChevronRight className={`h-4 w-4 transition-transform ${showSpec ? "rotate-90" : ""}`} />
            </div>
          </CardHeader>
          {showSpec && (
            <CardContent>
              <pre className="overflow-auto rounded-lg bg-muted p-4 text-sm">
                {JSON.stringify(selectedVersion.spec, null, 2)}
              </pre>
            </CardContent>
          )}
        </Card>
      )}

      {/* Run History */}
      <Card>
        <CardHeader>
          <CardTitle>Run History</CardTitle>
          <CardDescription>
            Past runs of this pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No runs yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Input Rows</TableHead>
                  <TableHead>Output Rows</TableHead>
                  <TableHead>Fix Iterations</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-mono text-sm">
                      {run.id.slice(0, 12)}...
                    </TableCell>
                    <TableCell>
                      <Badge variant={run.status === "success" ? "default" : "destructive"}>
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{run.input_rows.toLocaleString()}</TableCell>
                    <TableCell>{run.output_rows.toLocaleString()}</TableCell>
                    <TableCell>{run.fix_iterations}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(run.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/runs/${run.id}`}>
                          View
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rerun Modal */}
      {selectedVersionId && (
        <RerunModal
          isOpen={showRerunModal}
          onClose={() => setShowRerunModal(false)}
          pipelineId={pipelineId}
          pipelineVersionId={selectedVersionId}
          pipelineName={pipeline.name}
        />
      )}
    </div>
  );
}
