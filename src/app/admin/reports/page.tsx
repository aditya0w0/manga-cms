"use client";

import React, { useState, useEffect } from "react";
import { Flag, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export default function AdminReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReports = () => {
    fetch("/api/admin/reports")
      .then((r) => r.json())
      .then((d) => {
        if (d.reports) setReports(d.reports);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const [actionError, setActionError] = useState("");

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      setActionError("");
      const res = await fetch("/api/admin/reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActionError(d.error || "Failed to update report status");
        return;
      }
      fetchReports();
    } catch {
      setActionError("Network error while updating report status");
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Flag className="h-5 w-5 text-sky-400" />
          Reports
        </h1>
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
          {actionError}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        {/* Mobile Compact List */}
        <div className="block md:hidden divide-y divide-slate-800/80">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Loading reports...
            </div>
          ) : reports.length > 0 ? (
            reports.map((r) => (
              <div key={r.id} className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-xs text-foreground">{r.reason}</div>
                    <div className="text-xs text-sky-400 font-medium mt-0.5">
                      {r.manga?.title || (r.chapter ? `Ch. ${r.chapter.chapterNumber}` : "General")}
                    </div>
                  </div>
                  <Badge
                    variant={
                      r.status === "RESOLVED"
                        ? "success"
                        : r.status === "PENDING"
                        ? "default"
                        : "destructive"
                    }
                    className="text-[10px]"
                  >
                    {r.status}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1.5 border-t border-slate-800/60">
                  <span>{r.reporter ? r.reporter.username : "Guest"} • {formatDate(r.createdAt)}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(r.id, "RESOLVED")}
                      className="h-8 text-xs px-2.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      Resolve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleUpdateStatus(r.id, "DISMISSED")}
                      className="h-8 text-xs px-2.5 text-slate-400 hover:text-white"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              No reports pending review.
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[600px]">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-medium">
              <tr>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Reporter</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Loading reports...
                  </td>
                </tr>
              ) : reports.length > 0 ? (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-4 font-bold text-foreground">{r.reason}</td>
                    <td className="py-3 px-4 text-cyan-400 font-medium">
                      {r.manga?.title || (r.chapter ? `Ch. ${r.chapter.chapterNumber}` : "General")}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {r.reporter ? r.reporter.username : "Guest"}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          r.status === "RESOLVED"
                            ? "success"
                            : r.status === "PENDING"
                            ? "default"
                            : "destructive"
                        }
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono">
                      {formatDate(r.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(r.id, "RESOLVED")}
                        className="h-7 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                      >
                        Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUpdateStatus(r.id, "DISMISSED")}
                        className="h-7 text-xs text-muted-foreground hover:bg-white/[0.08]"
                      >
                        Dismiss
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No community reports pending review.
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
