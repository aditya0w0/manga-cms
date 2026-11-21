import React from "react";
import Link from "next/link";
import {
  getFeaturedManga,
  getTrendingManga,
  getRecentlyUpdated,
  getMangaList,
} from "@/modules/manga/manga-service";
import { getPrisma } from "@/lib/database/prisma";
import { HeroCarousel } from "@/components/manga/HeroCarousel";
import { LeaderboardList } from "@/components/manga/LeaderboardList";
import { LatestReleaseCard } from "@/components/manga/LatestReleaseCard";
import { MangaCard } from "@/components/manga/MangaCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = await getPrisma();

  const [featured, trending, recentlyUpdated, topRated, genres] = await Promise.all([
    getFeaturedManga(5),
    getTrendingManga(6),
    getRecentlyUpdated(6),
    getMangaList({ sortBy: "rating", limit: 6, minRating: 7.0 }),
    db.genre.findMany({
      where: { mangas: { some: {} } },
      take: 12,
      include: { _count: { select: { mangas: true } } },
      orderBy: { mangas: { _count: "desc" } },
    }),
  ]);

  return (
    <div className="flex flex-col space-y-12 pb-16">
      {/* 1. Asymmetric Hero Spotlight & Weekly Leaderboard */}
      {featured.length > 0 && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch pt-2">
          <div className="lg:col-span-8">
            <HeroCarousel items={featured as any} />
          </div>
          <div className="lg:col-span-4">
            <LeaderboardList items={trending as any} />
          </div>
        </section>
      )}

      {/* 2. Latest Chapter Releases (Direct Chapter Jump Feed) */}
      {recentlyUpdated.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">
                Latest Chapter Releases
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Direct access to the newest translated chapters
              </p>
            </div>
            <Link
              href="/browse?sortBy=updated"
              className="text-xs font-semibold text-slate-300 hover:text-sky-400 transition-colors"
            >
              View All Updates
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {recentlyUpdated.map((manga) => (
              <LatestReleaseCard key={manga.id} {...(manga as any)} />
            ))}
          </div>
        </section>
      )}

      {/* 3. Trending Series Showcase */}
      {trending.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">
                Trending Series
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                High readership titles across the catalog
              </p>
            </div>
            <Link
              href="/browse?sortBy=popularity"
              className="text-xs font-semibold text-slate-300 hover:text-sky-400 transition-colors"
            >
              Browse Catalog
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {trending.map((manga) => (
              <MangaCard key={manga.id} {...(manga as any)} />
            ))}
          </div>
        </section>
      )}

      {/* 4. Compact Genre Discovery Strip */}
      {genres.length > 0 && (
        <section className="rounded-2xl liquid-glass liquid-glass-glare p-3 sm:p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="shrink-0 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Genres
              </span>
              <span className="text-[11px] text-muted-foreground hidden md:inline">
                Quick filter by storytelling style
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {genres.map((g) => (
                <Link
                  key={g.slug}
                  href={`/browse?genre=${g.slug}`}
                  className="shrink-0 flex items-center gap-1.5 rounded-full liquid-glass-chip px-3 py-1 text-xs font-medium text-slate-200 hover:text-white transition-all"
                >
                  <span>{g.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {g._count.mangas}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. Highest Rated Masterpieces */}
      {topRated.items.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground">
                Critically Acclaimed
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Top community-reviewed series and landmark sagas
              </p>
            </div>
            <Link
              href="/browse?sortBy=rating"
              className="text-xs font-semibold text-slate-300 hover:text-sky-400 transition-colors"
            >
              All Top Rated
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {topRated.items.map((manga) => (
              <MangaCard key={manga.id} {...(manga as any)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
