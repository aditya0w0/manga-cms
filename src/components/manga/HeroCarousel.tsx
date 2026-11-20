"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, Star, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
    <div className="relative w-full overflow-hidden rounded-3xl liquid-glass shadow-2xl h-[440px] sm:h-[480px]">
      {/* Background Banner with blur */}
      <div className="absolute inset-0">
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
            className="h-full w-full object-cover object-center opacity-30 blur-md scale-105 transition-all duration-700"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-sky-500/15 via-cyan-500/5 to-transparent" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full items-center p-6 sm:p-10">
        <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8 w-full max-w-5xl">
          {/* Cover poster */}
          <div className="hidden sm:block shrink-0 w-44 md:w-56 aspect-[3/4] rounded-2xl overflow-hidden liquid-glass-card shadow-2xl">
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
              <div className="flex h-full w-full items-center justify-center bg-white/[0.03] text-muted-foreground">
                <BookOpen className="h-12 w-12 opacity-30" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 flex flex-col justify-center space-y-3.5">
            <div className="flex flex-wrap items-center gap-2">
              {current.contentType && (
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-0.5 rounded-md bg-white/[0.08] text-sky-300 border border-white/15">
                  {current.contentType}
                </span>
              )}
              {current.chapters && current.chapters.length > 0 && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-white/[0.06] text-slate-300 border border-white/10 font-mono">
                  Latest: Ch. {current.chapters[0].chapterNumber}
                </span>
              )}
              {current.rating && current.rating > 0 ? (
                <div className="flex items-center gap-1 rounded-md bg-black/60 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-white/10">
                  <Star className="h-3.5 w-3.5 fill-amber-400" />
                  <span>{current.rating.toFixed(1)}</span>
                </div>
              ) : null}
            </div>

            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground line-clamp-2">
              {current.title}
            </h2>

            {current.genres && current.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {current.genres.slice(0, 4).map((g) => (
                  <span
                    key={g.genre.slug}
                    className="text-xs font-medium text-slate-300 bg-white/[0.05] border border-white/10 px-2.5 py-0.5 rounded-md"
                  >
                    {g.genre.name}
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs sm:text-sm text-slate-300 line-clamp-3 leading-relaxed max-w-2xl font-normal">
              {current.description || "No synopsis available."}
            </p>

            <div className="flex items-center gap-3 pt-2">
              {current.chapters && current.chapters.length > 0 ? (
                <Link href={`/read/${current.chapters[0].id}`}>
                  <Button className="font-bold gap-2 px-6">
                    <BookOpen className="h-4 w-4" />
                    Read Chapter {current.chapters[0].chapterNumber}
                  </Button>
                </Link>
              ) : (
                <Link href={`/manga/${current.slug}`}>
                  <Button className="font-bold gap-2 px-6">
                    <BookOpen className="h-4 w-4" />
                    Start Reading
                  </Button>
                </Link>
              )}
              <Link href={`/manga/${current.slug}`}>
                <Button variant="secondary" className="gap-2 font-semibold">
                  <Info className="h-4 w-4" />
                  Series Details
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Slide Navigation Buttons */}
      {items.length > 1 && (
        <div className="absolute bottom-5 right-6 flex items-center gap-2 z-20 liquid-glass-pill p-1.5 px-3">
          <button
            onClick={() => setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)}
            className="p-1.5 rounded-full text-foreground hover:bg-white/[0.1] transition-colors"
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
                  idx === currentIndex ? "w-6 bg-sky-400" : "w-1.5 bg-white/25"
                }`}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % items.length)}
            className="p-1.5 rounded-full text-foreground hover:bg-white/[0.1] transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
