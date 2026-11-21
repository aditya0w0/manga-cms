"use client";

import { create } from "zustand";

export interface BookmarkedMangaItem {
  id: string;
  mangaId: string;
  bookmarkedAt: string;
  manga: {
    id: string;
    title: string;
    slug: string;
    coverUrl?: string | null;
    publicationStatus: string;
    contentType: string;
    totalChapters: number;
    latestChapter?: {
      id: string;
      chapterNumber: number;
      title?: string | null;
      createdAt: string;
    } | null;
    genres: string[];
  };
  readingProgress?: {
    chapterId: string;
    chapterNumber: number;
    chapterTitle?: string | null;
    pageNumber: number;
    percentRead: number;
    isCompleted: boolean;
    lastReadAt: string;
  } | null;
  unreadChapters: number;
}

export interface HistoryItem {
  id: string;
  userId: string;
  mangaId: string;
  chapterId: string;
  pageNumber: number;
  percentRead: number;
  isCompleted: boolean;
  lastReadAt: string;
  manga: {
    id: string;
    title: string;
    slug: string;
    coverUrl?: string | null;
    publicationStatus: string;
  };
  chapter: {
    id: string;
    chapterNumber: number;
    chapterTitle?: string | null;
  };
}

export interface LibraryEntryItem {
  id: string;
  mangaId: string;
  status: "READING" | "COMPLETED" | "ON_HOLD" | "PLAN_TO_READ" | "DROPPED";
  score?: number | null;
  isFavorite: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  manga: {
    id: string;
    title: string;
    slug: string;
    coverUrl?: string | null;
    publicationStatus: string;
    contentType: string;
    totalChapters: number;
    latestChapter?: {
      id: string;
      chapterNumber: number;
      title?: string | null;
      createdAt: string;
    } | null;
    genres: string[];
  };
  readingProgress?: {
    chapterId: string;
    chapterNumber: number;
    chapterTitle?: string | null;
    pageNumber: number;
    percentRead: number;
    isCompleted: boolean;
    lastReadAt: string;
  } | null;
}

interface UserLibraryState {
  bookmarks: BookmarkedMangaItem[];
  bookmarkedIds: Set<string>;
  history: HistoryItem[];
  libraryItems: LibraryEntryItem[];
  isLoading: boolean;
  hasSyncedGuestData: boolean;

  // Actions
  fetchBookmarks: (options?: { search?: string; sortBy?: string }) => Promise<void>;
  fetchHistory: (options?: { search?: string }) => Promise<void>;
  fetchLibrary: (options?: { status?: string; search?: string }) => Promise<void>;
  toggleBookmark: (mangaId: string, isLoggedIn: boolean) => Promise<boolean>;
  removeBookmark: (mangaId: string, isLoggedIn: boolean) => Promise<void>;
  deleteHistoryItem: (mangaId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  updateLibraryStatus: (
    mangaId: string,
    data: {
      status?: "READING" | "COMPLETED" | "ON_HOLD" | "PLAN_TO_READ" | "DROPPED";
      score?: number;
      isFavorite?: boolean;
      notes?: string;
    }
  ) => Promise<void>;
  removeFromLibrary: (mangaId: string) => Promise<void>;
  syncGuestDataOnLogin: () => Promise<void>;
}

const GUEST_BOOKMARKS_KEY = "mangacms_guest_bookmarks_v1";
const GUEST_HISTORY_KEY = "mangacms_guest_history_v1";

function loadGuestBookmarks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveGuestBookmarks(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUEST_BOOKMARKS_KEY, JSON.stringify(ids));
  } catch {
    // LocalStorage error fallback
  }
}

