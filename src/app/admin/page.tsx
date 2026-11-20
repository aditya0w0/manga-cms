import React from "react";
import Link from "next/link";
import { getDashboardStats } from "@/modules/cms/dashboard-service";
import {
  BookOpen,
  Layers,
  HardDrive,
  Activity,
  Plus,
  Upload,
  Eye,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { getSafeImageUrl } from "@/lib/image-utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();
  const storageMb = ((stats.kpis.storageSizeBytes || 0) / (1024 * 1024)).toFixed(1);

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Overview
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/chapters">
            <Button size="sm" variant="secondary" className="gap-1.5 text-xs font-medium">
              <Upload className="h-3.5 w-3.5" />
              Upload Chapter
            </Button>
          </Link>
          <Link href="/admin/manga/new">
            <Button size="sm" className="gap-1.5 text-xs font-medium">
              <Plus className="h-3.5 w-3.5" />
              New Series
            </Button>
          </Link>
        </div>
      </div>

      {/* Status Strip */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 grid grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
        <div className="space-y-0.5">
          <div className="text-xs text-slate-400">Series</div>
          <div className="text-xl font-semibold text-slate-100">{stats.kpis.totalManga}</div>
          <div className="text-xs text-slate-400">
            <span className="text-emerald-400 font-medium">{stats.kpis.publishedManga} published</span>
            <span className="mx-1">•</span>
            <span>{stats.kpis.draftManga} draft</span>
          </div>
        </div>

        <div className="pt-3 sm:pt-0 sm:pl-4 space-y-0.5">
          <div className="text-xs text-slate-400">Chapters</div>
          <div className="text-xl font-semibold text-slate-100">{stats.kpis.totalChapters}</div>
          <div className="text-xs text-slate-400">
            <span>{stats.kpis.totalPages} pages</span>
          </div>
        </div>

        <div className="pt-3 sm:pt-0 sm:pl-4 space-y-0.5">
          <div className="text-xs text-slate-400">Storage</div>
          <div className="text-xl font-semibold text-slate-100">{storageMb} MB</div>
          <div className="text-xs text-slate-400">
            <span>{stats.kpis.totalMediaAssets} files</span>
          </div>
        </div>

        <div className="pt-3 sm:pt-0 sm:pl-4 space-y-0.5">
          <div className="text-xs text-slate-400">Users</div>
          <div className="text-xl font-semibold text-slate-100">{stats.kpis.totalUsers}</div>
          <div className="text-xs text-slate-400">
            <span>{stats.kpis.activeUsers} active</span>
          </div>
        </div>
      </div>

      {/* Main Content Split: Series + Chapters & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Series */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Recent Series
            </h2>
            <Link href="/admin/manga" className="text-xs text-sky-400 hover:underline">
              View all
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {stats.recentManga && stats.recentManga.length > 0 ? (
              stats.recentManga.map((m: any) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/60 flex gap-3.5 hover:border-slate-700 transition-colors"
                >
                  <div className="w-16 h-22 rounded-md overflow-hidden shrink-0 border border-slate-700 bg-slate-800">
                    {m.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getSafeImageUrl(m.coverUrl)}
                        alt={`${m.title} cover`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-800" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-medium text-slate-300">
                          {m.contentType}
                        </span>
                        <span className="text-slate-600">•</span>
                        <Badge
                          variant={m.publicationStatus === "PUBLISHED" ? "success" : "warning"}
                          className="text-[10px]"
                        >
                          {m.publicationStatus}
                        </Badge>
                      </div>

                      <h3 className="font-bold text-sm text-foreground truncate" title={m.title}>
                        {m.title}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                      <span className="text-slate-300 font-medium">
                        {m._count?.chapters || 0} chapters
                      </span>
                      <Link
                        href={`/admin/chapters?mangaId=${m.id}`}
                        className="text-sky-400 hover:text-sky-300 font-medium"
                      >
                        Manage chapters
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 py-10 text-center text-xs text-slate-400 rounded-lg border border-dashed border-slate-800">
                No manga titles in internal catalog yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Recent Chapter Ingestions & Audit Trail */}
        <div className="lg:col-span-4 space-y-6">
          {/* Recent Chapters */}
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <h2 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-slate-400" />
                Recent Chapters
              </h2>
              <Link href="/admin/chapters" className="text-xs text-sky-400 hover:underline">
                View all
              </Link>
            </div>

            <div className="space-y-2.5">
              {stats.recentChapters && stats.recentChapters.length > 0 ? (
                stats.recentChapters.map((ch: any) => (
                  <div
                    key={ch.id}
                    className="p-3 rounded-md border border-slate-800 bg-slate-950/40 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2 space-y-0.5">
                      <p className="font-bold text-xs text-foreground truncate">
                        {ch.manga?.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-mono font-medium text-emerald-400">
                          Ch. {ch.chapterNumber}
                        </span>
                        <span>•</span>
                        <span>{ch._count?.pages || 0} pages</span>
                      </div>
                    </div>
                    <Link href={`/read/${ch.id}`} target="_blank">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2 gap-1 text-slate-300 hover:text-white shrink-0"
                        aria-label={`Preview chapter ${ch.chapterNumber}`}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No chapters uploaded yet.
                </p>
              )}
            </div>
          </div>

          {/* Audit Activity */}
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/40 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <h2 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                Recent Activity
              </h2>
              <Link href="/admin/audit-logs" className="text-xs text-sky-400 hover:underline">
                Logs
              </Link>
            </div>

            <div className="space-y-2">
              {stats.recentActivity && stats.recentActivity.length > 0 ? (
                stats.recentActivity.slice(0, 4).map((log: any) => (
                  <div key={log.id} className="text-xs space-y-0.5 pb-2 border-b border-slate-800/60 last:border-0">
                    <p className="font-medium text-foreground">
                      <span className="text-sky-300 font-mono font-bold mr-1">{log.action}</span>
                      {log.entityType}
                    </p>
                    <p className="text-xs text-slate-400">
                      by {log.user?.username || "System"} • {formatDate(log.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No audit logs recorded yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
