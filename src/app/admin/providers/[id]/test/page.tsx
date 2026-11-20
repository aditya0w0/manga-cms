"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Terminal,
  Play,
  Save,
  CheckCircle2,
  AlertCircle,
  Copy,
  Sliders,
  Layers,
  Sparkles,
  DownloadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

const INTERNAL_MANGA_FIELDS = [
  { key: "id", label: "External ID", required: true, hint: "Primary identifier on external API" },
  { key: "title", label: "Title", required: true, hint: "Main series title" },
  { key: "description", label: "Description / Synopsis", required: false, hint: "Story synopsis" },
  { key: "cover_url", label: "Cover Image URL", required: false, hint: "URL to cover artwork" },
  { key: "author", label: "Author", required: false, hint: "Writer name" },
  { key: "artist", label: "Artist", required: false, hint: "Illustrator name" },
  { key: "status", label: "Publication Status", required: false, hint: "Ongoing, Completed, etc." },
  { key: "release_year", label: "Release Year", required: false, hint: "Year published" },
  { key: "genres", label: "Genres / Categories", required: false, hint: "Array of genres or comma string" },
  { key: "content_type", label: "Content Format", required: false, hint: "Manga, Manhwa, Webtoon" },
  { key: "rating", label: "Rating / Score", required: false, hint: "Score (1-10 or 1-100)" },
];

const ENDPOINT_ROLES: {
  id: string;
  label: string;
  fallbackPath: string;
  fallbackParams: Record<string, string>;
  desc: string;
}[] = [
  { id: "popular", label: "Popular / Trending", fallbackPath: "/api/manga/home", fallbackParams: { limit: "50" }, desc: "Powers homepage spotlight and trending highlights" },
  { id: "search", label: "Search & Catalog Listing", fallbackPath: "/api/manga/browse", fallbackParams: { page: "1", sort: "views_7d:desc", limit: "20" }, desc: "Powers catalog browsing, keyword search, and filters" },
  { id: "manga_detail", label: "Manga Detail", fallbackPath: "/api/manga/{id}", fallbackParams: {}, desc: "Fetches full metadata, synopsis, and author for a title" },
  { id: "chapters", label: "Chapters List", fallbackPath: "/api/manga/{id}/chapters", fallbackParams: {}, desc: "Fetches chapter releases, scan groups, and release dates" },
  { id: "chapter_pages", label: "Chapter Pages", fallbackPath: "/api/manga/read", fallbackParams: { chapterId: "{id}" }, desc: "Fetches high-res image URLs for reading inside the viewer" },
];

