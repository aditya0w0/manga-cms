"use client";

import React, { useState, useEffect } from "react";
import { FileText, Shield } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit-logs")
      .then((r) => r.json())
      .then((d) => {
        if (d.logs) setLogs(d.logs);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-sky-400" />
          Audit Logs
        </h1>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        {/* Mobile Compact List (Zero Horizontal Overflow) */}
        <div className="block md:hidden divide-y divide-slate-800/80">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Loading audit trail...
            </div>
          ) : logs.length > 0 ? (
            logs.map((log) => (
              <div key={log.id} className="p-3.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-xs text-sky-300 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {log.action}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {formatDate(log.createdAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-medium text-foreground">{log.entityType}</span>
                  <span className="text-slate-400">{log.user ? `${log.user.username} (${log.user.role})` : "System"}</span>
                </div>

                {log.details && (
                  <p className="text-[11px] text-slate-400 font-mono truncate bg-slate-950/60 p-1.5 rounded border border-slate-800">
                    {JSON.stringify(log.details)}
                  </p>
                )}
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              No administrative audit logs recorded yet.
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-medium font-sans">
              <tr>
                <th className="py-3.5 px-4 whitespace-nowrap">Action</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Entity</th>
                <th className="py-3.5 px-4 whitespace-nowrap">User</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Details</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground font-sans">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.03] transition-colors font-sans">
                    <td className="py-3 px-4 font-mono font-bold text-sky-300 whitespace-nowrap">{log.action}</td>
                    <td className="py-3 px-4 text-foreground font-semibold whitespace-nowrap">{log.entityType}</td>
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                      {log.user ? `${log.user.username} (${log.user.role})` : "System"}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono text-xs truncate max-w-xs">
                      {log.details ? JSON.stringify(log.details) : "-"}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono text-xs whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground font-sans">
                    No administrative audit logs recorded yet.
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
