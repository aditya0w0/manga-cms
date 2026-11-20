"use client";

import React, { useState, useRef } from "react";
import { Upload, X, RefreshCw, Image as ImageIcon, Link as LinkIcon, AlertCircle } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { getSafeImageUrl } from "@/lib/image-utils";

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  aspectRatio?: "cover" | "banner";
  hint?: string;
}

export function ImageUploadField({
  label,
  value,
  onChange,
  folder = "media",
  aspectRatio = "cover",
  hint,
}: ImageUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG, WebP).");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch("/api/admin/media", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to upload image");
        return;
      }

      if (data.asset?.url) {
        onChange(data.asset.url);
      }
    } catch {
      setError("Network error while uploading image");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    onChange("");
    setError("");
  };

  const aspectClass = aspectRatio === "cover" ? "aspect-[3/4] w-28 sm:w-32" : "aspect-[16/9] w-full max-w-xs";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-300 block">{label}</label>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[11px] text-slate-400 hover:text-sky-400 transition-colors flex items-center gap-1"
        >
          <LinkIcon className="h-3 w-3" />
          {showUrlInput ? "Hide manual URL" : "Enter URL manually"}
        </button>
      </div>

      {error && (
        <div className="p-2 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showUrlInput && (
        <div className="pb-1">
          <Input
            placeholder="https://... or /uploads/..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-xs font-mono"
          />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={handleFileSelect}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="flex items-start gap-3">
        {value ? (
          <div className="flex items-center gap-3">
            <div className={`relative ${aspectClass} rounded-md border border-slate-700 bg-slate-950 overflow-hidden shrink-0 group`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getSafeImageUrl(value)}
                alt={label}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="h-7 text-xs gap-1 border-slate-700 text-slate-300 hover:text-white"
              >
                <RefreshCw className={`h-3 w-3 ${isUploading ? "animate-spin" : ""}`} />
                {isUploading ? "Uploading..." : "Replace"}
              </Button>
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1 px-2"
                >
                  <X className="h-3 w-3" /> Remove
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className={`${aspectClass} rounded-md border border-dashed border-slate-700 bg-slate-950/60 hover:bg-slate-900/60 hover:border-slate-600 transition-colors flex flex-col items-center justify-center p-3 text-center cursor-pointer group`}
          >
            {isUploading ? (
              <RefreshCw className="h-5 w-5 text-sky-400 animate-spin mb-1.5" />
            ) : (
              <Upload className="h-5 w-5 text-slate-400 group-hover:text-sky-400 transition-colors mb-1.5" />
            )}
            <span className="text-xs font-medium text-slate-300 group-hover:text-foreground transition-colors">
              {isUploading ? "Uploading..." : "Upload image"}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">JPG, PNG, WebP</span>
          </button>
        )}
      </div>

      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
