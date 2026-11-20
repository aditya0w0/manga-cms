"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Upload, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ImageUploadField } from "@/components/ui/ImageUploadField";

export default function NewMangaPage() {
  const router = useRouter();
  const [genres, setGenres] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [author, setAuthor] = useState("");
  const [artist, setArtist] = useState("");
  const [releaseYear, setReleaseYear] = useState<number>(new Date().getFullYear());
  const [status, setStatus] = useState("ONGOING");
  const [contentType, setContentType] = useState("MANGA");
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isTrending, setIsTrending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showCustomSlug, setShowCustomSlug] = useState(false);
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);

  useEffect(() => {
    fetch("/api/admin/genres")
      .then((r) => r.json())
      .then((d) => {
        if (d.genres) setGenres(d.genres);
      })
      .catch(() => {});
  }, []);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isSlugCustomized) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  };

  const toggleGenre = (genreId: string) => {
    setSelectedGenreIds((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/manga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          description,
          coverUrl,
          bannerUrl,
          author,
          artist,
          releaseYear,
          status,
          contentType,
          isFeatured,
          isTrending,
          genreIds: selectedGenreIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create manga");
        setIsSubmitting(false);
        return;
      }

      router.push("/admin/manga");
    } catch {
      setError("An unexpected error occurred");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      <div className="flex items-center gap-3">
        <Link href="/admin/manga">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Create New Manga</h1>
          <p className="text-xs text-muted-foreground">Add a new title manually to the catalog</p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-foreground border-b border-slate-800 pb-2">
            Basic Details
          </h3>

          <div className="space-y-4">
            <div>
              <label htmlFor="manga-title" className="text-xs font-semibold text-slate-300 block mb-1">
                Title *
              </label>
              <Input
                id="manga-title"
                required
                placeholder="e.g. Solo Leveling"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
              />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>
                  URL: /manga/<span className="text-sky-300">{slug || "title-slug"}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomSlug(!showCustomSlug)}
                  className="text-xs text-sky-400 hover:text-sky-300 font-sans"
                >
                  {showCustomSlug ? "Hide custom URL" : "Customize URL slug"}
                </button>
              </div>

              {showCustomSlug && (
                <div className="mt-2.5 p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1">
                  <label htmlFor="manga-slug" className="text-xs font-medium text-slate-300 block">
                    Custom URL Slug
                  </label>
                  <Input
                    id="manga-slug"
                    required
                    placeholder="e.g. solo-leveling"
                    value={slug}
                    onChange={(e) => {
                      setIsSlugCustomized(true);
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                    }}
                  />
                  <p className="text-[11px] text-slate-400">
                    Auto-generated from title. Customize only if you require a specific URL key.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="manga-author" className="text-xs font-semibold text-slate-300 block mb-1">
                  Author
                </label>
                <Input
                  id="manga-author"
                  placeholder="Story author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="manga-artist" className="text-xs font-semibold text-slate-300 block mb-1">
                  Artist
                </label>
                <Input
                  id="manga-artist"
                  placeholder="Illustrator"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="manga-format" className="text-xs font-semibold text-slate-300 block mb-1">
                  Format / Type
                </label>
                <select
                  id="manga-format"
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-800 bg-slate-950 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="MANGA">Manga</option>
                  <option value="MANHWA">Manhwa</option>
                  <option value="MANHUA">Manhua</option>
                  <option value="WEBTOON">Webtoon</option>
                  <option value="COMIC">Comic</option>
                </select>
              </div>

              <div>
                <label htmlFor="manga-status" className="text-xs font-semibold text-slate-300 block mb-1">
                  Status
                </label>
                <select
                  id="manga-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-800 bg-slate-950 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="ONGOING">Ongoing</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="HIATUS">Hiatus</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label htmlFor="manga-release-year" className="text-xs font-semibold text-slate-300 block mb-1">
                  Release Year
                </label>
                <Input
                  id="manga-release-year"
                  type="number"
                  value={releaseYear}
                  onChange={(e) => setReleaseYear(Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label htmlFor="manga-description" className="text-xs font-semibold text-slate-300 block mb-1">
                Description / Synopsis
              </label>
              <textarea
                id="manga-description"
                rows={4}
                placeholder="Full summary of the manga..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Artwork & Banners */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-foreground border-b border-slate-800 pb-2">
            Artwork & Banners
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ImageUploadField
              label="Cover Image"
              value={coverUrl}
              onChange={setCoverUrl}
              folder="covers"
              aspectRatio="cover"
              hint="Recommended: 600x900px vertical cover"
            />

            <ImageUploadField
              label="Banner Image (Optional)"
              value={bannerUrl}
              onChange={setBannerUrl}
              folder="banners"
              aspectRatio="banner"
              hint="Recommended: 1920x600px wide header banner"
            />
          </div>
        </div>

        {/* Genres Selection */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-foreground border-b border-slate-800 pb-2">
            Genres
          </h3>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => {
              const isSelected = selectedGenreIds.includes(g.id);
              return (
                <button
                  type="button"
                  key={g.id}
                  onClick={() => toggleGenre(g.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    isSelected
                      ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-foreground"
                  }`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Visibility Flags */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground border-b border-slate-800 pb-2">
            Discovery Placement
          </h3>
          <div className="flex flex-col sm:flex-row gap-6">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Feature in Homepage Hero Carousel
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={isTrending}
                onChange={(e) => setIsTrending(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Display in Trending Section
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/admin/manga">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting} className="gap-2 font-bold">
            <Save className="h-4 w-4" />
            {isSubmitting ? "Creating..." : "Save Manga"}
          </Button>
        </div>
      </form>
    </div>
  );
}
