"use client";

import { create } from "zustand";

export type ReadingMode = "VERTICAL_SCROLL" | "SINGLE_PAGE" | "DOUBLE_PAGE" | "WEBTOON";
export type ReadingDirection = "LTR" | "RTL" | "VERTICAL";
export type ImageScaling = "FIT_WIDTH" | "FIT_HEIGHT" | "ORIGINAL";
export type ReaderBg = "DARK" | "BLACK" | "GRAY" | "LIGHT";

interface ReaderState {
  readingMode: ReadingMode;
  readingDirection: ReadingDirection;
  imageScaling: ImageScaling;
  backgroundColor: ReaderBg;
  pageGap: number;
  preloadCount: number;
  showPageNumbers: boolean;
  currentPage: number;
  totalPages: number;
  zoomLevel: number;
  showControls: boolean;
  isFullscreen: boolean;
  smoothScroll: boolean;
  autoHideNavbar: boolean;

  // Actions
  setReadingMode: (mode: ReadingMode) => void;
  setReadingDirection: (dir: ReadingDirection) => void;
  setImageScaling: (scaling: ImageScaling) => void;
  setBackgroundColor: (bg: ReaderBg) => void;
  setPageGap: (gap: number) => void;
  setShowPageNumbers: (show: boolean) => void;
  setSmoothScroll: (enabled: boolean) => void;
  setAutoHideNavbar: (enabled: boolean) => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (total: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  toggleControls: () => void;
  setShowControls: (show: boolean) => void;
  toggleFullscreen: () => void;
  loadPreferences: () => Promise<void>;
  savePreferences: () => Promise<void>;
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  readingMode: "VERTICAL_SCROLL",
  readingDirection: "LTR",
  imageScaling: "FIT_WIDTH",
  backgroundColor: "DARK",
  pageGap: 0,
  preloadCount: 2,
  showPageNumbers: false,
  currentPage: 1,
  totalPages: 1,
  zoomLevel: 1,
  showControls: true,
  isFullscreen: false,
  smoothScroll: true,
  autoHideNavbar: true,

  setReadingMode: (mode) => {
    set({ readingMode: mode });
    get().savePreferences();
  },
  setReadingDirection: (dir) => {
    set({ readingDirection: dir });
    get().savePreferences();
  },
  setImageScaling: (scaling) => {
    set({ imageScaling: scaling });
    get().savePreferences();
  },
  setBackgroundColor: (bg) => {
    set({ backgroundColor: bg });
    get().savePreferences();
  },
  setPageGap: (gap) => {
    set({ pageGap: gap });
    get().savePreferences();
  },
  setShowPageNumbers: (show) => {
    set({ showPageNumbers: show });
    get().savePreferences();
  },
  setSmoothScroll: (enabled) => {
    set({ smoothScroll: enabled });
    get().savePreferences();
  },
  setAutoHideNavbar: (enabled) => {
    set({ autoHideNavbar: enabled });
    get().savePreferences();
  },
  setCurrentPage: (page) => {
    const clamped = Math.max(1, Math.min(page, get().totalPages));
    set({ currentPage: clamped });
  },
  setTotalPages: (total) => set({ totalPages: Math.max(1, total) }),
  nextPage: () => {
    const { currentPage, totalPages, readingMode } = get();
    const increment = readingMode === "DOUBLE_PAGE" ? 2 : 1;
    if (currentPage < totalPages) {
      set({ currentPage: Math.min(totalPages, currentPage + increment) });
    }
  },
  prevPage: () => {
    const { currentPage, readingMode } = get();
    const decrement = readingMode === "DOUBLE_PAGE" ? 2 : 1;
    if (currentPage > 1) {
      set({ currentPage: Math.max(1, currentPage - decrement) });
    }
  },
  zoomIn: () => set((state) => ({ zoomLevel: Math.min(2.5, state.zoomLevel + 0.25) })),
  zoomOut: () => set((state) => ({ zoomLevel: Math.max(0.5, state.zoomLevel - 0.25) })),
  resetZoom: () => set({ zoomLevel: 1 }),
  toggleControls: () => set((state) => ({ showControls: !state.showControls })),
  setShowControls: (show) => set({ showControls: show }),
  toggleFullscreen: () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      set({ isFullscreen: true });
    } else {
      document.exitFullscreen().catch(() => {});
      set({ isFullscreen: false });
    }
  },

  loadPreferences: async () => {
    // 1. Try local storage first
    try {
      const local = typeof window !== "undefined" ? localStorage.getItem("reader_prefs") : null;
      if (local) {
        const parsed = JSON.parse(local);
        set((state) => ({
          ...state,
          ...parsed,
          pageGap: typeof parsed.pageGap === "number" ? parsed.pageGap : state.pageGap,
        }));
      }
    } catch {}

    // 2. Fetch from DB if user is authenticated
    try {
      const res = await fetch("/api/user/preferences");
      if (res.ok) {
        const data = await res.json();
        if (data?.preference) {
          set((state) => ({
            readingMode: data.preference.readingMode ?? state.readingMode,
            readingDirection: data.preference.readingDirection ?? state.readingDirection,
            imageScaling: data.preference.imageScaling ?? state.imageScaling,
            backgroundColor: data.preference.backgroundColor ?? state.backgroundColor,
            pageGap: typeof data.preference.pageGap === "number" ? data.preference.pageGap : state.pageGap,
            preloadCount: typeof data.preference.preloadCount === "number" ? data.preference.preloadCount : state.preloadCount,
            showPageNumbers: typeof data.preference.showPageNumbers === "boolean" ? data.preference.showPageNumbers : state.showPageNumbers,
            smoothScroll: typeof data.preference.smoothScroll === "boolean" ? data.preference.smoothScroll : state.smoothScroll,
            autoHideNavbar: typeof data.preference.autoHideNavbar === "boolean" ? data.preference.autoHideNavbar : state.autoHideNavbar,
          }));
        }
      }
    } catch {}
  },

  savePreferences: async () => {
    const state = get();
    const prefs = {
      readingMode: state.readingMode,
      readingDirection: state.readingDirection,
      imageScaling: state.imageScaling,
      backgroundColor: state.backgroundColor,
      pageGap: state.pageGap,
      preloadCount: state.preloadCount,
      showPageNumbers: state.showPageNumbers,
      smoothScroll: state.smoothScroll,
      autoHideNavbar: state.autoHideNavbar,
    };

    try {
      localStorage.setItem("reader_prefs", JSON.stringify(prefs));
    } catch {}

    try {
      fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      }).catch(() => {});
    } catch {}
  },
}));
