"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Ban,
  Clock,
  HardDrive,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

interface ChapterJobItem {
  id: string;
  chapterKey: string;
  displayNumber: string;
  title: string | null;
  volume: number | null;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "SKIPPED" | "CANCELLED";
  attempts: number;
  errorMessage: string | null;
  pagesIngested: number;
  outputBytes: number;
  lockedAt: string | null;
  workerId: string | null;
}

interface BatchDetails {
  id: string;
  batchId: string;
  status: "UPLOADED" | "SCANNING" | "QUEUED" | "PROCESSING" | "COMPLETED" | "PARTIAL_FAILED" | "FAILED" | "CANCELLED";
  sourceMode: string;
  sourceRef: string;
  compressionPreset: string;
  conflictPolicy: string;
  autoPublish: boolean;
  totalComics: number;
  totalChapters: number;
  completedChapters: number;
  failedChapters: number;
  totalPages: number;
  processedPages: number;
  totalInputBytes: number;
  totalOutputBytes: number;
  errorSummary: string | null;
  createdAt: string;
  finishedAt: string | null;
  chapterJobs: ChapterJobItem[];
}

interface BatchImportMonitorProps {
  batchId: string;
  onClose?: () => void;
  onBatchCompleted?: () => void;
}

export function BatchImportMonitor({
  batchId,
  onClose,
  onBatchCompleted,
}: BatchImportMonitorProps) {
  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [showAllJobs, setShowAllJobs] = useState(false);

  const fetchBatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/admin/batch-import/${batchId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to fetch batch status");
      }
      const data = await res.json();
      setBatch(data.data.batch);
      setError("");

      if (
        (data.data.batch.status === "COMPLETED" || data.data.batch.status === "PARTIAL_FAILED") &&
        onBatchCompleted
      ) {
        onBatchCompleted();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading batch";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [batchId, onBatchCompleted]);

  useEffect(() => {
    fetchBatch();

    // Auto-poll while batch is active
    const interval = setInterval(() => {
      if (batch && ["COMPLETED", "PARTIAL_FAILED", "FAILED", "CANCELLED"].includes(batch.status)) {
        clearInterval(interval);
        return;
      }
      fetchBatch();
    }, 2500);

    return () => clearInterval(interval);
  }, [fetchBatch, batch?.status]);

  const handleRetryFailed = async () => {
    setIsRetrying(true);
    setActionMessage("");
    try {
      const res = await fetch(`/api/v1/admin/batch-import/${batchId}/retry-failed`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage(`Queued ${data.data?.retriedCount || 0} failed chapters for retry`);
        await fetchBatch();
      } else {
        setError(data.error?.message || "Failed to retry jobs");
      }
    } catch {
      setError("Network error while retrying jobs");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel remaining pending chapters for this batch?")) {
      return;
    }
    setIsCancelling(true);
    setActionMessage("");
    try {
      const res = await fetch(`/api/v1/admin/batch-import/${batchId}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage(`Cancelled ${data.data?.cancelledCount || 0} pending jobs`);
        await fetchBatch();
      } else {
        setError(data.error?.message || "Failed to cancel batch");
      }
    } catch {
      setError("Network error while cancelling batch");
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading && !batch) {
    return (
      <div className="py-8 text-center text-xs text-slate-400">
        Loading batch status...
      </div>
    );
  }

  if (error && !batch) {
    return (
      <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-2">
        <p className="font-semibold">Unable to monitor batch</p>
        <p>{error}</p>
        <Button size="sm" variant="outline" onClick={fetchBatch} className="text-xs">
          Try again
        </Button>
      </div>
    );
  }

  if (!batch) return null;

  const total = batch.totalChapters || 1;
  const completed = batch.completedChapters || 0;
  const progressPercent = Math.min(100, Math.round((completed / total) * 100));
  const outputMb = (batch.totalOutputBytes / (1024 * 1024)).toFixed(1);
  const isActive = ["QUEUED", "PROCESSING", "SCANNING", "UPLOADED"].includes(batch.status);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 space-y-4">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-slate-200">
              {batch.batchId}
            </span>
            <Badge
              variant={
                batch.status === "COMPLETED"
                  ? "success"
                  : batch.status === "PROCESSING"
                  ? "secondary"
                  : batch.status === "PARTIAL_FAILED" || batch.status === "FAILED"
                  ? "destructive"
                  : "outline"
              }
              className="text-[10px]"
            >
              {batch.status}
            </Badge>
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            Started: {formatDate(batch.createdAt)}
            {batch.finishedAt && ` • Finished: ${formatDate(batch.finishedAt)}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {batch.failedChapters > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetryFailed}
              disabled={isRetrying}
              className="h-8 text-xs gap-1.5 border-rose-800/60 text-rose-300 hover:bg-rose-950/40"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
              Retry Failed ({batch.failedChapters})
            </Button>
          )}

          {isActive && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isCancelling}
              className="h-8 text-xs gap-1.5 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <Ban className="h-3.5 w-3.5" />
              Cancel Batch
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={fetchBatch}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
            title="Refresh status"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
          {actionMessage}
        </div>
      )}

      {batch.errorSummary && (
        <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {batch.errorSummary}
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Batch Progress</span>
          <span className="font-mono text-slate-200 font-medium">
            {completed} of {batch.totalChapters} chapters ({progressPercent}%)
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-950 overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-300 ${
              batch.status === "COMPLETED"
                ? "bg-emerald-500"
                : batch.failedChapters > 0
                ? "bg-amber-500"
                : "bg-sky-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Stats Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
        <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80 space-y-0.5">
          <div className="text-[11px] text-slate-400">Chapters</div>
          <div className="font-mono font-semibold text-slate-200">
            {batch.completedChapters} / {batch.totalChapters}
            {batch.failedChapters > 0 && (
              <span className="text-rose-400 text-[10px] ml-1">({batch.failedChapters} failed)</span>
            )}
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80 space-y-0.5">
          <div className="text-[11px] text-slate-400">Pages Ingested</div>
          <div className="font-mono font-semibold text-slate-200">
            {batch.processedPages}
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80 space-y-0.5">
          <div className="text-[11px] text-slate-400">Storage Output</div>
          <div className="font-mono font-semibold text-slate-200">
            {outputMb} MB
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80 space-y-0.5">
          <div className="text-[11px] text-slate-400">Preset</div>
          <div className="font-mono font-semibold text-slate-200 uppercase text-[11px]">
            {batch.compressionPreset}
          </div>
        </div>
      </div>

      {/* Chapter Breakdown */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs">
          <h4 className="font-medium text-slate-300">
            Chapter Queue ({batch.chapterJobs.length})
          </h4>
          {batch.chapterJobs.length > 5 && (
            <button
              onClick={() => setShowAllJobs(!showAllJobs)}
              className="text-sky-400 hover:text-sky-300 text-[11px] flex items-center gap-1"
            >
              {showAllJobs ? "Show fewer" : `View all ${batch.chapterJobs.length}`}
              {showAllJobs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-800/60 border border-slate-800 rounded-lg overflow-hidden bg-slate-950/40">
          {(showAllJobs ? batch.chapterJobs : batch.chapterJobs.slice(0, 5)).map((job) => (
            <div
              key={job.id}
              className="p-2.5 flex items-center justify-between gap-2 text-xs hover:bg-slate-800/20"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono font-bold text-sky-300 bg-slate-800 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                  Ch. {job.displayNumber}
                </span>
                <span className="text-slate-300 truncate">
                  {job.title || `Chapter ${job.displayNumber}`}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {job.pagesIngested > 0 && (
                  <span className="text-[11px] font-mono text-slate-400">
                    {job.pagesIngested} pages
                  </span>
                )}

                <Badge
                  variant={
                    job.status === "COMPLETED"
                      ? "success"
                      : job.status === "PROCESSING"
                      ? "secondary"
                      : job.status === "FAILED"
                      ? "destructive"
                      : job.status === "SKIPPED"
                      ? "warning"
                      : "outline"
                  }
                  className="text-[10px]"
                >
                  {job.status}
                </Badge>
              </div>

              {job.errorMessage && (
                <div className="w-full text-[11px] text-rose-400 font-mono mt-1 pt-1 border-t border-slate-800/50">
                  {job.errorMessage}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {onClose && (
        <div className="pt-2 flex justify-end">
          <Button size="sm" variant="secondary" onClick={onClose} className="text-xs">
            Close Monitor
          </Button>
        </div>
      )}
    </div>
  );
}
