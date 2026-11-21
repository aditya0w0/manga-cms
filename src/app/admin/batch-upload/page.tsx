"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FolderArchive,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Ban,
  Clock,
  HardDrive,
  Layers,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  Play,
  Cpu,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  FileText,
  X,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { BatchChapterUploadModal } from "@/components/admin/BatchChapterUploadModal";

interface BatchItem {
  id: string;
  batchId: string;
  status: "UPLOADED" | "SCANNING" | "QUEUED" | "PROCESSING" | "COMPLETED" | "PARTIAL_FAILED" | "FAILED" | "CANCELLED";
  sourceMode: string;
  compressionPreset: string;
  conflictPolicy: string;
  autoPublish: boolean;
  totalComics: number;
  totalChapters: number;
  completedChapters: number;
  failedChapters: number;
  totalPages: number;
  processedPages: number;
  totalOutputBytes: number;
  errorSummary: string | null;
  createdAt: string;
  finishedAt: string | null;
  comicJobs?: Array<{ id: string; slug: string; status: string }>;
}

interface PipelineMetrics {
  totalBatches: number;
  activeBatches: number;
  completedBatches: number;
  failedBatches: number;
  totalChapters: number;
  completedChapters: number;
  failedChapters: number;
  totalPages: number;
  processedPages: number;
  totalInputBytes: number;
  totalOutputBytes: number;
}

