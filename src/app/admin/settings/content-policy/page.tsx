"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Ban,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Lock,
  Layers,
  Search,
  Settings,
  Cpu,
  Eye,
  Check,
  Image as ImageIcon,
  Activity,
  Sliders,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

interface BannedCategory {
  id: string;
  name: string;
  description: string;
  defaultAliases: string[];
  isCore: boolean;
}

interface PolicyConfig {
  unknownGenrePolicy: "QUARANTINE" | "REJECT" | "ALLOW";
  customAliases: string[];
  providerMappings: Record<string, Record<string, string>>;
}

interface WdTaggerConfig {
  enabled: boolean;
  endpoint: string;
  batchSize: number;
  hitlLowerThreshold: number;
  autoRejectThreshold: number;
  explicitRatingThreshold: number;
  questionableRatingThreshold: number;
  maxQueueWaitMs: number;
}

interface TaggerHealth {
  available: boolean;
  latencyMs: number;
  device?: string;
  model?: string;
  error?: string;
}

interface HitlItem {
  id: string;
  slug: string;
  title: string;
  coverUrl?: string;
  bannerUrl?: string;
  author?: string;
  artist?: string;
  status: string;
  contentType: string;
  publicationStatus: string;
  genres: string[];
  tags: string[];
  provider: string;
  createdAt: string;
  updatedAt: string;
  hitlReason: string;
  isVisualFlag: boolean;
  visualClassification?: {
    imageUrl: string;
    rating: {
      general: number;
      sensitive: number;
      questionable: number;
      explicit: number;
    };
    topTags: Array<{ tag: string; confidence: number; category?: string }>;
    matchedViolations: Array<{ tag: string; confidence: number; category?: string }>;
    hitlRequired: boolean;
    recommendation: "ALLOW" | "QUARANTINE_HITL" | "REJECT_AUTO";
    reason?: string;
    inferenceDurationMs: number;
  } | null;
}

