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
    scale: -80,
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
      className="relative w-full overflow-hidden rounded-[28px] liquid-glass liquid-glass-glare shadow-2xl h-[400px] sm:h-[460px] flex items-end sm:items-center"
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

        {/* Directional Scrim: text contrast on left/bottom without blurring artwork */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent sm:bg-gradient-to-r sm:from-background sm:via-background/85 sm:to-transparent sm:w-3/5" />
      </div>

      {/* Content Layer with strict fixed positioning */}
      <div className="relative z-10 flex w-full h-full items-end sm:items-center p-5 sm:p-8">
        <div className="flex items-center gap-6 sm:gap-8 w-full max-w-4xl">
          {/* Cover Poster: displayed on desktop only, avoiding mobile artwork overlap */}
          <div className="hidden sm:block shrink-0 w-40 md:w-48 aspect-[3/4] rounded-2xl overflow-hidden liquid-glass shadow-2xl border border-white/20">
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
          <div className="flex-1 min-w-0 flex flex-col justify-end sm:justify-center space-y-2.5 sm:space-y-3 pb-8 sm:pb-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {current.contentType && (
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full liquid-glass-chip text-sky-300">
                  {current.contentType}
                </span>
              )}
              {current.chapters && current.chapters.length > 0 && (
                <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full liquid-glass-chip text-slate-200 font-mono">
                  Latest: Ch. {current.chapters[0].chapterNumber}
                </span>
              )}
              {current.rating && current.rating > 0 ? (
                <div className="flex items-center gap-1 rounded-full liquid-glass-chip px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-amber-400">
                  <Star className="h-3 w-3 fill-amber-400" />
                  <span>{current.rating.toFixed(1)}</span>
                </div>
              ) : null}
            </div>

            <h2 className="text-xl sm:text-3xl font-black tracking-tight text-foreground line-clamp-1 sm:line-clamp-2 drop-shadow-sm">
              {current.title}
            </h2>

            {current.genres && current.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {current.genres.slice(0, 3).map((g) => (
                  <span
                    key={g.genre.slug}
                    className="text-[10px] sm:text-xs font-medium text-slate-200 liquid-glass-chip px-2.5 py-0.5"
                  >
                    {g.genre.name}
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 sm:line-clamp-3 leading-relaxed max-w-xl font-normal drop-shadow-sm">
              {current.description || "No synopsis available."}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1.5">
              {current.chapters && current.chapters.length > 0 ? (
                <Link href={`/read/${current.chapters[0].id}`}>
                  <button className="liquid-glass-btn-primary text-xs sm:text-sm py-2 px-4 sm:py-2.5 sm:px-5">
                    <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Read Chapter {current.chapters[0].chapterNumber}
                  </button>
                </Link>
              ) : (
                <Link href={`/manga/${current.slug}`}>
                  <button className="liquid-glass-btn-primary text-xs sm:text-sm py-2 px-4 sm:py-2.5 sm:px-5">
                    <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Start Reading
                  </button>
                </Link>
              )}
              <Link href={`/manga/${current.slug}`}>
                <button className="liquid-glass-chip px-4 py-2 sm:px-5 sm:py-2.5 flex items-center gap-1.5 font-semibold text-slate-200 hover:text-white text-xs sm:text-sm">
                  <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Series Details
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Slide Navigation Buttons */}
      {items.length > 1 && (
        <div className="absolute bottom-4 right-4 sm:bottom-5 sm:right-6 flex items-center gap-1.5 sm:gap-2 z-20 liquid-glass-chip p-1 px-2.5">
          <button
            onClick={() => setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)}
            className="p-1 rounded-full text-foreground hover:bg-white/[0.15] transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
          <div className="flex gap-1 px-0.5">
            {items.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentIndex ? "w-5 bg-white" : "w-1.5 bg-white/35"
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
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
