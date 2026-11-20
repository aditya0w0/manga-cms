import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import sharp from "sharp";
import { getPrisma } from "@/lib/database/prisma";
import { BatchQueueService } from "@/modules/upload-pipeline/batch-queue-service";
import { SchematicLoader } from "@/modules/upload-pipeline/schematic-loader";
import { StreamingArchiveReader } from "@/modules/upload-pipeline/source-reader";

describe("Phase 4: Standalone Background Worker & Batch Queue Pipeline", () => {
  const tempDir = path.join(os.tmpdir(), `worker_pipeline_test_${Date.now()}`);

  beforeEach(async () => {
    const db = await getPrisma();
    await db.importChapterJob.deleteMany();
    await db.importComicJob.deleteMany();
    await db.importBatch.deleteMany();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("orchestrates batch creation, atomic claiming, page ingestion, and auto-publishing", async () => {
    const db = await getPrisma();
    const comicSlug = `worker-comic-${Date.now()}`;

    // 1. Create a test archive with 2 chapters
    const zip = new AdmZip();

    const img1 = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 10, g: 20, b: 30 } },
    }).png().toBuffer();

    const img2 = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 40, g: 50, b: 60 } },
    }).png().toBuffer();

    zip.addFile("Ch 01 - Intro/01.png", img1);
    zip.addFile("Ch 01 - Intro/02.png", img2);
    zip.addFile("Ch 02 - Climax/01.png", img1);

    const zipPath = path.join(tempDir, "worker_test_archive.zip");
    zip.writeZip(zipPath);

    // 2. Load schematic and queue batch
    const reader = new StreamingArchiveReader(zipPath);
    const graph = await SchematicLoader.loadBatchGraph(reader, {
      fallbackSlug: comicSlug,
      fallbackBatchId: `batch_worker_${Date.now()}`,
    });
    await reader.close();

    const queued = await BatchQueueService.createBatchJobs(graph, zipPath);
    expect(queued.totalChapters).toBe(2);

    // 3. Atomically claim and execute Chapter 1
    const workerId = "test_worker_1";
    const job1 = await BatchQueueService.claimNextChapterJob(workerId);
    expect(job1).not.toBeNull();
    expect(job1.status).toBe("PROCESSING");
    expect(job1.workerId).toBe(workerId);

    await BatchQueueService.executeChapterJob(job1.id, workerId);

    const updatedJob1 = await db.importChapterJob.findUnique({ where: { id: job1.id } });
    expect(updatedJob1?.status).toBe("COMPLETED");
    expect(updatedJob1?.pagesIngested).toBe(2);

    // Verify Chapter & ChapterPage records in database
    const createdChapter1 = await db.chapter.findFirst({
      where: { mangaId: job1.mangaId, chapterNumber: 1 },
      include: { pages: true },
    });
    expect(createdChapter1).not.toBeNull();
    expect(createdChapter1?.pages).toHaveLength(2);

    // 4. Atomically claim and execute Chapter 2
    const job2 = await BatchQueueService.claimNextChapterJob(workerId, queued.batchId);
    expect(job2).not.toBeNull();
    await BatchQueueService.executeChapterJob(job2.id, workerId);

    const updatedJob2 = await db.importChapterJob.findUnique({ where: { id: job2.id } });
    expect(updatedJob2?.status).toBe("COMPLETED");
    expect(updatedJob2?.pagesIngested).toBe(1);

    // 5. Verify comic auto-published to PUBLISHED
    const manga = await db.manga.findUnique({ where: { slug: comicSlug } });
    expect(manga?.publicationStatus).toBe("PUBLISHED");

    // 6. Verify batch status
    const batchStatus = await BatchQueueService.getBatchStatus(queued.batchId);
    expect(batchStatus?.status).toBe("COMPLETED");
    expect(batchStatus?.counters.completedChapters).toBe(2);
    expect(batchStatus?.counters.processedPages).toBe(3);
    expect(batchStatus?.counters.failedChapters).toBe(0);
  });

  it("handles fault isolation and retry of failed chapter jobs", async () => {
    const db = await getPrisma();
    const batchId = `batch_fault_${Date.now()}`;
    const comicSlug = `fault-comic-${Date.now()}`;

    // Create a mock batch with 1 valid job and 1 broken job
    const manga = await db.manga.create({
      data: {
        title: "Fault Comic",
        slug: comicSlug,
        publicationStatus: "INGESTING",
        status: "ONGOING",
        contentType: "MANGA",
      },
    });

    const batch = await db.importBatch.create({
      data: {
        batchId,
        status: "QUEUED",
        sourceMode: "archive",
        sourceRef: "/tmp/non_existent_archive.zip",
        totalComics: 1,
        totalChapters: 1,
      },
    });

    const comicJob = await db.importComicJob.create({
      data: {
        batchId: batch.id,
        mangaId: manga.id,
        slug: comicSlug,
        status: "PENDING",
        totalChapters: 1,
      },
    });

    const brokenJob = await db.importChapterJob.create({
      data: {
        batchId: batch.id,
        comicJobId: comicJob.id,
        mangaId: manga.id,
        chapterKey: "1",
        displayNumber: "1",
        sortKey: "000001.0000",
        sourcePath: "missing_chapter.zip",
        sourceType: "zip",
        idempotencyKey: `${batchId}:${comicSlug}:1:v1`,
        status: "PENDING",
      },
    });

    // Worker claims and executes broken job
    const workerId = "test_worker_fault";
    const claimed = await BatchQueueService.claimNextChapterJob(workerId);
    expect(claimed?.id).toBe(brokenJob.id);

    await BatchQueueService.executeChapterJob(claimed.id, workerId);

    const failedJob = await db.importChapterJob.findUnique({ where: { id: brokenJob.id } });
    expect(failedJob?.status).toBe("FAILED");
    expect(failedJob?.errorMessage).toBeDefined();

    // Batch should transition to PARTIAL_FAILED
    const batchAfterFail = await db.importBatch.findUnique({ where: { id: batch.id } });
    expect(batchAfterFail?.status).toBe("PARTIAL_FAILED");
    expect(batchAfterFail?.failedChapters).toBe(1);

    // Test retry
    const retryResult = await BatchQueueService.retryFailedJobs(batchId);
    expect(retryResult.retriedCount).toBe(1);

    const retriedJob = await db.importChapterJob.findUnique({ where: { id: brokenJob.id } });
    expect(retriedJob?.status).toBe("PENDING");
    expect(retriedJob?.attempts).toBe(0);

    // Test cancel
    await BatchQueueService.cancelBatch(batchId);
    const cancelledJob = await db.importChapterJob.findUnique({ where: { id: brokenJob.id } });
    expect(cancelledJob?.status).toBe("CANCELLED");
  });

  it("reclaims stale jobs that exceeded timeout", async () => {
    const db = await getPrisma();
    const batchId = `batch_stale_${Date.now()}`;
    const comicSlug = `stale-comic-${Date.now()}`;

    const manga = await db.manga.create({
      data: {
        title: "Stale Comic",
        slug: comicSlug,
        publicationStatus: "INGESTING",
        status: "ONGOING",
        contentType: "MANGA",
      },
    });

    const batch = await db.importBatch.create({
      data: {
        batchId,
        status: "PROCESSING",
        sourceMode: "archive",
        sourceRef: "/tmp/fake.zip",
        totalComics: 1,
        totalChapters: 1,
      },
    });

    const comicJob = await db.importComicJob.create({
      data: {
        batchId: batch.id,
        mangaId: manga.id,
        slug: comicSlug,
        status: "PENDING",
      },
    });

    // Insert a job locked 20 minutes ago
    const staleTime = new Date(Date.now() - 20 * 60 * 1000);
    const staleJob = await db.importChapterJob.create({
      data: {
        batchId: batch.id,
        comicJobId: comicJob.id,
        mangaId: manga.id,
        chapterKey: "99",
        displayNumber: "99",
        sortKey: "000099.0000",
        sourcePath: "ch_99",
        sourceType: "directory",
        idempotencyKey: `${batchId}:${comicSlug}:99:v1`,
        status: "PROCESSING",
        lockedAt: staleTime,
        workerId: "crashed_worker",
        attempts: 1,
      },
    });

    const reclaimedCount = await BatchQueueService.reclaimStaleJobs(10);
    expect(reclaimedCount).toBeGreaterThanOrEqual(1);

    const refreshed = await db.importChapterJob.findUnique({ where: { id: staleJob.id } });
    expect(refreshed?.status).toBe("PENDING");
    expect(refreshed?.lockedAt).toBeNull();
    expect(refreshed?.workerId).toBeNull();
  });
});
