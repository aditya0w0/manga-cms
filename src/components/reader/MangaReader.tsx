"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useReaderStore,
  ReadingMode,
  ReadingDirection,
  ImageScaling,
  ReaderBg,
} from "@/lib/store/use-reader-store";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Settings,
  Eye,
  EyeOff,
  BookOpen,
  ArrowLeft,
  RefreshCw,
  Sliders,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { getSafeImageUrl, getProxyFallbackUrl } from "@/lib/image-utils";

export interface ChapterReaderData {
  id: string;
  chapterNumber: number;
  chapterTitle?: string | null;
  manga: {
    id: string;
    slug: string;
    title: string;
  };
  pages: {
    id: string;
    pageNumber: number;
    imageUrl: string;
  }[];
  prevChapter?: { id: string; chapterNumber: number } | null;
  nextChapter?: { id: string; chapterNumber: number } | null;
}

export function MangaReader({ chapter }: { chapter: ChapterReaderData }) {
  const router = useRouter();
  const {
    readingMode,
    readingDirection,
    imageScaling,
    backgroundColor,
    pageGap,
    preloadCount,
    showPageNumbers,
    currentPage,
    totalPages,
    zoomLevel,
    showControls,
    isFullscreen,
    setReadingMode,
    setReadingDirection,
    setImageScaling,
    setBackgroundColor,
    setPageGap,
    setShowPageNumbers,
    setCurrentPage,
    setTotalPages,
    nextPage,
    prevPage,
    zoomIn,
    zoomOut,
    resetZoom,
    toggleControls,
    toggleFullscreen,
    loadPreferences,
  } = useReaderStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChapterListOpen, setIsChapterListOpen] = useState(false);
  const [allChapters, setAllChapters] = useState<any[]>([]);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const progressDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  const handleImageError = (
    e: React.SyntheticEvent<HTMLImageElement>,
    pageNumber: number,
    originalUrl: string
  ) => {
    const current = e.currentTarget.src;
    if (!current.includes("/api/image-proxy")) {
      e.currentTarget.src = getProxyFallbackUrl(originalUrl);
    } else {
      setFailedImages((prev) => ({ ...prev, [pageNumber]: true }));
    }
  };

  useEffect(() => {
    loadPreferences();
    setTotalPages(chapter.pages.length);
  }, [chapter.pages.length, loadPreferences, setTotalPages]);

  // Load all chapters for the chapter drawer
  useEffect(() => {
    fetch(`/api/manga/${chapter.manga.slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.manga?.chapters) {
          setAllChapters(d.manga.chapters);
        }
      })
      .catch(() => {});
  }, [chapter.manga.slug]);

  // Debounced progress record
  const syncProgress = useCallback(
    (page: number) => {
      if (progressDebounceTimer.current) {
        clearTimeout(progressDebounceTimer.current);
      }
      progressDebounceTimer.current = setTimeout(() => {
        const percent = Math.min(100, Math.round((page / chapter.pages.length) * 100));
        fetch("/api/user/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mangaId: chapter.manga.id,
            chapterId: chapter.id,
            pageNumber: page,
            percentRead: percent,
            isCompleted: page >= chapter.pages.length,
          }),
        }).catch(() => {});
      }, 1500);
    },
    [chapter.id, chapter.manga.id, chapter.pages.length]
  );

  // Preload adjacent page images (e.g., 2 ahead)
  useEffect(() => {
    const start = Math.max(0, currentPage - 1);
    const end = Math.min(chapter.pages.length, currentPage + preloadCount);
    for (let i = start; i < end; i++) {
      if (chapter.pages[i]?.imageUrl) {
        const img = new Image();
        img.src = getSafeImageUrl(chapter.pages[i].imageUrl);
      }
    }
    syncProgress(currentPage);
  }, [currentPage, preloadCount, chapter.pages, syncProgress]);

  // Global Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input or textarea
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      switch (e.key) {
        case "ArrowRight":
          readingDirection === "RTL" ? prevPage() : nextPage();
          break;
        case "ArrowLeft":
          readingDirection === "RTL" ? nextPage() : prevPage();
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "h":
        case "H":
          toggleControls();
          break;
        case "a":
        case "A":
          if (chapter.prevChapter) router.push(`/read/${chapter.prevChapter.id}`);
          break;
        case "d":
        case "D":
          if (chapter.nextChapter) router.push(`/read/${chapter.nextChapter.id}`);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    readingDirection,
    nextPage,
    prevPage,
    toggleFullscreen,
    toggleControls,
    chapter.prevChapter,
    chapter.nextChapter,
    router,
  ]);

  const handleRetryImage = (pageNumber: number) => {
    setFailedImages((prev) => {
      const copy = { ...prev };
      delete copy[pageNumber];
      return copy;
    });
  };

  const getBgClass = () => {
    switch (backgroundColor) {
      case "BLACK":
        return "bg-black text-white";
      case "GRAY":
        return "bg-neutral-800 text-neutral-100";
      case "LIGHT":
        return "bg-neutral-100 text-neutral-900";
      case "DARK":
      default:
        return "bg-[#0B0D12] text-white";
    }
  };

  const getImageScaleClass = () => {
    switch (imageScaling) {
      case "FIT_HEIGHT":
        return "max-h-[92vh] w-auto mx-auto object-contain";
      case "ORIGINAL":
        return "max-w-none mx-auto";
      case "FIT_WIDTH":
      default:
        return "w-full max-w-4xl mx-auto object-contain";
    }
  };

  return (
    <div className={`relative min-h-screen select-none ${getBgClass()} transition-colors duration-300`}>
      {/* Top Floating Control Bar */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ${
          showControls ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex items-center justify-between liquid-glass-obsidian border-b border-white/[0.08] px-4 py-3 shadow-2xl">
          <div className="flex items-center space-x-3">
            <Link href={`/manga/${chapter.manga.slug}`}>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-white hover:bg-white/10">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline font-bold">{chapter.manga.title}</span>
              </Button>
            </Link>
            <span className="text-xs font-bold text-cyan-400 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 font-mono">
              Ch. {chapter.chapterNumber}
            </span>
            {chapter.chapterTitle && (
              <span className="text-xs text-neutral-400 hidden md:inline truncate max-w-xs">
                {chapter.chapterTitle}
              </span>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsChapterListOpen(true)}
              className="h-8 text-xs gap-1 text-white hover:bg-white/10"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Chapters</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="h-8 text-xs gap-1 text-white hover:bg-white/10"
            >
              <Sliders className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="h-8 text-white hover:bg-white/10"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Reading Viewport */}
      <main
        className="pt-16 pb-24 min-h-screen flex flex-col items-center justify-center cursor-default"
        onClick={(e) => {
          // If clicked directly on background, toggle controls
          if ((e.target as HTMLElement).tagName !== "IMG" && (e.target as HTMLElement).tagName !== "BUTTON") {
            toggleControls();
          }
        }}
        style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top center" }}
      >
        {/* MODE 1: Vertical Continuous Scroll (Webtoon) */}
        {(readingMode === "VERTICAL_SCROLL" || readingMode === "WEBTOON") && (
          <div
            className="flex flex-col items-center w-full px-0 sm:px-2"
            style={{ gap: readingMode === "WEBTOON" ? 0 : `${pageGap}px` }}
          >
            {chapter.pages.map((p) => {
              const hasFailed = failedImages[p.pageNumber];
              return (
                <div key={p.id} className={`relative ${getImageScaleClass()} group flex flex-col items-center`}>
                  {hasFailed ? (
                    <div className="flex flex-col items-center justify-center p-12 border border-red-500/30 rounded-lg bg-red-500/10 text-center space-y-2 w-full max-w-md">
                      <p className="text-xs text-red-400">Failed to load page {p.pageNumber}</p>
                      <Button size="sm" variant="outline" onClick={() => handleRetryImage(p.pageNumber)} className="gap-1.5 text-xs">
                        <RefreshCw className="h-3 w-3" /> Retry Page
                      </Button>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getSafeImageUrl(p.imageUrl)}
                      alt={`Page ${p.pageNumber}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageError(e, p.pageNumber, p.imageUrl)}
                      className={`transition-opacity duration-300 ${
                        readingMode === "WEBTOON" ? "w-full block" : "rounded shadow-md"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MODE 2: Single Page Mode */}
        {readingMode === "SINGLE_PAGE" && (
          <div className="flex flex-col items-center justify-center w-full min-h-[75vh] px-4">
            {chapter.pages[currentPage - 1] && (
              <div className={`relative ${getImageScaleClass()} flex flex-col items-center`}>
                {failedImages[currentPage] ? (
                  <div className="flex flex-col items-center justify-center p-12 border border-red-500/30 rounded-lg bg-red-500/10 text-center space-y-2">
                    <p className="text-xs text-red-400">Failed to load page {currentPage}</p>
                    <Button size="sm" variant="outline" onClick={() => handleRetryImage(currentPage)}>
                      <RefreshCw className="h-3 w-3" /> Retry
                    </Button>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getSafeImageUrl(chapter.pages[currentPage - 1].imageUrl)}
                    alt={`Page ${currentPage}`}
                    referrerPolicy="no-referrer"
                    onError={(e) =>
                      handleImageError(
                        e,
                        currentPage,
                        chapter.pages[currentPage - 1].imageUrl
                      )
                    }
                    className="rounded shadow-xl cursor-pointer"
                    onClick={() => {
                      readingDirection === "RTL" ? prevPage() : nextPage();
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* MODE 3: Double Page Mode */}
        {readingMode === "DOUBLE_PAGE" && (
          <div className="flex items-center justify-center w-full min-h-[75vh] px-4 gap-2">
            {/* Page A */}
            {chapter.pages[currentPage - 1] && (
              <div className="max-w-[48%] flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getSafeImageUrl(chapter.pages[currentPage - 1].imageUrl)}
                  alt={`Page ${currentPage}`}
                  referrerPolicy="no-referrer"
                  onError={(e) =>
                    handleImageError(
                      e,
                      currentPage,
                      chapter.pages[currentPage - 1].imageUrl
                    )
                  }
                  className="max-h-[85vh] w-auto rounded object-contain shadow-lg"
                />
              </div>
            )}
            {/* Page B (if exists) */}
            {chapter.pages[currentPage] && (
              <div className="max-w-[48%] flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getSafeImageUrl(chapter.pages[currentPage].imageUrl)}
                  alt={`Page ${currentPage + 1}`}
                  referrerPolicy="no-referrer"
                  onError={(e) =>
                    handleImageError(
                      e,
                      currentPage + 1,
                      chapter.pages[currentPage].imageUrl
                    )
                  }
                  className="max-h-[85vh] w-auto rounded object-contain shadow-lg"
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Floating Navigation & Page Controls */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ${
          showControls ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between liquid-glass-obsidian border-t border-white/[0.08] px-6 py-3.5 gap-3 shadow-2xl">
          {/* Chapter Jump Buttons */}
          <div className="flex items-center space-x-2">
            {chapter.prevChapter ? (
              <Link href={`/read/${chapter.prevChapter.id}`}>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-white/10 text-white hover:bg-white/10 hover:border-cyan-500/30">
                  <ChevronLeft className="h-4 w-4" /> Prev Chapter
                </Button>
              </Link>
            ) : (
              <Button disabled variant="outline" size="sm" className="h-8 text-xs border-white/5 text-white/30">
                First Chapter
              </Button>
            )}

            {chapter.nextChapter ? (
              <Link href={`/read/${chapter.nextChapter.id}`}>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-white/10 text-white hover:bg-white/10 hover:border-cyan-500/30">
                  Next Chapter <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button disabled variant="outline" size="sm" className="h-8 text-xs border-white/5 text-white/30">
                Latest Chapter
              </Button>
            )}
          </div>

          {/* Page Counter & Jumper (optional for paginated modes) */}
          {showPageNumbers && readingMode !== "VERTICAL_SCROLL" && readingMode !== "WEBTOON" && (
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={prevPage}
                disabled={currentPage <= 1}
                className="h-8 w-8 p-0 text-white hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center space-x-1.5 text-xs font-mono font-bold px-3 py-1 rounded-full bg-white/[0.06] border border-white/10">
                <span className="text-cyan-400">{currentPage}</span>
                <span className="text-white/40">/</span>
                <span className="text-white/80">{chapter.pages.length}</span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={nextPage}
                disabled={currentPage >= chapter.pages.length}
                className="h-8 w-8 p-0 text-white hover:bg-white/10"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="sm" onClick={zoomOut} className="h-8 w-8 p-0 text-white hover:bg-white/10">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono text-white/80 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10">{Math.round(zoomLevel * 100)}%</span>
            <Button variant="ghost" size="sm" onClick={zoomIn} className="h-8 w-8 p-0 text-white hover:bg-white/10">
              <ZoomIn className="h-4 w-4" />
            </Button>
            {zoomLevel !== 1 && (
              <Button variant="ghost" size="sm" onClick={resetZoom} className="h-8 w-8 p-0 text-white hover:bg-white/10">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Reader Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogHeader>
          <DialogTitle>Reader Settings</DialogTitle>
          <DialogDescription>
            Customize display mode, directions, scaling, and theme colors.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-3 text-xs">
          {/* Reading Mode */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Reading Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "VERTICAL_SCROLL", label: "Vertical Scroll" },
                { id: "WEBTOON", label: "Webtoon Continuous" },
                { id: "SINGLE_PAGE", label: "Single Page" },
                { id: "DOUBLE_PAGE", label: "Double Page" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setReadingMode(m.id as ReadingMode)}
                  className={`p-2 rounded-xl border text-left text-xs font-medium transition-colors ${
                    readingMode === m.id
                      ? "border-sky-500 bg-sky-500/15 text-sky-300"
                      : "border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reading Direction */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Reading Direction
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "LTR", label: "Left to Right" },
                { id: "RTL", label: "Right to Left (Manga)" },
                { id: "VERTICAL", label: "Vertical" },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setReadingDirection(d.id as ReadingDirection)}
                  className={`p-2 rounded-xl border text-center text-xs font-medium transition-colors ${
                    readingDirection === d.id
                      ? "border-sky-500 bg-sky-500/15 text-sky-300"
                      : "border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Image Scaling */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Image Scaling
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "FIT_WIDTH", label: "Fit Width" },
                { id: "FIT_HEIGHT", label: "Fit Height" },
                { id: "ORIGINAL", label: "Original" },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setImageScaling(s.id as ImageScaling)}
                  className={`p-2 rounded-xl border text-center text-xs font-medium transition-colors ${
                    imageScaling === s.id
                      ? "border-sky-500 bg-sky-500/15 text-sky-300"
                      : "border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Background Color */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Background Color
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "DARK", label: "Dark", color: "#0B0D12" },
                { id: "BLACK", label: "Pure Black", color: "#000000" },
                { id: "GRAY", label: "Charcoal", color: "#262626" },
                { id: "LIGHT", label: "Light", color: "#F5F5F5" },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBackgroundColor(b.id as ReaderBg)}
                  className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
                    backgroundColor === b.id
                      ? "border-sky-500 bg-sky-500/15 text-sky-300"
                      : "border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: b.color }} />
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Page Number Visibility */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <div>
              <div className="text-xs font-semibold text-slate-200">Show Page Indicator</div>
              <p className="text-[11px] text-slate-400">Display page numbers during reading</p>
            </div>
            <button
              onClick={() => setShowPageNumbers(!showPageNumbers)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                showPageNumbers
                  ? "border-sky-500 bg-sky-500/15 text-sky-300"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {showPageNumbers ? "Visible" : "Hidden (Clean)"}
            </button>
          </div>

          {/* Page Gap Slider (for continuous mode) */}
          {(readingMode === "VERTICAL_SCROLL" || readingMode === "WEBTOON") && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Page Gap: {pageGap}px
                </label>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="4"
                value={pageGap}
                onChange={(e) => setPageGap(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
            </div>
          )}

          {/* Shortcuts Info */}
          <div className="pt-2 border-t border-border/60">
            <h5 className="font-bold text-foreground mb-1">Keyboard Shortcuts</h5>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <div><kbd className="px-1 py-0.5 rounded bg-surface-elevated border border-border">← / →</kbd> Next/Prev Page</div>
              <div><kbd className="px-1 py-0.5 rounded bg-surface-elevated border border-border">F</kbd> Fullscreen</div>
              <div><kbd className="px-1 py-0.5 rounded bg-surface-elevated border border-border">H</kbd> Hide/Show UI</div>
              <div><kbd className="px-1 py-0.5 rounded bg-surface-elevated border border-border">A / D</kbd> Prev/Next Chapter</div>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Chapter Selection Drawer */}
      <Dialog open={isChapterListOpen} onOpenChange={setIsChapterListOpen}>
        <DialogHeader>
          <DialogTitle>Select Chapter</DialogTitle>
          <DialogDescription>{chapter.manga.title}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-1 pr-1">
          {allChapters.map((ch: any) => (
            <Link
              key={ch.id}
              href={`/read/${ch.id}`}
              onClick={() => setIsChapterListOpen(false)}
              className={`flex items-center justify-between p-2.5 rounded-md border text-xs transition-colors ${
                ch.id === chapter.id
                  ? "border-primary bg-primary/20 text-primary font-bold"
                  : "border-border bg-surface-elevated text-foreground hover:bg-surface-elevated/80"
              }`}
            >
              <span>Chapter {ch.chapterNumber}</span>
              {ch.chapterTitle && <span className="text-muted-foreground truncate max-w-[180px]">{ch.chapterTitle}</span>}
            </Link>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
