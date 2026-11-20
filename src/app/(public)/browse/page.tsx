"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { MangaCard } from "@/components/manga/MangaCard";
import { Search, RotateCcw, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useLiquidGlass } from "@/lib/liquid-glass";

function BrowseContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterRef = useLiquidGlass<HTMLDivElement>({ scale: -75, chroma: 4, blur: 0, saturate: 1.4 });

  const qParam = searchParams.get("q") || "";
  const genreParam = searchParams.get("genre") || "";
  const statusParam = searchParams.get("status") || "";
  const typeParam = searchParams.get("contentType") || "";
  const sortParam = searchParams.get("sortBy") || "popularity";
  const pageParam = parseInt(searchParams.get("page") || "1", 10);

  const [query, setQuery] = useState(qParam);
  const [selectedGenre, setSelectedGenre] = useState(genreParam);
  const [selectedStatus, setSelectedStatus] = useState(statusParam);
  const [selectedType, setSelectedType] = useState(typeParam);
  const [sortBy, setSortBy] = useState(sortParam);
  const [page, setPage] = useState(pageParam);

  const [mangaList, setMangaList] = useState<any[]>([]);
  const [genres, setGenres] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch genres for filter dropdown
  useEffect(() => {
    fetch("/api/admin/genres")
      .then((r) => r.json())
      .then((d) => {
        if (d.genres) setGenres(d.genres);
      })
      .catch(() => {});
  }, []);

  // Sync URL query params
  const applyFilters = (
    newPage = page,
    overrides?: {
      q?: string;
      genre?: string;
      status?: string;
      contentType?: string;
      sortBy?: string;
    }
  ) => {
    const params = new URLSearchParams();
    const currentQ = overrides?.q !== undefined ? overrides.q : query;
    const currentGenre = overrides?.genre !== undefined ? overrides.genre : selectedGenre;
    const currentStatus = overrides?.status !== undefined ? overrides.status : selectedStatus;
    const currentType = overrides?.contentType !== undefined ? overrides.contentType : selectedType;
    const currentSort = overrides?.sortBy !== undefined ? overrides.sortBy : sortBy;

    if (currentQ.trim()) params.set("q", currentQ.trim());
    if (currentGenre) params.set("genre", currentGenre);
    if (currentStatus) params.set("status", currentStatus);
    if (currentType) params.set("contentType", currentType);
    if (currentSort) params.set("sortBy", currentSort);
    if (newPage > 1) params.set("page", String(newPage));

    router.push(`${pathname}?${params.toString()}`);
  };

  // Fetch manga whenever searchParams change
  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams(searchParams.toString());
    params.set("limit", "18");

    fetch(`/api/manga?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setMangaList(data.items || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalCount(data.pagination?.total || 0);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });
  }, [searchParams]);

  const handleReset = () => {
    setQuery("");
    setSelectedGenre("");
    setSelectedStatus("");
    setSelectedType("");
    setSortBy("popularity");
    setPage(1);
    router.push(pathname);
  };

  const hasActiveFilters = Boolean(
    query || selectedGenre || selectedStatus || selectedType || sortBy !== "popularity"
  );

  return (
    <div className="flex flex-col space-y-6 pb-16">
      {/* Compact Header & Filter Controls */}
      <div
        ref={filterRef}
        className="rounded-2xl liquid-glass liquid-glass-glare p-3.5 sm:p-5 shadow-xl space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Browse Catalog
            </h1>
            <span className="text-[11px] font-mono text-muted-foreground">
              ({totalCount} titles)
            </span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Filters
            </button>
          )}
        </div>

        {/* Compact Search Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            applyFilters(1);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by title, author, artist..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl liquid-glass-input text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <button type="submit" className="liquid-glass-btn-primary h-9 px-4 text-xs font-bold">
            Search
          </button>
        </form>

        {/* Compact Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
          {/* Genre */}
          <select
            value={selectedGenre}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedGenre(val);
              setPage(1);
              applyFilters(1, { genre: val });
            }}
            className="w-full h-8 rounded-lg liquid-glass-input px-2.5 text-xs text-foreground focus:outline-none"
          >
            <option value="" className="bg-[#0f141c] text-white">All Genres</option>
            {genres.map((g) => (
              <option key={g.slug} value={g.slug} className="bg-[#0f141c] text-white">
                {g.name}
              </option>
            ))}
          </select>

          {/* Format */}
          <select
            value={selectedType}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedType(val);
              setPage(1);
              applyFilters(1, { contentType: val });
            }}
            className="w-full h-8 rounded-lg liquid-glass-input px-2.5 text-xs text-foreground focus:outline-none"
          >
            <option value="" className="bg-[#0f141c] text-white">All Formats</option>
            <option value="MANGA" className="bg-[#0f141c] text-white">Manga</option>
            <option value="MANHWA" className="bg-[#0f141c] text-white">Manhwa</option>
            <option value="MANHUA" className="bg-[#0f141c] text-white">Manhua</option>
            <option value="WEBTOON" className="bg-[#0f141c] text-white">Webtoon</option>
            <option value="COMIC" className="bg-[#0f141c] text-white">Comic</option>
          </select>

          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedStatus(val);
              setPage(1);
              applyFilters(1, { status: val });
            }}
            className="w-full h-8 rounded-lg liquid-glass-input px-2.5 text-xs text-foreground focus:outline-none"
          >
            <option value="" className="bg-[#0f141c] text-white">All Statuses</option>
            <option value="ONGOING" className="bg-[#0f141c] text-white">Ongoing</option>
            <option value="COMPLETED" className="bg-[#0f141c] text-white">Completed</option>
            <option value="HIATUS" className="bg-[#0f141c] text-white">Hiatus</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => {
              const val = e.target.value;
              setSortBy(val);
              setPage(1);
              applyFilters(1, { sortBy: val });
            }}
            className="w-full h-8 rounded-lg liquid-glass-input px-2.5 text-xs text-foreground focus:outline-none"
          >
            <option value="popularity" className="bg-[#0f141c] text-white">Order: Popularity</option>
            <option value="rating" className="bg-[#0f141c] text-white">Order: Top Rated</option>
            <option value="latest" className="bg-[#0f141c] text-white">Order: Recently Added</option>
            <option value="updated" className="bg-[#0f141c] text-white">Order: Latest Updates</option>
            <option value="title" className="bg-[#0f141c] text-white">Order: Alphabetical</option>
          </select>
        </div>
      </div>

      {/* Results Section */}
      <div>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-2xl liquid-glass animate-pulse border border-white/5"
              />
            ))}
          </div>
        ) : mangaList.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl liquid-glass border border-white/10 space-y-3">
            <BookOpen className="h-10 w-10 text-muted-foreground opacity-30" />
            <h3 className="text-sm font-bold text-foreground">No Titles Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              We couldn&apos;t find any manga matching your filter criteria. Try adjusting or resetting your search.
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleReset}
                className="liquid-glass-chip px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {mangaList.map((manga) => (
              <MangaCard key={manga.id} {...manga} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <button
            onClick={() => {
              const p = Math.max(1, page - 1);
              setPage(p);
              applyFilters(p);
            }}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl liquid-glass-chip text-xs font-semibold text-slate-200 disabled:opacity-40 disabled:pointer-events-none hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <span className="text-xs font-mono text-muted-foreground px-2">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => {
              const p = Math.min(totalPages, page + 1);
              setPage(p);
              applyFilters(p);
            }}
            disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl liquid-glass-chip text-xs font-semibold text-slate-200 disabled:opacity-40 disabled:pointer-events-none hover:text-white"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-28 rounded-2xl liquid-glass animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl liquid-glass animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <BrowseContent />
    </Suspense>
  );
}
