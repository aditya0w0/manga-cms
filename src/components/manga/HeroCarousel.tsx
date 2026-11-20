"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, Star, ChevronLeft, ChevronRight, Info, Sparkles } from "lucide-react";
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
    <div className="relative w-full overflow-hidden rounded-3xl border border-white/20 bg-slate-950/80 backdrop-blur-3xl shadow-2xl shadow-black/60 h-[440px] sm:h-[480px]">
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
            className="h-full w-full object-cover object-center opacity-25 blur-md scale-105 transition-all duration-700"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-sky-500/10 to-transparent" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full items-center p-6 sm:p-10">
        <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8 w-full max-w-5xl">
          {/* Cover poster */}
          <div className="hidden sm:block shrink-0 w-44 md:w-56 aspect-[3/4] rounded-2xl overflow-hidden border border-white/25 shadow-2xl shadow-sky-500/10">
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
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/30 backdrop-blur-xl shadow-sm flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-sky-400" />
                Featured Title
              </span>
              {current.contentType && (
                <span className="text-xs font-semibold uppercase px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/15 text-foreground backdrop-blur-md">
                  {current.contentType}
                </span>
              )}
              {current.rating && current.rating > 0 ? (
                <div className="flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-xl px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-white/15">
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
                {current.genres.map((g) => (
                  <span
                    key={g.genre.slug}
                    className="text-xs font-semibold text-slate-300 bg-white/[0.05] border border-white/10 px-2.5 py-0.5 rounded-full backdrop-blur-md"
                  >
                    {g.genre.name}
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 leading-relaxed max-w-2xl">
              {current.description || "No synopsis available."}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <Link href={`/manga/${current.slug}`}>
                <Button className="font-bold gap-2 px-6">
                  <BookOpen className="h-4 w-4" />
                  Read Now
                </Button>
              </Link>
              <Link href={`/manga/${current.slug}`}>
                <Button variant="secondary" className="gap-2 font-semibold">
                  <Info className="h-4 w-4" />
                  Details
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