export default function ContentPolicyAdminPage() {
  const [loading, setLoading] = useState(true);
  const [coreCategories, setCoreCategories] = useState<BannedCategory[]>([]);
  const [config, setConfig] = useState<PolicyConfig>({
    unknownGenrePolicy: "QUARANTINE",
    customAliases: [],
    providerMappings: {},
  });
  const [stats, setStats] = useState({
    totalManga: 0,
    quarantinedCount: 0,
    rejectedCount: 0,
  });

  const [newAlias, setNewAlias] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanAction, setScanAction] = useState<"ARCHIVE" | "QUARANTINE" | "DRY_RUN">("ARCHIVE");
  const [scanResult, setScanResult] = useState<any>(null);

  // Quarantine & Rejections state
  const [quarantined, setQuarantined] = useState<any[]>([]);
  const [rejections, setRejections] = useState<any[]>([]);

  // HITL & WD Tagger state
  const [hitlItems, setHitlItems] = useState<HitlItem[]>([]);
  const [taggerConfig, setTaggerConfig] = useState<WdTaggerConfig>({
    enabled: true,
    endpoint: "http://127.0.0.1:5005",
    batchSize: 32,
    hitlLowerThreshold: 0.35,
    autoRejectThreshold: 0.85,
    explicitRatingThreshold: 0.5,
    questionableRatingThreshold: 0.65,
    maxQueueWaitMs: 40,
  });
  const [taggerHealth, setTaggerHealth] = useState<TaggerHealth>({
    available: false,
    latencyMs: 0,
    device: "NVIDIA RTX 4070 (CUDA Pass-through)",
  });
  const [savingTaggerConfig, setSavingTaggerConfig] = useState(false);
  const [taggerSuccess, setTaggerSuccess] = useState(false);
  const [testImageUrl, setTestImageUrl] = useState("");
  const [testingTagger, setTestingTagger] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [hitlDecisionLoading, setHitlDecisionLoading] = useState<Record<string, boolean>>({});

  const [activeTab, setActiveTab] = useState<
    "categories" | "config" | "scan" | "quarantine" | "hitl" | "tagger" | "rejections"
  >("categories");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (
        tabParam &&
        ["categories", "config", "scan", "quarantine", "hitl", "tagger", "rejections"].includes(tabParam)
      ) {
        setActiveTab(tabParam as any);
      }
    }
    fetchPolicyData();
  }, []);

  const fetchPolicyData = async () => {
    setLoading(true);
    try {
      const [baseRes, qRes, rRes, hitlRes, taggerRes] = await Promise.all([
        fetch("/api/admin/content-policy").then((r) => r.json()),
        fetch("/api/admin/content-policy/quarantine").then((r) => r.json()),
        fetch("/api/admin/content-policy/rejections").then((r) => r.json()),
        fetch("/api/admin/content-policy/hitl").then((r) => r.json()),
        fetch("/api/admin/content-policy/tagger").then((r) => r.json()),
      ]);

      if (baseRes.coreCategories) setCoreCategories(baseRes.coreCategories);
      if (baseRes.config) setConfig(baseRes.config);
      if (baseRes.stats) setStats(baseRes.stats);

      if (qRes.quarantined) setQuarantined(qRes.quarantined);
      if (rRes.rejections) setRejections(rRes.rejections);

      if (hitlRes.items) setHitlItems(hitlRes.items);
      if (taggerRes.config) setTaggerConfig(taggerRes.config);
      if (taggerRes.health) setTaggerHealth(taggerRes.health);
    } catch (err) {
      console.error("Failed to load policy data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAlias = () => {
    if (!newAlias.trim()) return;
    const clean = newAlias.trim().toLowerCase();
    if (!config.customAliases.includes(clean)) {
      setConfig({
        ...config,
        customAliases: [...config.customAliases, clean],
      });
    }
    setNewAlias("");
  };

  const handleRemoveAlias = (aliasToRemove: string) => {
    setConfig({
      ...config,
      customAliases: config.customAliases.filter((a) => a !== aliasToRemove),
    });
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setConfigSuccess(false);
    try {
      const res = await fetch("/api/admin/content-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setConfigSuccess(true);
        setTimeout(() => setConfigSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save config:", err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/admin/content-policy/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: scanAction }),
      });
      const data = await res.json();
      if (data.result) {
        setScanResult(data.result);
        fetchPolicyData();
      }
    } catch (err) {
      console.error("Failed to run scan:", err);
    } finally {
      setScanning(false);
    }
  };

  const handleReviewQuarantine = async (mangaId: string, action: "APPROVE" | "ARCHIVE" | "DELETE") => {
    try {
      const res = await fetch(`/api/admin/content-policy/quarantine/${mangaId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setQuarantined((prev) => prev.filter((m) => m.id !== mangaId));
        setHitlItems((prev) => prev.filter((m) => m.id !== mangaId));
        setStats((prev) => ({ ...prev, quarantinedCount: Math.max(0, prev.quarantinedCount - 1) }));
      }
    } catch (err) {
      console.error("Failed review:", err);
    }
  };

  const handleHitlDecision = async (
    mangaId: string,
    action: "APPROVE_CLEAR_FLAG" | "CONFIRM_VIOLATION" | "DELETE",
    note?: string
  ) => {
    setHitlDecisionLoading((prev) => ({ ...prev, [mangaId]: true }));
    try {
      const res = await fetch(`/api/admin/content-policy/hitl/${mangaId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      if (res.ok) {
        setHitlItems((prev) => prev.filter((m) => m.id !== mangaId));
        setQuarantined((prev) => prev.filter((m) => m.id !== mangaId));
        setStats((prev) => ({ ...prev, quarantinedCount: Math.max(0, prev.quarantinedCount - 1) }));
      }
    } catch (err) {
      console.error("Failed HITL decision:", err);
    } finally {
      setHitlDecisionLoading((prev) => ({ ...prev, [mangaId]: false }));
    }
  };

  const handleSaveTaggerConfig = async () => {
    setSavingTaggerConfig(true);
    setTaggerSuccess(false);
    try {
      const res = await fetch("/api/admin/content-policy/tagger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taggerConfig),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) setTaggerConfig(data.config);
        setTaggerSuccess(true);
        setTimeout(() => setTaggerSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save tagger config:", err);
    } finally {
      setSavingTaggerConfig(false);
    }
  };

  const handleTestTagger = async () => {
    if (!testImageUrl.trim()) return;
    setTestingTagger(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/content-policy/tagger/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: testImageUrl.trim() }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      console.error("Failed to test tagger:", err);
    } finally {
      setTestingTagger(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-sky-400" />
            Content Policy
          </h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchPolicyData}
          disabled={loading}
          className="gap-1.5 border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium self-start sm:self-auto"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Policy Status Strip */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 grid grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
        <div className="space-y-0.5">
          <div className="text-xs text-slate-400">Policy status</div>
          <div className="text-sm font-semibold text-emerald-400">Active</div>
        </div>

        <div className="pt-3 sm:pt-0 sm:pl-4 space-y-0.5">
          <div className="text-xs text-slate-400">Classifier</div>
          <div className="text-sm font-semibold text-slate-200">
            {taggerHealth.available ? "Local sidecar" : "Simulation"}
          </div>
        </div>

        <div className="pt-3 sm:pt-0 sm:pl-4 space-y-0.5">
          <div className="text-xs text-slate-400">Review queue</div>
          <div className="text-sm font-semibold text-slate-200">
            {hitlItems.length}
          </div>
        </div>

        <div className="pt-3 sm:pt-0 sm:pl-4 space-y-0.5">
          <div className="text-xs text-slate-400">Blocked</div>
          <div className="text-sm font-semibold text-slate-200">
            {stats.rejectedCount}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 space-x-1 sm:space-x-2 text-xs font-medium overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("categories")}
          className={`pb-2.5 px-3 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === "categories"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Categories (11)
        </button>

        <button
          onClick={() => setActiveTab("hitl")}
          className={`pb-2.5 px-3 border-b-2 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === "hitl"
              ? "border-amber-400 text-amber-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Review Queue</span>
          {hitlItems.length > 0 && (
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-medium">
              {hitlItems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("tagger")}
          className={`pb-2.5 px-3 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === "tagger"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Classifier
        </button>

        <button
          onClick={() => setActiveTab("config")}
          className={`pb-2.5 px-3 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === "config"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Configuration
        </button>

        <button
          onClick={() => setActiveTab("scan")}
          className={`pb-2.5 px-3 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === "scan"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Database Scan
        </button>

        <button
          onClick={() => setActiveTab("quarantine")}
          className={`pb-2.5 px-3 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === "quarantine"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Quarantine ({quarantined.length})
        </button>

        <button
          onClick={() => setActiveTab("rejections")}
          className={`pb-2.5 px-3 border-b-2 text-xs font-medium whitespace-nowrap transition-colors ${
            activeTab === "rejections"
              ? "border-sky-400 text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Rejections ({rejections.length})
        </button>
      </div>

      {/* TAB: HITL VISUAL REVIEW (WD TAGGER) */}
      {activeTab === "hitl" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Review Queue</h2>
              <p className="text-xs text-slate-400">Titles flagged for manual review before publishing.</p>
            </div>
          </div>

          {hitlItems.length === 0 ? (
            <div className="p-12 rounded-lg border border-slate-800 bg-slate-900/40 text-center space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">No items in review queue</h3>
              <p className="text-xs text-slate-400">All titles meet current policy rules.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {hitlItems.map((item) => {
                const isItemLoading = !!hitlDecisionLoading[item.id];
                const visual = item.visualClassification;

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row gap-4"
                  >
                    {/* Artwork Preview */}
                    <div className="w-full md:w-36 flex-shrink-0 flex flex-col items-center">
                      <div className="w-full aspect-[3/4] rounded-md bg-slate-950 border border-slate-800 overflow-hidden relative group">
                        {item.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.coverUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                            <ImageIcon className="h-6 w-6 mb-1 opacity-40" />
                            <span className="text-[10px]">No cover</span>
                          </div>
                        )}
                        {item.coverUrl && (
                          <a
                            href={item.coverUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute bottom-2 right-2 p-1.5 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="View image"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1.5 font-mono">
                        {item.provider}
                      </span>
                    </div>

                    {/* Metadata & Tag Breakdown */}
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-foreground leading-snug">{item.title}</h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[10px]">
                              {item.contentType}
                            </Badge>
                            {item.genres.map((g) => (
                              <Badge key={g} variant="outline" className="text-[10px]">
                                {g}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs self-start"
                        >
                          Pending Review
                        </Badge>
                      </div>

                      {/* Quarantine Reason */}
                      <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                        <span className="font-medium text-amber-200">Reason:</span> {item.hitlReason}
                      </div>

                      {/* Visual Classifier Breakdown if available */}
                      {visual && (
                        <div className="space-y-2 pt-1">
                          <span className="text-xs font-medium text-slate-400 block">
                            Classifier ratings
                          </span>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="p-2 rounded-md bg-slate-950 border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">General</span>
                              <span className="font-semibold text-emerald-400">
                                {((visual.rating?.general || 0) * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="p-2 rounded-md bg-slate-950 border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">Sensitive</span>
                              <span className="font-semibold text-sky-400">
                                {((visual.rating?.sensitive || 0) * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="p-2 rounded-md bg-slate-950 border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">Questionable</span>
                              <span className="font-semibold text-amber-400">
                                {((visual.rating?.questionable || 0) * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="p-2 rounded-md bg-slate-950 border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">Explicit</span>
                              <span className="font-semibold text-rose-400">
                                {((visual.rating?.explicit || 0) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {/* Detected Tags */}
                          {visual.topTags && visual.topTags.length > 0 && (
                            <div className="pt-1">
                              <span className="text-xs font-medium text-slate-400 block mb-1">
                                Detected tags
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {visual.topTags.map((t, idx) => {
                                  const isViolationTag = !!t.category;
                                  return (
                                    <span
                                      key={idx}
                                      className={`px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 ${
                                        isViolationTag
                                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold"
                                          : "bg-slate-950 border border-slate-800 text-slate-300"
                                      }`}
                                    >
                                      {t.tag}
                                      <span className="opacity-60 text-[9px]">
                                        ({(t.confidence * 100).toFixed(0)}%)
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Human Action Bar */}
                      <div className="pt-2.5 border-t border-slate-800 flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={isItemLoading}
                          onClick={() => handleHitlDecision(item.id, "APPROVE_CLEAR_FLAG")}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1 text-xs font-medium"
                        >
                          <Check className="h-3 w-3" />
                          Approve
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isItemLoading}
                          onClick={() => handleHitlDecision(item.id, "CONFIRM_VIOLATION")}
                          className="gap-1 text-xs font-medium"
                        >
                          <Ban className="h-3 w-3" />
                          Reject
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isItemLoading}
                          onClick={() => handleHitlDecision(item.id, "DELETE")}
                          className="text-xs text-slate-400 hover:text-rose-400 border-slate-700"
                          aria-label="Delete item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: CLASSIFIER SETTINGS */}
      {activeTab === "tagger" && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Classifier Settings
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Local image tagging service and threshold configuration.
                </p>
              </div>

              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                taggerHealth.available
                  ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                  : "text-slate-400 bg-slate-800 border border-slate-700"
              }`}>
                {taggerHealth.available ? "Connected" : "Local mode"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Endpoint URL</label>
                <Input
                  value={taggerConfig.endpoint}
                  onChange={(e) => setTaggerConfig({ ...taggerConfig, endpoint: e.target.value })}
                  placeholder="http://127.0.0.1:5005"
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Batch size</label>
                <Input
                  type="number"
                  value={taggerConfig.batchSize}
                  onChange={(e) => setTaggerConfig({ ...taggerConfig, batchSize: Number(e.target.value) })}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Review threshold</label>
                <Input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="0.9"
                  value={taggerConfig.hitlLowerThreshold}
                  onChange={(e) => setTaggerConfig({ ...taggerConfig, hitlLowerThreshold: Number(e.target.value) })}
                  className="font-mono text-xs"
                />
                <span className="text-[11px] text-slate-400">
                  Minimum confidence to flag for review (e.g. 0.35)
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Auto-reject threshold</label>
                <Input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="1.0"
                  value={taggerConfig.autoRejectThreshold}
                  onChange={(e) => setTaggerConfig({ ...taggerConfig, autoRejectThreshold: Number(e.target.value) })}
                  className="font-mono text-xs"
                />
                <span className="text-[11px] text-slate-400">
                  Confidence to reject automatically (e.g. 0.85)
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Queue wait window (ms)</label>
                <Input
                  type="number"
                  value={taggerConfig.maxQueueWaitMs}
                  onChange={(e) => setTaggerConfig({ ...taggerConfig, maxQueueWaitMs: Number(e.target.value) })}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Adult score threshold</label>
                <Input
                  type="number"
                  step="0.05"
                  value={taggerConfig.questionableRatingThreshold}
                  onChange={(e) => setTaggerConfig({ ...taggerConfig, questionableRatingThreshold: Number(e.target.value) })}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="tagger-enabled"
                  checked={taggerConfig.enabled}
                  onChange={(e) => setTaggerConfig({ ...taggerConfig, enabled: e.target.checked })}
                  className="rounded border-slate-700"
                />
                <label htmlFor="tagger-enabled" className="text-xs font-medium text-slate-300 cursor-pointer">
                  Enable visual classifier
                </label>
              </div>

              <div className="flex items-center gap-2">
                {taggerSuccess && (
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Saved
                  </span>
                )}
                <Button
                  size="sm"
                  onClick={handleSaveTaggerConfig}
                  disabled={savingTaggerConfig}
                  className="text-xs font-medium"
                >
                  Save Settings
                </Button>
              </div>
            </div>
          </div>

          {/* Test Image Classifier */}
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 space-y-3">
            <h4 className="text-xs font-semibold text-foreground">
              Test Classifier
            </h4>
            <div className="flex gap-2">
              <Input
                value={testImageUrl}
                onChange={(e) => setTestImageUrl(e.target.value)}
                placeholder="Image URL to test..."
                className="text-xs font-mono"
              />
              <Button
                size="sm"
                onClick={handleTestTagger}
                disabled={testingTagger || !testImageUrl.trim()}
                className="text-xs font-medium whitespace-nowrap"
              >
                {testingTagger ? "Testing..." : "Test"}
              </Button>
            </div>

            {testResult && testResult.result && (
              <div className="p-3 rounded-md bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">Result</span>
                  <Badge
                    variant="outline"
                    className={
                      testResult.result.recommendation === "ALLOW"
                        ? "text-emerald-400 bg-emerald-500/10"
                        : testResult.result.recommendation === "QUARANTINE_HITL"
                        ? "text-amber-400 bg-amber-500/10"
                        : "text-rose-400 bg-rose-500/10"
                    }
                  >
                    {testResult.result.recommendation}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">General</span>
                    <span className="font-semibold text-emerald-400">
                      {((testResult.result.rating?.general || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Sensitive</span>
                    <span className="font-semibold text-sky-400">
                      {((testResult.result.rating?.sensitive || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Questionable</span>
                    <span className="font-semibold text-amber-400">
                      {((testResult.result.rating?.questionable || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Explicit</span>
                    <span className="font-semibold text-rose-400">
                      {((testResult.result.rating?.explicit || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {testResult.result.topTags && testResult.result.topTags.length > 0 && (
                  <div>
                    <span className="text-[10px] font-medium text-slate-400 block mb-1">
                      Detected tags
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {testResult.result.topTags.map((t: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-800 font-mono text-slate-300"
                        >
                          {t.tag} ({(t.confidence * 100).toFixed(0)}%)
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
                  <span>Latency: {testResult.totalLatencyMs}ms</span>
                  {testResult.result.reason && (
                    <span className="text-amber-400">{testResult.result.reason}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: CORE CATEGORIES */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Filter Categories</h2>
              <p className="text-xs text-slate-400">Default prohibited content categories.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {coreCategories.map((cat) => (
              <div
                key={cat.id}
                className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/60 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">{cat.name}</span>
                </div>

                <p className="text-xs text-slate-400">{cat.description}</p>

                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-medium text-slate-500 block mb-1">
                    Triggers
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {cat.defaultAliases.map((alias) => (
                      <span
                        key={alias}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-slate-950 text-slate-300 border border-slate-800 font-mono"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CONFIG & ALIASES */}
      {activeTab === "config" && (
        <div className="space-y-4">
          {/* Unknown Genre Policy Card */}
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Unclassified Titles</h3>
            <p className="text-xs text-slate-400">
              Action to take when a title has no genre or tag metadata.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <label
                className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between transition-colors ${
                  config.unknownGenrePolicy === "QUARANTINE"
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-slate-800 bg-slate-950/60 hover:bg-slate-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Quarantine</span>
                  <input
                    type="radio"
                    name="unknownGenrePolicy"
                    checked={config.unknownGenrePolicy === "QUARANTINE"}
                    onChange={() => setConfig({ ...config, unknownGenrePolicy: "QUARANTINE" })}
                    className="accent-sky-500"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-2 block">
                  Hold for manual review before publishing.
                </span>
              </label>

              <label
                className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between transition-colors ${
                  config.unknownGenrePolicy === "REJECT"
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-slate-800 bg-slate-950/60 hover:bg-slate-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Reject</span>
                  <input
                    type="radio"
                    name="unknownGenrePolicy"
                    checked={config.unknownGenrePolicy === "REJECT"}
                    onChange={() => setConfig({ ...config, unknownGenrePolicy: "REJECT" })}
                    className="accent-sky-500"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-2 block">
                  Block title immediately.
                </span>
              </label>

              <label
                className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between transition-colors ${
                  config.unknownGenrePolicy === "ALLOW"
                    ? "border-sky-500 bg-sky-500/10"
                    : "border-slate-800 bg-slate-950/60 hover:bg-slate-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Allow</span>
                  <input
                    type="radio"
                    name="unknownGenrePolicy"
                    checked={config.unknownGenrePolicy === "ALLOW"}
                    onChange={() => setConfig({ ...config, unknownGenrePolicy: "ALLOW" })}
                    className="accent-sky-500"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-2 block">
                  Allow publishing if no other policy triggered.
                </span>
              </label>
            </div>
          </div>

          {/* Custom Aliases */}
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Custom Prohibited Keywords</h3>
            <p className="text-xs text-slate-400">
              Keywords or terms that trigger policy rejection.
            </p>

            <div className="flex gap-2">
              <Input
                placeholder="Add keyword..."
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAlias();
                  }
                }}
                className="max-w-md text-xs"
              />
              <Button size="sm" onClick={handleAddAlias} className="gap-1 text-xs font-medium">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>

            <div className="pt-2">
              <span className="text-xs font-medium text-slate-400 block mb-1.5">
                Active Keywords ({config.customAliases.length})
              </span>
              {config.customAliases.length === 0 ? (
                <span className="text-xs text-slate-500">No custom keywords added.</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {config.customAliases.map((alias) => (
                    <span
                      key={alias}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-rose-500/10 text-rose-300 border border-rose-500/20 font-mono"
                    >
                      {alias}
                      <button
                        type="button"
                        onClick={() => handleRemoveAlias(alias)}
                        className="hover:text-rose-100 transition-colors ml-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSaveConfig} disabled={savingConfig} className="gap-2 text-xs font-medium">
              {savingConfig ? "Saving..." : "Save Policy"}
            </Button>
            {configSuccess && (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DATABASE AUDIT & SCAN */}
      {activeTab === "scan" && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Database Scan
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan catalog records against current filter rules and keywords.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <select
                  value={scanAction}
                  onChange={(e: any) => setScanAction(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-md text-xs py-1.5 px-3 text-foreground font-medium"
                >
                  <option value="ARCHIVE">Archive violations</option>
                  <option value="QUARANTINE">Quarantine for review</option>
                  <option value="DRY_RUN">Dry run (audit only)</option>
                </select>

                <Button
                  onClick={handleRunScan}
                  disabled={scanning}
                  className="gap-1.5 text-xs font-medium"
                >
                  <Play className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
                  {scanning ? "Scanning..." : "Run Scan"}
                </Button>
              </div>
            </div>
          </div>

          {/* Scan Results */}
          {scanResult && (
            <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="text-xs font-semibold text-foreground">Scan Summary</h4>
                <Badge
                  variant="outline"
                  className={scanResult.violationCount === 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}
                >
                  {scanResult.violationCount === 0 ? "Clean" : `${scanResult.violationCount} violations`}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2.5 rounded-md bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Scanned</span>
                  <span className="text-base font-bold text-foreground">{scanResult.scannedCount}</span>
                </div>
                <div className="p-2.5 rounded-md bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Violations</span>
                  <span className="text-base font-bold text-rose-400">{scanResult.violationCount}</span>
                </div>
                <div className="p-2.5 rounded-md bg-slate-950 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block">Action</span>
                  <span className="text-base font-bold text-slate-200">{scanResult.actionApplied}</span>
                </div>
              </div>

              {scanResult.details && scanResult.details.length > 0 && (
                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2 px-3">Title</th>
                        <th className="py-2 px-3">Violations</th>
                        <th className="py-2 px-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {scanResult.details.map((d: any) => (
                        <tr key={d.mangaId} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-medium text-foreground">{d.title}</td>
                          <td className="py-2.5 px-3">
                            {d.violations.map((v: any, i: number) => (
                              <span key={i} className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 mr-1 mb-1">
                                {v.category} ({v.matchedTerm})
                              </span>
                            ))}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-400">
                              {d.actionTaken}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: QUARANTINED TITLES */}
      {activeTab === "quarantine" && (
        <div className="space-y-4">
          {quarantined.length === 0 ? (
            <div className="p-8 rounded-lg border border-slate-800 bg-slate-900/40 text-center space-y-1">
              <h4 className="text-sm font-semibold text-foreground">No quarantined titles</h4>
              <p className="text-xs text-slate-400">All content is reviewed.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60">
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Genres</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {quarantined.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-foreground">{m.title}</td>
                      <td className="py-3 px-4 text-slate-400">{m.provider?.name || "Manual"}</td>
                      <td className="py-3 px-4">
                        {m.genres && m.genres.length > 0 ? (
                          m.genres.map((g: any) => (
                            <span key={g.genre.slug} className="mr-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-950 border border-slate-800 text-slate-300">
                              {g.genre.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 italic">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReviewQuarantine(m.id, "APPROVE")}
                          className="h-7 text-xs text-emerald-400 hover:text-emerald-300 border-slate-700"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReviewQuarantine(m.id, "ARCHIVE")}
                          className="h-7 text-xs text-rose-400 hover:text-rose-300 border-slate-700"
                        >
                          Archive
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: REJECTIONS LOG */}
      {activeTab === "rejections" && (
        <div className="space-y-4">
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/40 flex items-center justify-between text-xs">
            <span className="text-slate-400">Blocked titles:</span>
            <span className="text-slate-200 font-semibold font-mono">
              {rejections.length} logged
            </span>
          </div>

          {rejections.length === 0 ? (
            <div className="p-8 rounded-lg border border-slate-800 bg-slate-900/40 text-center space-y-1">
              <h4 className="text-sm font-semibold text-foreground">No rejections</h4>
              <p className="text-xs text-slate-400">No prohibited titles attempted ingestion.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60">
                    <th className="py-3 px-4">External ID</th>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rejections.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono text-slate-400">{r.externalId}</td>
                      <td className="py-3 px-4 text-foreground">{r.job?.provider?.name || "Direct API"}</td>
                      <td className="py-3 px-4 text-rose-400">
                        {r.errorMessage?.replace("POLICY_VIOLATION: ", "")}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400 font-mono">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
