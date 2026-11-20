"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Network,
  Plus,
  Terminal,
  Settings,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProviders = () => {
    setIsLoading(true);
    fetch("/api/admin/providers")
      .then((r) => r.json())
      .then((d) => {
        setProviders(d.providers || []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/admin/providers/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchProviders();
      }
    } catch {
      // silent or handled in state
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <Network className="h-6 w-6 text-sky-400" />
            Universal Public API Connectors
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Connect arbitrary external REST APIs, inspect JSON payloads, configure visual mappings, and run scheduled imports
          </p>
        </div>

        <Link href="/admin/providers/new">
          <Button size="sm" className="gap-1.5 text-xs font-bold w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Add API Provider
          </Button>
        </Link>
      </div>

      {/* Providers Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-muted-foreground liquid-glass">Loading connectors...</div>
      ) : providers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {providers.map((p) => (
            <div
              key={p.id}
              className="liquid-glass p-5 space-y-4 hover:border-white/25 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-base text-foreground flex items-center gap-2 truncate">
                      {p.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                      {p.description || "No description."}
                    </p>
                  </div>
                  <Badge
                    variant={p.healthStatus === "HEALTHY" ? "success" : "warning"}
                    className="text-[10px] shrink-0"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" /> {p.healthStatus}
                  </Badge>
                </div>

                <div className="rounded-xl bg-white/[0.04] p-3 border border-white/10 space-y-1.5 font-mono text-xs backdrop-blur-md">
                  <div className="flex items-center justify-between text-muted-foreground text-[11px] gap-2">
                    <span className="shrink-0">Base URL</span>
                    <span className="text-sky-300 truncate font-semibold text-right">{p.baseUrl}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span>Auth Mode</span>
                    <span className="text-foreground font-semibold">{p.authType}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                  <span>
                    Endpoints: <strong className="text-foreground">{p._count?.endpoints || 0}</strong>
                  </span>
                  <span>
                    Imported Manga: <strong className="text-foreground">{p._count?.mangas || 0}</strong>
                  </span>
                  <span>
                    Rate Limit: <strong className="text-foreground">{p.rateLimitRequests} req/m</strong>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/10">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/admin/providers/${p.id}/test`}>
                    <Button size="sm" className="h-8 text-xs gap-1.5">
                      <Terminal className="h-3.5 w-3.5" />
                      Test & Mapper
                    </Button>
                  </Link>
                  <Link href={`/admin/providers/${p.id}`}>
                    <Button variant="secondary" size="sm" className="h-8 text-xs gap-1">
                      <Settings className="h-3.5 w-3.5" /> Configure
                    </Button>
                  </Link>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(p.id, p.name)}
                  className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 ml-auto"
                  title="Delete provider"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 sm:p-16 text-center space-y-3 liquid-glass border-dashed">
          <Network className="h-12 w-12 text-sky-400 opacity-60 mx-auto" />
          <h3 className="text-base font-bold text-foreground">No API Providers Configured</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            Connect any external manga REST API by registering its URL. You will be able to inspect responses and map fields visually.
          </p>
          <Link href="/admin/providers/new">
            <Button size="sm" className="gap-1.5 font-bold mt-2">
              <Plus className="h-4 w-4" /> Add Your First Provider
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