export default function ProviderTestConsolePage() {
  const params = useParams();
  const [provider, setProvider] = useState<any>(null);
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [endpointRole, setEndpointRole] = useState("popular");
  const [queryParams, setQueryParams] = useState<Record<string, string>>({ limit: "50" });
  const [newParamKey, setNewParamKey] = useState("");
  const [newParamVal, setNewParamVal] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [error, setError] = useState("");

  // Field mapping state: fieldKey -> { path, transform, defaultValue }
  const [mappings, setMappings] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importSummary, setImportSummary] = useState<any>(null);
  const [autoSuggestStatus, setAutoSuggestStatus] = useState<{
    type: "success" | "warning" | "info";
    message: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/admin/providers/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.provider) {
          setProvider(d.provider);

          // Find initial endpoint to display
          const popularEp = d.provider.endpoints?.find((e: any) => e.name === "popular");
          const searchEp = d.provider.endpoints?.find((e: any) => e.name === "search");
          const firstEp = popularEp || searchEp || d.provider.endpoints?.[0];

          if (firstEp) {
            setEndpointRole(firstEp.name);
            setUrl(d.provider.baseUrl + firstEp.urlTemplate);
            if (firstEp.queryParams && typeof firstEp.queryParams === "object") {
              setQueryParams(firstEp.queryParams);
            }
            if (firstEp.method) {
              setMethod(firstEp.method);
            }
          } else {
            if (d.provider.baseUrl.includes("comix-api")) {
              setEndpointRole("popular");
              setUrl(d.provider.baseUrl + "/api/manga/home");
              setQueryParams({ limit: "50" });
            } else {
              setEndpointRole("search");
              setUrl(d.provider.baseUrl + "/manga");
            }
          }

          // Load existing mappings if available
          const existing = d.provider.fieldMappings?.find((m: any) => m.entityType === "MANGA");
          if (existing?.mappings) {
            setMappings(existing.mappings);
          }
        }
      })
      .catch(() => {});
  }, [params.id]);

  const handleRoleChange = (newRole: string) => {
    setEndpointRole(newRole);
    if (!provider) return;

    // Check if provider has existing saved endpoint for this role in DB
    const existing = provider.endpoints?.find((e: any) => e.name === newRole);
    if (existing) {
      setUrl(provider.baseUrl + existing.urlTemplate);
      if (existing.queryParams && typeof existing.queryParams === "object") {
        setQueryParams(existing.queryParams);
      } else {
        setQueryParams({});
      }
      if (existing.method) {
        setMethod(existing.method);
      }
      return;
    }

    // Fallback to smart preset
    const preset = ENDPOINT_ROLES.find((r) => r.id === newRole);
    if (preset) {
      setUrl(provider.baseUrl + preset.fallbackPath);
      setQueryParams(preset.fallbackParams);
      setMethod("GET");
    }
  };

  const handleAddParam = () => {
    if (newParamKey.trim()) {
      setQueryParams((prev) => ({ ...prev, [newParamKey.trim()]: newParamVal.trim() }));
      setNewParamKey("");
      setNewParamVal("");
    }
  };

  const handleRemoveParam = (k: string) => {
    setQueryParams((prev) => {
      const copy = { ...prev };
      delete copy[k];
      return copy;
    });
  };

  const executeTestRequest = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setError("");
    setTestResult(null);

    try {
      const res = await fetch("/api/admin/providers/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          method,
          queryParams,
          timeoutMs: provider?.timeoutMs || 10000,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        setError(
          text.includes("<!DOCTYPE") || text.includes("<html")
            ? `Target server or proxy returned an HTML page (HTTP ${res.status} ${res.statusText}) instead of a JSON REST API response. Make sure the URL points to a JSON endpoint (e.g. https://comix-api.vercel.app/api/manga/home) rather than a website HTML page.`
            : `Non-JSON response received (HTTP ${res.status}): ${text.substring(0, 100)}`
        );
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        setIsLoading(false);
        return;
      }

      setTestResult(data);
      setIsLoading(false);

      // Check if mappings are currently empty or only have blank paths
      const hasConfiguredPaths = Object.values(mappings).some(
        (m: any) => m && typeof m.path === "string" && m.path.trim() !== ""
      );

      if (data.mappingAnalysis?.suggestions && data.mappingAnalysis.suggestions.length > 0) {
        if (!hasConfiguredPaths) {
          const initialMap: Record<string, any> = { ...mappings };
          const mappedFields: string[] = [];
          for (const sug of data.mappingAnalysis.suggestions) {
            initialMap[sug.field] = {
              path: sug.suggestedPath,
              transform: "none",
              defaultValue: "",
            };
            mappedFields.push(sug.field);
          }
          setMappings(initialMap);
          setAutoSuggestStatus({
            type: "success",
            message: `Auto-detected and filled ${mappedFields.length} field paths (${mappedFields.join(", ")})!`,
          });
        }
      }
    } catch (err: any) {
      setError(err.message || "Network error executing test request");
      setIsLoading(false);
    }
  };

  const handleAutoSuggest = () => {
    if (!testResult) {
      setAutoSuggestStatus({
        type: "warning",
        message: "Please click 'Test URL' first so MangaCMS can analyze the JSON response.",
      });
      return;
    }

    const suggestions = testResult?.mappingAnalysis?.suggestions || [];
    if (suggestions.length === 0) {
      setAutoSuggestStatus({
        type: "warning",
        message: "No standard field names detected in this payload. You can enter paths manually into the fields below.",
      });
      return;
    }

    const updated = { ...mappings };
    const mappedFields: string[] = [];

    for (const sug of suggestions) {
      updated[sug.field] = {
        path: sug.suggestedPath,
        transform: updated[sug.field]?.transform || "none",
        defaultValue: updated[sug.field]?.defaultValue || "",
      };
      mappedFields.push(sug.field);
    }

    setMappings(updated);
    setAutoSuggestStatus({
      type: "success",
      message: `Successfully auto-mapped ${mappedFields.length} fields: ${mappedFields.join(", ")}`,
    });
  };

  const handleSaveConfiguration = async () => {
    if (!provider) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // 1. Save Endpoint Config
      const epRes = await fetch(`/api/admin/providers/${provider.id}/endpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: endpointRole,
          method,
          urlTemplate: url.replace(provider.baseUrl, "") || "/manga",
          queryParams,
          paginationType: testResult?.paginationAnalysis?.type || "PAGE",
          paginationConfig: testResult?.paginationAnalysis || undefined,
        }),
      });

      if (epRes.ok) {
        const epData = await epRes.json();
        if (epData.endpoint) {
          setProvider((prev: any) => {
            if (!prev) return prev;
            const currentEps = prev.endpoints || [];
            const idx = currentEps.findIndex((e: any) => e.name === endpointRole);
            const updated = [...currentEps];
            if (idx >= 0) {
              updated[idx] = epData.endpoint;
            } else {
              updated.push(epData.endpoint);
            }
            return { ...prev, endpoints: updated };
          });
        }
      }

      // 2. Save Field Mappings
      await fetch(`/api/admin/providers/${provider.id}/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "MANGA",
          mappings,
        }),
      });

      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      alert("Error saving configuration");
      setIsSaving(false);
    }
  };

  const handleTriggerImport = async () => {
    if (!provider) return;
    setIsImporting(true);
    setImportSummary(null);

    try {
      const res = await fetch(`/api/admin/providers/${provider.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "FULL_SYNC",
          maxItems: 5,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        alert(`Server returned non-JSON response (${res.status}): ${text.substring(0, 100)}`);
        setIsImporting(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to trigger import");
        setIsImporting(false);
        return;
      }

      setImportSummary(data.summary);
      setIsImporting(false);
    } catch {
      alert("Error executing live import");
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/admin/providers/${params.id}`}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              API Test Console & Visual Field Mapper
            </h1>
            <p className="text-xs text-muted-foreground">
              Provider: <span className="text-foreground font-semibold">{provider?.name}</span> ({provider?.baseUrl})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSaveConfiguration}
            disabled={isSaving}
            className="gap-1.5 text-xs font-bold"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : saveSuccess ? "Saved Successfully!" : "Save Mappings & Endpoint"}
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleTriggerImport}
            disabled={isImporting}
            className="gap-1.5 text-xs font-bold"
          >
            <DownloadCloud className="h-4 w-4" />
            {isImporting ? "Importing..." : "Execute Live Import"}
          </Button>
        </div>
      </div>

      {importSummary && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 space-y-1 text-xs">
          <p className="font-bold">Live Import Execution Completed:</p>
          <p>
            Status: <strong>{importSummary.status}</strong> • Processed {importSummary.processedItems} of {importSummary.totalItems} records.
          </p>
          <Link href="/admin/manga" className="underline font-bold mt-1 inline-block">
            View Imported Titles in Catalog →
          </Link>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Execution Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* 1. Request Configuration Panel */}
      <div className="rounded-2xl liquid-glass p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan-400" />
          Request Configuration
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-2">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
            >
              <option value="GET" className="bg-[#0f141c] text-white">GET</option>
              <option value="POST" className="bg-[#0f141c] text-white">POST</option>
            </select>
          </div>

          <div className="md:col-span-8">
            <Input
              type="text"
              placeholder="https://example.com/api/manga"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-10 font-mono text-xs"
            />
          </div>

          <div className="md:col-span-2">
            <Button
              type="button"
              onClick={executeTestRequest}
              disabled={isLoading}
              className="w-full h-10 gap-1.5 font-bold"
            >
              <Play className="h-4 w-4 fill-current" />
              {isLoading ? "Running..." : "Test URL"}
            </Button>
          </div>
        </div>

        {/* Endpoint Role & Query Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/60">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-muted-foreground block">
                Assign Endpoint Role
              </label>
              {provider?.endpoints?.find((e: any) => e.name === endpointRole) && (
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Configured in DB
                </span>
              )}
            </div>
            <select
              value={endpointRole}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-surface-elevated px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {ENDPOINT_ROLES.map((r) => {
                const ep = provider?.endpoints?.find((e: any) => e.name === r.id);
                return (
                  <option key={r.id} value={r.id}>
                    {r.label} {ep ? `[Configured: ${ep.urlTemplate}]` : "(Not Configured)"}
                  </option>
                );
              })}
            </select>
            <div className="mt-1.5 p-2 rounded bg-surface/60 border border-white/5 text-[11px] text-muted-foreground flex items-center justify-between">
              <div>
                <span className="font-semibold text-cyan-400 mr-1.5">Purpose:</span>
                <span>{ENDPOINT_ROLES.find((r) => r.id === endpointRole)?.desc}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Add Query Parameter
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="param key (e.g. limit)"
                value={newParamKey}
                onChange={(e) => setNewParamKey(e.target.value)}
                className="h-9 text-xs"
              />
              <Input
                placeholder="value (e.g. 10)"
                value={newParamVal}
                onChange={(e) => setNewParamVal(e.target.value)}
                className="h-9 text-xs"
              />
              <Button type="button" size="sm" variant="outline" onClick={handleAddParam} className="h-9 shrink-0">
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Query Params Chips */}
        {Object.keys(queryParams).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Object.entries(queryParams).map(([k, v]) => (
              <span
                key={k}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-elevated border border-border text-[11px] font-mono text-muted-foreground"
              >
                <strong className="text-foreground">{k}:</strong> {v}
                <button
                  type="button"
                  onClick={() => handleRemoveParam(k)}
                  className="text-red-400 hover:text-red-500 font-bold ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. Response Inspector & Diagnostics */}
      {testResult && (
        <div className="rounded-2xl liquid-glass p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              HTTP Response Diagnostics
            </h3>
            <div className="flex items-center gap-2 text-xs font-mono">
              <Badge variant={testResult.statusCode === 200 ? "success" : "default"}>
                {testResult.statusCode} {testResult.statusText}
              </Badge>
              <span className="text-muted-foreground">{testResult.durationMs}ms</span>
              {testResult.resolvedIp && (
                <span className="text-muted-foreground">IP: {testResult.resolvedIp}</span>
              )}
            </div>
          </div>

          {/* Pagination detection badge */}
          {testResult.paginationAnalysis && (
            <div className="p-3 rounded-lg bg-surface-elevated border border-border flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-foreground">Detected Pagination Pattern: </span>
                <span className="text-primary font-mono font-bold">{testResult.paginationAnalysis.type}</span>
              </div>
              <span className="text-muted-foreground text-[11px]">
                Page Param: {testResult.paginationAnalysis.pageParam || "page"} • Limit: {testResult.paginationAnalysis.limitParam || "limit"}
              </span>
            </div>
          )}

          {/* Raw JSON viewer */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                Raw JSON Payload ({testResult.mappingAnalysis?.primaryArrayPath || "$"})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard.writeText(JSON.stringify(testResult.data, null, 2))}
                className="h-6 text-[10px] gap-1"
              >
                <Copy className="h-3 w-3" /> Copy JSON
              </Button>
            </div>
            <pre className="max-h-60 overflow-y-auto rounded-lg bg-black/60 p-3 text-[11px] font-mono text-neutral-200 border border-border">
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* 3. Visual JSON Field Mapper */}
      <div className="rounded-2xl liquid-glass p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Sliders className="h-4 w-4 text-cyan-400" />
                Visual JSON Field Mapper
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono border-white/10 text-muted-foreground">
                {Object.values(mappings).filter((m: any) => m && m.path && m.path.trim() !== "").length} / {INTERNAL_MANGA_FIELDS.length} mapped
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Map external JSON keys (e.g. <code className="text-cyan-400">id</code>, <code className="text-cyan-400">title</code>, <code className="text-cyan-400">img</code>) to MangaCMS database fields
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleAutoSuggest}
            className="gap-1.5 text-xs text-cyan-300 border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 shrink-0 font-bold"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            Auto-Fill Suggested Paths
            {testResult?.mappingAnalysis?.suggestions?.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-400/25 text-cyan-200 text-[10px] font-mono">
                {testResult.mappingAnalysis.suggestions.length}
              </span>
            )}
          </Button>
        </div>

        {/* Live Auto-Suggest Feedback Banner */}
        {autoSuggestStatus && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
              autoSuggestStatus.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 shadow-sm"
                : "bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-sm"
            }`}
          >
            <span className="font-medium">{autoSuggestStatus.message}</span>
            <button
              type="button"
              onClick={() => setAutoSuggestStatus(null)}
              className="text-white/60 hover:text-white text-xs ml-2 font-bold px-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Mapper Table */}
        <div className="space-y-3">
          {INTERNAL_MANGA_FIELDS.map((f) => {
            const currentRule = mappings[f.key] || { path: "", transform: "none", defaultValue: "" };
            const suggestedForField = testResult?.mappingAnalysis?.suggestions?.find(
              (s: any) => s.field === f.key
            );

            return (
              <div
                key={f.key}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-2.5 rounded-lg bg-surface-elevated border border-border text-xs"
              >
                <div className="md:col-span-3 space-y-0.5">
                  <span className="font-bold text-foreground flex items-center gap-1">
                    {f.label}
                    {f.required && <span className="text-red-400">*</span>}
                  </span>
                  <span className="text-[10px] text-muted-foreground block line-clamp-1">{f.hint}</span>
                </div>

                <div className="md:col-span-5 space-y-1">
                  <Input
                    placeholder="JSON key / path (e.g. id, title, img)"
                    value={currentRule.path || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMappings((prev) => ({
                        ...prev,
                        [f.key]: { ...currentRule, path: val },
                      }));
                    }}
                    className="h-8 font-mono text-xs"
                  />
                  {suggestedForField && suggestedForField.suggestedPath !== currentRule.path && (
                    <button
                      type="button"
                      onClick={() => {
                        setMappings((prev) => ({
                          ...prev,
                          [f.key]: { ...currentRule, path: suggestedForField.suggestedPath },
                        }));
                      }}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono text-left bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20 rounded px-1.5 py-0.5 transition-colors"
                    >
                      <Sparkles className="h-3 w-3 shrink-0" />
                      Suggested: <span className="font-bold underline">{suggestedForField.suggestedPath}</span>
                      <span className="text-muted-foreground truncate max-w-[140px] inline-block">
                        ({String(suggestedForField.sampleValue)})
                      </span>
                    </button>
                  )}
                </div>

                <div className="md:col-span-2">
                  <select
                    value={currentRule.transform || "none"}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMappings((prev) => ({
                        ...prev,
                        [f.key]: { ...currentRule, transform: val },
                      }));
                    }}
                    className="w-full h-8 rounded border border-border bg-surface px-2 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="none">Transform: None</option>
                    <option value="to_string">To String</option>
                    <option value="to_number">To Number</option>
                    <option value="to_integer">To Integer</option>
                    <option value="to_array">To Array</option>
                    <option value="split_comma">Split Comma</option>
                    <option value="uppercase">Uppercase</option>
                    <option value="lowercase">Lowercase</option>
                    <option value="trim">Trim</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Input
                    placeholder="Default val"
                    value={currentRule.defaultValue || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMappings((prev) => ({
                        ...prev,
                        [f.key]: { ...currentRule, defaultValue: val },
                      }));
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
