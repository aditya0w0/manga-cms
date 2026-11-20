"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Network,
  ArrowLeft,
  Terminal,
  Settings,
  Plus,
  CheckCircle2,
  Lock,
  Globe,
  Sliders,
  Layers,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export default function ProviderDetailsPage() {
  const params = useParams();
  const [provider, setProvider] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/providers/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.provider) setProvider(d.provider);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [params.id]);

  if (isLoading) {
    return <div className="py-20 text-center text-xs text-muted-foreground">Loading provider details...</div>;
  }

  if (!provider) {
    return <div className="py-20 text-center text-xs text-muted-foreground">Provider not found</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/providers">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              {provider.name}
              <span className="text-xs font-mono text-muted-foreground">({provider.slug})</span>
            </h1>
            <p className="text-xs text-muted-foreground">{provider.baseUrl}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/admin/providers/${provider.id}/test`}>
            <Button size="sm" className="gap-1.5 text-xs font-bold">
              <Terminal className="h-4 w-4" /> Open Test Console & Mapper
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-2xl liquid-glass p-4 space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Health Status
          </span>
          <p className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> {provider.healthStatus}
          </p>
          <span className="text-[10px] text-muted-foreground font-mono">
            Timeout: {provider.timeoutMs}ms • Rate: {provider.rateLimitRequests}/m
          </span>
        </div>

        <div className="rounded-2xl liquid-glass p-4 space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Authentication
          </span>
          <p className="text-base font-bold text-foreground flex items-center gap-1.5">
            <Lock className="h-4 w-4 text-cyan-400" /> {provider.authType}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {provider.hasCredentials ? "Credentials securely encrypted at rest" : "Public endpoints, no credentials"}
          </span>
        </div>

        <div className="rounded-2xl liquid-glass p-4 space-y-1 sm:col-span-2 md:col-span-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Registered Endpoints
          </span>
          <p className="text-base font-bold text-foreground flex items-center gap-1.5">
            <Globe className="h-4 w-4 text-cyan-400" /> {provider.endpoints?.length || 0} active
          </p>
          <span className="text-[10px] text-muted-foreground">Configured REST routes</span>
        </div>
      </div>

      {/* Endpoints Table */}
      <div className="rounded-2xl liquid-glass overflow-hidden shadow-sm">
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Globe className="h-4 w-4 text-cyan-400" />
            Configured REST Endpoints
          </h3>
          <Link href={`/admin/providers/${provider.id}/test`}>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-white/10 hover:border-cyan-500/30 hover:bg-cyan-500/10">
              <Plus className="h-3 w-3" /> Configure in Console
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[500px]">
            <thead className="bg-white/[0.03] text-muted-foreground border-b border-white/[0.08] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Endpoint Role</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">URL Template</th>
                <th className="py-3 px-4">Pagination</th>
                <th className="py-3 px-4">Cache TTL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] font-mono">
              {provider.endpoints && provider.endpoints.length > 0 ? (
                provider.endpoints.map((ep: any) => (
                  <tr key={ep.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-4 font-bold text-foreground font-sans">{ep.name}</td>
                    <td className="py-3 px-4">
                      <span className="text-emerald-400 font-bold">{ep.method}</span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{ep.urlTemplate}</td>
                    <td className="py-3 px-4 font-sans text-muted-foreground">{ep.paginationType}</td>
                    <td className="py-3 px-4 text-muted-foreground">{ep.cacheTtlSec}s</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground font-sans">
                    No endpoints configured yet. Open the Test Console to test and register endpoints.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Field Mappings Section */}
      <div className="rounded-2xl liquid-glass p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-white/[0.08] pb-3">
          <FileCode className="h-4 w-4 text-cyan-400" />
          Configured JSON Field Mappings
        </h3>

        {provider.fieldMappings && provider.fieldMappings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {provider.fieldMappings.map((m: any) => (
              <div key={m.id} className="rounded-xl bg-white/[0.03] p-3.5 border border-white/[0.08] space-y-2">
                <span className="text-xs font-bold text-cyan-400 font-mono">{m.entityType} Mapping</span>
                <pre className="text-[11px] text-muted-foreground overflow-x-auto p-2.5 rounded-lg bg-black/50 border border-white/[0.04] font-mono">
                  {JSON.stringify(m.mappings, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No field mappings configured yet. Use the Visual Field Mapper in the Test Console.
          </p>
        )}
      </div>
    </div>
  );
}
