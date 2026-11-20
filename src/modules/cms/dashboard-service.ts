import { getPrisma } from "@/lib/database/prisma";
import { ImportJobStatus, ProviderHealth } from "@prisma/client";

export async function getDashboardStats() {
  const db = await getPrisma();

  const [
    totalManga,
    totalChapters,
    totalPages,
    totalUsers,
    activeUsers,
    totalReadingSessions,
    providers,
    recentImportJobs,
    recentAuditLogs,
    mediaAssetStats,
    recentManga,
    recentChapters,
    publishedCount,
    draftCount,
  ] = await Promise.all([
    db.manga.count(),
    db.chapter.count(),
    db.chapterPage.count(),
    db.user.count(),
    db.user.count({ where: { status: "ACTIVE" } }),
    db.readingHistory.count(),
    db.aPIProvider.findMany({
      select: {
        id: true,
        name: true,
        baseUrl: true,
        healthStatus: true,
        isEnabled: true,
        lastCheckedAt: true,
      },
    }),
    db.aPIImportJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { provider: { select: { name: true } } },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { username: true } } },
    }),
    db.media.aggregate({
      _sum: { fileSize: true },
      _count: true,
    }),
    db.manga.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        slug: true,
        coverUrl: true,
        status: true,
        contentType: true,
        publicationStatus: true,
        updatedAt: true,
        _count: { select: { chapters: true } },
      },
    }),
    db.chapter.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        chapterNumber: true,
        volume: true,
        title: true,
        chapterTitle: true,
        publicationStatus: true,
        createdAt: true,
        manga: { select: { title: true, slug: true, coverUrl: true } },
        _count: { select: { pages: true } },
      },
    }),
    db.manga.count({ where: { publicationStatus: "PUBLISHED" } }),
    db.manga.count({ where: { publicationStatus: "DRAFT" } }),
  ]);

  const healthyProviders = providers.filter((p) => p.healthStatus === ProviderHealth.HEALTHY).length;
  const failingProviders = providers.filter((p) => p.healthStatus === ProviderHealth.FAILING).length;

  const failedImports = await db.aPIImportJob.count({
    where: { status: ImportJobStatus.FAILED },
  });

  return {
    kpis: {
      totalManga,
      totalChapters,
      totalPages,
      totalUsers,
      activeUsers,
      totalReadingSessions,
      storageSizeBytes: mediaAssetStats._sum.fileSize || 0,
      totalMediaAssets: mediaAssetStats._count,
      publishedManga: publishedCount,
      draftManga: draftCount,
    },
    recentManga,
    recentChapters,
    providers: {
      total: providers.length,
      healthy: healthyProviders,
      failing: failingProviders,
      list: providers,
    },
    imports: {
      failedCount: failedImports,
      recent: recentImportJobs,
    },
    recentActivity: recentAuditLogs,
  };
}
