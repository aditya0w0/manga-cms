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
  Layout,
  Palette,
  Navigation,
  Monitor,
  Check,
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
    smoothScroll,
    autoHideNavbar,
    scrollSpeed,
    setReadingMode,
    setReadingDirection,
    setImageScaling,
    setBackgroundColor,
    setPageGap,
    setShowPageNumbers,
    setSmoothScroll,
    setAutoHideNavbar,
    setScrollSpeed,
    setCurrentPage,
    setTotalPages,
    nextPage,
    prevPage,
    zoomIn,
    zoomOut,
    resetZoom,
    toggleControls,
    setShowControls,
    toggleFullscreen,
    loadPreferences,
  } = useReaderStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"layout" | "appearance" | "behavior">("layout");
  const [isChapterListOpen, setIsChapterListOpen] = useState(false);
  const [allChapters, setAllChapters] = useState<any[]>([]);
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const progressDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const showControlsRef = useRef(showControls);
  showControlsRef.current = showControls;

  // Frame-rate independent continuous physics engine (exponential lerp)
  const physicsRef = useRef<{
    animId: number | null;
    targetY: number;
    currentY: number;
    lastTime: number;
    isScrolling: boolean;
  }>({
    animId: null,
    targetY: 0,
    currentY: 0,
    lastTime: 0,
    isScrolling: false,
  });

  // Reading pace configuration: step ratio and exponential stiffness
  const getPaceConfig = useCallback(() => {
    switch (scrollSpeed) {
      case "FAST":
        return {
          ratio: 0.65,
          stiffness: 15.0, // Brisk settling in ~180ms
        };
      case "BALANCED":
        return {
          ratio: 0.52,
          stiffness: 11.0, // Crisp settling in ~250ms
        };
      case "IMMERSIVE":
      default:
        return {
          ratio: 0.44, // 44% screen height: leaves 56% panel context visible so the eye never loses position
          stiffness: 8.0, // Butter-smooth continuous deceleration settling in ~350ms
        };
    }
  }, [scrollSpeed]);

  const triggerSmoothScroll = useCallback((delta: number) => {
    if (typeof window === "undefined") return;

    const { stiffness } = getPaceConfig();
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const scrollY = window.scrollY;

    // Accumulate onto current targetY if already in flight (continuous momentum chaining without lag)
    const isRunning = physicsRef.current.animId !== null && physicsRef.current.isScrolling;
    const baseTarget = isRunning ? physicsRef.current.targetY : scrollY;
    const nextTarget = Math.max(0, Math.min(baseTarget + delta, maxScroll));

    physicsRef.current.targetY = nextTarget;
    if (!isRunning) {
      physicsRef.current.currentY = scrollY;
    }

    if (Math.abs(physicsRef.current.targetY - scrollY) < 1 && !isRunning) {
      return;
    }

    physicsRef.current.lastTime = performance.now();
    physicsRef.current.isScrolling = true;

    if (physicsRef.current.animId !== null) {
      return; // rAF loop is already running and will smoothly consume the new targetY
    }

    const step = (currentTime: number) => {
      const dt = Math.min((currentTime - physicsRef.current.lastTime) / 1000, 0.05);
      physicsRef.current.lastTime = currentTime;

      // Frame-rate independent exponential lerp factor: 1 - exp(-stiffness * dt)
      const factor = 1 - Math.exp(-stiffness * dt);
      const diff = physicsRef.current.targetY - physicsRef.current.currentY;

      if (Math.abs(diff) < 0.5) {
        physicsRef.current.currentY = physicsRef.current.targetY;
        window.scrollTo({ top: Math.round(physicsRef.current.targetY), behavior: "instant" });
        physicsRef.current.animId = null;
        physicsRef.current.isScrolling = false;
        return;
      }

      physicsRef.current.currentY += diff * factor;
      window.scrollTo({ top: physicsRef.current.currentY, behavior: "instant" });
      physicsRef.current.animId = requestAnimationFrame(step);
    };

    physicsRef.current.animId = requestAnimationFrame(step);
  }, [getPaceConfig]);

  // Synchronize physics engine with manual mouse wheel, trackpad, and touch input
  useEffect(() => {
    const handleUserInterruption = () => {
      if (physicsRef.current.animId !== null) {
        cancelAnimationFrame(physicsRef.current.animId);
        physicsRef.current.animId = null;
      }
      physicsRef.current.isScrolling = false;
      physicsRef.current.currentY = window.scrollY;
      physicsRef.current.targetY = window.scrollY;
    };

    window.addEventListener("wheel", handleUserInterruption, { passive: true });
    window.addEventListener("touchstart", handleUserInterruption, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleUserInterruption);
      window.removeEventListener("touchstart", handleUserInterruption);
      if (physicsRef.current.animId !== null) {
        cancelAnimationFrame(physicsRef.current.animId);
      }
    };
  }, []);

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

  // Load user preferences once on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // When chapter changes, initialize page count, reset reading position, and scroll to top
  useEffect(() => {
    setTotalPages(chapter.pages.length);
    setCurrentPage(1);
    setFailedImages({});
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [chapter.id, chapter.pages.length, setCurrentPage, setTotalPages]);

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

  // Prevent browser smooth-scroll collision with physics engine
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.scrollBehavior = "auto";
    }
    return () => {
      if (typeof document !== "undefined") {
        document.documentElement.style.scrollBehavior = "";
      }
    };
  }, []);

  // Auto-Hide Navbar during reading with guarded updates (no mid-scroll re-render churn)
  useEffect(() => {
    if (!autoHideNavbar) return;

    let lastY = window.scrollY;
    let idleTimer: NodeJS.Timeout | null = null;

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        // Hide controls after 3.5s of reading inactivity if scrolled down
        if (window.scrollY > 80 && showControlsRef.current) {
          showControlsRef.current = false;
          setShowControls(false);
        }
      }, 3500);
    };

    const handleScroll = () => {
      const currentY = window.scrollY;

      // Sync physics target when user manually drags scrollbar or wheels
      if (!physicsRef.current.isScrolling) {
        physicsRef.current.currentY = currentY;
        physicsRef.current.targetY = currentY;
      }

      const delta = currentY - lastY;

      // Guarded updates: only trigger React store dispatch on state change
      if (delta > 20 && currentY > 60) {
        if (showControlsRef.current) {
          showControlsRef.current = false;
          setShowControls(false);
        }
      } else if (delta < -20) {
        if (!showControlsRef.current) {
          showControlsRef.current = true;
          setShowControls(true);
        }
      }

      lastY = currentY;
      resetIdleTimer();
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Reveal controls when hovering near top or bottom edges
      if ((e.clientY < 90 || e.clientY > window.innerHeight - 90) && !showControlsRef.current) {
        showControlsRef.current = true;
        setShowControls(true);
      }
      resetIdleTimer();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    resetIdleTimer();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [autoHideNavbar, setShowControls]);

  // Global Keyboard Navigation (with Arrow, Space, PageDown/Up Support)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input or textarea
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === "Escape") {
        if (isSettingsOpen) setIsSettingsOpen(false);
        if (isChapterListOpen) setIsChapterListOpen(false);
        return;
      }

      // If settings or chapter dialog is open, do not handle reader navigation shortcuts
      if (isSettingsOpen || isChapterListOpen) {
        return;
      }

      const isRTL = readingDirection === "RTL";
      const isPaginated = readingMode === "SINGLE_PAGE" || readingMode === "DOUBLE_PAGE";
      const isLastPage = isPaginated && currentPage >= chapter.pages.length;
      const isFirstPage = isPaginated && currentPage <= 1;

      switch (e.key) {
        case " ":
        case "Space":
        case "Spacebar": {
          e.preventDefault();
          const { ratio } = getPaceConfig();
          // Calibrated step distance preserving generous overlapping context for reading focus
          const distance = Math.round(window.innerHeight * ratio);
          const isScrollableMode = readingMode === "VERTICAL_SCROLL" || readingMode === "WEBTOON";

          if (isScrollableMode) {
            const isAtBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 50;
            if (isAtBottom && !e.shiftKey) {
              if (chapter.nextChapter) {
                router.push(`/read/${chapter.nextChapter.id}`);
              }
              break;
            }

            if (e.shiftKey) {
              if (smoothScroll) {
                triggerSmoothScroll(-distance);
              } else {
                window.scrollBy({ top: -distance, behavior: "instant" });
              }
            } else {
              if (smoothScroll) {
                triggerSmoothScroll(distance);
              } else {
                window.scrollBy({ top: distance, behavior: "instant" });
              }
            }
          } else {
            // Paginated mode (Single or Double Page)
            const isAtBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 30;
            const isAtTop = window.scrollY <= 10;

            if (e.shiftKey) {
              if (!isAtTop) {
                if (smoothScroll) {
                  triggerSmoothScroll(-distance);
                } else {
                  window.scrollBy({ top: -distance, behavior: "instant" });
                }
              } else {
                prevPage();
              }
            } else {
              if (!isAtBottom) {
                if (smoothScroll) {
                  triggerSmoothScroll(distance);
                } else {
                  window.scrollBy({ top: distance, behavior: "instant" });
                }
              } else {
                if (isLastPage && chapter.nextChapter) {
                  router.push(`/read/${chapter.nextChapter.id}`);
                } else {
                  nextPage();
                  window.scrollTo({ top: 0, behavior: "instant" });
                }
              }
            }
          }
          break;
        }

        case "PageDown": {
          e.preventDefault();
          const { ratio } = getPaceConfig();
          const distance = Math.round(window.innerHeight * ratio);
          if (smoothScroll) {
            triggerSmoothScroll(distance);
          } else {
            window.scrollBy({ top: distance, behavior: "instant" });
          }
          break;
        }

        case "PageUp": {
          e.preventDefault();
          const { ratio } = getPaceConfig();
          const distance = Math.round(window.innerHeight * ratio);
          if (smoothScroll) {
            triggerSmoothScroll(-distance);
          } else {
            window.scrollBy({ top: -distance, behavior: "instant" });
          }
          break;
        }

        case "ArrowRight":
          if (isRTL) {
            if (isFirstPage && chapter.prevChapter) {
              router.push(`/read/${chapter.prevChapter.id}`);
            } else {
              prevPage();
            }
          } else {
            if (isLastPage && chapter.nextChapter) {
              router.push(`/read/${chapter.nextChapter.id}`);
            } else if (!isPaginated && chapter.nextChapter) {
              router.push(`/read/${chapter.nextChapter.id}`);
            } else {
              nextPage();
            }
          }
          break;

        case "ArrowLeft":
          if (isRTL) {
            if (isLastPage && chapter.nextChapter) {
              router.push(`/read/${chapter.nextChapter.id}`);
            } else if (!isPaginated && chapter.nextChapter) {
              router.push(`/read/${chapter.nextChapter.id}`);
            } else {
              nextPage();
            }
          } else {
            if (isFirstPage && chapter.prevChapter) {
              router.push(`/read/${chapter.prevChapter.id}`);
            } else if (!isPaginated && chapter.prevChapter) {
              router.push(`/read/${chapter.prevChapter.id}`);
            } else {
              prevPage();
            }
          }
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
    readingMode,
    currentPage,
    chapter.pages.length,
    nextPage,
    prevPage,
    toggleFullscreen,
    toggleControls,
    chapter.prevChapter,
    chapter.nextChapter,
    router,
    smoothScroll,
    getPaceConfig,
    triggerSmoothScroll,
    isSettingsOpen,
    isChapterListOpen,
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

  const handleViewportClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Do not toggle controls if user clicked on buttons, links, inputs, sliders, or inside open dialogs
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("[role='dialog']")
    ) {
      return;
    }

    if (readingMode === "SINGLE_PAGE" || readingMode === "DOUBLE_PAGE") {
      const x = e.clientX;
      const width = window.innerWidth;
      const isRTL = readingDirection === "RTL";
      if (x < width * 0.3) {
        if (isRTL) {
          nextPage();
        } else {
          prevPage();
        }
        return;
      }
      if (x > width * 0.7) {
        if (isRTL) {
          prevPage();
        } else {
          nextPage();
        }
        return;
      }
    }

    toggleControls();
  };

  return (
    <div className={`relative min-h-screen select-none ${getBgClass()} transition-colors duration-300`}>
      {/* Top Floating Control Bar */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ease-in-out will-change-transform ${
          showControls
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
        style={{ transform: "translateZ(0)" }}
      >
        <div className="flex items-center justify-between liquid-glass-obsidian border-b border-white/[0.08] px-4 py-3 shadow-2xl backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <Link href={`/manga/${chapter.manga.slug}`}>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-white hover:bg-white/10">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline font-bold">{chapter.manga.title}</span>
              </Button>
            </Link>
            <span className="text-xs font-bold text-cyan-400 px-3 py-1 rounded-full liquid-glass-pill font-mono">
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
              className="h-8 text-xs gap-1.5 text-white liquid-glass-pill px-3 hover:border-cyan-400/40"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Chapters</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="h-8 text-xs gap-1.5 text-white liquid-glass-pill px-3 hover:border-cyan-400/40"
            >
              <Sliders className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="h-8 text-white liquid-glass-pill px-2.5 hover:border-cyan-400/40"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Reading Viewport */}
      <main
        className="pt-14 pb-20 min-h-screen flex flex-col items-center justify-center cursor-default w-full"
        onClick={handleViewportClick}
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
                <div
                  key={p.id}
                  className={`relative ${getImageScaleClass()} group flex flex-col items-center`}
                  style={{ contain: "layout paint" }}
                >
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
                      decoding="async"
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
                    decoding="async"
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
                  decoding="async"
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
                  decoding="async"
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

        {/* End of Chapter Navigation Card */}
        <div className="w-full max-w-2xl mx-auto px-4 pt-10 pb-6 flex flex-col items-center text-center space-y-3">
          <div className="p-6 rounded-2xl liquid-glass-obsidian border border-white/10 shadow-2xl w-full space-y-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              End of Chapter {chapter.chapterNumber}
            </span>
            <h3 className="text-base font-bold text-foreground">
              {chapter.nextChapter
                ? `Next Chapter: Chapter ${chapter.nextChapter.chapterNumber}`
                : "You have reached the latest chapter"}
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              {chapter.prevChapter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/read/${chapter.prevChapter!.id}`)}
                  className="gap-1.5 text-xs text-slate-300 border-slate-700 hover:bg-slate-800"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev Chapter
                </Button>
              )}
              {chapter.nextChapter ? (
                <Button
                  size="sm"
                  onClick={() => router.push(`/read/${chapter.nextChapter!.id}`)}
                  className="gap-1.5 text-xs liquid-glass-btn-primary font-bold shadow-md"
                >
                  Read Chapter {chapter.nextChapter.chapterNumber}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Link href={`/manga/${chapter.manga.slug}`}>
                  <Button size="sm" variant="outline" className="text-xs border-slate-700 text-slate-300">
                    Series Overview
                  </Button>
                </Link>
              )}
            </div>
            {chapter.nextChapter && (
              <p className="text-[11px] text-slate-400 font-mono pt-1">
                Press <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-white/15 text-white font-mono">Arrow Right</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-white/15 text-white font-mono">D</kbd> for next chapter
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Floating Navigation & Page Controls */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ease-in-out will-change-transform ${
          showControls ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`}
        style={{ transform: "translateZ(0)" }}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between liquid-glass-obsidian border-t border-white/[0.08] px-6 py-3.5 gap-3 shadow-2xl backdrop-blur-md">
          {/* Chapter Jump Buttons */}
          <div className="flex items-center space-x-2">
            {chapter.prevChapter ? (
              <Link href={`/read/${chapter.prevChapter.id}`}>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 liquid-glass-pill text-white hover:border-cyan-400/40 px-3">
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
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 liquid-glass-pill text-white hover:border-cyan-400/40 px-3">
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

              <div className="flex items-center space-x-1.5 text-xs font-mono font-bold px-3.5 py-1 rounded-full liquid-glass-pill">
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

      {/* Reader Settings Modal (Crafted Anti-Slop Segmented Design) */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} className="max-w-xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-white tracking-tight">Reader Settings</DialogTitle>
          <DialogDescription className="text-xs text-neutral-400">
            Configure layout viewports, reading directions, canvas styles, and navigation interactions.
          </DialogDescription>
        </DialogHeader>

        {/* Segmented Category Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/10 my-3">
          <button
            type="button"
            onClick={() => setSettingsTab("layout")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              settingsTab === "layout"
                ? "bg-sky-500/20 text-sky-300 border border-sky-400/30 shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Layout className="h-3.5 w-3.5" />
            Layout
          </button>
          <button
            type="button"
            onClick={() => setSettingsTab("appearance")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              settingsTab === "appearance"
                ? "bg-sky-500/20 text-sky-300 border border-sky-400/30 shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            Appearance
          </button>
          <button
            type="button"
            onClick={() => setSettingsTab("behavior")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              settingsTab === "behavior"
                ? "bg-sky-500/20 text-sky-300 border border-sky-400/30 shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Navigation className="h-3.5 w-3.5" />
            Navigation
          </button>
        </div>

        {/* Tab 1: Layout & Modes */}
        {settingsTab === "layout" && (
          <div className="space-y-4 text-xs py-1">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-2">
                Reading Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "VERTICAL_SCROLL", label: "Vertical Scroll", desc: "Standard webtoon view with spacing" },
                  { id: "WEBTOON", label: "Webtoon Seamless", desc: "Flush continuous page strip" },
                  { id: "SINGLE_PAGE", label: "Single Page", desc: "Classic one page pagination" },
                  { id: "DOUBLE_PAGE", label: "Double Page", desc: "Two pages side by side spread" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setReadingMode(m.id as ReadingMode)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-0.5 ${
                      readingMode === m.id
                        ? "border-sky-400 bg-sky-500/15 text-white shadow-sm"
                        : "border-white/10 bg-white/[0.02] text-neutral-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className={`font-semibold ${readingMode === m.id ? "text-sky-300" : "text-white"}`}>
                      {m.label}
                    </span>
                    <span className="text-[11px] text-neutral-400 line-clamp-1">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-2">
                Reading Direction
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "LTR", label: "Left to Right" },
                  { id: "RTL", label: "Right to Left (Manga)" },
                  { id: "VERTICAL", label: "Vertical Flow" },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setReadingDirection(d.id as ReadingDirection)}
                    className={`py-2 px-3 rounded-xl border text-center font-medium transition-all ${
                      readingDirection === d.id
                        ? "border-sky-400 bg-sky-500/15 text-sky-200 shadow-sm"
                        : "border-white/10 bg-white/[0.02] text-neutral-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {(readingMode === "VERTICAL_SCROLL" || readingMode === "WEBTOON") && (
              <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white">Page Gap</span>
                    <p className="text-[11px] text-neutral-400">Vertical separation between consecutive pages</p>
                  </div>
                  <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-400/30 px-2 py-0.5 rounded-md">
                    {pageGap}px
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="2"
                  value={pageGap}
                  onChange={(e) => setPageGap(Number(e.target.value))}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                />
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[11px] text-neutral-400 mr-1">Presets:</span>
                  {[
                    { val: 0, label: "0px (Flush)" },
                    { val: 8, label: "8px" },
                    { val: 16, label: "16px" },
                    { val: 24, label: "24px" },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setPageGap(p.val)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                        pageGap === p.val
                          ? "border-sky-400 bg-sky-500/20 text-sky-200"
                          : "border-white/10 text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-2">
                Image Scaling
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "FIT_WIDTH", label: "Fit Width" },
                  { id: "FIT_HEIGHT", label: "Fit Height" },
                  { id: "ORIGINAL", label: "Original Size" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setImageScaling(s.id as ImageScaling)}
                    className={`py-2 px-3 rounded-xl border text-center font-medium transition-all ${
                      imageScaling === s.id
                        ? "border-sky-400 bg-sky-500/15 text-sky-200 shadow-sm"
                        : "border-white/10 bg-white/[0.02] text-neutral-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Theme & Appearance */}
        {settingsTab === "appearance" && (
          <div className="space-y-4 text-xs py-1">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-2">
                Canvas Background Theme
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "DARK", label: "Dark Obsidian", color: "#0B0D12", border: "border-neutral-700" },
                  { id: "BLACK", label: "Pure OLED Black", color: "#000000", border: "border-neutral-800" },
                  { id: "GRAY", label: "Charcoal Slate", color: "#262626", border: "border-neutral-600" },
                  { id: "LIGHT", label: "Clean Paper", color: "#F5F5F5", border: "border-neutral-300" },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBackgroundColor(b.id as ReaderBg)}
                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                      backgroundColor === b.id
                        ? "border-sky-400 bg-sky-500/15 text-white shadow-sm"
                        : "border-white/10 bg-white/[0.02] text-neutral-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full border shadow-inner ${b.border}`}
                      style={{ backgroundColor: b.color }}
                    />
                    <span className="font-semibold text-xs">{b.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between">
              <div>
                <span className="font-semibold text-white">Page Number Badge</span>
                <p className="text-[11px] text-neutral-400">Display floating page counter indicator during reading</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPageNumbers(!showPageNumbers)}
                className={`px-3 py-1.5 rounded-xl font-medium border transition-colors ${
                  showPageNumbers
                    ? "border-sky-400 bg-sky-500/20 text-sky-200"
                    : "border-white/10 text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                {showPageNumbers ? "Visible" : "Hidden"}
              </button>
            </div>

            <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between">
              <div>
                <span className="font-semibold text-white">Fullscreen Display</span>
                <p className="text-[11px] text-neutral-400">Expand reader to cover the physical display</p>
              </div>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="px-3 py-1.5 rounded-xl font-medium border border-white/10 text-neutral-300 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Navigation & Behavior */}
        {settingsTab === "behavior" && (
          <div className="space-y-4 text-xs py-1">
            <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between">
              <div>
                <span className="font-semibold text-white">Auto-Hide Navigation Bars</span>
                <p className="text-[11px] text-neutral-400">Automatically hide header and footer controls while scrolling</p>
              </div>
              <button
                type="button"
                onClick={() => setAutoHideNavbar(!autoHideNavbar)}
                className={`px-3 py-1.5 rounded-xl font-medium border transition-colors ${
                  autoHideNavbar
                    ? "border-sky-400 bg-sky-500/20 text-sky-200"
                    : "border-white/10 text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                {autoHideNavbar ? "Auto-Hide" : "Sticky"}
              </button>
            </div>

            <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between">
              <div>
                <span className="font-semibold text-white">Smooth Scrolling</span>
                <p className="text-[11px] text-neutral-400">Fluid viewport scrolling animations during reading</p>
              </div>
              <button
                type="button"
                onClick={() => setSmoothScroll(!smoothScroll)}
                className={`px-3 py-1.5 rounded-xl font-medium border transition-colors ${
                  smoothScroll
                    ? "border-sky-400 bg-sky-500/20 text-sky-200"
                    : "border-white/10 text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                {smoothScroll ? "Smooth" : "Instant"}
              </button>
            </div>

            {smoothScroll && (
              <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
                <div>
                  <span className="font-semibold text-white">Scroll Pace</span>
                  <p className="text-[11px] text-neutral-400">Glide velocity and step distance for Spacebar reading</p>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { id: "IMMERSIVE", label: "Immersive Glide", desc: "44% step, soft curve" },
                    { id: "BALANCED", label: "Balanced", desc: "52% step, medium" },
                    { id: "FAST", label: "Brisk", desc: "65% step, faster" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setScrollSpeed(p.id as any)}
                      className={`p-2 rounded-lg border text-center transition-all flex flex-col items-center gap-0.5 ${
                        scrollSpeed === p.id
                          ? "border-sky-400 bg-sky-500/20 text-sky-200 shadow-sm"
                          : "border-white/10 text-neutral-400 hover:text-white hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="font-semibold text-xs">{p.label}</span>
                      <span className="text-[10px] text-neutral-400">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-2">
                Keyboard Shortcuts
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg border border-white/5 bg-white/[0.02] flex items-center justify-between col-span-2">
                  <span className="text-neutral-300">Smooth Scroll Down / Up</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/15 text-neutral-200 font-mono text-[11px]">
                    Space / Shift+Space
                  </kbd>
                </div>
                <div className="p-2.5 rounded-lg border border-white/5 bg-white/[0.02] flex items-center justify-between">
                  <span className="text-neutral-300">Page or Chapter</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/15 text-neutral-200 font-mono text-[11px]">
                    Left / Right
                  </kbd>
                </div>
                <div className="p-2.5 rounded-lg border border-white/5 bg-white/[0.02] flex items-center justify-between">
                  <span className="text-neutral-300">Next / Prev Chapter</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/15 text-neutral-200 font-mono text-[11px]">
                    A / D
                  </kbd>
                </div>
                <div className="p-2.5 rounded-lg border border-white/5 bg-white/[0.02] flex items-center justify-between">
                  <span className="text-neutral-300">Toggle Fullscreen</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/15 text-neutral-200 font-mono text-[11px]">
                    F
                  </kbd>
                </div>
                <div className="p-2.5 rounded-lg border border-white/5 bg-white/[0.02] flex items-center justify-between">
                  <span className="text-neutral-300">Show / Hide UI</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/15 text-neutral-200 font-mono text-[11px]">
                    H
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
          <Button
            size="sm"
            onClick={() => setIsSettingsOpen(false)}
            className="liquid-glass-btn-primary px-4 py-1.5 text-xs font-semibold"
          >
            Save & Close
          </Button>
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
