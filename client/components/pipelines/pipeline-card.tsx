"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "@/lib/date-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Play, ChevronRight, MoreVertical, Pencil, Check, X } from "lucide-react";
import { updatePipeline } from "@/lib/api";
import type { Pipeline } from "@/lib/types";

interface PipelineCardProps {
  pipeline: Pipeline;
  onUpdate?: (updated: Pipeline) => void;
}

export function PipelineCard({ pipeline, onUpdate }: PipelineCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(pipeline.name);
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = () => {
    setEditName(pipeline.name);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditName(pipeline.name);
  };

  const saveChanges = async () => {
    if (!editName.trim()) return;
    
    setIsSaving(true);
    try {
      await updatePipeline(pipeline.id, { name: editName.trim() });
      onUpdate?.({ ...pipeline, name: editName.trim() });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update pipeline:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveChanges();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-7 text-sm font-semibold"
                  autoFocus
                />
                <Button 
                  size="icon" 
                  variant="ghost"
                  className="h-7 w-7" 
                  onClick={saveChanges}
                  disabled={!editName.trim() || isSaving}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost"
                  className="h-7 w-7" 
                  onClick={cancelEditing}
                  disabled={isSaving}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <CardTitle className="text-lg">
                <Link 
                  href={`/pipelines/${pipeline.id}`}
                  className="hover:underline"
                >
                  {pipeline.name}
                </Link>
              </CardTitle>
            )}
            <CardDescription className="line-clamp-2">
              {pipeline.description || "No description"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {pipeline.last_run_status && (
              <Badge 
                variant={pipeline.last_run_status === "success" ? "default" : "destructive"}
              >
                {pipeline.last_run_status}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={startEditing}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {pipeline.last_run_at ? (
              <span>Last run {formatDistanceToNow(pipeline.last_run_at)}</span>
            ) : (
              <span>Never run</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/pipelines/${pipeline.id}`}>
                <Play className="mr-1 h-3 w-3" />
                Run Again
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/pipelines/${pipeline.id}`}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
