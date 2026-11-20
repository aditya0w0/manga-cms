"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DownloadCloud, Play, CheckCircle2, AlertTriangle, Clock, ArrowRight, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export default function AdminImportsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/imports")
      .then((r) => r.json())
      .then((d) => {
        if (d.jobs) setJobs(d.jobs);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <DownloadCloud className="h-6 w-6 text-primary" />
            Content Synchronization & Import History
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit logs and records of data imported from connected REST API providers
          </p>
        </div>

        <Link href="/admin/providers">
          <Button size="sm" className="gap-1.5 text-xs">
            <Play className="h-3.5 w-3.5" /> Start New Import
          </Button>
        </Link>
      </div>

      <div className="liquid-glass rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[600px]">
            <thead className="bg-white/[0.03] text-muted-foreground border-b border-white/[0.08] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Job Type</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Progress</th>
                <th className="py-3 px-4">Started</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground font-sans">
                    Loading import history...
                  </td>
                </tr>
              ) : jobs.length > 0 ? (
                jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-white/[0.03] font-sans transition-colors">
                    <td className="py-3 px-4 font-bold text-foreground">{j.jobType}</td>
                    <td className="py-3 px-4 text-cyan-400 font-semibold">{j.provider?.name}</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          j.status === "COMPLETED"
                            ? "success"
                            : j.status === "RUNNING"
                            ? "default"
                            : "destructive"
                        }
                        className="text-[10px]"
                      >
                        {j.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {j.processedItems} / {j.totalItems} items
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono">
                      {formatDate(j.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/admin/imports/${j.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover:bg-white/[0.08]">
                          Inspect <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground font-sans">
                    No import jobs have been executed yet. Configure an API provider and run a test import.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
