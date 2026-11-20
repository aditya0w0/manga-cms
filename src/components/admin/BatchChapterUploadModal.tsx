"use client";

import React, { useState, useRef } from "react";
import {
  FolderArchive,
  Upload,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FileArchive,
  ArrowRight,
  RotateCcw,
  HardDrive,
} from "lucide-react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ClientZipInspector } from "@/lib/zip-client-parser";
import { BatchManifestParser, DetectedChapterItem } from "@/modules/upload-pipeline/batch-manifest";
import { BatchImportMonitor } from "./BatchImportMonitor";

interface BatchChapterUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  mangaId: string;
  mangaTitle: string;
  onSuccess: () => void;
}

type Step = "inspect" | "preview" | "uploading" | "monitoring" | "complete";
type Mode = "master-zip" | "multi-file" | "local-dir";

export function BatchChapterUploadModal({
  isOpen,
  onClose,
  mangaId,
  mangaTitle,
  onSuccess,
}: BatchChapterUploadModalProps) {
  const [step, setStep] = useState<Step>("inspect");
  const [mode, setMode] = useState<Mode>("master-zip");
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [multiFiles, setMultiFiles] = useState<File[]>([]);
  const [localDirPath, setLocalDirPath] = useState("");

  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectError, setInspectError] = useState("");
  const [showSchematicHelp, setShowSchematicHelp] = useState(false);

  // Preview state
  const [chapters, setChapters] = useState<DetectedChapterItem[]>([]);
  const [globalWarnings, setGlobalWarnings] = useState<string[]>([]);
  const [hasSchematic, setHasSchematic] = useState(false);
  const [conflictStrategy, setConflictStrategy] = useState<"SKIP" | "OVERWRITE">("SKIP");
  const [compressionPreset, setCompressionPreset] = useState<"auto" | "lossless" | "compact" | "raw">("auto");

  // Upload and monitor state
  const [isUploading, setIsUploading] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; currentChapterTitle: string }>({
    current: 0,
    total: 0,
    currentChapterTitle: "",
  });
  const [uploadError, setUploadError] = useState("");
  const [finalReport, setFinalReport] = useState<{
    chaptersCreated: number;
    chaptersUpdated: number;
    chaptersSkipped: number;
    totalPagesIngested: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep("inspect");
    setMode("master-zip");
    setMasterFile(null);
    setMultiFiles([]);
    setLocalDirPath("");
    setIsInspecting(false);
    setInspectError("");
    setChapters([]);
    setGlobalWarnings([]);
    setHasSchematic(false);
    setConflictStrategy("SKIP");
    setCompressionPreset("auto");
    setIsUploading(false);
    setActiveBatchId(null);
    setProgress({ current: 0, total: 0, currentChapterTitle: "" });
    setUploadError("");
    setFinalReport(null);
  };

  const handleFilesSelected = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsInspecting(true);
    setInspectError("");
    setGlobalWarnings([]);

    try {
      if (files.length === 1 && files[0].name.toLowerCase().endsWith(".zip")) {
        // Mode A: Master Archive
        const file = files[0];
        setMode("master-zip");
        setMasterFile(file);
        setMultiFiles([]);

        const result = await ClientZipInspector.inspectZipFile(file);
        const manifestResult = BatchManifestParser.buildManifest(result.entries, result.schematicJson);
        if (manifestResult.chapters.length === 0) {
          throw new Error(
            "No valid chapter subfolders or nested .zip/.cbz archives found inside this archive."
          );
        }
        setChapters(manifestResult.chapters);
        setGlobalWarnings(manifestResult.globalWarnings);
        setHasSchematic(manifestResult.hasSchematic);
        setStep("preview");
      } else {
        // Mode B: Multi-File Selection
        const fileList = Array.from(files).filter(
          (f) => f.name.toLowerCase().endsWith(".zip") || f.name.toLowerCase().endsWith(".cbz")
        );

        if (fileList.length === 0) {
          throw new Error("Please select valid .zip or .cbz chapter archives.");
        }

        setMode("multi-file");
        setMasterFile(null);
        setMultiFiles(fileList);

        const entries = fileList.map((f) => ({ path: f.name, size: f.size }));
        const manifestResult = BatchManifestParser.buildManifest(entries);

        if (manifestResult.chapters.length === 0) {
          throw new Error("Could not parse chapter metadata from selected files.");
        }

        setChapters(manifestResult.chapters);
        setGlobalWarnings(manifestResult.globalWarnings);
        setHasSchematic(false);
        setStep("preview");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to inspect archive.";
      setInspectError(msg);
    } finally {
      setIsInspecting(false);
    }
  };

  const updateChapterField = (index: number, field: "chapterNumber" | "volume" | "title", value: any) => {
    setChapters((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };

      // Re-evaluate duplicate warnings
      const seen = new Map<number, number>();
      for (const ch of next) {
        if (ch.chapterNumber > 0) {
          seen.set(ch.chapterNumber, (seen.get(ch.chapterNumber) || 0) + 1);
        }
      }

      for (let i = 0; i < next.length; i++) {
        const num = next[i].chapterNumber;
        const count = seen.get(num) || 0;
        const currentWarnings = next[i].warnings.filter((w) => !w.includes("Duplicate chapter number"));
        if (count > 1) {
          currentWarnings.push(`Duplicate chapter number ${num} in batch.`);
        }
        next[i] = { ...next[i], warnings: currentWarnings };
      }

      return next;
    });
  };

  const removeChapter = (index: number) => {
    setChapters((prev) => prev.filter((_, idx) => idx !== index));
  };

  const hasDuplicateErrors = chapters.some((ch) =>
    ch.warnings.some((w) => w.includes("Duplicate chapter number"))
  );

  const startBatchExecution = async () => {
    if (chapters.length === 0 || hasDuplicateErrors) return;
    setUploadError("");

    if (mode === "master-zip" && masterFile) {
      setStep("uploading");
      setIsUploading(true);
      setProgress({ current: 0, total: chapters.length, currentChapterTitle: "Uploading archive to queue..." });

      const formData = new FormData();
      formData.append("file", masterFile);
      formData.append("slug", mangaTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
      formData.append("compressionPreset", compressionPreset);
      formData.append("conflictPolicy", conflictStrategy === "OVERWRITE" ? "replace_pages" : "skip_existing");
      formData.append("autoPublish", "true");

      try {
        const res = await fetch("/api/v1/admin/batch-import", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.data?.batch?.batchId) {
          throw new Error(data.error?.message || "Failed to enqueue batch import");
        }

        const bId = data.data.batch.batchId;
        setActiveBatchId(bId);
        setStep("monitoring");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to process batch upload";
        setUploadError(msg);
        setStep("preview");
      } finally {
        setIsUploading(false);
      }
    } else if (mode === "multi-file") {
      setStep("uploading");
      setIsUploading(true);

      let created = 0;
      let updated = 0;
      let skipped = 0;
      let totalPages = 0;

      try {
        for (let idx = 0; idx < chapters.length; idx++) {
          const ch = chapters[idx];
          const matchedFile = multiFiles.find((f) => f.name === ch.sourceKey) || multiFiles[idx];

          setProgress({
            current: idx + 1,
            total: chapters.length,
            currentChapterTitle: ch.title ? `Ch. ${ch.chapterNumber} - ${ch.title}` : `Ch. ${ch.chapterNumber}`,
          });

          if (!matchedFile) continue;

          const formData = new FormData();
          formData.append("file", matchedFile);
          formData.append("chapterNumber", ch.chapterNumber.toString());
          if (ch.volume) formData.append("volume", ch.volume.toString());
          if (ch.title) formData.append("title", ch.title);
          formData.append("conflictStrategy", conflictStrategy);

          const res = await fetch(`/api/v1/admin/manga/${mangaId}/chapters/batch-item`, {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (res.ok && data.data) {
            if (data.data.skipped) {
              skipped++;
            } else if (data.data.isNew) {
              created++;
            } else {
              updated++;
            }
            totalPages += data.data.totalPages || 0;
          }
        }

        setFinalReport({
          chaptersCreated: created,
          chaptersUpdated: updated,
          chaptersSkipped: skipped,
          totalPagesIngested: totalPages,
        });
        setStep("complete");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error during multi-file batch execution";
        setUploadError(msg);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
    resetState();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isUploading && onClose()}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FolderArchive className="h-5 w-5 text-sky-400" />
          Batch Ingestion
        </DialogTitle>
        <DialogDescription>
          Multi-chapter upload and background processing for {mangaTitle}
        </DialogDescription>
      </DialogHeader>

      <div className="my-2 space-y-4 text-xs">
        {/* Step 1: File Selection & Inspection */}
        {step === "inspect" && (
          <div className="space-y-3">
            {inspectError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{inspectError}</span>
              </div>
            )}

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files) {
                  handleFilesSelected(e.dataTransfer.files);
                }
              }}
              className="border-2 border-dashed border-white/20 hover:border-sky-400/50 rounded-2xl p-8 text-center space-y-3 cursor-pointer liquid-glass transition-colors"
            >
              <FileArchive className="h-10 w-10 mx-auto text-sky-400 opacity-70" />
              <div>
                <p className="font-semibold text-sm text-foreground">
                  Select Master Archive or Chapter Files
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  Drop a single Master .zip containing chapter folders, OR drop multiple .zip / .cbz files
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".zip,.cbz"
                onChange={(e) => {
                  if (e.target.files) {
                    handleFilesSelected(e.target.files);
                  }
                }}
                className="hidden"
              />

              <Button size="sm" variant="secondary" disabled={isInspecting} className="text-xs">
                {isInspecting ? "Inspecting Headers..." : "Browse Archives"}
              </Button>
            </div>

            {/* Optional schematic.json helper collapsible */}
            <div className="rounded-xl border border-white/10 liquid-glass p-3">
              <button
                type="button"
                onClick={() => setShowSchematicHelp(!showSchematicHelp)}
                className="w-full flex items-center justify-between text-left text-slate-300 font-medium hover:text-white"
              >
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-sky-400" />
                  Optional: Include schematic.json in Master .zip
                </span>
                {showSchematicHelp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showSchematicHelp && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-2 text-slate-400 font-mono text-[11px]">
                  <p className="text-slate-300">
                    If you include a <code className="text-sky-300">schematic.json</code> at the root of your Master .zip, the system maps chapters exactly without guessing:
                  </p>
                  <pre className="bg-slate-900 p-2.5 rounded border border-slate-800 overflow-x-auto text-sky-200">
{`{
  "chapters": [
    { "source": "ch_01", "chapterNumber": 1, "title": "The Awakening", "volume": 1 },
    { "source": "ch_02", "chapterNumber": 2, "title": "Second Step", "volume": 1 }
  ]
}`}
                  </pre>
                  <p className="text-slate-400 font-sans">
                    Without it, the auto-parser extracts volume, chapter (including decimals like 4.5), and title from folder names.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Confirmation & Editable Preview Table */}
        {step === "preview" && (
          <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl liquid-glass border border-white/10">
              <div className="flex items-center gap-2">
                <Badge variant={hasSchematic ? "success" : "outline"} className="text-[10px]">
                  {hasSchematic ? "schematic.json matched" : "Auto-parsed from folders"}
                </Badge>
                <span className="text-slate-300 font-medium">
                  {chapters.length} chapters detected
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Conflict:</span>
                  <select
                    value={conflictStrategy}
                    onChange={(e) => setConflictStrategy(e.target.value as "SKIP" | "OVERWRITE")}
                    className="h-7 px-2 rounded-lg liquid-glass-input text-xs text-foreground focus:outline-none"
                  >
                    <option value="SKIP">Skip existing</option>
                    <option value="OVERWRITE">Overwrite pages</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Preset:</span>
                  <select
                    value={compressionPreset}
                    onChange={(e) => setCompressionPreset(e.target.value as any)}
                    className="h-7 px-2 rounded-lg liquid-glass-input text-xs text-foreground focus:outline-none uppercase"
                  >
                    <option value="auto">Auto (Lossless PNG / Quality WebP)</option>
                    <option value="lossless">Strict Lossless</option>
                    <option value="compact">Compact (75%)</option>
                    <option value="raw">Raw</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Global Warnings */}
            {globalWarnings.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Validation Notices</span>
                </div>
                {globalWarnings.map((w, idx) => (
                  <p key={idx} className="text-[11px] text-amber-200/90 pl-5">
                    • {w}
                  </p>
                ))}
              </div>
            )}

            {/* Mobile View: Compact Stacked Cards (Zero Horizontal Overflow) */}
            <div className="block md:hidden max-h-[45vh] overflow-y-auto space-y-2.5 pr-0.5">
              {chapters.map((ch, idx) => {
                const isDup = ch.warnings.some((w) => w.includes("Duplicate"));

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border bg-slate-950/60 space-y-2 ${
                      isDup ? "border-rose-500/40 bg-rose-500/5" : "border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-slate-300 truncate" title={ch.sourceKey}>
                        {ch.sourceKey}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {ch.fileCount} files
                        </span>
                        <button
                          type="button"
                          onClick={() => removeChapter(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                          aria-label="Remove chapter"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Chapter #</label>
                        <Input
                          type="number"
                          step="0.1"
                          value={ch.chapterNumber}
                          onChange={(e) => updateChapterField(idx, "chapterNumber", parseFloat(e.target.value) || 0)}
                          className="h-7 text-xs font-mono text-sky-300 bg-slate-900 border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Volume</label>
                        <Input
                          type="number"
                          value={ch.volume ?? ""}
                          onChange={(e) => updateChapterField(idx, "volume", e.target.value ? parseInt(e.target.value, 10) : undefined)}
                          placeholder="-"
                          className="h-7 text-xs font-mono bg-slate-900 border-slate-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Title (Optional)</label>
                      <Input
                        type="text"
                        value={ch.title || ""}
                        onChange={(e) => updateChapterField(idx, "title", e.target.value)}
                        placeholder="Chapter title"
                        className="h-7 text-xs bg-slate-900 border-slate-700"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: High-Density Table */}
            <div className="hidden md:block rounded-xl border border-white/10 overflow-hidden max-h-[45vh] overflow-y-auto liquid-glass">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/60 backdrop-blur-xl text-slate-300 sticky top-0 border-b border-white/10 z-10 font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3 w-20">Ch #</th>
                    <th className="py-2.5 px-3 w-16">Vol</th>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3 w-16 text-center">Files</th>
                    <th className="py-2.5 px-3 text-right w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-transparent font-sans">
                  {chapters.map((ch, idx) => {
                    const isDup = ch.warnings.some((w) => w.includes("Duplicate"));

                    return (
                      <tr key={idx} className={`hover:bg-white/[0.04] transition-colors ${isDup ? "bg-rose-500/10" : ""}`}>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-300 truncate max-w-[140px]" title={ch.sourceKey}>
                          {ch.sourceKey}
                        </td>
                        <td className="py-1.5 px-3">
                          <Input
                            type="number"
                            step="0.1"
                            value={ch.chapterNumber}
                            onChange={(e) => updateChapterField(idx, "chapterNumber", parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs font-mono text-sky-300 bg-slate-950/80 border-slate-700 w-16"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <Input
                            type="number"
                            value={ch.volume ?? ""}
                            onChange={(e) => updateChapterField(idx, "volume", e.target.value ? parseInt(e.target.value, 10) : undefined)}
                            placeholder="-"
                            className="h-7 text-xs font-mono bg-slate-950/80 border-slate-700 w-14"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <Input
                            type="text"
                            value={ch.title || ""}
                            onChange={(e) => updateChapterField(idx, "title", e.target.value)}
                            placeholder="Optional title"
                            className="h-7 text-xs bg-slate-950/80 border-slate-700"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full liquid-glass-pill text-slate-300">
                            {ch.fileCount}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeChapter(idx)}
                            className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                            aria-label="Remove chapter"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 3: Direct Uploading Spinner */}
        {step === "uploading" && (
          <div className="py-8 space-y-4 text-center">
            <div className="inline-flex p-3 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 animate-pulse">
              <Upload className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-foreground">
                Processing Ingestion
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {progress.currentChapterTitle || "Streaming and queuing batch..."}
              </p>
            </div>

            {progress.total > 0 && (
              <div className="w-full max-w-xs mx-auto space-y-1.5">
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-all duration-300 rounded-full"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Chapter {progress.current} of {progress.total}
                </div>
              </div>
            )}

            {uploadError && (
              <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {uploadError}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Live Background Queue Monitor */}
        {step === "monitoring" && activeBatchId && (
          <BatchImportMonitor
            batchId={activeBatchId}
            onBatchCompleted={() => {
              onSuccess();
            }}
          />
        )}

        {/* Step 5: Multi-File Completion Report */}
        {step === "complete" && finalReport && (
          <div className="py-6 space-y-4 text-center">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-base text-foreground">
                Batch Ingestion Complete
              </h3>
              <p className="text-xs text-slate-400">
                All confirmed chapters have been processed and indexed into the database.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-md mx-auto pt-2 text-xs">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400">Created</span>
                <p className="text-base font-bold font-mono text-emerald-400">{finalReport.chaptersCreated}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400">Updated</span>
                <p className="text-base font-bold font-mono text-sky-400">{finalReport.chaptersUpdated}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400">Skipped</span>
                <p className="text-base font-bold font-mono text-slate-400">{finalReport.chaptersSkipped}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400">Pages Ingested</span>
                <p className="text-base font-bold font-mono text-amber-300">{finalReport.totalPagesIngested}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-800 pt-3">
        {step === "preview" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("inspect");
                setMasterFile(null);
                setMultiFiles([]);
              }}
              className="text-xs"
            >
              Back to file selection
            </Button>
            <Button
              size="sm"
              onClick={startBatchExecution}
              disabled={hasDuplicateErrors || chapters.length === 0}
              className="text-xs gap-1.5"
            >
              Start Ingestion ({chapters.length} chapters)
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        {step === "inspect" && (
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs ml-auto">
            Cancel
          </Button>
        )}

        {(step === "complete" || step === "monitoring") && (
          <Button size="sm" onClick={handleFinish} className="text-xs ml-auto">
            Done
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
