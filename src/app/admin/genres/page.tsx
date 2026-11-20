"use client";

import React, { useState, useEffect } from "react";
import { Tag, Plus, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";

export default function AdminGenresPage() {
  const [genres, setGenres] = useState<any[]>([]);
  const [newGenreName, setNewGenreName] = useState("");
  const [newGenreDesc, setNewGenreDesc] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const fetchGenres = () => {
    setIsLoading(true);
    fetch("/api/admin/genres")
      .then((r) => r.json())
      .then((d) => {
        if (d.genres) setGenres(d.genres);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchGenres();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGenreName.trim()) {
      setFormError("Genre name cannot be empty");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/admin/genres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGenreName.trim(), description: newGenreDesc.trim() }),
      });

      if (res.ok) {
        setNewGenreName("");
        setNewGenreDesc("");
        fetchGenres();
      } else {
        const d = await res.json().catch(() => ({}));
        setFormError(d.error || "Failed to create genre");
      }
    } catch {
      setFormError("Network error while creating genre");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(`/api/admin/genres?id=${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteTarget(null);
        fetchGenres();
      } else {
        const d = await res.json().catch(() => ({}));
        setDeleteError(d.error || "Failed to delete genre");
      }
    } catch {
      setDeleteError("Network error while deleting genre");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Tag className="h-5 w-5 text-sky-400" />
          Genres
        </h1>
      </div>

      {/* Add Genre Form */}
      <form
        onSubmit={handleCreate}
        className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 space-y-3"
      >
        <h2 className="text-xs font-semibold text-slate-200">
          Add Genre
        </h2>

        {formError && (
          <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full space-y-1">
            <label htmlFor="genre-name" className="text-xs font-medium text-slate-300 block">Name *</label>
            <Input
              id="genre-name"
              placeholder="e.g. Cyberpunk"
              value={newGenreName}
              onChange={(e) => setNewGenreName(e.target.value)}
              className="h-10 text-xs"
            />
          </div>
          <div className="flex-1 w-full space-y-1">
            <label htmlFor="genre-desc" className="text-xs font-medium text-slate-300 block">Description (Optional)</label>
            <Input
              id="genre-desc"
              placeholder="Description..."
              value={newGenreDesc}
              onChange={(e) => setNewGenreDesc(e.target.value)}
              className="h-10 text-xs"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="h-10 w-full sm:w-auto gap-1.5 shrink-0 px-4 text-xs font-medium"
          >
            <Plus className="h-4 w-4" /> {isSubmitting ? "Adding..." : "Add Genre"}
          </Button>
        </div>
      </form>

      {/* Structured Management Table */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden">
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Genres ({genres.length})
          </h2>
        </div>

        {/* Mobile Compact List (Zero Horizontal Overflow) */}
        <div className="block md:hidden divide-y divide-slate-800/80">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Loading genres...
            </div>
          ) : genres.length > 0 ? (
            genres.map((g) => (
              <div key={g.id} className="p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-xs">{g.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-medium">
                      {g._count?.mangas || 0} titles
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDeleteError("");
                      setDeleteTarget({ id: g.id, name: g.name });
                    }}
                    aria-label={`Delete genre ${g.name}`}
                    className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {g.description && (
                  <p className="text-xs text-slate-400">
                    {g.description}
                  </p>
                )}
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              No genres defined yet.
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Titles</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    Loading genres...
                  </td>
                </tr>
              ) : genres.length > 0 ? (
                genres.map((g) => (
                  <tr key={g.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-foreground text-xs">{g.name}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 text-xs max-w-md">
                      {g.description || "-"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-semibold">
                        {g._count?.mangas || 0} titles
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDeleteError("");
                          setDeleteTarget({ id: g.id, name: g.name });
                        }}
                        aria-label={`Delete genre ${g.name}`}
                        className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    No genres defined yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogHeader>
          <DialogTitle>Confirm Delete Genre</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete genre &quot;{deleteTarget?.name}&quot;?
          </DialogDescription>
        </DialogHeader>

        {deleteError && (
          <div className="p-3 my-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
            {deleteError}
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
            {isDeleting ? "Deleting..." : "Delete Genre"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
