"use client";

import React, { useState } from "react";
import {
  FileCode,
  Download,
  Copy,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface BatchSchematicModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TEMPLATES: Record<
  string,
  {
    fileName: string;
    description: string;
    language: string;
    content: string;
    tag: string;
  }
> = {
  schematic: {
    fileName: "schematic.json",
    description: "Tier 1 Multi-Comic Orchestration root manifest. References sub-manifests and applies global conflict defaults.",
    language: "json",
    tag: "Tier 1 Root",
    content: `{
  "$schema": "https://mangacms.local/schemas/schematic-v1.json",
  "schemaVersion": "1.0",
  "batchId": "batch_archive_4000_sample",
  "sourceMode": "archive",
  "compressionPreset": "auto",
  "autoPublish": true,
  "defaults": {
    "conflictPolicy": "skip_existing",
    "pageSort": "natural",
    "onChapterError": "continue"
  },
  "comics": [
    {
      "slug": "sample-solo-adventure",
      "title": "Sample Solo Adventure",
      "manifestPath": "sample-solo-adventure/manifest.json",
      "createIfMissing": true,
      "enabled": true
    },
    {
      "slug": "sample-epic-odyssey",
      "title": "Sample Epic Odyssey (4,000 Chapters Streaming)",
      "manifestPath": "sample-epic-odyssey/manifest.json",
      "createIfMissing": true,
      "enabled": true
    },
    {
      "slug": "sample-auto-discovery",
      "title": "Sample Auto Discovery Comic",
      "manifestPath": "sample-auto-discovery/manifest.json",
      "createIfMissing": true,
      "enabled": true
    }
  ]
}`,
  },
  streaming: {
    fileName: "chapters.ndjson",
    description: "Tier 2 Streaming NDJSON Mode. Stream line-by-line without memory bottlenecks for 500 to 10,000+ chapters.",
    language: "json",
    tag: "High Scale (4k+)",
    content: `{"chapterKey":"1","displayNumber":"1","title":"Dawn of the Adventure","volume":1,"source":"chapters/ch_0001.cbz"}
{"chapterKey":"2","displayNumber":"2","title":"The Straw Hat Guy","volume":1,"source":"chapters/ch_0002.cbz"}
{"chapterKey":"1400","displayNumber":"1400","title":"The High Seas Clash","volume":140,"source":"chapters/ch_1400/"}
{"chapterKey":"1401","displayNumber":"1401","title":"Uncharted Horizons","volume":140,"source":"chapters/ch_1401/"}
{"chapterKey":"4000","displayNumber":"4000","title":"The Grand Finale","volume":400,"source":"chapters/ch_4000/"}`,
  },
  inline: {
    fileName: "manifest.json (Inline)",
    description: "Tier 2 Inline Mode. Ideal for small or medium releases under 500 chapters declared directly in an array.",
    language: "json",
    tag: "Under 500 Ch.",
    content: `{
  "chaptersMode": "inline",
  "chapters": [
    {
      "chapterKey": "1",
      "displayNumber": "1",
      "title": "Prologue: The Awakening",
      "volume": 1,
      "source": "ch_001.cbz"
    },
    {
      "chapterKey": "2",
      "displayNumber": "2",
      "title": "Chapter 2: The First Trial",
      "volume": 1,
      "source": "ch_002/"
    },
    {
      "chapterKey": "2.5",
      "displayNumber": "2.5",
      "title": "Omake: Behind the Scenes",
      "volume": 1,
      "source": "ch_002_extra/"
    }
  ]
}`,
  },
  auto: {
    fileName: "manifest.json (Auto Discovery)",
    description: "Tier 2 Regex Discovery. Zero manual chapter list authoring. Automatic regex detection with custom overrides.",
    language: "json",
    tag: "Zero Authoring",
    content: `{
  "chaptersMode": "auto_with_overrides",
  "chapterRegex": "(?:Ch\\\\.?|Chapter)\\\\s*(\\\\d+(?:\\\\.\\\\d+)?)",
  "volumeRegex": "(?:Vol\\\\.?|Volume)\\\\s*(\\\\d+)",
  "overrides": {
    "Ch 00 Special Edition": {
      "displayNumber": "0.5",
      "title": "Special Prequel Episode"
    },
    "Rough Drafts": {
      "skip": true
    }
  }
}`,
  },
  readme: {
    fileName: "README.md",
    description: "Specification guide, file layout diagram, and checkpoint recovery invariant explanation.",
    language: "markdown",
    tag: "Spec Guide",
    content: `# MangaCMS Batch Ingestion Architecture & Schematic Specification

## Overview

MangaCMS uses a 2-tier schematic structure for ingesting massive comic archives up to 10,000+ chapters:

1. Tier 1: schematic.json (Root orchestrator for multi-comic archives)
2. Tier 2: comic manifest (manifest.json and chapters.ndjson)

## Checkpoint Recovery & Resumability

Each chapter is committed atomically to the database. If an ingestion of 4,000 chapters encounters an error at Chapter 1,401, Chapters 1 through 1,400 remain permanently saved. Resuming the batch will only queue the failed and pending chapters from the failure checkpoint without reprocessing completed work.`,
  },
};

export function BatchSchematicModal({ isOpen, onClose }: BatchSchematicModalProps) {
  const [activeTabKey, setActiveTabKey] = useState<string>("schematic");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentTemplate = TEMPLATES[activeTabKey];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentTemplate.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      {/* Optical Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Surface */}
      <div className="relative z-50 w-full max-w-4xl rounded-2xl liquid-glass-obsidian border border-white/20 p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl liquid-glass text-sky-400 border border-white/20 shadow-md">
              <FileCode className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">
                  Batch Ingestion Schematic Templates
                </h2>
                <Badge variant="outline" className="text-[10px] font-mono text-sky-300 border-sky-400/30 bg-sky-500/10">
                  v1.0 Spec
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Standardized schemas for multi-comic archives, streaming NDJSON pipelines, and checkpoint recovery
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors focus:outline-none"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action Row: Download Button & Spec Tabs */}
        <div className="pt-3 pb-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
            {Object.entries(TEMPLATES).map(([key, t]) => {
              const isActive = activeTabKey === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveTabKey(key);
                    setCopied(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    isActive
                      ? "liquid-glass-btn-primary font-bold text-white shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  <span>{t.fileName.split(" ")[0]}</span>
                  <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${isActive ? "bg-white/20 text-white" : "bg-black/30 text-slate-400"}`}>
                    {t.tag}
                  </span>
                </button>
              );
            })}
          </div>

          <a
            href="/api/v1/admin/batch-import/template"
            download="mangacms-schematic-templates.zip"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 transition-all shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Download Starter Bundle (.zip)
          </a>
        </div>

        {/* Tab Description */}
        <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300 flex items-center justify-between gap-2 shrink-0 mb-3">
          <span className="leading-relaxed">{currentTemplate.description}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-7 px-2.5 text-xs gap-1 text-slate-300 hover:text-white hover:bg-white/10 shrink-0"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </Button>
        </div>

        {/* Code View Surface */}
        <div className="flex-1 overflow-hidden rounded-xl border border-white/15 bg-slate-950/90 relative flex flex-col min-h-[260px]">
          <div className="h-7 px-3 bg-black/60 border-b border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0">
            <span>{currentTemplate.fileName}</span>
            <span className="text-slate-500">{currentTemplate.language.toUpperCase()}</span>
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-200 leading-relaxed select-text">
            <pre className="whitespace-pre">{currentTemplate.content}</pre>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span>
            Schematic files can be dropped directly into the root of CBZ or ZIP archives, or referenced from local storage paths.
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-7 text-xs text-slate-300 hover:text-white"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
