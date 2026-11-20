"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, Star, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useLiquidGlass } from "@/lib/liquid-glass";
import { getSafeImageUrl, getProxyFallbackUrl } from "@/lib/image-utils";

export interface FeaturedMangaItem {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  bannerUrl?: string | null;
  rating?: number;
  contentType?: string;
  genres?: { genre: { name: string; slug: string } }[];
  chapters?: { id: string; chapterNumber: number }[];
}

export function HeroCarousel({ items }: { items: FeaturedMangaItem[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useLiquidGlass<HTMLDivElement>({
    scale: -85,
    chroma: 4,
    border: 0.05,
    blur: 0,
    saturate: 1.4,
  });

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (!items || items.length === 0) return null;

  const current = items[currentIndex];

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-[28px] liquid-glass liquid-glass-glare shadow-2xl min-h-[460px] sm:h-[480px] flex items-center"
    >
      {/* Crisp Unblurred Manga Banner Artwork */}
      <div className="absolute inset-0 z-0">
        {current.bannerUrl || current.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getSafeImageUrl(current.bannerUrl || current.coverUrl)}
            alt={current.title}
            referrerPolicy="no-referrer"
            onError={(e) => {
              const url = current.bannerUrl || current.coverUrl;
              if (url && !e.currentTarget.src.includes("/api/image-proxy")) {
                e.currentTarget.src = getProxyFallbackUrl(url);
              }
            }}
            className="h-full w-full object-cover object-top sm:object-right transition-opacity duration-700"
          />
        ) : (
          <div className="h-full w-full bg-slate-900" />
        )}

        {/* Directional Scrim: keeps manga artwork crisp on the right while ensuring high text contrast on the left */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent w-full md:w-3/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent sm:hidden" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 flex h-full items-center p-5 sm:p-10 w-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-8 w-full max-w-5xl">
          {/* Cover Poster: visible on mobile and desktop */}
          <div className="shrink-0 w-28 sm:w-44 md:w-52 aspect-[3/4] rounded-2xl overflow-hidden liquid-glass shadow-2xl border border-white/20">
            {current.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getSafeImageUrl(current.coverUrl)}
                alt={current.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  if (current.coverUrl && !e.currentTarget.src.includes("/api/image-proxy")) {
                    e.currentTarget.src = getProxyFallbackUrl(current.coverUrl);
                  }
                }}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/[0.05] text-muted-foreground">
                <BookOpen className="h-10 w-10 opacity-40 text-sky-400" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 flex flex-col justify-center space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {current.contentType && (
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full liquid-glass-chip text-sky-300">
                  {current.contentType}
                </span>
              )}
              {current.chapters && current.chapters.length > 0 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full liquid-glass-chip text-slate-200 font-mono">
                  Latest: Ch. {current.chapters[0].chapterNumber}
                </span>
              )}
              {current.rating && current.rating > 0 ? (
                <div className="flex items-center gap-1 rounded-full liquid-glass-chip px-3 py-1 text-xs font-bold text-amber-400">
                  <Star className="h-3.5 w-3.5 fill-amber-400" />
                  <span>{current.rating.toFixed(1)}</span>
                </div>
              ) : null}
            </div>

            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground line-clamp-2 drop-shadow-sm">
              {current.title}
            </h2>

            {current.genres && current.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {current.genres.slice(0, 4).map((g) => (
                  <span
                    key={g.genre.slug}
                    className="text-xs font-medium text-slate-200 liquid-glass-chip px-3 py-0.5"
                  >
                    {g.genre.name}
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs sm:text-sm text-slate-300 line-clamp-3 leading-relaxed max-w-2xl font-normal drop-shadow-sm">
              {current.description || "No synopsis available."}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {current.chapters && current.chapters.length > 0 ? (
                <Link href={`/read/${current.chapters[0].id}`}>
                  <button className="liquid-glass-btn-primary">
                    <BookOpen className="h-4 w-4" />
                    Read Chapter {current.chapters[0].chapterNumber}
                  </button>
                </Link>
              ) : (
                <Link href={`/manga/${current.slug}`}>
                  <button className="liquid-glass-btn-primary">
                    <BookOpen className="h-4 w-4" />
                    Start Reading
                  </button>
                </Link>
              )}
              <Link href={`/manga/${current.slug}`}>
                <button className="liquid-glass-chip px-5 py-2.5 flex items-center gap-2 font-semibold text-slate-200 hover:text-white text-sm">
                  <Info className="h-4 w-4" />
                  Series Details
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Slide Navigation Buttons */}
      {items.length > 1 && (
        <div className="absolute bottom-5 right-6 flex items-center gap-2 z-20 liquid-glass-chip p-1.5 px-3">
          <button
            onClick={() => setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)}
            className="p-1 rounded-full text-foreground hover:bg-white/[0.15] transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5 px-1">
            {items.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/35"
                }`}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % items.length)}
            className="p-1 rounded-full text-foreground hover:bg-white/[0.15] transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
