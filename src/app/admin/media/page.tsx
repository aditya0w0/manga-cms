"use client";

import React, { useState, useEffect, useRef } from "react";
import { Image as ImageIcon, Upload, Copy, CheckCircle2, AlertCircle, Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";

export default function AdminMediaPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [filterQuery, setFilterQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = () => {
    fetch("/api/admin/media")
      .then((r) => r.json())
      .then((d) => {
        if (d.assets) setAssets(d.assets);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    setIsUploading(true);
    setUploadError("");
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "media");

    try {
      const res = await fetch("/api/admin/media", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        fetchAssets();
      } else {
        const errData = await res.json().catch(() => ({}));
        setUploadError(errData.error || "Media upload failed");
      }
    } catch {
      setUploadError("Network error while uploading media asset");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(url);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredAssets = assets.filter((a) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      (a.originalName && a.originalName.toLowerCase().includes(q)) ||
      (a.storageKey && a.storageKey.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-sky-400" />
            Media Library
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
          <Button
            size="sm"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload media file"
            className="gap-1.5 text-xs font-medium"
          >
            <Upload className="h-4 w-4" /> {isUploading ? "Uploading..." : "Upload Asset"}
          </Button>
        </div>
      </div>

      {uploadError && (
        <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Search & Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <label htmlFor="media-search" className="sr-only">
            Search assets by filename
          </label>
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <Input
            id="media-search"
            placeholder="Search assets by filename..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="pl-10 h-10 text-xs bg-slate-900 border-slate-800"
          />
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Showing {filteredAssets.length} of {assets.length} assets
        </span>
      </div>

      {/* Grid of assets */}
      {filteredAssets.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className="rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden shadow-sm flex flex-col justify-between group hover:border-slate-700 transition-colors"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setPreviewAsset(asset)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPreviewAsset(asset);
                  }
                }}
                aria-label={`Preview ${asset.originalName || "media asset"}`}
                className="relative aspect-square w-full overflow-hidden bg-slate-950 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.url}
                  alt={asset.originalName || "Media asset"}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="p-1.5 rounded-md bg-black/70 text-white border border-white/20">
                    <Eye className="h-4 w-4" />
                  </span>
                </div>
              </div>

              <div className="p-2.5 space-y-1.5">
                <p className="text-xs font-semibold text-foreground truncate" title={asset.originalName}>
                  {asset.originalName}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>{(asset.size / 1024).toFixed(0)} KB</span>
                  <span className="text-sky-400">{asset.storageProvider}</span>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyUrl(asset.url)}
                  className="w-full h-7 text-xs gap-1 mt-1 border-slate-700 hover:bg-slate-800 text-slate-300"
                  aria-label={`Copy URL for ${asset.originalName}`}
                >
                  {copiedKey === asset.url ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copiedKey === asset.url ? "Copied" : "Copy URL"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-slate-400 space-y-2 rounded-lg border border-dashed border-slate-800 bg-slate-900/40">
          <ImageIcon className="h-8 w-8 mx-auto opacity-30 text-sky-400" />
          <p className="text-sm font-semibold text-foreground">No media assets found</p>
          <p className="text-xs text-slate-400">Upload images, posters, or covers to the media library.</p>
        </div>
      )}

      {/* Asset Preview Modal */}
      <Dialog open={!!previewAsset} onOpenChange={(open) => !open && setPreviewAsset(null)}>
        <DialogHeader>
          <DialogTitle>{previewAsset?.originalName}</DialogTitle>
          <DialogDescription>
            Size: {(previewAsset?.size / 1024).toFixed(1)} KB • Provider: {previewAsset?.storageProvider}
          </DialogDescription>
        </DialogHeader>

        <div className="my-3 max-h-[65vh] overflow-y-auto flex items-center justify-center bg-black/80 rounded-xl p-2">
          {previewAsset && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewAsset.url}
              alt={previewAsset.originalName}
              className="max-h-[60vh] w-auto object-contain rounded"
            />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => previewAsset && copyUrl(previewAsset.url)}
            className="text-xs gap-1 border-slate-700"
          >
            <Copy className="h-3.5 w-3.5" /> Copy Public URL
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setPreviewAsset(null)} className="text-xs">
            Close
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
