"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Plus, Edit, Trash2, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ImageUploadField } from "@/components/ui/ImageUploadField";

export default function EditMangaPage() {
  const params = useParams();
  const router = useRouter();
  const [genres, setGenres] = useState<any[]>([]);
  const [manga, setManga] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [author, setAuthor] = useState("");
  const [artist, setArtist] = useState("");
  const [releaseYear, setReleaseYear] = useState<number>(2024);
  const [status, setStatus] = useState("ONGOING");
  const [contentType, setContentType] = useState("MANGA");
  const [publicationStatus, setPublicationStatus] = useState("PUBLISHED");
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isTrending, setIsTrending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showCustomSlug, setShowCustomSlug] = useState(false);

  useEffect(() => {
    fetch("/api/admin/genres")
      .then((r) => r.json())
      .then((d) => {
        if (d.genres) setGenres(d.genres);
      })
      .catch(() => {});

    fetch(`/api/manga/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.manga) {
          const m = d.manga;
          setManga(m);
          setTitle(m.title);
          setSlug(m.slug);
          setDescription(m.description || "");
          setCoverUrl(m.coverUrl || "");
          setBannerUrl(m.bannerUrl || "");
          setAuthor(m.author || "");
          setArtist(m.artist || "");
          setReleaseYear(m.releaseYear || 2024);
          setStatus(m.status);
          setContentType(m.contentType);
          setPublicationStatus(m.publicationStatus);
          setIsFeatured(m.isFeatured);
          setIsTrending(m.isTrending);
          setSelectedGenreIds(m.genres?.map((g: any) => g.genreId) || []);
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [params.id]);

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
      const res = await fetch(`/api/manga/${params.id}`, {
        method: "PUT",
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
          publicationStatus,
          isFeatured,
          isTrending,
          genreIds: selectedGenreIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update manga");
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage("Manga updated successfully. Redirecting to catalog...");
      setTimeout(() => {
        router.push("/admin/manga");
      }, 750);
    } catch {
      setError("An unexpected error occurred");
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="py-20 text-center text-xs text-muted-foreground">Loading manga data...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/manga">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Edit Manga: {title}</h1>
            <p className="text-xs text-muted-foreground">Modify catalog metadata and chapter associations</p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
          {successMessage}
        </div>
      )}

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
              <label htmlFor="edit-manga-title" className="text-xs font-semibold text-slate-300 block mb-1">
                Title *
              </label>
              <Input
                id="edit-manga-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>
                  URL: /manga/<span className="text-sky-300">{slug}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomSlug(!showCustomSlug)}
                  className="text-xs text-sky-400 hover:text-sky-300 font-sans"
                >
                  {showCustomSlug ? "Hide custom URL" : "Edit URL slug"}
                </button>
              </div>

              {showCustomSlug && (
                <div className="mt-2.5 p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1">
                  <label htmlFor="edit-manga-slug" className="text-xs font-medium text-slate-300 block">
                    URL Slug
                  </label>
                  <Input
                    id="edit-manga-slug"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}
                  />
                  <p className="text-[11px] text-slate-400">
                    Warning: Changing the slug alters existing chapter and reader URLs.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="edit-manga-author" className="text-xs font-semibold text-slate-300 block mb-1">Author</label>
                <Input id="edit-manga-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
              </div>

              <div>
                <label htmlFor="edit-manga-artist" className="text-xs font-semibold text-slate-300 block mb-1">Artist</label>
                <Input id="edit-manga-artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
              </div>

              <div>
                <label htmlFor="edit-manga-format" className="text-xs font-semibold text-slate-300 block mb-1">Format</label>
                <select
                  id="edit-manga-format"
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
                <label htmlFor="edit-manga-status" className="text-xs font-semibold text-slate-300 block mb-1">Status</label>
                <select
                  id="edit-manga-status"
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
                <label htmlFor="edit-manga-pubstatus" className="text-xs font-semibold text-slate-300 block mb-1">Publication Status</label>
                <select
                  id="edit-manga-pubstatus"
                  value={publicationStatus}
                  onChange={(e) => setPublicationStatus(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-800 bg-slate-950 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="PUBLISHED">Published</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-manga-year" className="text-xs font-semibold text-slate-300 block mb-1">Release Year</label>
                <Input id="edit-manga-year" type="number" value={releaseYear} onChange={(e) => setReleaseYear(Number(e.target.value))} />
              </div>
            </div>

            <div>
              <label htmlFor="edit-manga-desc" className="text-xs font-semibold text-slate-300 block mb-1">Description</label>
              <textarea
                id="edit-manga-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-slate-800 bg-slate-950 p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Artwork & Banners */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-foreground border-b border-slate-800 pb-2">Cover & Banner</h3>
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

        {/* Genres */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-foreground border-b border-slate-800 pb-2">Genres</h3>
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

        <div className="flex justify-end gap-3">
          <Link href="/admin/manga">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting} className="gap-2 font-bold">
            <Save className="h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
