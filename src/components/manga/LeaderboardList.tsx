"use client";

import React from "react";
import Link from "next/link";
import { Star, Eye } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { getSafeImageUrl, getProxyFallbackUrl } from "@/lib/image-utils";

export interface LeaderboardItem {
  id: string;
  slug: string;
  title: string;
  coverUrl?: string | null;
  viewCount?: number;
  rating?: number;
  contentType?: string;
  chapters?: { id: string; chapterNumber: number }[];
}

export function LeaderboardList({ items }: { items: LeaderboardItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="flex flex-col h-full rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-6 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Top Leaderboard
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Most read titles this week
          </p>
        </div>
        <Link
          href="/browse?sortBy=popularity"
          className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
        >
          Full Rankings
        </Link>
      </div>

      <div className="flex flex-col divide-y divide-white/5 flex-1 justify-between pt-2">
        {items.slice(0, 5).map((item, index) => {
          const rank = index + 1;
          const rankColor =
            rank === 1
              ? "text-amber-400 bg-amber-400/10 border-amber-400/30"
              : rank === 2
              ? "text-slate-200 bg-white/10 border-white/20"
              : rank === 3
              ? "text-amber-600 bg-amber-600/10 border-amber-600/30"
              : "text-slate-400 bg-white/[0.04] border-white/10";

          const latestChapter = item.chapters?.[0];

          return (
            <Link
              key={item.id}
              href={`/manga/${item.slug}`}
              className="group flex items-center gap-3.5 py-3 transition-colors hover:bg-white/[0.03] px-2 rounded-xl"
            >
              {/* Numeric Rank Marker */}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-black ${rankColor}`}
              >
                {rank < 10 ? `0${rank}` : rank}
              </div>

              {/* Cover Poster */}
              <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
                {item.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getSafeImageUrl(item.coverUrl)}
                    alt={item.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const url = item.coverUrl;
                      if (url && !e.currentTarget.src.includes("/api/image-proxy")) {
                        e.currentTarget.src = getProxyFallbackUrl(url);
                      }
                    }}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-white/[0.04] text-[10px] text-muted-foreground font-mono">
                    MG
                  </div>
                )}
              </div>

              {/* Comic Details */}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-foreground truncate group-hover:text-sky-400 transition-colors">
                  {item.title}
                </h4>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                  {latestChapter && (
                    <span className="font-mono text-slate-300 font-medium">
                      Ch. {latestChapter.chapterNumber}
                    </span>
                  )}
                  {item.viewCount != null && item.viewCount > 0 && (
                    <span className="flex items-center gap-1 font-mono">
                      <Eye className="h-3 w-3 text-slate-400" />
                      {formatNumber(item.viewCount)}
                    </span>
                  )}
                  {item.rating != null && item.rating > 0 && (
                    <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                      <Star className="h-3 w-3 fill-amber-400" />
                      {item.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
