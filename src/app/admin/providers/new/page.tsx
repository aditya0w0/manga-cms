"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Network, ShieldCheck, Key, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function NewProviderPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [authType, setAuthType] = useState("NONE");
  const [credentials, setCredentials] = useState("");
  const [timeoutMs, setTimeoutMs] = useState(10000);
  const [rateLimitRequests, setRateLimitRequests] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/admin/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description,
          baseUrl,
          defaultLanguage,
          authType,
          credentials: credentials || undefined,
          timeoutMs,
          rateLimitRequests,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create provider");
        setIsSubmitting(false);
        return;
      }

      router.push(`/admin/providers/${data.provider.id}/test`);
    } catch {
      setError("An unexpected error occurred");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl pb-16">
      <div className="flex items-center gap-3">
        <Link href="/admin/providers">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Register New API Provider</h1>
          <p className="text-xs text-muted-foreground">
            Configure base connection, safety limits, and authentication mode
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl liquid-glass p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-foreground border-b border-white/[0.08] pb-2">
            Provider Identity & URL
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Provider Name *
              </label>
              <Input
                required
                placeholder="e.g. MangaDex Public API"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Slug (Unique Identifier) *
              </label>
              <Input
                required
                placeholder="e.g. mangadex-api"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Base API URL *
            </label>
            <Input
              required
              placeholder="https://api.example.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Protected by SSRF security rules. Requests are strictly proxy-routed through safe DNS validation.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Description
            </label>
            <Input
              placeholder="Brief description of the source API..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Authentication Mode */}
        <div className="rounded-2xl liquid-glass p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-foreground border-b border-white/[0.08] pb-2 flex items-center gap-2">
            <Lock className="h-4 w-4 text-cyan-400" />
            Authentication & Security
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Auth Type
              </label>
              <select
                value={authType}
                onChange={(e) => setAuthType(e.target.value)}
                className="w-full h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
              >
                <option value="NONE" className="bg-[#0f141c] text-white">No Authentication (Public REST)</option>
                <option value="BEARER_TOKEN" className="bg-[#0f141c] text-white">Bearer Token (Header)</option>
                <option value="API_KEY_HEADER" className="bg-[#0f141c] text-white">API Key in Header (X-API-Key)</option>
                <option value="API_KEY_QUERY" className="bg-[#0f141c] text-white">API Key in Query Parameter (?api_key=...)</option>
                <option value="BASIC" className="bg-[#0f141c] text-white">Basic Authentication (user:pass)</option>
                <option value="CUSTOM_HEADERS" className="bg-[#0f141c] text-white">Custom Headers JSON</option>
              </select>
            </div>

            {authType !== "NONE" && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Credentials / Token (Encrypted at Rest)
                </label>
                <Input
                  type="password"
                  placeholder="Enter secret token or key..."
                  value={credentials}
                  onChange={(e) => setCredentials(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Network & Rate Limits */}
        <div className="rounded-2xl liquid-glass p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-foreground border-b border-white/[0.08] pb-2">
            Network Safeguards
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Request Timeout (ms)
              </label>
              <Input
                type="number"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Rate Limit (requests per minute)
              </label>
              <Input
                type="number"
                value={rateLimitRequests}
                onChange={(e) => setRateLimitRequests(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/admin/providers">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting} className="gap-2 font-bold">
            <Save className="h-4 w-4" />
            {isSubmitting ? "Creating..." : "Save & Proceed to Test Console"}
          </Button>
        </div>
      </form>
    </div>
  );
}
