"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { MangaCard } from "@/components/manga/MangaCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Search, Filter, RotateCcw, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";

function BrowseContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
  const applyFilters = (newPage = page) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (selectedGenre) params.set("genre", selectedGenre);
    if (selectedStatus) params.set("status", selectedStatus);
    if (selectedType) params.set("contentType", selectedType);
    if (sortBy) params.set("sortBy", sortBy);
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

  return (
    <div className="flex flex-col space-y-8 pb-16">
      {/* Header & Filter Controls */}
      <div className="rounded-3xl liquid-glass p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Browse & Search
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Explore thousands of manga, manhwa, and webtoons
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 self-start sm:self-auto text-xs hover:bg-white/[0.08]">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Filters
          </Button>
        </div>

        {/* Search input form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            applyFilters(1);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by title, author, artist, or keywords..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-11 text-xs"
            />
          </div>
          <Button type="submit" className="h-11 px-6 gap-1.5 font-bold">
            Search
          </Button>
        </form>

        {/* Filter Selects */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {/* Genre */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Genre
            </label>
            <select
              value={selectedGenre}
              onChange={(e) => {
                setSelectedGenre(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 rounded-xl liquid-glass-input px-3 text-xs text-foreground focus:outline-none"
            >
              <option value="" className="bg-[#0f141c] text-white">All Genres</option>
              {genres.map((g) => (
                <option key={g.slug} value={g.slug} className="bg-[#0f141c] text-white">
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Content Type */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Format
            </label>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 rounded-xl liquid-glass-input px-3 text-xs text-foreground focus:outline-none"
            >
              <option value="" className="bg-[#0f141c] text-white">All Formats</option>
              <option value="MANGA" className="bg-[#0f141c] text-white">Manga</option>
              <option value="MANHWA" className="bg-[#0f141c] text-white">Manhwa</option>
              <option value="MANHUA" className="bg-[#0f141c] text-white">Manhua</option>
              <option value="WEBTOON" className="bg-[#0f141c] text-white">Webtoon</option>
              <option value="COMIC" className="bg-[#0f141c] text-white">Comic</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 rounded-xl liquid-glass-input px-3 text-xs text-foreground focus:outline-none"
            >
              <option value="" className="bg-[#0f141c] text-white">All Statuses</option>
              <option value="ONGOING" className="bg-[#0f141c] text-white">Ongoing</option>
              <option value="COMPLETED" className="bg-[#0f141c] text-white">Completed</option>
              <option value="HIATUS" className="bg-[#0f141c] text-white">Hiatus</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Order By
            </label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 rounded-xl liquid-glass-input px-3 text-xs text-foreground focus:outline-none"
            >
              <option value="popularity" className="bg-[#0f141c] text-white">Popularity</option>
              <option value="rating" className="bg-[#0f141c] text-white">Top Rated</option>
              <option value="latest" className="bg-[#0f141c] text-white">Recently Added</option>
              <option value="updated" className="bg-[#0f141c] text-white">Latest Updates</option>
              <option value="title" className="bg-[#0f141c] text-white">Alphabetical</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={() => applyFilters(1)} className="gap-1.5 text-xs font-semibold px-4 h-9">
            <Filter className="h-3.5 w-3.5" /> Apply Filters
          </Button>
        </div>
      </div>

      {/* Results Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-muted-foreground">
            Found <span className="font-bold text-foreground">{totalCount}</span> titles
          </p>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-lg bg-surface-elevated animate-pulse" />
            ))}
          </div>
        ) : mangaList.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {mangaList.map((manga) => (
              <MangaCard key={manga.id} {...manga} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-16 rounded-xl border border-dashed border-border text-center space-y-3">
            <BookOpen className="h-12 w-12 text-muted-foreground/40" />
            <h4 className="text-base font-semibold text-foreground">No manga found</h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              Try adjusting your search criteria, clear selected genre filters, or search for different keywords.
            </p>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset Filters
            </Button>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 mt-12">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => {
                const prev = Math.max(1, page - 1);
                setPage(prev);
                applyFilters(prev);
              }}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>

            <span className="text-xs text-muted-foreground px-4">
              Page {page} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => {
                const next = Math.min(totalPages, page + 1);
                setPage(next);
                applyFilters(next);
              }}
              className="gap-1"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-16 text-center text-text-muted">Loading manga directory...</div>}>
      <BrowseContent />
    </Suspense>
  );
}
