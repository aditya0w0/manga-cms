"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { useUserLibraryStore, BookmarkedMangaItem, HistoryItem, LibraryEntryItem } from "@/lib/store/use-user-library-store";
import { Button } from "@/components/ui/Button";
import {
  User,
  Bookmark,
  Clock,
  Heart,
  Settings,
  BookOpen,
  CheckCircle2,
  ListFilter,
  Search,
  Download,
  Upload,
  KeyRound,
  Trash2,
  ExternalLink,
  Shield,
  Layers,
  ChevronRight,
  Sparkles,
  RotateCcw,
  Sliders,
  AlertCircle,
  Eye,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getSafeImageUrl, getProxyFallbackUrl } from "@/lib/image-utils";

type ProfileTab = "overview" | "saved" | "bookmarks" | "history" | "settings";

export default function UserProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as ProfileTab) || "overview";

  const { user, isLoading: isAuthLoading, fetchUser } = useAuthStore();
  const {
    bookmarks,
    history,
    libraryItems,
    fetchBookmarks,
    fetchHistory,
    fetchLibrary,
    removeBookmark,
    deleteHistoryItem,
    clearHistory,
    updateLibraryStatus,
    removeFromLibrary,
  } = useUserLibraryStore();

  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [profileStats, setProfileStats] = useState<any>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  // Tab-specific filters & state
  const [bookmarkSearch, setBookmarkSearch] = useState("");
  const [bookmarkSort, setBookmarkSort] = useState<string>("recent");
  const [historySearch, setHistorySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<string>("ALL");
  const [librarySearch, setLibrarySearch] = useState("");

  // Settings form states
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [profileMessage, setProfileMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Reader Preferences state
  const [readerMode, setReaderMode] = useState<string>("VERTICAL_SCROLL");
  const [readerDirection, setReaderDirection] = useState<string>("LTR");
  const [imageScaling, setImageScaling] = useState<string>("FIT_WIDTH");
  const [bgColor, setBgColor] = useState<string>("DARK");
  const [pageGap, setPageGap] = useState<number>(12);
  const [preloadCount, setPreloadCount] = useState<number>(2);
  const [prefMessage, setPrefMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Backup / Import state
  const [backupMessage, setBackupMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Sync tab with URL
  useEffect(() => {
    const tabParam = searchParams.get("tab") as ProfileTab;
    if (tabParam && ["overview", "saved", "bookmarks", "history", "settings"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const switchTab = (tab: ProfileTab) => {
    setActiveTab(tab);
    router.push(`/profile?tab=${tab}`, { scroll: false });
  };

  // Load profile data on user change
  const loadProfileDetails = useCallback(async () => {
    if (!user) return;
    setIsStatsLoading(true);
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setProfileStats(data.stats);
        setEditUsername(data.username || "");
        setEditEmail(data.email || "");
        setEditBio(data.bio || "");
        setEditAvatarUrl(data.avatarUrl || "");
      }
    } catch {
      // Ignore
    } finally {
      setIsStatsLoading(false);
    }
  }, [user]);

  // Load preferences
  const loadPreferences = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/user/preferences");
      if (res.ok) {
        const data = await res.json();
        if (data.preference) {
          setReaderMode(data.preference.readingMode || "VERTICAL_SCROLL");
          setReaderDirection(data.preference.readingDirection || "LTR");
          setImageScaling(data.preference.imageScaling || "FIT_WIDTH");
          setBgColor(data.preference.backgroundColor || "DARK");
          setPageGap(data.preference.pageGap ?? 12);
          setPreloadCount(data.preference.preloadCount ?? 2);
        }
      }
    } catch {
      // Ignore
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadProfileDetails();
      loadPreferences();
      fetchBookmarks();
      fetchHistory();
      fetchLibrary();
    }
  }, [user, loadProfileDetails, loadPreferences, fetchBookmarks, fetchHistory, fetchLibrary]);

  // Handle Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileMessage(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: editUsername,
          email: editEmail,
          bio: editBio,
          avatarUrl: editAvatarUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      setProfileMessage({ text: "Profile details updated successfully." });
      await fetchUser();
    } catch (err: any) {
      setProfileMessage({ text: err.message, error: true });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: "New passwords do not match.", error: true });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage({ text: "New password must be at least 8 characters.", error: true });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      setPasswordMessage({ text: "Password changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMessage({ text: err.message, error: true });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle Reader Defaults Save
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPrefs(true);
    setPrefMessage(null);

    try {
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readingMode: readerMode,
          readingDirection: readerDirection,
          imageScaling,
          backgroundColor: bgColor,
          pageGap,
          preloadCount,
        }),
      });

      if (!res.ok) throw new Error("Failed to save reader preferences");
      setPrefMessage({ text: "Reader preferences saved as global defaults." });
    } catch (err: any) {
      setPrefMessage({ text: err.message, error: true });
    } finally {
      setIsSavingPrefs(false);
    }
  };

  // Handle Export Backup
  const handleExportData = () => {
    window.location.href = "/api/user/data/export";
  };

  // Handle Import Backup
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setBackupMessage(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const res = await fetch("/api/user/data/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore backup");

      setBackupMessage({
        text: `Restored successfully: ${data.importedBookmarks} bookmarks, ${data.importedLibrary} library titles, ${data.importedHistory} history entries.`,
      });

      // Refresh all lists
      await Promise.all([fetchBookmarks(), fetchHistory(), fetchLibrary(), loadProfileDetails()]);
    } catch (err: any) {
      setBackupMessage({ text: err.message || "Failed to parse backup JSON file", error: true });
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  // Filtered Bookmarks
  const filteredBookmarks = useMemo(() => {
    let result = [...bookmarks];
    if (bookmarkSearch.trim()) {
      const q = bookmarkSearch.toLowerCase().trim();
      result = result.filter((b) => b.manga.title.toLowerCase().includes(q));
    }
    if (bookmarkSort === "title") {
      result.sort((a, b) => a.manga.title.localeCompare(b.manga.title));
    } else if (bookmarkSort === "unread") {
      result.sort((a, b) => b.unreadChapters - a.unreadChapters);
    }
    return result;
  }, [bookmarks, bookmarkSearch, bookmarkSort]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return history;
    const q = historySearch.toLowerCase().trim();
    return history.filter(
      (h) =>
        h.manga.title.toLowerCase().includes(q) ||
        String(h.chapter.chapterNumber).includes(q)
    );
  }, [history, historySearch]);

  // Filtered Saved Library Items
  const filteredLibrary = useMemo(() => {
    return libraryItems.filter((item) => {
      if (libraryFilter === "FAVORITES" && !item.isFavorite) return false;
      if (libraryFilter !== "ALL" && libraryFilter !== "FAVORITES" && item.status !== libraryFilter) return false;
      if (librarySearch.trim()) {
        const q = librarySearch.toLowerCase().trim();
        return item.manga.title.toLowerCase().includes(q);
      }
      return true;
    });
  }, [libraryItems, libraryFilter, librarySearch]);

  if (isAuthLoading) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground animate-pulse">
        Loading profile...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
        <div className="p-4 rounded-full bg-primary/10 text-primary">
          <User className="h-10 w-10 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Sign In to View Your Profile</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Access your reading history, permanent bookmarks, custom reading preferences, and offline data backups.
        </p>
        <div className="flex gap-3 pt-2">
          <Link href="/login">
            <Button className="font-semibold">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline" className="border-white/10">Create Account</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Profile Header Hero */}
      <div className="relative rounded-3xl liquid-glass p-6 sm:p-8 border border-white/10 overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 border-2 border-blue-400/30 bg-black/50 shadow-inner flex items-center justify-center">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-2xl sm:text-3xl font-extrabold text-blue-400">
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  {user.username}
                </h1>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 font-mono border border-blue-400/30">
                  {user.role}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-medium">{user.email}</p>
              {user.bio && (
                <p className="text-xs text-slate-300/80 pt-1 line-clamp-2 max-w-xl">
                  {user.bio}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportData}
              className="text-xs gap-1.5 border-white/10 hover:border-blue-400/40 liquid-glass-pill"
            >
              <Download className="h-3.5 w-3.5 text-blue-400" />
              Backup Data
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => switchTab("settings")}
              className="text-xs gap-1.5 border-white/10 hover:border-blue-400/40 liquid-glass-pill"
            >
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/[0.08] pb-3">
        {[
          { id: "overview", label: "Overview", icon: Layers, count: null },
          { id: "saved", label: "Saved Library", icon: Heart, count: libraryItems.length },
          { id: "bookmarks", label: "Bookmarks", icon: Bookmark, count: bookmarks.length },
          { id: "history", label: "Reading History", icon: Clock, count: history.length },
          { id: "settings", label: "Profile Settings", icon: Settings, count: null },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id as ProfileTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                isActive
                  ? "bg-blue-600/20 text-blue-200 border border-blue-400/40 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                  : "liquid-glass text-muted-foreground hover:text-foreground hover:border-white/20"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-blue-300" : "text-muted-foreground"}`} />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? "bg-blue-500/30 text-white" : "bg-white/[0.06] text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Bookmarks",
                val: bookmarks.length,
                color: "text-amber-400",
                sub: "Indexed in PostgreSQL",
              },
              {
                label: "Reading History",
                val: history.length,
                color: "text-blue-400",
                sub: "Recorded chapters",
              },
              {
                label: "Saved in Library",
                val: libraryItems.length,
                color: "text-slate-200",
                sub: "Personal catalog",
              },
              {
                label: "Completed Titles",
                val: libraryItems.filter((i) => i.status === "COMPLETED").length,
                color: "text-emerald-400",
                sub: "Finished series",
              },
            ].map((stat, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl liquid-glass border border-white/[0.08] space-y-1 shadow-sm"
              >
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </p>
                <p className={`text-2xl sm:text-3xl font-extrabold ${stat.color} font-mono`}>
                  {stat.val}
                </p>
                <p className="text-[10px] text-muted-foreground/70">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Continue Reading Shelf */}
          {history.length > 0 && (
            <div className="rounded-3xl liquid-glass p-6 sm:p-7 border border-white/[0.08] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-400" />
                  Continue Reading
                </h2>
                <button
                  onClick={() => switchTab("history")}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  View All History <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {history.slice(0, 4).map((hist) => (
                  <div
                    key={hist.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-blue-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-black/40">
                        {hist.manga.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={getSafeImageUrl(hist.manga.coverUrl)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-white/[0.05]" />
                        )}
                      </div>
                      <div>
                        <Link
                          href={`/manga/${hist.manga.slug}`}
                          className="font-bold text-sm text-foreground hover:text-blue-400 transition-colors line-clamp-1"
                        >
                          {hist.manga.title}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Chapter {hist.chapter.chapterNumber} • Page {hist.pageNumber}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(100, hist.percentRead)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {hist.percentRead}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <Link href={`/read/${hist.chapterId}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-white/10 hover:border-blue-500/40 hover:bg-blue-500/10 text-slate-200"
                      >
                        Resume
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Bookmarks Shelf */}
          {bookmarks.length > 0 && (
            <div className="rounded-3xl liquid-glass p-6 sm:p-7 border border-white/[0.08] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Bookmark className="h-5 w-5 text-amber-400" />
                  Recent Bookmarks
                </h2>
                <button
                  onClick={() => switchTab("bookmarks")}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  View All Bookmarks <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {bookmarks.slice(0, 6).map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-amber-500/30 transition-all flex items-center gap-3"
                  >
                    <div className="w-12 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-black/40">
                      {b.manga.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={getSafeImageUrl(b.manga.coverUrl)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-white/[0.05]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/manga/${b.manga.slug}`}
                        className="font-bold text-sm text-foreground hover:text-amber-400 transition-colors line-clamp-1"
                      >
                        {b.manga.title}
                      </Link>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {b.manga.latestChapter
                          ? `Latest: Ch. ${b.manga.latestChapter.chapterNumber}`
                          : "No chapters"}
                      </p>
                      {b.unreadChapters > 0 ? (
                        <span className="inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                          {b.unreadChapters} new chapters
                        </span>
                      ) : (
                        <span className="inline-block mt-1 text-[9px] text-muted-foreground/60 font-mono">
                          Up to date
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SAVED LIBRARY */}
      {/* ========================================================================= */}
      {activeTab === "saved" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {[
                { id: "ALL", label: "All Saved" },
                { id: "READING", label: "Reading" },
                { id: "PLAN_TO_READ", label: "Plan to Read" },
                { id: "COMPLETED", label: "Completed" },
                { id: "ON_HOLD", label: "On Hold" },
                { id: "DROPPED", label: "Dropped" },
                { id: "FAVORITES", label: "Favorites" },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setLibraryFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    libraryFilter === filter.id
                      ? "bg-blue-600/20 text-blue-200 border border-blue-400/40"
                      : "liquid-glass text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search saved titles..."
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                className="liquid-glass-input pl-9 pr-3 py-1.5 text-xs rounded-full w-full"
              />
            </div>
          </div>

          {filteredLibrary.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLibrary.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl liquid-glass border border-white/[0.08] hover:border-blue-500/30 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex gap-3">
                    <div className="w-16 h-22 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-black/40">
                      {item.manga.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={getSafeImageUrl(item.manga.coverUrl)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-white/[0.05]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/manga/${item.manga.slug}`}
                        className="font-bold text-sm text-foreground hover:text-blue-400 transition-colors line-clamp-1"
                      >
                        {item.manga.title}
                      </Link>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {item.manga.latestChapter
                          ? `Latest: Ch. ${item.manga.latestChapter.chapterNumber}`
                          : "No chapters"}
                      </p>
                      {item.readingProgress && (
                        <p className="text-[10px] text-blue-300 mt-1 font-mono">
                          Read up to Ch. {item.readingProgress.chapterNumber} (p. {item.readingProgress.pageNumber})
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs">
                    <select
                      value={item.status}
                      onChange={(e) =>
                        updateLibraryStatus(item.mangaId, {
                          status: e.target.value as any,
                        })
                      }
                      className="rounded-lg liquid-glass-input px-2 py-1 text-[11px] font-semibold text-foreground"
                    >
                      <option value="PLAN_TO_READ" className="bg-[#0f141c]">Plan to Read</option>
                      <option value="READING" className="bg-[#0f141c]">Reading</option>
                      <option value="COMPLETED" className="bg-[#0f141c]">Completed</option>
                      <option value="ON_HOLD" className="bg-[#0f141c]">On Hold</option>
                      <option value="DROPPED" className="bg-[#0f141c]">Dropped</option>
                    </select>

                    <button
                      onClick={() => removeFromLibrary(item.mangaId)}
                      className="text-muted-foreground hover:text-rose-400 p-1"
                      title="Remove from saved"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground space-y-3 rounded-3xl liquid-glass border border-dashed border-white/10">
              <BookOpen className="h-10 w-10 mx-auto opacity-30 text-blue-400" />
              <p className="text-sm font-semibold text-foreground">No manga found in this list</p>
              <p className="text-xs">Browse the catalog to add titles to your personal reading library.</p>
              <Link href="/browse">
                <Button size="sm" variant="outline" className="border-white/10 hover:border-blue-500/30">
                  Browse Catalog
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BOOKMARKS (PERMANENT & HIGH RESILIENCE) */}
      {/* ========================================================================= */}
      {activeTab === "bookmarks" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Sort By:</span>
              <select
                value={bookmarkSort}
                onChange={(e) => setBookmarkSort(e.target.value)}
                className="liquid-glass-input px-3 py-1.5 rounded-full text-xs font-semibold text-foreground"
              >
                <option value="recent" className="bg-[#0f141c]">Recently Bookmarked</option>
                <option value="unread" className="bg-[#0f141c]">Unread Chapters First</option>
                <option value="title" className="bg-[#0f141c]">Title (A-Z)</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search bookmarks..."
                value={bookmarkSearch}
                onChange={(e) => setBookmarkSearch(e.target.value)}
                className="liquid-glass-input pl-9 pr-3 py-1.5 text-xs rounded-full w-full"
              />
            </div>
          </div>

          {filteredBookmarks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBookmarks.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl liquid-glass border border-white/[0.08] hover:border-amber-500/30 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex gap-3">
                    <div className="w-16 h-22 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-black/40">
                      {b.manga.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={getSafeImageUrl(b.manga.coverUrl)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-white/[0.05]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/manga/${b.manga.slug}`}
                        className="font-bold text-sm text-foreground hover:text-amber-400 transition-colors line-clamp-1"
                      >
                        {b.manga.title}
                      </Link>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {b.manga.latestChapter
                          ? `Latest: Ch. ${b.manga.latestChapter.chapterNumber}`
                          : "No chapters"}
                      </p>

                      <div className="mt-1">
                        {b.unreadChapters > 0 ? (
                          <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                            {b.unreadChapters} unread
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60 font-mono">
                            Up to date
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs">
                    {b.readingProgress ? (
                      <Link href={`/read/${b.readingProgress.chapterId}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs border-amber-500/30 hover:bg-amber-500/10 text-amber-300"
                        >
                          Resume (Ch. {b.readingProgress.chapterNumber})
                        </Button>
                      </Link>
                    ) : b.manga.latestChapter ? (
                      <Link href={`/read/${b.manga.latestChapter.id}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs border-white/10 hover:border-amber-500/30 text-slate-200"
                        >
                          Start Reading
                        </Button>
                      </Link>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Unavailable</span>
                    )}

                    <button
                      onClick={() => removeBookmark(b.mangaId, true)}
                      className="text-muted-foreground hover:text-rose-400 p-1"
                      title="Remove bookmark"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground space-y-3 rounded-3xl liquid-glass border border-dashed border-white/10">
              <Bookmark className="h-10 w-10 mx-auto opacity-30 text-amber-400" />
              <p className="text-sm font-semibold text-foreground">No bookmarks saved yet</p>
              <p className="text-xs">
                Unlike common scan sites that lose your bookmarks after 20 titles, our database maintains unlimited bookmarks permanently with offline sync.
              </p>
              <Link href="/browse">
                <Button size="sm" variant="outline" className="border-white/10 hover:border-amber-500/30">
                  Explore Manga
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: READING HISTORY */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search history by title or chapter..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="liquid-glass-input pl-9 pr-3 py-1.5 text-xs rounded-full w-full"
              />
            </div>

            {history.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm("Are you sure you want to clear your entire reading history?")) {
                    clearHistory();
                  }
                }}
                className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10 liquid-glass-pill"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Clear All History
              </Button>
            )}
          </div>

          {filteredHistory.length > 0 ? (
            <div className="space-y-3">
              {filteredHistory.map((hist) => (
                <div
                  key={hist.id}
                  className="p-4 rounded-2xl liquid-glass border border-white/[0.08] hover:border-blue-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-black/40">
                      {hist.manga.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={getSafeImageUrl(hist.manga.coverUrl)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-white/[0.05]" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <Link
                        href={`/manga/${hist.manga.slug}`}
                        className="font-bold text-sm text-foreground hover:text-blue-400 transition-colors line-clamp-1"
                      >
                        {hist.manga.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Chapter {hist.chapter.chapterNumber}
                        {hist.chapter.chapterTitle ? `: ${hist.chapter.chapterTitle}` : ""} • Page {hist.pageNumber}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70 font-mono">
                        <span>{hist.percentRead}% completed</span>
                        <span>•</span>
                        <span>{formatDate(hist.lastReadAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Link href={`/read/${hist.chapterId}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-white/10 hover:border-blue-500/30 text-slate-200"
                      >
                        Resume Reading
                      </Button>
                    </Link>
                    <button
                      onClick={() => deleteHistoryItem(hist.mangaId)}
                      className="p-2 text-muted-foreground hover:text-rose-400 rounded-lg"
                      title="Delete from history"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground space-y-3 rounded-3xl liquid-glass border border-dashed border-white/10">
              <Clock className="h-10 w-10 mx-auto opacity-30 text-blue-400" />
              <p className="text-sm font-semibold text-foreground">Reading history is empty</p>
              <p className="text-xs">Chapters you read will appear here automatically with exact page checkpoints.</p>
              <Link href="/browse">
                <Button size="sm" variant="outline" className="border-white/10 hover:border-blue-500/30">
                  Start Reading
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PROFILE SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === "settings" && (
        <div className="space-y-8 max-w-3xl">
          {/* Section A: Account Details */}
          <div className="rounded-3xl liquid-glass p-6 sm:p-7 border border-white/[0.08] space-y-5">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <User className="h-5 w-5 text-blue-400" />
              Account Details
            </h2>

            {profileMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  profileMessage.error
                    ? "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                    : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {profileMessage.text}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Username</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="liquid-glass-input w-full px-3 py-2 text-xs rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="liquid-glass-input w-full px-3 py-2 text-xs rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Avatar Image URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  className="liquid-glass-input w-full px-3 py-2 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  placeholder="Share a short bio or favorite genres..."
                  className="liquid-glass-input w-full px-3 py-2 text-xs rounded-xl resize-none"
                />
              </div>

              <Button type="submit" size="sm" disabled={isUpdatingProfile} className="font-semibold">
                {isUpdatingProfile ? "Saving..." : "Save Profile Details"}
              </Button>
            </form>
          </div>

          {/* Section B: Security & Password */}
          <div className="rounded-3xl liquid-glass p-6 sm:p-7 border border-white/[0.08] space-y-5">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-400" />
              Security & Password
            </h2>

            {passwordMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  passwordMessage.error
                    ? "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                    : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {passwordMessage.text}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="liquid-glass-input w-full px-3 py-2 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="liquid-glass-input w-full px-3 py-2 text-xs rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="liquid-glass-input w-full px-3 py-2 text-xs rounded-xl"
                    required
                  />
                </div>
              </div>

              <Button type="submit" size="sm" variant="outline" disabled={isChangingPassword} className="border-white/10 hover:border-amber-400/40">
                {isChangingPassword ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </div>

          {/* Section C: Default Reader Settings */}
          <div className="rounded-3xl liquid-glass p-6 sm:p-7 border border-white/[0.08] space-y-5">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Sliders className="h-5 w-5 text-slate-400" />
              Default Reader Preferences
            </h2>

            {prefMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  prefMessage.error
                    ? "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                    : "bg-blue-500/15 text-blue-200 border border-blue-400/30"
                }`}
              >
                {prefMessage.text}
              </div>
            )}

            <form onSubmit={handleSavePreferences} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Default Reading Mode</label>
                  <select
                    value={readerMode}
                    onChange={(e) => setReaderMode(e.target.value)}
                    className="liquid-glass-input w-full px-3 py-2 text-xs rounded-xl"
                  >
                    <option value="VERTICAL_SCROLL" className="bg-[#0f141c]">Vertical Scroll</option>
                    <option value="WEBTOON" className="bg-[#0f141c]">Webtoon Continuous</option>
                    <option value="SINGLE_PAGE" className="bg-[#0f141c]">Single Page</option>
                    <option value="DOUBLE_PAGE" className="bg-[#0f141c]">Double Page</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Reading Direction</label>
                  <select
                    value={readerDirection}
                    onChange={(e) => setReaderDirection(e.target.value)}
                    className="liquid-glass-input w-full px-3 py-2 text-xs rounded-xl"
                  >
                    <option value="LTR" className="bg-[#0f141c]">Left to Right</option>
                    <option value="RTL" className="bg-[#0f141c]">Right to Left (Manga)</option>
                    <option value="VERTICAL" className="bg-[#0f141c]">Vertical</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Image Scaling</label>
                  <select
                    value={imageScaling}
                    onChange={(e) => setImageScaling(e.target.value)}
                    className="liquid-glass-input w-full px-3 py-2 text-xs rounded-xl"
                  >
                    <option value="FIT_WIDTH" className="bg-[#0f141c]">Fit Width</option>
                    <option value="FIT_HEIGHT" className="bg-[#0f141c]">Fit Height</option>
                    <option value="ORIGINAL" className="bg-[#0f141c]">Original</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Background Color</label>
                  <select
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="liquid-glass-input w-full px-3 py-2 text-xs rounded-xl"
                  >
                    <option value="DARK" className="bg-[#0f141c]">Dark Obsidian (#06080D)</option>
                    <option value="BLACK" className="bg-[#0f141c]">Pure Black (#000000)</option>
                    <option value="GRAY" className="bg-[#0f141c]">Charcoal</option>
                    <option value="LIGHT" className="bg-[#0f141c]">Light</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">Page Gap: {pageGap}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="32"
                  step="2"
                  value={pageGap}
                  onChange={(e) => setPageGap(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>

              <Button type="submit" size="sm" variant="outline" disabled={isSavingPrefs} className="border-white/10 hover:border-blue-400/40">
                {isSavingPrefs ? "Saving Defaults..." : "Save Reader Defaults"}
              </Button>
            </form>
          </div>

          {/* Section D: Data Portability & Anti-Loss Backup */}
          <div className="rounded-3xl liquid-glass p-6 sm:p-7 border border-white/[0.08] space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-400" />
              Data Ownership & Anti-Loss Protection
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Export all your bookmarks, personal library classifications, reading progress checkpoints, and reader settings as an offline JSON backup. You can restore this backup at any time.
            </p>

            {backupMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  backupMessage.error
                    ? "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                    : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {backupMessage.text}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportData}
                className="text-xs gap-1.5 border-white/10 hover:border-blue-400/40 text-blue-300"
              >
                <Download className="h-4 w-4" />
                Export Full Backup (JSON)
              </Button>

              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:border-blue-400/40 liquid-glass-pill text-xs font-semibold text-slate-300 transition-all">
                  <Upload className="h-4 w-4 text-blue-400" />
                  {isImporting ? "Restoring..." : "Restore from Backup"}
                </span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  disabled={isImporting}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
