"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Star,
  Bookmark,
  Heart,
  Share2,
  Flag,
  ArrowUpDown,
  Search,
  Calendar,
  Layers,
  Globe,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { useUserLibraryStore } from "@/lib/store/use-user-library-store";
import { formatDate } from "@/lib/utils";
import { getSafeImageUrl, getProxyFallbackUrl } from "@/lib/image-utils";

export function MangaDetailClient({ initialManga }: { initialManga: any }) {
  const { user } = useAuthStore();
  const { bookmarkedIds, toggleBookmark, fetchBookmarks } = useUserLibraryStore();
  const [manga, setManga] = useState(initialManga);
  const [sortAsc, setSortAsc] = useState(false);
  const [chapterSearch, setChapterSearch] = useState("");
  const [libraryStatus, setLibraryStatus] = useState<string>("PLAN_TO_READ");
  const [isFavorite, setIsFavorite] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isSavedInLibrary, setIsSavedInLibrary] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("INCORRECT_METADATA");
  const [reportDescription, setReportDescription] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  // Check user's current library & progress status
  useEffect(() => {
    if (!user) return;
    fetch(`/api/user/library`)
      .then((r) => r.json())
      .then((d) => {
        if (d.items) {
          const entry = d.items.find((item: any) => item.mangaId === manga.id);
          if (entry) {
            setIsSavedInLibrary(true);
            setLibraryStatus(entry.status);
            setIsFavorite(entry.isFavorite);
            setUserRating(entry.score);
          }
        }
      })
      .catch(() => {});
  }, [user, manga.id]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const handleLibraryChange = async (newStatus: string) => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setLibraryStatus(newStatus);
    setIsSavedInLibrary(true);
    try {
      await fetch("/api/user/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mangaId: manga.id,
          status: newStatus,
          isFavorite,
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    const nextFav = !isFavorite;
    setIsFavorite(nextFav);
    try {
      await fetch("/api/user/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mangaId: manga.id,
          status: libraryStatus,
          isFavorite: nextFav,
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
  };

  const handleSubmitReport = async () => {
    try {
      await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mangaId: manga.id,
          reason: reportReason,
          description: reportDescription,
        }),
      }).catch(() => {});
      setIsReportOpen(false);
      setReportDescription("");
      alert("Report submitted successfully. Our moderation team will review it.");
    } catch (e) {
      console.error(e);
    }
  };

  const chapters = [...(manga.chapters || [])];
  chapters.sort((a, b) => {
    return sortAsc ? a.chapterNumber - b.chapterNumber : b.chapterNumber - a.chapterNumber;
  });

  const filteredChapters = chapters.filter((c) => {
    if (!chapterSearch.trim()) return true;
    const term = chapterSearch.toLowerCase();
    return (
      String(c.chapterNumber).includes(term) ||
      (c.chapterTitle && c.chapterTitle.toLowerCase().includes(term))
    );
  });

  const firstChapter = manga.chapters && manga.chapters.length > 0
    ? [...manga.chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)[0]
    : null;

  return (
    <div className="flex flex-col space-y-10 pb-16">
      {/* Banner & Header Section */}
      <div className="relative rounded-3xl overflow-hidden liquid-glass shadow-2xl">
        {/* Backdrop Banner */}
        <div className="relative h-48 sm:h-72 w-full overflow-hidden">
          {manga.bannerUrl || manga.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={getSafeImageUrl(manga.bannerUrl || manga.coverUrl)}
              alt={manga.title}
              referrerPolicy="no-referrer"
              onError={(e) => {
                const url = manga.bannerUrl || manga.coverUrl;
                if (url && !e.currentTarget.src.includes("/api/image-proxy")) {
                  e.currentTarget.src = getProxyFallbackUrl(url);
                }
              }}
              className="h-full w-full object-cover opacity-25 blur-sm"
            />
          ) : (
            <div className="h-full w-full bg-white/[0.02]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-[#0B0D12]/70 to-transparent" />
        </div>

        {/* Info Container */}
        <div className="relative z-10 px-6 pb-8 -mt-24 sm:-mt-32">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Poster Cover */}
            <div className="shrink-0 w-44 sm:w-56 aspect-[3/4] rounded-2xl overflow-hidden liquid-glass-card shadow-2xl">
              {manga.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getSafeImageUrl(manga.coverUrl)}
                  alt={manga.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    if (manga.coverUrl && !e.currentTarget.src.includes("/api/image-proxy")) {
                      e.currentTarget.src = getProxyFallbackUrl(manga.coverUrl);
                    }
                  }}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/[0.05] text-muted-foreground">
                  <BookOpen className="h-12 w-12 opacity-30 text-cyan-400" />
                </div>
              )}
            </div>

            {/* Metadata & Actions */}
            <div className="flex-1 flex flex-col space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {manga.contentType && (
                  <span className="text-xs font-semibold px-3 py-1 rounded-full liquid-glass-pill text-sky-300">
                    {manga.contentType}
                  </span>
                )}
                {manga.status && (
                  <span className="text-xs font-medium px-3 py-1 rounded-full liquid-glass-pill text-slate-300">
                    {manga.status}
                  </span>
                )}
                {manga.releaseYear && (
                  <span className="text-xs text-slate-300 font-medium px-3 py-1 rounded-full liquid-glass-pill font-mono">
                    {manga.releaseYear}
                  </span>
                )}
                <span className="text-xs text-emerald-400 font-medium px-3 py-1 rounded-full liquid-glass-pill flex items-center gap-1.5 border-emerald-500/30">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Self-Hosted Library
                </span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                  {manga.title}
                </h1>
                {manga.alternativeTitles && Array.isArray(manga.alternativeTitles) && manga.alternativeTitles.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {manga.alternativeTitles.join(" • ")}
                  </p>
                )}
              </div>

              {/* Creators & Stats */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
                {manga.author && (
                  <div>
                    <span className="text-foreground font-semibold">Author:</span> {manga.author}
                  </div>
                )}
                {manga.artist && (
                  <div>
                    <span className="text-foreground font-semibold">Artist:</span> {manga.artist}
                  </div>
                )}
                <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                  <Star className="h-3.5 w-3.5 fill-amber-400" />
                  <span>{manga.rating ? manga.rating.toFixed(1) : "0.0"}</span>
                  {Boolean(manga.ratingCount && manga.ratingCount > 0) && (
                    <span className="text-slate-400 font-normal">({manga.ratingCount} reviews)</span>
                  )}
                </div>
              </div>

              {/* Genre Chips */}
              {manga.genres && manga.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {manga.genres.map((g: any) => (
                    <Link key={g.genre.slug} href={`/browse?genre=${g.genre.slug}`}>
                      <span className="text-xs font-medium text-slate-300 liquid-glass-pill hover:text-cyan-300 transition-all px-3 py-1">
                        {g.genre.name}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-3 pt-3">
                {firstChapter ? (
                  <Link href={`/read/${firstChapter.id}`}>
                    <Button size="lg" className="font-bold gap-2 shadow-[0_0_24px_rgba(14,165,233,0.35)]">
                      <BookOpen className="h-5 w-5" />
                      Start Reading (Ch. {firstChapter.chapterNumber})
                    </Button>
                  </Link>
                ) : (
                  <Button disabled size="lg">
                    No Chapters Available
                  </Button>
                )}

                {/* Bookmark Toggle Button */}
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => toggleBookmark(manga.id, Boolean(user))}
                  className={`gap-1.5 liquid-glass-pill transition-all ${
                    bookmarkedIds.has(manga.id)
                      ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                      : "text-slate-300 hover:border-emerald-500/40"
                  }`}
                >
                  <Bookmark
                    className={`h-4 w-4 ${
                      bookmarkedIds.has(manga.id) ? "fill-emerald-400 text-emerald-400" : ""
                    }`}
                  />
                  {bookmarkedIds.has(manga.id) ? "Bookmarked" : "Bookmark"}
                </Button>

                {/* Library Selector */}
                <select
                  value={libraryStatus}
                  onChange={(e) => handleLibraryChange(e.target.value)}
                  className="h-10 rounded-xl liquid-glass-input px-3 text-xs font-semibold text-foreground focus:outline-none w-auto"
                >
                  <option value="PLAN_TO_READ" className="bg-[#0f141c] text-white">Plan to Read</option>
                  <option value="READING" className="bg-[#0f141c] text-white">Reading</option>
                  <option value="COMPLETED" className="bg-[#0f141c] text-white">Completed</option>
                  <option value="ON_HOLD" className="bg-[#0f141c] text-white">On Hold</option>
                  <option value="DROPPED" className="bg-[#0f141c] text-white">Dropped</option>
                </select>

                {/* Favorite Button */}
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleToggleFavorite}
                  className={`gap-1.5 liquid-glass-pill hover:border-rose-500/40 ${isFavorite ? "text-rose-400 border-rose-500/40 bg-rose-500/10" : "text-slate-300"}`}
                >
                  <Heart className={`h-4 w-4 ${isFavorite ? "fill-rose-400 text-rose-400" : ""}`} />
                  {isFavorite ? "Favorited" : "Favorite"}
                </Button>

                {/* Share Button */}
                <Button variant="outline" size="default" onClick={handleShare} className="gap-1.5 liquid-glass-pill hover:border-cyan-500/40 text-slate-300">
                  <Share2 className="h-4 w-4" />
                  {shareCopied ? "Link Copied!" : "Share"}
                </Button>

                {/* Report Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsReportOpen(true)}
                  className="text-muted-foreground hover:text-rose-400 text-xs ml-auto"
                >
                  <Flag className="h-3.5 w-3.5 mr-1" />
                  Report
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description / Synopsis Section */}
      <section className="rounded-3xl liquid-glass p-6 sm:p-8 shadow-sm space-y-3">
        <h3 className="text-base font-bold text-foreground">Synopsis</h3>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {manga.description || "No description provided."}
        </p>
      </section>

      {/* Chapter List Section */}
      <section className="rounded-3xl liquid-glass p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-cyan-400" />
              Chapter List ({chapters.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Select a chapter to open in the advanced reader
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Chapter search inside list */}
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Find chapter..."
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
                className="w-full h-9 rounded-xl liquid-glass-input pl-8 pr-3 text-xs text-foreground focus:outline-none"
              />
            </div>

            {/* Sort order toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortAsc(!sortAsc)}
              className="gap-1.5 text-xs h-9 liquid-glass-pill hover:border-cyan-500/40 text-slate-300"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortAsc ? "Oldest First" : "Newest First"}
            </Button>
          </div>
        </div>

        {/* Chapters Table / List */}
        {filteredChapters.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredChapters.map((ch) => (
              <Link
                key={ch.id}
                href={`/read/${ch.id}`}
                className="group flex items-center justify-between p-3.5 rounded-2xl liquid-glass-card hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all duration-200"
              >
                <div className="flex flex-col space-y-0.5">
                  <span className="text-sm font-bold text-foreground group-hover:text-cyan-400 transition-colors">
                    Chapter {ch.chapterNumber}
                  </span>
                  {ch.chapterTitle && (
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {ch.chapterTitle}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {ch.releaseDate && (
                    <span className="hidden sm:inline font-mono">{formatDate(ch.releaseDate)}</span>
                  )}
                  {ch._count?.pages ? (
                    <span className="px-2.5 py-0.5 rounded-full liquid-glass-pill font-mono text-[10px] text-cyan-400">
                      {ch._count.pages}p
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No matching chapters found.
          </div>
        )}
      </section>

      {/* Report Dialog */}
      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogHeader>
          <DialogTitle>Report Manga Metadata</DialogTitle>
          <DialogDescription>
            Help improve quality by letting moderators know about broken images or incorrect information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Reason
            </label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
            >
              <option value="INCORRECT_METADATA" className="bg-[#0f141c] text-white">Incorrect title or author info</option>
              <option value="BROKEN_IMAGES" className="bg-[#0f141c] text-white">Missing or broken chapter images</option>
              <option value="DUPLICATE_ENTRY" className="bg-[#0f141c] text-white">Duplicate manga entry</option>
              <option value="OTHER" className="bg-[#0f141c] text-white">Other issue</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Details
            </label>
            <textarea
              rows={3}
              placeholder="Describe the issue in detail..."
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsReportOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmitReport}>Submit Report</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
