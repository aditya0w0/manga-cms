"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { getSafeImageUrl, getProxyFallbackUrl } from "@/lib/image-utils";

export interface LatestReleaseCardProps {
  id: string;
  slug: string;
  title: string;
  coverUrl?: string | null;
  contentType?: string;
  chapters?: {
    id: string;
    chapterNumber: number;
    chapterTitle?: string | null;
    releaseDate?: string | Date | null;
    createdAt?: string | Date | null;
  }[];
}

export function LatestReleaseCard({
  slug,
  title,
  coverUrl,
  contentType,
  chapters = [],
}: LatestReleaseCardProps) {
  const initialSrc = getSafeImageUrl(coverUrl);
  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [imageError, setImageError] = useState(false);

  const handleError = () => {
    if (coverUrl && !currentSrc.includes("/api/image-proxy")) {
      setCurrentSrc(getProxyFallbackUrl(coverUrl));
    } else {
      setImageError(true);
    }
  };

  return (
    <div className="flex gap-3.5 p-3 rounded-2xl border border-white/10 bg-slate-950/60 hover:border-white/20 transition-all">
      {/* Cover Image Thumbnail */}
      <Link
        href={`/manga/${slug}`}
        className="relative h-24 w-18 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] group"
      >
        {currentSrc && !imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentSrc}
            alt={title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={handleError}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <BookOpen className="h-6 w-6 opacity-30 text-sky-400" />
          </div>
        )}
      </Link>

      {/* Info & Direct Chapter Actions */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            {contentType && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.2 rounded bg-white/[0.08] text-sky-300 border border-white/10">
                {contentType}
              </span>
            )}
          </div>
          <Link href={`/manga/${slug}`}>
            <h4 className="text-xs sm:text-sm font-bold text-foreground truncate hover:text-sky-400 transition-colors">
              {title}
            </h4>
          </Link>
        </div>

        {/* Clickable Chapter Links */}
        <div className="space-y-1.5 pt-2">
          {chapters && chapters.length > 0 ? (
            chapters.slice(0, 2).map((ch) => (
              <Link
                key={ch.id}
                href={`/read/${ch.id}`}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:border-sky-500/40 hover:bg-sky-500/10 transition-colors group/ch text-xs"
              >
                <span className="font-mono font-semibold text-slate-200 group-hover/ch:text-sky-300 transition-colors">
                  Chapter {ch.chapterNumber}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {formatRelativeTime(ch.releaseDate || ch.createdAt)}
                </span>
              </Link>
            ))
          ) : (
            <span className="text-[11px] text-muted-foreground font-medium">
              No published chapters yet
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