interface ChapterJob {
  id: string;
  chapterKey: string;
  displayNumber: string;
  sortKey: string;
  title: string | null;
  volume: number | null;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "SKIPPED" | "CANCELLED";
  attempts: number;
  maxAttempts: number;
  pagesIngested: number;
  slicesCreated: number;
  outputBytes: number;
  errorMessage: string | null;
  lockedAt: string | null;
  workerId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BatchDetailResponse {
  id: string;
  batchId: string;
  status: string;
  sourceMode: string;
  sourceRef: string;
  compressionPreset: string;
  conflictPolicy: string;
  autoPublish: boolean;
  errorSummary: string | null;
  counters: {
    totalComics: number;
    totalChapters: number;
    completedChapters: number;
    failedChapters: number;
    totalPages: number;
    processedPages: number;
    totalInputBytes: number;
    totalOutputBytes: number;
  };
  statusCounts: Record<string, number>;
  chapterJobs: ChapterJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  checkpoint: {
    isSafe: boolean;
    completedCount: number;
    failedCount: number;
    pendingCount: number;
    resumableCount: number;
  };
  createdAt: string;
  finishedAt: string | null;
}

export default function AdminBatchUploadDashboardPage() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [workerStatus, setWorkerStatus] = useState<{ isRunning: boolean; workerId: string | null; activeJobCount: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "COMPLETED" | "FAILED" | "CANCELLED">("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Inspection Drawer State
  const [inspectBatchId, setInspectBatchId] = useState<string | null>(null);
  const [batchDetail, setBatchDetail] = useState<BatchDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailChapterStatus, setDetailChapterStatus] = useState<string>("ALL");
  const [detailChapterSearch, setDetailChapterSearch] = useState("");
  const [detailPage, setDetailPage] = useState(1);

  // Action status feedback
  const [actionNotice, setActionNotice] = useState<string>("");
  const [isActionBusy, setIsActionBusy] = useState(false);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [mangaList, setMangaList] = useState<Array<{ id: string; title: string; slug: string }>>([]);
  const [selectedMangaId, setSelectedMangaId] = useState("");

  // Fetch batches & pipeline metrics
  const fetchDashboardData = useCallback(async () => {
    try {
      const [batchRes, workerRes] = await Promise.all([
        fetch("/api/v1/admin/batch-import"),
        fetch("/api/v1/admin/batch-import/worker").catch(() => null),
      ]);

      if (batchRes.ok) {
        const data = await batchRes.json();
        if (data.data?.batches) setBatches(data.data.batches);
        if (data.data?.metrics) setMetrics(data.data.metrics);
      }

      if (workerRes && workerRes.ok) {
        const wData = await workerRes.json();
        if (wData.data?.worker) setWorkerStatus(wData.data.worker);
      }
    } catch (err) {
      console.error("Failed to load batch dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch manga list for upload modal picker
  useEffect(() => {
    fetch("/api/manga?limit=50")
      .then((r) => r.json())
      .then((d) => {
        if (d.items) {
          setMangaList(d.items.map((m: any) => ({ id: m.id, title: m.title, slug: m.slug })));
          if (d.items.length > 0 && !selectedMangaId) {
            setSelectedMangaId(d.items[0].id);
          }
        }
      })
      .catch(() => {});
  }, [selectedMangaId]);

  // Initial load and live auto-poll for active batches
  useEffect(() => {
    fetchDashboardData();

    const interval = setInterval(() => {
      fetchDashboardData();
    }, 2500);

    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Fetch single batch drilldown details
  const fetchBatchDetail = useCallback(async (batchId: string, page = 1, status = "ALL", search = "") => {
    setDetailLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      if (status !== "ALL") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/v1/admin/batch-import/${batchId}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBatchDetail(data.data.batch);
      }
    } catch (err) {
      console.error("Failed to fetch batch detail:", err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // When inspecting a batch or changing detail filters
  useEffect(() => {
    if (inspectBatchId) {
      fetchBatchDetail(inspectBatchId, detailPage, detailChapterStatus, detailChapterSearch);
    } else {
      setBatchDetail(null);
    }
  }, [inspectBatchId, detailPage, detailChapterStatus, detailChapterSearch, fetchBatchDetail]);

  // Handle Resume / Retry Failed for an entire batch
  const handleResumeBatch = async (batchId: string) => {
    setIsActionBusy(true);
    setActionNotice("");
    try {
      const res = await fetch(`/api/v1/admin/batch-import/${batchId}/retry-failed`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setActionNotice(`Checkpoint Resumed: Queued ${data.data?.retriedCount || 0} failed chapters. Completed chapters are preserved.`);
        fetchDashboardData();
        if (inspectBatchId === batchId) {
          fetchBatchDetail(batchId, detailPage, detailChapterStatus, detailChapterSearch);
        }
      } else {
        setActionNotice(`Error: ${data.error?.message || "Failed to resume batch"}`);
      }
    } catch {
      setActionNotice("Network error while resuming batch");
    } finally {
      setIsActionBusy(false);
    }
  };

  // Handle Cancel Batch
  const handleCancelBatch = async (batchId: string) => {
    if (!window.confirm("Cancel remaining pending jobs in this batch? Already completed chapters will remain safe.")) {
      return;
    }
    setIsActionBusy(true);
    setActionNotice("");
    try {
      const res = await fetch(`/api/v1/admin/batch-import/${batchId}/cancel`, {
        method: "POST",
      });
      if (res.ok) {
        setActionNotice("Batch cancelled. Pending chapters stopped. Completed chapters remain published.");
        fetchDashboardData();
        if (inspectBatchId === batchId) {
          fetchBatchDetail(batchId, detailPage, detailChapterStatus, detailChapterSearch);
        }
      }
    } catch {
      setActionNotice("Network error while cancelling batch");
    } finally {
      setIsActionBusy(false);
    }
  };

  // Handle Single Chapter Retry
  const handleRetrySingleChapter = async (batchId: string, jobId: string, chapterDisplay: string) => {
    setIsActionBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/batch-import/${batchId}/retry-chapter/${jobId}`, {
        method: "POST",
      });
      if (res.ok) {
        setActionNotice(`Chapter ${chapterDisplay} queued for retry from checkpoint.`);
        fetchDashboardData();
        fetchBatchDetail(batchId, detailPage, detailChapterStatus, detailChapterSearch);
      }
    } catch {
      setActionNotice(`Failed to retry chapter ${chapterDisplay}`);
    } finally {
      setIsActionBusy(false);
    }
  };

  // Handle Trigger Worker
  const handleTriggerWorker = async () => {
    try {
      const res = await fetch("/api/v1/admin/batch-import/worker", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setWorkerStatus(data.data.worker);
        setActionNotice("Ingestion worker activated. Polling job queue.");
      }
    } catch {
      setActionNotice("Failed to trigger worker");
    }
  };

  // Filtered batch items
  const filteredBatches = batches.filter((b) => {
    if (activeTab === "ACTIVE") {
      if (!["QUEUED", "PROCESSING", "SCANNING", "UPLOADED"].includes(b.status)) return false;
    } else if (activeTab === "COMPLETED") {
      if (b.status !== "COMPLETED") return false;
    } else if (activeTab === "FAILED") {
      if (!["FAILED", "PARTIAL_FAILED"].includes(b.status)) return false;
    } else if (activeTab === "CANCELLED") {
      if (b.status !== "CANCELLED") return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchBatchId = b.batchId.toLowerCase().includes(q);
      const matchComics = b.comicJobs?.some((c) => c.slug.toLowerCase().includes(q));
      if (!matchBatchId && !matchComics) return false;
    }

    return true;
  });

  const selectedManga = mangaList.find((m) => m.id === selectedMangaId) || mangaList[0];

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl liquid-glass text-sky-400 border border-white/20 shadow-md">
              <FolderArchive className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Batch Ingestion & Queue Monitor
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time pipeline orchestration, checkpoint-resumable ingestion, and fault isolation
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {workerStatus && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full liquid-glass-chip text-xs">
              <span className={`h-2 w-2 rounded-full ${workerStatus.isRunning ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
              <span className="font-mono text-[11px] text-slate-300">
                {workerStatus.isRunning ? `Worker Online (${workerStatus.activeJobCount} active)` : "Worker Idle"}
              </span>
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleTriggerWorker}
            className="h-8 text-xs gap-1.5 border-slate-700 text-slate-200 hover:bg-slate-800"
            title="Start or wake up queue processing worker"
          >
            <Play className="h-3.5 w-3.5 text-emerald-400" />
            Start Worker
          </Button>

          <Button
            size="sm"
            onClick={() => setIsUploadOpen(true)}
            className="h-8 text-xs gap-1.5 liquid-glass-btn-primary font-bold shadow-md"
          >
            <Plus className="h-3.5 w-3.5" />
            Upload New Batch
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={fetchDashboardData}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
            title="Refresh dashboard"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Checkpoint Resilience Callout */}
      <div className="rounded-2xl liquid-glass p-4 border border-sky-500/20 bg-sky-950/20 text-xs flex items-start gap-3 shadow-md">
        <ShieldCheck className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-sky-300">
            Atomic Checkpoint & Safe Resume Protection
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            Chapters are committed and published to the database atomically one by one. If an archive of 5,000 chapters encounters an error at Chapter 1,400, Chapters 1 through 1,400 remain permanently saved and viewable. Resuming the batch will only queue the failed and remaining 3,600 chapters from the exact failure checkpoint, never restarting from Chapter 1.
          </p>
        </div>
      </div>

      {/* System Action Notice Banner */}
      {actionNotice && (
        <div className="p-3 rounded-xl liquid-glass-chip border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <span className="font-mono">{actionNotice}</span>
          <button onClick={() => setActionNotice("")} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Pipeline KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl liquid-glass liquid-glass-glare space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Active Batches
            </span>
            <Activity className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {metrics?.activeBatches ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            {metrics?.totalBatches ?? 0} total batches recorded
          </div>
        </div>

        <div className="p-4 rounded-2xl liquid-glass liquid-glass-glare space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Chapters Ingested
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-300">
            {metrics?.completedChapters ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            of {metrics?.totalChapters ?? 0} queued chapters
          </div>
        </div>

        <div className="p-4 rounded-2xl liquid-glass liquid-glass-glare space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Pages Processed
            </span>
            <Layers className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300">
            {metrics?.processedPages ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Lossless WebP optimized
          </div>
        </div>

        <div className="p-4 rounded-2xl liquid-glass liquid-glass-glare space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Storage Output
            </span>
            <HardDrive className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-300">
            {(((metrics?.totalOutputBytes || 0) / (1024 * 1024)) || 0).toFixed(1)} MB
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            {metrics?.failedChapters ? `${metrics.failedChapters} chapters need retry` : "0 failed chapters"}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="rounded-2xl liquid-glass p-3 sm:p-4 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: "ALL", label: "All Batches", count: batches.length },
              { id: "ACTIVE", label: "Active", count: batches.filter((b) => ["QUEUED", "PROCESSING", "SCANNING", "UPLOADED"].includes(b.status)).length },
              { id: "COMPLETED", label: "Completed", count: batches.filter((b) => b.status === "COMPLETED").length },
              { id: "FAILED", label: "Failed / Partial", count: batches.filter((b) => ["FAILED", "PARTIAL_FAILED"].includes(b.status)).length },
              { id: "CANCELLED", label: "Cancelled", count: batches.filter((b) => b.status === "CANCELLED").length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "liquid-glass-btn-primary text-white shadow-md"
                    : "liquid-glass-chip text-slate-300 hover:text-white"
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] font-mono text-slate-400 bg-white/10 px-1.5 py-0.2 rounded-full">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by batch ID or comic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-xl liquid-glass-input text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>

        {/* Batches Table */}
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-white/[0.04] text-muted-foreground border-b border-white/10 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4">Batch ID & Source</th>
                <th className="py-3 px-4">Target Comic</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Chapter Progress</th>
                <th className="py-3 px-4">Pages & Storage</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground font-mono">
                    Loading ingestion queue...
                  </td>
                </tr>
              ) : filteredBatches.length > 0 ? (
                filteredBatches.map((batch) => {
                  const total = batch.totalChapters || 1;
                  const completed = batch.completedChapters || 0;
                  const progressPct = Math.min(100, Math.round((completed / total) * 100));
                  const isBatchActive = ["QUEUED", "PROCESSING", "SCANNING", "UPLOADED"].includes(batch.status);
                  const isFailedOrPartial = ["FAILED", "PARTIAL_FAILED"].includes(batch.status) || batch.failedChapters > 0;

                  return (
                    <tr
                      key={batch.id}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      {/* Batch ID */}
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-slate-200 group-hover:text-white transition-colors">
                          {batch.batchId}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 uppercase">
                          <span>{batch.sourceMode}</span>
                          <span>•</span>
                          <span>{batch.compressionPreset}</span>
                        </div>
                      </td>

                      {/* Target Comic */}
                      <td className="py-3 px-4 font-medium text-slate-200">
                        {batch.comicJobs && batch.comicJobs.length > 0 ? (
                          <div className="space-y-0.5">
                            {batch.comicJobs.slice(0, 2).map((c) => (
                              <div key={c.id} className="text-sky-300 font-mono text-[11px] truncate max-w-[180px]">
                                {c.slug}
                              </div>
                            ))}
                            {batch.comicJobs.length > 2 && (
                              <span className="text-[10px] text-slate-400">
                                +{batch.comicJobs.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground font-mono">Auto-detected</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            batch.status === "COMPLETED"
                              ? "success"
                              : batch.status === "PROCESSING"
                              ? "secondary"
                              : isFailedOrPartial
                              ? "destructive"
                              : batch.status === "CANCELLED"
                              ? "outline"
                              : "default"
                          }
                          className="text-[10px] font-mono"
                        >
                          {batch.status === "PROCESSING" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-ping mr-1" />
                          )}
                          {batch.status}
                        </Badge>
                      </td>

                      {/* Chapter Progress */}
                      <td className="py-3 px-4">
                        <div className="space-y-1 min-w-[130px]">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-slate-300">
                              {batch.completedChapters} / {batch.totalChapters}
                            </span>
                            <span className="font-bold text-slate-400">{progressPct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-950 overflow-hidden border border-white/10">
                            <div
                              className={`h-full transition-all duration-300 ${
                                batch.status === "COMPLETED"
                                  ? "bg-emerald-400"
                                  : isFailedOrPartial
                                  ? "bg-amber-400"
                                  : "bg-sky-400"
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          {batch.failedChapters > 0 && (
                            <div className="text-[10px] font-mono text-rose-400 font-semibold">
                              {batch.failedChapters} failed (resumable)
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Pages & Storage */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="text-slate-200">
                          {batch.processedPages} pages
                        </div>
                        <div className="text-slate-400 text-[10px]">
                          {((batch.totalOutputBytes / (1024 * 1024)) || 0).toFixed(1)} MB WebP
                        </div>
                      </td>

                      {/* Created */}
                      <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDate(batch.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setInspectBatchId(batch.batchId)}
                            className="h-7 text-xs px-2.5 liquid-glass-chip text-sky-300 hover:text-white"
                          >
                            Inspect
                          </Button>

                          {isFailedOrPartial && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResumeBatch(batch.batchId)}
                              disabled={isActionBusy}
                              className="h-7 text-[11px] px-2.5 border-rose-800/60 text-rose-300 hover:bg-rose-950/40 gap-1 font-mono"
                              title="Resume only failed chapters from checkpoint"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Resume Failed
                            </Button>
                          )}

                          {isBatchActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelBatch(batch.batchId)}
                              disabled={isActionBusy}
                              className="h-7 text-[11px] px-2 text-slate-400 hover:text-rose-400"
                              title="Cancel remaining pending chapters"
                            >
                              <Ban className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground space-y-2">
                    <p className="font-semibold text-foreground">No batch ingestion jobs found</p>
                    <p className="text-xs">Upload an archive or directory to begin bulk comic ingestion.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deep-Dive Chapter Inspection Drawer / Modal */}
      {inspectBatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl liquid-glass liquid-glass-glare border border-white/20 shadow-2xl overflow-hidden bg-[#0a0f18]/95">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-base text-foreground">
                    {inspectBatchId}
                  </span>
                  {batchDetail && (
                    <Badge
                      variant={
                        batchDetail.status === "COMPLETED"
                          ? "success"
                          : batchDetail.status === "PROCESSING"
                          ? "secondary"
                          : batchDetail.counters.failedChapters > 0
                          ? "destructive"
                          : "outline"
                      }
                      className="text-[10px] font-mono"
                    >
                      {batchDetail.status}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {batchDetail ? `Created ${formatDate(batchDetail.createdAt)}` : "Loading details..."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {batchDetail && batchDetail.counters.failedChapters > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResumeBatch(inspectBatchId)}
                    disabled={isActionBusy}
                    className="h-8 text-xs border-rose-800/60 text-rose-300 hover:bg-rose-950/40 gap-1.5 font-mono"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Resume Failed ({batchDetail.counters.failedChapters})
                  </Button>
                )}

                <button
                  onClick={() => setInspectBatchId(null)}
                  className="p-1.5 rounded-full liquid-glass-chip text-slate-400 hover:text-white"
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Checkpoint Status Banner inside Modal */}
            {batchDetail && (
              <div className="px-5 py-3 bg-white/[0.02] border-b border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="font-mono text-[11px]">
                    <strong className="text-emerald-400 font-bold">{batchDetail.counters.completedChapters}</strong> chapters safe in catalog.{" "}
                    {batchDetail.counters.failedChapters > 0 ? (
                      <span className="text-amber-300">
                        {batchDetail.counters.failedChapters} failed chapters can be retried without restarting from 1.
                      </span>
                    ) : (
                      <span>All processed chapters verified.</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                  <span>Output: {((batchDetail.counters.totalOutputBytes / (1024 * 1024)) || 0).toFixed(1)} MB</span>
                  <span>•</span>
                  <span>{batchDetail.counters.processedPages} pages</span>
                </div>
              </div>
            )}

            {/* Filter and Search Bar for Chapters */}
            <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {[
                  { id: "ALL", label: "All Chapters" },
                  { id: "FAILED", label: `Failed (${batchDetail?.statusCounts?.FAILED ?? 0})` },
                  { id: "PENDING", label: `Pending (${batchDetail?.statusCounts?.PENDING ?? 0})` },
                  { id: "PROCESSING", label: `Processing (${batchDetail?.statusCounts?.PROCESSING ?? 0})` },
                  { id: "COMPLETED", label: `Completed (${batchDetail?.statusCounts?.COMPLETED ?? 0})` },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    onClick={() => {
                      setDetailChapterStatus(pill.id);
                      setDetailPage(1);
                    }}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
                      detailChapterStatus === pill.id
                        ? "liquid-glass-btn-primary text-white"
                        : "liquid-glass-chip text-slate-300 hover:text-white"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-2 h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter chapter number..."
                  value={detailChapterSearch}
                  onChange={(e) => {
                    setDetailChapterSearch(e.target.value);
                    setDetailPage(1);
                  }}
                  className="w-full h-7 pl-7 pr-3 rounded-lg liquid-glass-input text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </div>

            {/* Chapters Table Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {detailLoading && !batchDetail ? (
                <div className="py-12 text-center text-xs text-muted-foreground font-mono">
                  Loading chapter breakdown...
                </div>
              ) : batchDetail && batchDetail.chapterJobs.length > 0 ? (
                batchDetail.chapterJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-3 rounded-xl liquid-glass border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-white/10 text-sky-300 shrink-0">
                        Ch. {job.displayNumber}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-xs text-foreground truncate">
                          {job.title || `Chapter ${job.displayNumber}`}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          Key: {job.chapterKey} {job.attempts > 0 && `• Attempts: ${job.attempts}/${job.maxAttempts}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      {job.pagesIngested > 0 && (
                        <span className="text-[11px] font-mono text-slate-300">
                          {job.pagesIngested} pages ({job.slicesCreated} slices)
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
                        className="text-[10px] font-mono"
                      >
                        {job.status}
                      </Badge>

                      {job.status === "FAILED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetrySingleChapter(inspectBatchId, job.id, job.displayNumber)}
                          disabled={isActionBusy}
                          className="h-6 text-[10px] px-2 border-rose-800 text-rose-300 hover:bg-rose-950 font-mono gap-1"
                        >
                          <RotateCcw className="h-2.5 w-2.5" />
                          Retry
                        </Button>
                      )}
                    </div>

                    {/* Error Diagnostic Box for Failed Chapter */}
                    {job.errorMessage && (
                      <div className="w-full mt-1.5 p-2 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-[11px] font-mono leading-relaxed">
                        <strong className="text-rose-200">Failure Diagnostic: </strong>
                        {job.errorMessage}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs text-muted-foreground font-mono">
                  No chapters match the selected filter.
                </div>
              )}
            </div>

            {/* Modal Pagination Footer */}
            {batchDetail && batchDetail.pagination.totalPages > 1 && (
              <div className="p-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 shrink-0 font-mono">
                <span>
                  Page {batchDetail.pagination.page} of {batchDetail.pagination.totalPages} ({batchDetail.pagination.total} chapters)
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={detailPage <= 1}
                    onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                    className="h-7 text-xs px-2"
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={detailPage >= batchDetail.pagination.totalPages}
                    onClick={() => setDetailPage((p) => p + 1)}
                    className="h-7 text-xs px-2"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Batch Upload Modal Instance */}
      {selectedManga && (
        <BatchChapterUploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          mangaId={selectedManga.id}
          mangaTitle={selectedManga.title}
          onSuccess={() => {
            setIsUploadOpen(false);
            fetchDashboardData();
          }}
        />
      )}
    </div>
  );
}
