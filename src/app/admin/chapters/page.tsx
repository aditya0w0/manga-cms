"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Layers,
  Plus,
  Upload,
  FileArchive,
  FolderArchive,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  BookOpen,
  Eye,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { formatDate } from "@/lib/utils";
import { getSafeImageUrl, getProxyFallbackUrl } from "@/lib/image-utils";
import { BatchChapterUploadModal } from "@/components/admin/BatchChapterUploadModal";
import { BatchImportMonitor } from "@/components/admin/BatchImportMonitor";

export default function AdminChaptersPage() {
  const searchParams = useSearchParams();
  const initialMangaId = searchParams.get("mangaId") || "";

  const [mangas, setMangas] = useState<any[]>([]);
  const [selectedMangaId, setSelectedMangaId] = useState<string>(initialMangaId);
  const [selectedManga, setSelectedManga] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Expanded chapter page inspection: chapterId -> { loading: boolean, pages: any[] }
  const [inspectedChapterId, setInspectedChapterId] = useState<string | null>(null);
  const [chapterPages, setChapterPages] = useState<Record<string, any[]>>({});
  const [pagesLoading, setPagesLoading] = useState<Record<string, boolean>>({});

  // Fullsize page image preview modal
  const [previewPageUrl, setPreviewPageUrl] = useState<string | null>(null);

  // Batch Upload Modal state
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  // Create Chapter Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newChapterNum, setNewChapterNum] = useState<number>(1);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newVolume, setNewVolume] = useState<number | "">("");
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Delete Chapter Dialog state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; chapterNumber: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ZIP Upload Modal state
  const [isZipOpen, setIsZipOpen] = useState(false);
  const [targetChapterId, setTargetChapterId] = useState<string>("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadReport, setUploadReport] = useState<any>(null);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    fetch("/api/manga?limit=100")
      .then((r) => r.json())
      .then((d) => {
        if (d.items && d.items.length > 0) {
          setMangas(d.items);
          if (!selectedMangaId) {
            setSelectedMangaId(d.items[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedMangaId) return;
    setIsLoading(true);
    const m = mangas.find((item) => item.id === selectedMangaId);
    if (m) {
      fetch(`/api/manga/${m.slug}`)
        .then((r) => r.json())
        .then((d) => {
          setSelectedManga(d.manga);
          setChapters(d.manga?.chapters || []);
          if (d.manga?.chapters?.length > 0) {
            const maxCh = Math.max(...d.manga.chapters.map((c: any) => c.chapterNumber));
            setNewChapterNum(maxCh + 1);
          } else {
            setNewChapterNum(1);
          }
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    }
  }, [selectedMangaId, mangas]);

  // Load pages for a chapter when inspector is toggled
  const toggleInspectChapter = async (chapterId: string) => {
    if (inspectedChapterId === chapterId) {
      setInspectedChapterId(null);
      return;
    }

    setInspectedChapterId(chapterId);
    if (!chapterPages[chapterId]) {
      setPagesLoading((prev) => ({ ...prev, [chapterId]: true }));
      try {
        const res = await fetch(`/api/v1/admin/chapters/${chapterId}/pages`);
        if (res.ok) {
          const d = await res.json();
          setChapterPages((prev) => ({ ...prev, [chapterId]: d.data?.pages || [] }));
        } else {
          // Fallback to public chapter reader endpoint
          const fallback = await fetch(`/api/v1/chapters/${chapterId}/pages`);
          if (fallback.ok) {
            const d = await fallback.json();
            setChapterPages((prev) => ({ ...prev, [chapterId]: d.data?.pages || [] }));
          }
        }
      } catch {
        // Handled silently
      } finally {
        setPagesLoading((prev) => ({ ...prev, [chapterId]: false }));
      }
    }
  };

  const handleCreateChapter = async () => {
    if (!selectedMangaId || newChapterNum === undefined) return;
    setIsCreating(true);
    setCreateError("");

    try {
      let res = await fetch(`/api/v1/admin/manga/${selectedMangaId}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterNumber: Number(newChapterNum),
          title: newChapterTitle || undefined,
          volumeNumber: newVolume ? Number(newVolume) : null,
          publicationStatus: "PUBLISHED",
        }),
      });

      if (!res.ok) {
        res = await fetch("/api/chapters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mangaId: selectedMangaId,
            chapterNumber: Number(newChapterNum),
            chapterTitle: newChapterTitle || undefined,
            volume: newVolume ? Number(newVolume) : undefined,
            publicationStatus: "PUBLISHED",
          }),
        });
      }

      if (res.ok) {
        setIsCreateOpen(false);
        setNewChapterTitle("");
        const m = mangas.find((item) => item.id === selectedMangaId);
        if (m) {
          const fresh = await fetch(`/api/manga/${m.slug}`).then((r) => r.json());
          setChapters(fresh.manga?.chapters || []);
        }
      } else {
        const d = await res.json().catch(() => ({}));
        setCreateError(d.error || "Failed to create chapter");
      }
    } catch {
      setCreateError("Network error while creating chapter");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUploadZip = async () => {
    if (!targetChapterId || !zipFile) return;
    setIsUploading(true);
    setUploadError("");
    setUploadReport(null);

    const formData = new FormData();
    formData.append("file", zipFile);

    try {
      const res = await fetch(`/api/chapters/${targetChapterId}/upload-zip`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Failed to process ZIP upload");
        setIsUploading(false);
        return;
      }

      setUploadReport(data.report);
      setIsUploading(false);

      // Invalidate cached pages for this chapter so inspector shows new pages
      setChapterPages((prev) => {
        const next = { ...prev };
        delete next[targetChapterId];
        return next;
      });

      const m = mangas.find((item) => item.id === selectedMangaId);
      if (m) {
        const fresh = await fetch(`/api/manga/${m.slug}`).then((r) => r.json());
        setChapters(fresh.manga?.chapters || []);
      }
    } catch (err: any) {
      setUploadError(err.message || "Network error uploading ZIP");
      setIsUploading(false);
    }
  };

  const confirmDeleteChapter = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError("");

    try {
      let res = await fetch(`/api/v1/admin/chapters/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        res = await fetch(`/api/chapters/${deleteTarget.id}`, { method: "DELETE" });
      }

      if (res.ok) {
        setChapters((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        const d = await res.json().catch(() => ({}));
        setDeleteError(d.error || "Failed to delete chapter");
      }
    } catch {
      setDeleteError("Network error deleting chapter");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-sky-400" />
            Chapters
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsBatchOpen(true)}
            disabled={!selectedMangaId}
            className="gap-1.5 text-xs font-medium border-slate-700 hover:bg-slate-800 text-slate-300"
          >
            <FolderArchive className="h-4 w-4" /> Batch Upload
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setCreateError("");
              setIsCreateOpen(true);
            }}
            disabled={!selectedMangaId}
            className="gap-1.5 text-xs font-medium"
          >
            <Plus className="h-4 w-4" /> Add Chapter
          </Button>
        </div>
      </div>

      {/* Selected Manga Spotlight Card */}
      {selectedManga ? (
        <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-14 h-20 rounded-md overflow-hidden shrink-0 border border-slate-700 bg-slate-800">
              {selectedManga.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getSafeImageUrl(selectedManga.coverUrl)}
                  alt={`${selectedManga.title} cover`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <BookOpen className="h-6 w-6 opacity-40" />
                </div>
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-medium">
                  {selectedManga.contentType || "MANGA"}
                </Badge>
                <Badge variant={selectedManga.publicationStatus === "PUBLISHED" ? "success" : "warning"} className="text-[10px]">
                  {selectedManga.publicationStatus}
                </Badge>
              </div>
              <h2 className="text-base font-bold text-foreground truncate" title={selectedManga.title}>
                {selectedManga.title}
              </h2>
              <p className="text-xs text-slate-400">
                {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
              </p>
            </div>
          </div>

          {/* Quick Series Switcher */}
          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <select
              value={selectedMangaId}
              onChange={(e) => setSelectedMangaId(e.target.value)}
              className="w-full sm:w-auto h-9 px-3 rounded-md border border-slate-700 bg-slate-950 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {mangas.map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-foreground">
                  {m.title} ({m._count?.chapters || 0} {m._count?.chapters === 1 ? "chapter" : "chapters"})
                </option>
              ))}
            </select>

            <Link href={`/manga/${selectedManga.slug}`} target="_blank" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto h-9 text-xs border-slate-700 text-slate-300 shrink-0">
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Public View
              </Button>
            </Link>
          </div>
        </div>
      ) : null}

      {/* Live Batch Ingestion Monitor */}
      {activeBatchId && (
        <BatchImportMonitor
          batchId={activeBatchId}
          onClose={() => setActiveBatchId(null)}
          onBatchCompleted={() => {
            if (selectedManga?.slug) {
              fetch(`/api/manga/${selectedManga.slug}`)
                .then((r) => r.json())
                .then((d) => setChapters(d.manga?.chapters || []));
            }
          }}
        />
      )}

      {/* Chapters Table & Inspector */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Chapter List
          </h2>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
            {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
          </span>
        </div>

        {/* Compact Mobile Chapter List (Zero Horizontal Overflow) */}
        <div className="block md:hidden divide-y divide-slate-800/80">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Loading chapters...
            </div>
          ) : chapters.length > 0 ? (
            chapters.map((ch) => {
              const isInspected = inspectedChapterId === ch.id;
              const pages = chapterPages[ch.id] || [];
              const isPageLoading = pagesLoading[ch.id];

              return (
                <div key={ch.id} className={`p-3.5 space-y-2.5 transition-colors ${isInspected ? "bg-slate-800/30" : ""}`}>
                  {/* Row 1: Chapter badge + Title + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-sky-300 font-mono font-bold text-xs shrink-0">
                        Ch. {ch.chapterNumber}
                      </span>
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {ch.chapterTitle || `Chapter ${ch.chapterNumber}`}
                      </span>
                    </div>
                    <Badge variant={ch.publicationStatus === "PUBLISHED" ? "success" : "warning"} className="text-[10px] shrink-0">
                      {ch.publicationStatus}
                    </Badge>
                  </div>

                  {/* Row 2: Metadata (Volume, Release Date) */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                    {ch.volume && <span>Vol. {ch.volume}</span>}
                    {ch.volume && <span>•</span>}
                    <span>{formatDate(ch.releaseDate)}</span>
                  </div>

                  {/* Row 3: Action Bar */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => toggleInspectChapter(ch.id)}
                      className="font-mono px-2.5 py-1.5 rounded bg-sky-500/10 border border-sky-500/25 text-sky-300 hover:bg-sky-500/20 text-xs flex items-center gap-1.5 transition-colors"
                      aria-label={`Inspect ${ch._count?.pages || 0} pages for chapter ${ch.chapterNumber}`}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>{ch._count?.pages || 0} pages</span>
                      {isInspected ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <Link href={`/read/${ch.id}`} target="_blank">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs px-2.5 gap-1 text-slate-300 hover:text-white"
                          aria-label={`Read chapter ${ch.chapterNumber}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Read
                        </Button>
                      </Link>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setTargetChapterId(ch.id);
                          setZipFile(null);
                          setUploadReport(null);
                          setUploadError("");
                          setIsZipOpen(true);
                        }}
                        className="h-8 text-xs px-2.5 gap-1"
                        aria-label={`Upload ZIP for chapter ${ch.chapterNumber}`}
                      >
                        <Upload className="h-3.5 w-3.5" /> ZIP
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeleteError("");
                          setDeleteTarget({ id: ch.id, chapterNumber: ch.chapterNumber });
                        }}
                        aria-label={`Delete chapter ${ch.chapterNumber}`}
                        className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expandable Page Inspector for mobile */}
                  {isInspected && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-2">
                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Chapter {ch.chapterNumber} ({pages.length} pages)</span>
                        <span>Tap to preview</span>
                      </div>

                      {isPageLoading ? (
                        <div className="py-4 text-center text-xs text-slate-400">
                          Loading pages...
                        </div>
                      ) : pages.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                          {pages.map((p) => (
                            <div
                              key={p.id}
                              onClick={() => setPreviewPageUrl(p.url)}
                              className="shrink-0 w-20 rounded-md overflow-hidden border border-slate-700 bg-slate-900 cursor-pointer hover:border-sky-400 transition-colors"
                            >
                              <div className="aspect-[3/4] w-full overflow-hidden bg-black/60 relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={getSafeImageUrl(p.url)}
                                  alt={`Page ${p.pageNumber}`}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute top-1 left-1 px-1.5 py-0.2 rounded bg-black/80 text-[9px] font-mono font-bold text-white">
                                  p.{p.pageNumber}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-4 text-center text-xs text-slate-400 bg-slate-950/40 rounded border border-slate-800">
                          No pages found. Click &quot;ZIP&quot; to upload.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              No chapters exist for this manga yet. Click &quot;Add Chapter&quot; above to create one.
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Chapter</th>
                <th className="py-3 px-4 whitespace-nowrap">Title</th>
                <th className="py-3 px-4 whitespace-nowrap">Volume</th>
                <th className="py-3 px-4 whitespace-nowrap">Pages</th>
                <th className="py-3 px-4 whitespace-nowrap">Status</th>
                <th className="py-3 px-4 whitespace-nowrap">Release Date</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading chapters...
                  </td>
                </tr>
              ) : chapters.length > 0 ? (
                chapters.map((ch) => {
                  const isInspected = inspectedChapterId === ch.id;
                  const pages = chapterPages[ch.id] || [];
                  const isPageLoading = pagesLoading[ch.id];

                  return (
                    <React.Fragment key={ch.id}>
                      <tr className={`hover:bg-white/[0.02] transition-colors ${isInspected ? "bg-slate-800/40" : ""}`}>
                        <td className="py-3.5 px-4 font-bold text-foreground font-mono whitespace-nowrap text-xs">
                          <span className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-sky-300">
                            Ch. {ch.chapterNumber}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap text-xs">
                          {ch.chapterTitle || "-"}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap text-xs">
                          {ch.volume ? `Vol. ${ch.volume}` : "-"}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            onClick={() => toggleInspectChapter(ch.id)}
                            className="font-mono px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/25 text-sky-300 hover:bg-sky-500/20 font-bold text-xs flex items-center gap-1 transition-colors"
                            aria-label={`Inspect ${ch._count?.pages || 0} pages for chapter ${ch.chapterNumber}`}
                          >
                            <ImageIcon className="h-3 w-3" />
                            <span>{ch._count?.pages || 0} pages</span>
                            {isInspected ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Badge variant="success" className="text-xs">
                            {ch.publicationStatus}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4 text-slate-400 font-mono text-xs whitespace-nowrap">
                          {formatDate(ch.releaseDate)}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/read/${ch.id}`} target="_blank">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2 gap-1 text-slate-300 hover:text-white"
                                aria-label={`Read chapter ${ch.chapterNumber}`}
                              >
                                <ExternalLink className="h-3 w-3" /> Read
                              </Button>
                            </Link>

                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setTargetChapterId(ch.id);
                                setZipFile(null);
                                setUploadReport(null);
                                setUploadError("");
                                setIsZipOpen(true);
                              }}
                              className="h-7 text-xs gap-1"
                              aria-label={`Upload ZIP for chapter ${ch.chapterNumber}`}
                            >
                              <Upload className="h-3 w-3" /> Upload ZIP
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeleteError("");
                                setDeleteTarget({ id: ch.id, chapterNumber: ch.chapterNumber });
                              }}
                              aria-label={`Delete chapter ${ch.chapterNumber}`}
                              className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* Visual Page Strip Inspector */}
                      {isInspected && (
                        <tr>
                          <td colSpan={7} className="p-4 bg-slate-950/70 border-b border-slate-800">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                                  <ImageIcon className="h-3.5 w-3.5 text-sky-400" />
                                  Chapter {ch.chapterNumber} pages ({pages.length})
                                </span>
                                <span className="text-slate-400">Click thumbnail to preview</span>
                              </div>

                              {isPageLoading ? (
                                <div className="py-8 text-center text-xs text-slate-400">
                                  Loading pages...
                                </div>
                              ) : pages.length > 0 ? (
                                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                                  {pages.map((p) => (
                                    <div
                                      key={p.id}
                                      onClick={() => setPreviewPageUrl(p.url)}
                                      className="shrink-0 w-24 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 group cursor-pointer hover:border-sky-400 transition-colors"
                                    >
                                      <div className="aspect-[3/4] w-full overflow-hidden bg-black/60 relative">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={getSafeImageUrl(p.url)}
                                          alt={`Page ${p.pageNumber}`}
                                          loading="lazy"
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                        />
                                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono font-bold text-white">
                                          p.{p.pageNumber}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="py-6 text-center text-xs text-slate-400 bg-slate-950/40 rounded border border-slate-800">
                                  No pages found in this chapter. Click &quot;Upload ZIP&quot; to add pages.
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No chapters exist for this manga yet. Click &quot;Add Chapter&quot; above to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Resolution Page Image Modal */}
      <Dialog open={!!previewPageUrl} onOpenChange={(open) => !open && setPreviewPageUrl(null)}>
        <DialogHeader>
          <DialogTitle>Page Image Preview</DialogTitle>
          <DialogDescription>High resolution page preview</DialogDescription>
        </DialogHeader>

        <div className="my-3 max-h-[70vh] overflow-y-auto flex items-center justify-center bg-black/80 rounded-xl p-2">
          {previewPageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={getSafeImageUrl(previewPageUrl)}
              alt="Page preview"
              className="max-h-[65vh] w-auto object-contain rounded"
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setPreviewPageUrl(null)}>
            Close
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Create Chapter Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogHeader>
          <DialogTitle>Add New Chapter</DialogTitle>
          <DialogDescription>
            Create a chapter record for {selectedManga?.title}
          </DialogDescription>
        </DialogHeader>

        {createError && (
          <div className="p-3 my-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
            {createError}
          </div>
        )}

        <div className="space-y-4 my-2 text-xs">
          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Chapter Number *
            </label>
            <Input
              type="number"
              step="0.1"
              required
              value={newChapterNum}
              onChange={(e) => setNewChapterNum(parseFloat(e.target.value))}
            />
          </div>

          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Chapter Title (Optional)
            </label>
            <Input
              placeholder="e.g. The Awakening"
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="font-semibold text-slate-300 block mb-1">
              Volume (Optional)
            </label>
            <Input
              type="number"
              placeholder="e.g. 1"
              value={newVolume}
              onChange={(e) => setNewVolume(e.target.value ? Number(e.target.value) : "")}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCreateOpen(false)}
            disabled={isCreating}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreateChapter}
            disabled={isCreating}
            className="text-xs font-bold"
          >
            {isCreating ? "Creating..." : "Create Chapter"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ZIP Upload Dialog */}
      <Dialog open={isZipOpen} onOpenChange={setIsZipOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-sky-400" />
            Upload Chapter ZIP
          </DialogTitle>
          <DialogDescription>
            Pages will be extracted and ordered by filename.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-3 text-xs">
          {uploadError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadReport && (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                <span>Successfully extracted and imported {uploadReport.totalPages} pages!</span>
              </div>
              {uploadReport.skippedFiles && uploadReport.skippedFiles.length > 0 && (
                <p className="text-xs text-slate-400">
                  Skipped non-image files: {uploadReport.skippedFiles.join(", ")}
                </p>
              )}
            </div>
          )}

          <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center space-y-2 hover:border-sky-500/50 transition-colors">
            <FileArchive className="h-10 w-10 mx-auto text-sky-400 opacity-60" />
            <p className="font-semibold text-foreground">Select Chapter .zip archive</p>
            <p className="text-slate-400 text-xs">Supports JPG, PNG, WEBP, AVIF images naturally ordered</p>
            <input
              type="file"
              accept=".zip"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setZipFile(e.target.files[0]);
                }
              }}
              className="block mx-auto text-xs text-slate-300 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
          </div>

          {zipFile && (
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="font-mono text-foreground font-semibold truncate max-w-xs">{zipFile.name}</span>
              <span className="text-slate-400 font-mono text-xs">{(zipFile.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="ghost" size="sm" onClick={() => setIsZipOpen(false)} className="text-xs">
            Close
          </Button>
          <Button
            size="sm"
            disabled={!zipFile || isUploading}
            onClick={handleUploadZip}
            className="gap-2 text-xs font-bold"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? "Extracting & Uploading..." : "Process ZIP Archive"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Accessible In-App Chapter Deletion Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogHeader>
          <DialogTitle>Confirm Delete Chapter</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete Chapter {deleteTarget?.chapterNumber} and all its pages?
          </DialogDescription>
        </DialogHeader>

        {deleteError && (
          <div className="p-3 my-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
            {deleteError}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDeleteTarget(null)}
            disabled={isDeleting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={confirmDeleteChapter}
            disabled={isDeleting}
            className="text-xs font-bold"
          >
            {isDeleting ? "Deleting..." : "Delete Chapter"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Batch Chapter Upload Modal */}
      {selectedManga && (
        <BatchChapterUploadModal
          isOpen={isBatchOpen}
          onClose={() => setIsBatchOpen(false)}
          mangaId={selectedManga.id}
          mangaTitle={selectedManga.title}
          onSuccess={async () => {
            const m = mangas.find((item) => item.id === selectedMangaId);
            if (m) {
              const fresh = await fetch(`/api/manga/${m.slug}`).then((r) => r.json());
              setChapters(fresh.manga?.chapters || []);
            }
          }}
        />
      )}
    </div>
  );
}
