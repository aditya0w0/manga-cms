"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Star, BookOpen, Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatNumber, formatDate } from "@/lib/utils";
import { getSafeImageUrl, getProxyFallbackUrl } from "@/lib/image-utils";

export interface MangaCardProps {
  id: string;
  slug: string;
  title: string;
  alternativeTitles?: any;
  coverUrl?: string | null;
  status?: string;
  contentType?: string;
  rating?: number;
  viewCount?: number;
  updatedAt?: string | Date;
  genres?: { genre: { name: string; slug: string } }[];
  chapters?: { id: string; chapterNumber: number; chapterTitle?: string | null; releaseDate?: string | Date | null }[];
}

export function MangaCard({
  slug,
  title,
  alternativeTitles,
  coverUrl,
  status,
  contentType,
  rating = 0,
  updatedAt,
  genres = [],
  chapters = [],
}: MangaCardProps) {
  const initialSrc = getSafeImageUrl(coverUrl);
  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setCurrentSrc(getSafeImageUrl(coverUrl));
    setImageError(false);
  }, [coverUrl]);

  const latestChapter = chapters[0];
  const altTitle = Array.isArray(alternativeTitles) && alternativeTitles.length > 0 ? alternativeTitles[0] : null;
  const showCover = Boolean(currentSrc && !imageError);

  const handleError = () => {
    if (coverUrl && !currentSrc.includes("/api/image-proxy")) {
      setCurrentSrc(getProxyFallbackUrl(coverUrl));
    } else {
      setImageError(true);
    }
  };

  return (
    <Link href={`/manga/${slug}`} className="group flex flex-col">
      <div className="relative aspect-[3/4] w-full overflow-hidden liquid-glass-card transition-all duration-300">
        {showCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentSrc}
            alt={title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            onError={handleError}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-950/40 via-surface to-black/60 text-muted-foreground">
            <BookOpen className="h-10 w-10 opacity-30 text-blue-400" />
          </div>
        )}

        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent opacity-80 group-hover:opacity-65 transition-opacity" />

        {/* Top badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
          {contentType && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full liquid-glass-pill text-blue-200 border-white/20 shadow-sm">
              {contentType}
            </span>
          )}
        </div>

        <div className="absolute top-2.5 right-2.5">
          {rating > 0 && (
            <div className="flex items-center gap-1 rounded-full liquid-glass-pill px-2.5 py-0.5 text-xs font-bold text-amber-400 border-white/20 shadow-sm">
              <Star className="h-3 w-3 fill-amber-400" />
              <span>{rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Bottom details inside card */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-xs text-muted-foreground">
          {latestChapter ? (
            <span className="font-bold text-white bg-gradient-to-r from-blue-600/90 to-indigo-600/90 backdrop-blur-xl px-2.5 py-0.5 rounded-full text-[10px] border border-white/30 shadow-sm">
              Ch. {latestChapter.chapterNumber}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground font-medium">No chapters</span>
          )}

          {status && (
            <span className="text-[9px] font-bold uppercase text-slate-300 liquid-glass-pill px-2 py-0.5 border-white/15">
              {status}
            </span>
          )}
        </div>
      </div>

      {/* Meta text below card */}
      <div className="mt-2.5 flex flex-col space-y-1">
        <h4 className="font-bold text-sm text-foreground line-clamp-1 transition-colors group-hover:text-blue-400">
          {title}
        </h4>

        {altTitle && (
          <p className="text-[11px] text-muted-foreground line-clamp-1 font-normal">
            {altTitle}
          </p>
        )}

        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {genres.slice(0, 2).map((g) => (
              <span
                key={g.genre.slug}
                className="text-[9px] font-semibold text-slate-300 bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded-full backdrop-blur-md"
              >
                {g.genre.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
