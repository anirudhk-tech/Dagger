"use client";

import { useState } from "react";
import { Download, Loader2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataPreview } from "@/components/shared/data-preview";
import { getDownloadUrl } from "@/lib/api";
import type { ParsedCSV } from "@/lib/types";

interface OutputPreviewProps {
  runId: string;
  outputBase64: string | null;
}

function parseCSVFromBase64(base64: string): ParsedCSV {
  try {
    const csvContent = atob(base64);
    const lines = csvContent.trim().split(/\r?\n/);

    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = parseCSVLine(lines[0]);
    const rows: string[][] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        rows.push(parseCSVLine(line));
      }
    }

    return { headers, rows };
  } catch {
    return { headers: [], rows: [] };
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  result.push(current.trim());
  return result;
}

export function OutputPreview({ runId, outputBase64 }: OutputPreviewProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [expiryInfo, setExpiryInfo] = useState<string | null>(null);

  const data = outputBase64
    ? parseCSVFromBase64(outputBase64)
    : { headers: [], rows: [] };

  const hasData = data.headers.length > 0;

  const handleDownload = async () => {
    if (!hasData) return;

    setIsDownloading(true);
    setDownloadError(null);
    setExpiryInfo(null);

    try {
      // Get temporary download URL from backend
      const response = await getDownloadUrl(runId);

      // Show expiry info
      const expiresAt = new Date(response.expires_at);
      const minutesRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / 60000);
      setExpiryInfo(`Link expires in ${minutesRemaining} minutes`);

      // Open the download URL in a new tab/trigger download
      const link = document.createElement("a");
      link.href = response.download_url;
      link.download = response.filename;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clear expiry info after a few seconds
      setTimeout(() => setExpiryInfo(null), 5000);
    } catch (err) {
      console.error("Download failed:", err);
      setDownloadError(err instanceof Error ? err.message : "Download failed");

      // Fallback to local download if server fails
      fallbackDownload();
    } finally {
      setIsDownloading(false);
    }
  };

  const fallbackDownload = () => {
    if (!hasData) return;

    // Create CSV content locally
    const csvContent = [
      data.headers.join(","),
      ...data.rows.map((row) => row.map(escapeCSVField).join(",")),
    ].join("\n");

    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `output-${runId.slice(0, 8)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Output Preview</CardTitle>
          <CardDescription>No output data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Output Preview</CardTitle>
            <CardDescription>
              First {Math.min(data.rows.length, 10)} of {data.rows.length} rows
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button onClick={handleDownload} disabled={isDownloading}>
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </>
              )}
            </Button>
            {expiryInfo && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {expiryInfo}
              </span>
            )}
            {downloadError && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {downloadError}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DataPreview data={data} maxRows={10} />
      </CardContent>
    </Card>
  );
}

function escapeCSVField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
