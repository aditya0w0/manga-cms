"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/use-auth-store";
import { MangaCard } from "@/components/manga/MangaCard";
import { Button } from "@/components/ui/Button";
import { Bookmark, Clock, Heart, BookOpen, LogIn, User } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getSafeImageUrl, getProxyFallbackUrl } from "@/lib/image-utils";

export default function LibraryPage() {
  const { user, isLoading: isAuthLoading } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [readingHistory, setReadingHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    Promise.all([
      fetch("/api/user/library").then((r) => r.json()),
      fetch("/api/user/history").then((r) => r.json()),
    ])
      .then(([libData, histData]) => {
        if (libData.items) setLibraryItems(libData.items);
        if (histData.history) setReadingHistory(histData.history);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [user]);

  if (isAuthLoading) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
        <div className="p-4 rounded-full bg-primary/10 text-primary">
          <Bookmark className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Sign In to View Your Library</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Track reading progress across devices, bookmark ongoing series, organize reading lists, and access custom settings.
        </p>
        <Link href="/login">
          <Button className="gap-2">
            <LogIn className="h-4 w-4" /> Sign In to Account
          </Button>
        </Link>
      </div>
    );
  }

  const filteredItems = libraryItems.filter((item) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "FAVORITES") return item.isFavorite;
    return item.status === activeTab;
  });

  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <Bookmark className="h-7 w-7 text-primary" />
            My Manga Library
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Signed in as <span className="text-foreground font-semibold">{user.username}</span> ({user.email})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/profile?tab=bookmarks">
            <Button size="sm" variant="outline" className="text-xs gap-1.5 border-white/10 hover:border-amber-500/30 liquid-glass-pill">
              <Bookmark className="h-3.5 w-3.5 text-amber-400" />
              Bookmarks
            </Button>
          </Link>
          <Link href="/profile">
            <Button size="sm" variant="outline" className="text-xs gap-1.5 border-white/10 hover:border-blue-400/40 liquid-glass-pill">
              <User className="h-3.5 w-3.5 text-blue-400" />
              Full Profile & Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/[0.08] pb-3">
        {[
          { id: "ALL", label: "All Titles", count: libraryItems.length },
          { id: "READING", label: "Reading", count: libraryItems.filter((i) => i.status === "READING").length },
          { id: "COMPLETED", label: "Completed", count: libraryItems.filter((i) => i.status === "COMPLETED").length },
          { id: "PLAN_TO_READ", label: "Plan to Read", count: libraryItems.filter((i) => i.status === "PLAN_TO_READ").length },
          { id: "ON_HOLD", label: "On Hold", count: libraryItems.filter((i) => i.status === "ON_HOLD").length },
          { id: "FAVORITES", label: "Favorites", count: libraryItems.filter((i) => i.isFavorite).length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-blue-600/20 text-blue-200 border border-blue-400/40 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                : "liquid-glass text-muted-foreground hover:text-foreground hover:border-white/20"
            }`}
          >
            <span>{tab.label}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === tab.id ? "bg-blue-500/30 text-white" : "bg-white/[0.06] text-muted-foreground"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Manga Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl liquid-glass animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredItems.map((item) => (
            <MangaCard key={item.id} {...item.manga} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-muted-foreground space-y-3 rounded-3xl liquid-glass border border-dashed border-white/10">
          <BookOpen className="h-10 w-10 mx-auto opacity-30 text-blue-400" />
          <p className="text-sm font-semibold text-foreground">No manga in this list</p>
          <p className="text-xs">Browse the catalog to add titles to your personal collection.</p>
          <Link href="/browse">
            <Button size="sm" variant="outline" className="border-white/10 hover:border-blue-400/30">Browse Manga</Button>
          </Link>
        </div>
      )}

      {/* Reading History Section */}
      {readingHistory.length > 0 && (
        <section className="rounded-3xl liquid-glass p-6 sm:p-8 shadow-sm space-y-4 mt-12">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-400" />
            Continue Reading History
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {readingHistory.map((hist) => (
              <div
                key={hist.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-blue-500/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-black/40">
                    {hist.manga.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getSafeImageUrl(hist.manga.coverUrl)}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (hist.manga.coverUrl && !e.currentTarget.src.includes("/api/image-proxy")) {
                            e.currentTarget.src = getProxyFallbackUrl(hist.manga.coverUrl);
                          }
                        }}
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
                    <span className="text-[10px] text-muted-foreground/60 font-mono">{formatDate(hist.lastReadAt)}</span>
                  </div>
                </div>

                <Link href={`/read/${hist.chapterId}`}>
                  <Button size="sm" variant="outline" className="text-xs border-white/10 hover:border-blue-400/40 hover:bg-blue-500/10 text-slate-200">
                    Resume
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
