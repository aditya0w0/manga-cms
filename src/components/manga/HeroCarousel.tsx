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
    scale: -75,
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
      className="relative w-full overflow-hidden rounded-[28px] liquid-glass liquid-glass-glare shadow-2xl h-[380px] sm:h-[440px] flex items-end sm:items-center"
    >
      {/* Big Full-Bleed Manga Banner Background */}
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
            className="h-full w-full object-cover object-center transition-all duration-700"
          />
        ) : (
          <div className="h-full w-full bg-slate-900" />
        )}

        {/* Directional Scrim: preserves text readability on left without drowning out the artwork */}
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/65 to-transparent w-full md:w-3/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent sm:hidden" />
      </div>

      {/* Clean Editorial Content: No Small Card, No Wall of Text */}
      <div className="relative z-10 flex w-full h-full items-end sm:items-center p-6 sm:p-10">
        <div className="max-w-xl space-y-3 sm:space-y-3.5 pb-6 sm:pb-0">
          {/* Format, Chapter & Rating Badges */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {current.contentType && (
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full liquid-glass-chip text-sky-300">
                {current.contentType}
              </span>
            )}
            {current.chapters && current.chapters.length > 0 && (
              <span className="text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full liquid-glass-chip text-slate-200 font-mono">
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

          {/* Large Bold Title */}
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-md line-clamp-2">
            {current.title}
          </h2>

          {/* Genre Badges */}
          {current.genres && current.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
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

          {/* Direct Actions */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            {current.chapters && current.chapters.length > 0 ? (
              <Link href={`/read/${current.chapters[0].id}`}>
                <button className="liquid-glass-btn-primary text-xs sm:text-sm py-2.5 px-5 font-bold">
                  <BookOpen className="h-4 w-4" />
                  Read Chapter {current.chapters[0].chapterNumber}
                </button>
              </Link>
            ) : (
              <Link href={`/manga/${current.slug}`}>
                <button className="liquid-glass-btn-primary text-xs sm:text-sm py-2.5 px-5 font-bold">
                  <BookOpen className="h-4 w-4" />
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
