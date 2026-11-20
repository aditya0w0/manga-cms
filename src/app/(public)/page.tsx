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
import { MangaCard } from "@/components/manga/MangaCard";
import { Button } from "@/components/ui/Button";
import {
  Flame,
  Clock,
  Sparkles,
  TrendingUp,
  Compass,
  ArrowRight,
  BookOpen,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = await getPrisma();

  const [featured, trending, recentlyUpdated, popularResult, genres] = await Promise.all([
    getFeaturedManga(5),
    getTrendingManga(6),
    getRecentlyUpdated(8),
    getMangaList({ sortBy: "popularity", limit: 12 }),
    db.genre.findMany({
      take: 12,
      include: { _count: { select: { mangas: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col space-y-12 pb-16">
      {/* 1. Hero Featured Carousel */}
      {featured.length > 0 && (
        <section className="pt-2">
          <HeroCarousel items={featured as any} />
        </section>
      )}

      {/* 2. Trending Manga Section */}
      {trending.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <Flame className="h-5 w-5 fill-orange-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  Trending Now
                </h3>
                <p className="text-xs text-muted-foreground">
                  Most engaged series across the community this week
                </p>
              </div>
            </div>
            <Link href="/browse?sortBy=popularity">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {trending.map((manga) => (
              <MangaCard key={manga.id} {...(manga as any)} />
            ))}
          </div>
        </section>
      )}

      {/* 3. Genre Quick Discovery Chips */}
      {genres.length > 0 && (
        <section className="rounded-3xl liquid-glass p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Compass className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-bold tracking-wider uppercase text-foreground">
              Explore by Genre
            </h4>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {genres.map((g) => (
              <Link
                key={g.slug}
                href={`/browse?genre=${g.slug}`}
                className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-cyan-400 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all duration-200"
              >
                <span>{g.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/[0.06] text-muted-foreground/80 group-hover:text-cyan-300 group-hover:bg-cyan-500/20 transition-colors">
                  {g._count.mangas}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 4. Recently Updated Manga */}
      {recentlyUpdated.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  Latest Releases
                </h3>
                <p className="text-xs text-muted-foreground">
                  Freshly updated chapters and newly translated scans
                </p>
              </div>
            </div>
            <Link href="/browse?sortBy=updated">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
            {recentlyUpdated.map((manga) => (
              <MangaCard key={manga.id} {...(manga as any)} />
            ))}
          </div>
        </section>
      )}

      {/* 5. Most Popular Series */}
      {popularResult.items.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  All-Time Favorites
                </h3>
                <p className="text-xs text-muted-foreground">
                  Highly rated masterpieces and legendary sagas
                </p>
              </div>
            </div>
            <Link href="/browse?sortBy=rating">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {popularResult.items.map((manga) => (
              <MangaCard key={manga.id} {...(manga as any)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
