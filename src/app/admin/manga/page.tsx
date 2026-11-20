"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  Search,
  Edit,
  Trash2,
  ExternalLink,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { formatDate } from "@/lib/utils";
import { getSafeImageUrl, getProxyFallbackUrl } from "@/lib/image-utils";

type ViewMode = "grid" | "table";
type StatusFilter = "ALL" | "PUBLISHED" | "PENDING_REVIEW" | "DRAFT";

export default function AdminMangaPage() {
  const [mangaList, setMangaList] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isLoading, setIsLoading] = useState(true);

  // In-app deletion dialog state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; slug: string; title: string; chaptersCount?: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  const fetchList = () => {
    setIsLoading(true);
    const url = query.trim() ? `/api/manga?q=${encodeURIComponent(query)}&limit=100` : `/api/manga?limit=100`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setMangaList(d.items || []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  const filteredManga = mangaList.filter((m) => {
    if (statusFilter === "ALL") return true;
    return m.publicationStatus === statusFilter;
  });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setActionError("");

    try {
      const res = await fetch(`/api/v1/admin/manga/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteTarget(null);
        fetchList();
      } else {
        const fallbackRes = await fetch(`/api/manga/${deleteTarget.slug}`, { method: "DELETE" });
        if (fallbackRes.ok) {
          setDeleteTarget(null);
          fetchList();
        } else {
          const errData = await fallbackRes.json().catch(() => ({}));
          setActionError(errData.error || "Failed to delete manga");
        }
      }
    } catch {
      setActionError("Network error while deleting manga");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-sky-400" />
            Manga Catalog
          </h1>
        </div>

        <Link href="/admin/manga/new">
          <Button size="sm" className="gap-1.5 text-xs font-medium shrink-0">
            <Plus className="h-4 w-4" /> New Series
          </Button>
        </Link>
      </div>

      {/* Control Bar: Filters, Search & View Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        {/* Search Input */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <label htmlFor="manga-search" className="sr-only">
              Filter manga catalog
            </label>
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <Input
              id="manga-search"
              placeholder="Filter by title or author..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-10 text-xs bg-slate-900 border-slate-800"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={fetchList} className="h-10 text-xs font-semibold px-4">
            Search
          </Button>
        </div>

        {/* Status Filter Tabs & View Mode Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/80 p-1 text-xs font-semibold">
            {(["ALL", "PUBLISHED", "PENDING_REVIEW", "DRAFT"] as StatusFilter[]).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  statusFilter === st
                    ? "bg-slate-800 text-sky-300 font-bold border border-slate-700/60"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {st === "ALL" ? "All" : st === "PENDING_REVIEW" ? "Review" : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/80 p-1 text-xs">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "grid" ? "bg-slate-800 text-sky-400" : "text-slate-400 hover:text-white"
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "table" ? "bg-slate-800 text-sky-400" : "text-slate-400 hover:text-white"
              }`}
              aria-label="Table view"
            >
              <TableIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-slate-400 rounded-lg border border-slate-800 bg-slate-900/40">
          Loading series...
        </div>
      ) : filteredManga.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-400 rounded-lg border border-dashed border-slate-800 bg-slate-900/30 space-y-2">
          <BookOpen className="h-8 w-8 mx-auto opacity-30 text-sky-400" />
          <p className="font-semibold text-foreground text-sm">No series match this filter</p>
          <p>Try adjusting your search query or status filter.</p>
        </div>
      ) : viewMode === "grid" ? (
        /* Visual Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredManga.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden flex flex-col justify-between group hover:border-slate-700 transition-colors"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950 border-b border-slate-800">
                {m.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getSafeImageUrl(m.coverUrl)}
                    alt={`${m.title} cover`}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      if (m.coverUrl && !e.currentTarget.src.includes("/api/image-proxy")) {
                        e.currentTarget.src = getProxyFallbackUrl(m.coverUrl);
                      }
                    }}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <BookOpen className="h-10 w-10 opacity-30" />
                  </div>
                )}

                {/* Badges */}
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-900/90 text-slate-300 border border-slate-700">
                    {m.contentType}
                  </span>
                  <Badge
                    variant={
                      m.publicationStatus === "PUBLISHED"
                        ? "success"
                        : m.publicationStatus === "PENDING_REVIEW"
                        ? "warning"
                        : "outline"
                    }
                    className="text-[11px]"
                  >
                    {m.publicationStatus}
                  </Badge>
                </div>

                {/* Chapter Count Pill */}
                <div className="absolute bottom-2 left-2 pointer-events-none">
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-slate-900/90 text-slate-300 border border-slate-700">
                    {m._count?.chapters || 0} chapters
                  </span>
                </div>
              </div>

              {/* Series Info */}
              <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-foreground line-clamp-1" title={m.title}>
                    {m.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {m.author ? `by ${m.author}` : "Internal author"} • {formatDate(m.updatedAt)}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between gap-1.5">
                  <Link href={`/admin/chapters?mangaId=${m.id}`} className="flex-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full h-8 text-xs font-medium gap-1 text-sky-300 hover:text-white"
                    >
                      <Layers className="h-3.5 w-3.5" /> Chapters
                    </Button>
                  </Link>

                  <Link href={`/admin/manga/${m.id}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-2.5 border-slate-700 hover:bg-slate-800 text-slate-300"
                      aria-label={`Edit ${m.title}`}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </Link>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setActionError("");
                      setDeleteTarget({ id: m.id, slug: m.slug, title: m.title, chaptersCount: m._count?.chapters });
                    }}
                    aria-label={`Delete ${m.title}`}
                    className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* High-Density Table / List View */
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden">
          {/* Mobile Compact List (Zero Horizontal Overflow) */}
          <div className="block md:hidden divide-y divide-slate-800/80">
            {filteredManga.map((m) => (
              <div key={m.id} className="p-3.5 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-15 rounded-md overflow-hidden shrink-0 border border-slate-700 bg-slate-800">
                    {m.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getSafeImageUrl(m.coverUrl)}
                        alt={`${m.title} cover`}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (m.coverUrl && !e.currentTarget.src.includes("/api/image-proxy")) {
                            e.currentTarget.src = getProxyFallbackUrl(m.coverUrl);
                          }
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-800" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {m.contentType}
                      </Badge>
                      <Badge
                        variant={
                          m.publicationStatus === "PUBLISHED"
                            ? "success"
                            : m.publicationStatus === "PENDING_REVIEW"
                            ? "warning"
                            : "outline"
                        }
                        className="text-[10px] px-1.5 py-0"
                      >
                        {m.publicationStatus}
                      </Badge>
                    </div>
                    <Link
                      href={`/manga/${m.slug}`}
                      target="_blank"
                      className="font-semibold text-xs text-foreground hover:text-sky-400 transition-colors flex items-center gap-1 truncate"
                    >
                      <span className="truncate">{m.title}</span>
                      <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />
                    </Link>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {m._count?.chapters || 0} chapters • {formatDate(m.updatedAt)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
                  <Link href={`/admin/chapters?mangaId=${m.id}`}>
                    <Button size="sm" variant="secondary" className="h-8 text-xs px-2.5">
                      <Layers className="h-3.5 w-3.5 mr-1" /> Chapters
                    </Button>
                  </Link>
                  <Link href={`/admin/manga/${m.id}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-2.5 border-slate-700 text-slate-300"
                      aria-label={`Edit ${m.title}`}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setActionError("");
                      setDeleteTarget({ id: m.id, slug: m.slug, title: m.title, chaptersCount: m._count?.chapters });
                    }}
                    aria-label={`Delete ${m.title}`}
                    className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Chapters</th>
                  <th className="py-3.5 px-4">Publication</th>
                  <th className="py-3.5 px-4">Updated</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredManga.map((m) => (
                  <tr key={m.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-4 flex items-center gap-3">
                      <div className="w-10 h-14 rounded-lg overflow-hidden shrink-0 border border-slate-700 bg-slate-800">
                        {m.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={getSafeImageUrl(m.coverUrl)}
                            alt={`${m.title} cover`}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              if (m.coverUrl && !e.currentTarget.src.includes("/api/image-proxy")) {
                                e.currentTarget.src = getProxyFallbackUrl(m.coverUrl);
                              }
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-800" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/manga/${m.slug}`}
                          target="_blank"
                          className="font-semibold text-foreground hover:text-sky-400 transition-colors flex items-center gap-1 truncate max-w-xs"
                        >
                          <span className="truncate">{m.title}</span>
                          <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />
                        </Link>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant="outline" className="text-xs">
                        {m.contentType}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-foreground text-xs uppercase">
                        {m.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold whitespace-nowrap text-xs">
                      {m._count?.chapters || 0}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge
                        variant={
                          m.publicationStatus === "PUBLISHED"
                            ? "success"
                            : m.publicationStatus === "PENDING_REVIEW"
                            ? "warning"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {m.publicationStatus}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 text-slate-400 font-mono text-xs whitespace-nowrap">
                      {formatDate(m.updatedAt)}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/admin/chapters?mangaId=${m.id}`}>
                          <Button size="sm" variant="secondary" className="h-7 text-xs px-2.5">
                            <Layers className="h-3 w-3 mr-1" /> Chapters
                          </Button>
                        </Link>
                        <Link href={`/admin/manga/${m.id}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2.5 border-slate-700 text-slate-300"
                            aria-label={`Edit ${m.title}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setActionError("");
                            setDeleteTarget({ id: m.id, slug: m.slug, title: m.title, chaptersCount: m._count?.chapters });
                          }}
                          aria-label={`Delete ${m.title}`}
                          className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Accessible In-App Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogHeader>
          <DialogTitle>Confirm Delete Series</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{deleteTarget?.title}&quot;?
            {deleteTarget?.chaptersCount !== undefined && deleteTarget.chaptersCount > 0 && (
              <span className="block mt-1 font-semibold text-rose-400">
                Warning: This series has {deleteTarget.chaptersCount} chapters that will also be permanently deleted.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {actionError && (
          <div className="p-3 my-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
            {actionError}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDeleteTarget(null)}
            disabled={isDeleting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={confirmDelete}
            disabled={isDeleting}
            className="text-xs font-bold"
          >
            {isDeleting ? "Deleting..." : "Delete Series"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
