"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, DownloadCloud, CheckCircle2, AlertTriangle, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export default function ImportJobDetailPage() {
  const params = useParams();
  const [job, setJob] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/imports/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.job) setJob(d.job);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [params.id]);

  if (isLoading) {
    return <div className="py-20 text-center text-xs text-muted-foreground">Loading job details...</div>;
  }

  if (!job) {
    return <div className="py-20 text-center text-xs text-muted-foreground">Job not found</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      <div className="flex items-center gap-3">
        <Link href="/admin/imports">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Import Job Execution Report</h1>
          <p className="text-xs text-muted-foreground font-mono">Job ID: {job.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="liquid-glass rounded-2xl p-4">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">Provider</span>
          <p className="text-base font-bold text-foreground mt-0.5">{job.provider?.name}</p>
        </div>

        <div className="liquid-glass rounded-2xl p-4">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">Status</span>
          <p className="text-base font-bold text-emerald-400 mt-0.5">{job.status}</p>
        </div>

        <div className="liquid-glass rounded-2xl p-4">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">Processed Records</span>
          <p className="text-base font-bold text-cyan-400 mt-0.5">{job.processedItems} / {job.totalItems}</p>
        </div>

        <div className="liquid-glass rounded-2xl p-4">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">Failed</span>
          <p className="text-base font-bold text-rose-400 mt-0.5">{job.failedItems}</p>
        </div>
      </div>

      {job.log && (
        <div className="liquid-glass rounded-2xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Execution Log</h4>
          <pre className="p-3 rounded-xl bg-black/60 border border-white/[0.06] text-[11px] font-mono text-muted-foreground max-h-48 overflow-y-auto">
            {job.log}
          </pre>
        </div>
      )}

      {/* Records Table */}
      <div className="liquid-glass rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-white/[0.08]">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Imported Records ({job.records?.length || 0})</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono min-w-[500px]">
            <thead className="bg-white/[0.03] text-muted-foreground border-b border-white/[0.08] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-2.5 px-4">External ID</th>
                <th className="py-2.5 px-4">Internal Entity</th>
                <th className="py-2.5 px-4">Result</th>
                <th className="py-2.5 px-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {job.records?.map((rec: any) => (
                <tr key={rec.id} className="hover:bg-white/[0.03] font-sans transition-colors">
                  <td className="py-2.5 px-4 font-mono font-bold text-cyan-400">{rec.externalId}</td>
                  <td className="py-2.5 px-4">
                    {rec.manga ? (
                      <Link href={`/manga/${rec.manga.slug}`} className="hover:text-cyan-400 font-bold text-foreground transition-colors">
                        {rec.manga.title}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <Badge variant={rec.status === "SUCCESS" ? "success" : "destructive"}>
                      {rec.status}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-4 text-muted-foreground font-mono">{formatDate(rec.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