function loadGuestHistory(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const useUserLibraryStore = create<UserLibraryState>((set, get) => ({
  bookmarks: [],
  bookmarkedIds: new Set(),
  history: [],
  libraryItems: [],
  isLoading: false,
  hasSyncedGuestData: false,

  fetchBookmarks: async (options) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (options?.search) params.set("q", options.search);
      if (options?.sortBy) params.set("sortBy", options.sortBy);

      const res = await fetch(`/api/user/bookmarks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const items: BookmarkedMangaItem[] = data.items || [];
        const ids = new Set(items.map((b) => b.mangaId));
        set({ bookmarks: items, bookmarkedIds: ids, isLoading: false });
      } else {
        // Fallback for guests: load from localStorage
        const guestIds = loadGuestBookmarks();
        set({ bookmarkedIds: new Set(guestIds), isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  fetchHistory: async (options) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (options?.search) params.set("q", options.search);

      const res = await fetch(`/api/user/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        set({ history: data.history || [], isLoading: false });
      } else {
        const guestHist = loadGuestHistory();
        set({ history: guestHist, isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  fetchLibrary: async (options) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (options?.status && options.status !== "ALL") params.set("status", options.status);
      if (options?.search) params.set("q", options.search);

      const res = await fetch(`/api/user/library?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        set({ libraryItems: data.items || [], isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  toggleBookmark: async (mangaId: string, isLoggedIn: boolean) => {
    const { bookmarkedIds, bookmarks } = get();
    const isCurrentlyBookmarked = bookmarkedIds.has(mangaId);
    const nextBookmarked = !isCurrentlyBookmarked;

    // Optimistic UI update
    const updatedIds = new Set(bookmarkedIds);
    if (nextBookmarked) {
      updatedIds.add(mangaId);
    } else {
      updatedIds.delete(mangaId);
    }
    set({ bookmarkedIds: updatedIds });

    if (!isLoggedIn) {
      saveGuestBookmarks(Array.from(updatedIds));
      return nextBookmarked;
    }

    try {
      const res = await fetch("/api/user/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mangaId }),
      });
      if (res.ok) {
        const data = await res.json();
        // Refresh bookmarks in background
        get().fetchBookmarks();
        return data.bookmarked;
      }
    } catch {
      // Rollback on network failure
      set({ bookmarkedIds, bookmarks });
    }

    return isCurrentlyBookmarked;
  },

  removeBookmark: async (mangaId: string, isLoggedIn: boolean) => {
    const { bookmarkedIds, bookmarks } = get();
    const updatedIds = new Set(bookmarkedIds);
    updatedIds.delete(mangaId);
    const updatedBookmarks = bookmarks.filter((b) => b.mangaId !== mangaId);

    set({ bookmarkedIds: updatedIds, bookmarks: updatedBookmarks });

    if (!isLoggedIn) {
      saveGuestBookmarks(Array.from(updatedIds));
      return;
    }

    try {
      await fetch(`/api/user/bookmarks?mangaId=${encodeURIComponent(mangaId)}`, {
        method: "DELETE",
      });
    } catch {
      // Rollback on failure
      set({ bookmarkedIds, bookmarks });
    }
  },

  deleteHistoryItem: async (mangaId: string) => {
    const { history } = get();
    const updated = history.filter((h) => h.mangaId !== mangaId);
    set({ history: updated });

    try {
      await fetch(`/api/user/history?mangaId=${encodeURIComponent(mangaId)}`, {
        method: "DELETE",
      });
    } catch {
      set({ history });
    }
  },

  clearHistory: async () => {
    set({ history: [] });
    try {
      await fetch("/api/user/history?all=true", { method: "DELETE" });
    } catch {
      get().fetchHistory();
    }
  },

  updateLibraryStatus: async (mangaId, data) => {
    try {
      const res = await fetch("/api/user/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mangaId, ...data }),
      });
      if (res.ok) {
        await get().fetchLibrary();
      }
    } catch (e) {
      console.error(e);
    }
  },

  removeFromLibrary: async (mangaId: string) => {
    const { libraryItems } = get();
    set({ libraryItems: libraryItems.filter((i) => i.mangaId !== mangaId) });

    try {
      await fetch(`/api/user/library?mangaId=${encodeURIComponent(mangaId)}`, {
        method: "DELETE",
      });
    } catch {
      set({ libraryItems });
    }
  },

  syncGuestDataOnLogin: async () => {
    if (get().hasSyncedGuestData) return;

    const guestBookmarkIds = loadGuestBookmarks();
    const guestHistory = loadGuestHistory();

    try {
      if (guestBookmarkIds.length > 0) {
        const payload = guestBookmarkIds.map((mangaId) => ({ mangaId }));
        const res = await fetch("/api/user/bookmarks/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookmarks: payload }),
        });
        if (res.ok) {
          localStorage.removeItem(GUEST_BOOKMARKS_KEY);
        }
      }

      if (guestHistory.length > 0) {
        const res = await fetch("/api/user/history/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ history: guestHistory }),
        });
        if (res.ok) {
          localStorage.removeItem(GUEST_HISTORY_KEY);
        }
      }

      set({ hasSyncedGuestData: true });
      await Promise.all([get().fetchBookmarks(), get().fetchHistory(), get().fetchLibrary()]);
    } catch (e) {
      console.error("Failed to sync guest data on login:", e);
    }
  },
}));
