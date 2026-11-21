import path from "path";
import os from "os";
import fs from "fs";
import crypto from "crypto";
import { getPrisma } from "@/lib/database/prisma";
import { ParsedBatchGraph } from "./schematic-loader";
import { CompressionPreset, naturalSort, computeSortKey } from "./schematic-schema";
import { createSourceReader, StreamingArchiveReader, SourceReader, SourceEntry } from "./source-reader";
import { BatchManifestParser } from "./batch-manifest";
import { ImageProcessor, ProcessedImageSlice } from "./image-processor";
import { getStorageAdapter } from "../storage/storage-adapter";
import { BatchStatus, BatchJobStatus, PublicationStatus } from "@prisma/client";

export class BatchQueueService {
  /**
   * Initializes and commits a full batch job graph into PostgreSQL.
   */
  static async createBatchJobs(
    graph: ParsedBatchGraph,
    sourceRef: string,
    createdById?: string
  ): Promise<{ batchId: string; totalComics: number; totalChapters: number }> {
    const db = await getPrisma();
    const batchId = graph.schematic.batchId;

    return await db.$transaction(async (tx) => {
      // 1. Create ImportBatch row
      const batch = await tx.importBatch.create({
        data: {
          batchId,
          status: "QUEUED",
          sourceMode: graph.schematic.sourceMode,
          sourceRef,
          compressionPreset: graph.schematic.compressionPreset,
          conflictPolicy: graph.schematic.defaults.conflictPolicy,
          autoPublish: graph.schematic.autoPublish,
          totalComics: graph.totalComics,
          totalChapters: graph.totalChapters,
          completedChapters: 0,
          failedChapters: 0,
          totalPages: 0,
          processedPages: 0,
          totalInputBytes: BigInt(0),
          totalOutputBytes: BigInt(0),
          createdById,
        },
      });

      // 2. Create Manga (if missing), ImportComicJob, and ImportChapterJob rows
      for (const comic of graph.comics) {
        let manga = await tx.manga.findUnique({
          where: { slug: comic.slug },
        });

        if (!manga) {
          manga = await tx.manga.create({
            data: {
              title: comic.title || comic.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              slug: comic.slug,
              publicationStatus: "INGESTING",
              status: "ONGOING",
              contentType: "MANGA",
            },
          });
        } else {
          // If manga already exists, ensure publicationStatus marks INGESTING during batch
          await tx.manga.update({
            where: { id: manga.id },
            data: { publicationStatus: "INGESTING" },
          });
        }

        const comicJob = await tx.importComicJob.create({
          data: {
            batchId: batch.id,
            mangaId: manga.id,
            slug: comic.slug,
            manifestJson: comic.manifestJson as any,
            status: "PENDING",
            totalChapters: comic.chapters.length,
            completedChapters: 0,
            failedChapters: 0,
          },
        });

        for (const ch of comic.chapters) {
          await tx.importChapterJob.create({
            data: {
              batchId: batch.id,
              comicJobId: comicJob.id,
              mangaId: manga.id,
              chapterKey: ch.chapterKey,
              displayNumber: ch.displayNumber,
              sortKey: ch.sortKey,
              volume: ch.volume,
              title: ch.title,
              sourcePath: ch.sourcePath,
              sourceType: ch.sourceType,
              explicitPagesJson: ch.explicitPages ? (ch.explicitPages as any) : undefined,
              idempotencyKey: ch.idempotencyKey,
              status: "PENDING",
              attempts: 0,
              maxAttempts: 3,
            },
          });
        }
      }

      return {
        batchId: batch.batchId,
        totalComics: graph.totalComics,
        totalChapters: graph.totalChapters,
      };
    });
  }

  /**
   * Reclaims stale jobs stuck in PROCESSING longer than staleMinutes (e.g. after worker crash).
   */
  static async reclaimStaleJobs(staleMinutes = 10): Promise<number> {
    const db = await getPrisma();
    const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);

    const result = await db.importChapterJob.updateMany({
      where: {
        status: "PROCESSING",
        lockedAt: { lt: cutoff },
        attempts: { lt: 3 },
      },
      data: {
        status: "PENDING",
        lockedAt: null,
        workerId: null,
      },
    });

    return result.count;
  }

  /**
   * Claims next available pending chapter job atomically using a transaction.
   */
  static async claimNextChapterJob(workerId: string, batchId?: string): Promise<any | null> {
    const db = await getPrisma();

    return await db.$transaction(async (tx) => {
      const candidate = await tx.importChapterJob.findFirst({
        where: {
          status: "PENDING",
          attempts: { lt: 3 },
          ...(batchId
            ? {
                OR: [{ batchId }, { batch: { batchId } }],
              }
            : {}),
        },
        orderBy: [{ sortKey: "asc" }, { createdAt: "asc" }],
      });

      if (!candidate) return null;

      const claimed = await tx.importChapterJob.update({
        where: { id: candidate.id },
        data: {
          status: "PROCESSING",
          lockedAt: new Date(),
          workerId,
          attempts: { increment: 1 },
        },
        include: {
          batch: true,
          comicJob: true,
          manga: true,
        },
      });

      // Update batch status to PROCESSING if it was QUEUED
      if (claimed.batch.status === "QUEUED" || claimed.batch.status === "UPLOADED") {
        await tx.importBatch.update({
          where: { id: claimed.batch.id },
          data: { status: "PROCESSING" },
        });
      }

      return claimed;
    });
  }

  /**
   * Executes a claimed chapter job to completion:
   * Slices images, uploads to storage, and writes Chapter & ChapterPage records in a single transaction.
   */
  static async executeChapterJob(jobId: string, workerId: string): Promise<void> {
    const db = await getPrisma();
    const storage = getStorageAdapter();

    const job = await db.importChapterJob.findUnique({
      where: { id: jobId },
      include: {
        batch: true,
        comicJob: true,
        manga: true,
      },
    });

    if (!job || job.status !== "PROCESSING" || job.workerId !== workerId) {
      return;
    }

    let tempNestedArchive: string | null = null;
    let reader: SourceReader | null = null;
    let subReader: SourceReader | null = null;

    try {
      if (!job.batch.sourceRef) {
        throw new Error("Missing sourceRef on batch");
      }

      reader = createSourceReader({
        sourceMode: job.batch.sourceMode as any,
        sourceRef: job.batch.sourceRef,
      });

      await reader.open();

      // Resolve candidate image entries for this chapter
      let imageEntries: Array<{ filename: string; getBuffer: () => Promise<Buffer> }> = [];

      if (job.sourceType === "directory") {
        const allEntries = await reader.listEntries();
        const prefix = job.sourcePath.endsWith("/") ? job.sourcePath : `${job.sourcePath}/`;
        const matched = allEntries.filter(
          (e: SourceEntry) => !e.isDirectory && (e.path.startsWith(prefix) || e.path === job.sourcePath) && BatchManifestParser.isImageFile(e.path)
        );

        imageEntries = matched.map((e: SourceEntry) => ({
          filename: path.basename(e.path),
          getBuffer: async () => {
            if (e.readBuffer) return e.readBuffer();
            const s = await e.openStream();
            const chunks: Buffer[] = [];
            for await (const chunk of s as any) chunks.push(Buffer.from(chunk));
            return Buffer.concat(chunks);
          },
        }));
      } else {
        // Nested archive (.zip or .cbz)
        const archiveEntry = await reader.findEntry(job.sourcePath);
        if (!archiveEntry) {
          throw new Error(`Chapter archive not found at path: ${job.sourcePath}`);
        }

        const buf = archiveEntry.readBuffer
          ? await archiveEntry.readBuffer()
          : await (async () => {
              const s = await archiveEntry.openStream();
              const chunks: Buffer[] = [];
              for await (const chunk of s as any) chunks.push(Buffer.from(chunk));
              return Buffer.concat(chunks);
            })();

        const tempDir = os.tmpdir();
        const tempId = crypto.randomBytes(6).toString("hex");
        tempNestedArchive = path.join(tempDir, `chapter_${tempId}.zip`);
        await fs.promises.writeFile(tempNestedArchive, buf);

        subReader = new StreamingArchiveReader(tempNestedArchive);
        await subReader.open();
        const subEntries = await subReader.listEntries();
        const matched = subEntries.filter((e: SourceEntry) => !e.isDirectory && BatchManifestParser.isImageFile(e.path));

        imageEntries = matched.map((e: SourceEntry) => ({
          filename: path.basename(e.path),
          getBuffer: async () => {
            if (e.readBuffer) return e.readBuffer();
            const s = await e.openStream();
            const chunks: Buffer[] = [];
            for await (const chunk of s as any) chunks.push(Buffer.from(chunk));
            return Buffer.concat(chunks);
          },
        }));
      }

      if (imageEntries.length === 0) {
        throw new Error(`No valid image files found in source: ${job.sourcePath}`);
      }

      // Determine page order
      let sortedFilenames: string[];
      if (Array.isArray(job.explicitPagesJson) && job.explicitPagesJson.length > 0) {
        sortedFilenames = job.explicitPagesJson as string[];
      } else {
        sortedFilenames = naturalSort(imageEntries.map((e) => e.filename));
      }

      const entryMap = new Map(imageEntries.map((e) => [e.filename, e]));
      const compressionPreset = (job.batch.compressionPreset || "auto") as CompressionPreset;

      // Process and upload pages with controlled concurrency
      const storedPages: Array<{
        pageNumber: number;
        imageUrl: string;
        storageKey: string;
        width: number;
        height: number;
        fileSize: number;
        sourceSha256: string;
        compressionPreset: string;
      }> = [];

      let globalPageNum = 1;
      let totalOutputBytes = 0;
      let totalSlicesCreated = 0;

      for (const fname of sortedFilenames) {
        const item = entryMap.get(fname);
        if (!item) continue;

        const rawBuffer = await item.getBuffer();
        const procResult = await ImageProcessor.processImage(rawBuffer, compressionPreset, storage);

        if (procResult.isDeduped && procResult.cachedUrl) {
          storedPages.push({
            pageNumber: globalPageNum++,
            imageUrl: procResult.cachedUrl,
            storageKey: procResult.cachedUrl.replace(/^\/api\/v1\/media\//, ""),
            width: procResult.originalWidth,
            height: procResult.originalHeight,
            fileSize: 0,
            sourceSha256: procResult.sourceSha256,
            compressionPreset,
          });
        } else {
          const storedSlices = await ImageProcessor.storeSlices({
            slices: procResult.slices,
            storage,
            mangaSlug: job.comicJob.slug,
            chapterKey: job.chapterKey,
            pageNumber: globalPageNum,
            preset: compressionPreset,
          });

          totalSlicesCreated += storedSlices.length;

          for (const s of storedSlices) {
            totalOutputBytes += s.byteSize;
            storedPages.push({
              pageNumber: globalPageNum++,
              imageUrl: s.publicUrl,
              storageKey: s.key,
              width: s.width,
              height: s.height,
              fileSize: s.byteSize,
              sourceSha256: s.sourceSha256,
              compressionPreset,
            });
          }
        }
      }

      // Commit Chapter + ChapterPage rows atomically in database
      const chapterNum = parseFloat(job.displayNumber);
      const conflictPolicy = job.batch.conflictPolicy;

      await db.$transaction(async (tx) => {
        const existingChapter = await tx.chapter.findFirst({
          where: {
            mangaId: job.mangaId,
            chapterNumber: chapterNum,
          },
        });

        if (existingChapter) {
          if (conflictPolicy === "skip_existing") {
            await tx.importChapterJob.update({
              where: { id: job.id },
              data: {
                status: "SKIPPED",
                pagesIngested: 0,
                slicesCreated: 0,
              },
            });
            return;
          }

          if (conflictPolicy === "replace_pages") {
            await tx.chapterPage.deleteMany({
              where: { chapterId: existingChapter.id },
            });

            await tx.chapter.update({
              where: { id: existingChapter.id },
              data: {
                chapterKey: job.chapterKey,
                sortKey: job.sortKey,
                chapterTitle: job.title || existingChapter.chapterTitle,
                volume: job.volume ?? existingChapter.volume,
                ingestStatus: "COMPLETED",
              },
            });

            for (const p of storedPages) {
              await tx.chapterPage.create({
                data: {
                  chapterId: existingChapter.id,
                  pageNumber: p.pageNumber,
                  imageUrl: p.imageUrl,
                  storageKey: p.storageKey,
                  width: p.width,
                  height: p.height,
                  fileSize: p.fileSize,
                  sourceSha256: p.sourceSha256,
                  compressionPreset: p.compressionPreset,
                },
              });
            }
          }
        } else {
          // Create new Chapter
          const createdChapter = await tx.chapter.create({
            data: {
              mangaId: job.mangaId,
              chapterNumber: chapterNum,
              chapterKey: job.chapterKey,
              sortKey: job.sortKey,
              chapterTitle: job.title,
              volume: job.volume,
              publicationStatus: "PUBLISHED",
              ingestStatus: "COMPLETED",
            },
          });

          for (const p of storedPages) {
            await tx.chapterPage.create({
              data: {
                chapterId: createdChapter.id,
                pageNumber: p.pageNumber,
                imageUrl: p.imageUrl,
                storageKey: p.storageKey,
                width: p.width,
                height: p.height,
                fileSize: p.fileSize,
                sourceSha256: p.sourceSha256,
                compressionPreset: p.compressionPreset,
              },
            });
          }
        }

        // Update ChapterJob counters
        await tx.importChapterJob.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            pagesIngested: storedPages.length,
            slicesCreated: totalSlicesCreated,
            outputBytes: BigInt(totalOutputBytes),
          },
        });

        // Update Batch counters
        await tx.importBatch.update({
          where: { id: job.batch.id },
          data: {
            completedChapters: { increment: 1 },
            processedPages: { increment: storedPages.length },
            totalOutputBytes: { increment: BigInt(totalOutputBytes) },
          },
        });

        // Update ComicJob counters
        await tx.importComicJob.update({
          where: { id: job.comicJobId },
          data: {
            completedChapters: { increment: 1 },
          },
        });
      });

      // Check if comic and batch are complete
      await this.checkBatchAndComicCompletion(job);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Fault isolation: mark ONLY this job as failed and increment batch error counters
      await db.$transaction(async (tx) => {
        await tx.importChapterJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            errorMessage,
          },
        });

        await tx.importComicJob.update({
          where: { id: job.comicJobId },
          data: { failedChapters: { increment: 1 } },
        });

        await tx.importBatch.update({
          where: { id: job.batch.id },
          data: {
            failedChapters: { increment: 1 },
            errorSummary: errorMessage,
          },
        });
      });

      // Also check completion when a job fails so batch reaches PARTIAL_FAILED when done
      await this.checkBatchAndComicCompletion(job);
    } finally {
      if (subReader) {
        try {
          await subReader.close();
        } catch {}
      }
      if (reader) {
        try {
          await reader.close();
        } catch {}
      }
      if (tempNestedArchive && fs.existsSync(tempNestedArchive)) {
        try {
          await fs.promises.unlink(tempNestedArchive);
        } catch {}
      }
    }
  }

  /**
   * Checks if comic and entire batch have finished all pending/processing jobs.
   */
  private static async checkBatchAndComicCompletion(job: {
    mangaId: string;
    comicJobId: string;
    batchId: string;
    batch: { autoPublish: boolean };
  }): Promise<void> {
    const db = await getPrisma();

    // Check if comic is complete
    const remainingComicJobs = await db.importChapterJob.count({
      where: {
        comicJobId: job.comicJobId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
    });

    if (remainingComicJobs === 0) {
      const failedComicJobs = await db.importChapterJob.count({
        where: {
          comicJobId: job.comicJobId,
          status: "FAILED",
        },
      });

      const nextStatus: PublicationStatus =
        failedComicJobs === 0 && job.batch.autoPublish ? "PUBLISHED" : "READY_TO_PUBLISH";

      await db.manga.update({
        where: { id: job.mangaId },
        data: { publicationStatus: nextStatus },
      });

      await db.importComicJob.update({
        where: { id: job.comicJobId },
        data: { status: failedComicJobs === 0 ? "COMPLETED" : "FAILED" },
      });
    }

    // Check if entire batch is complete
    const remainingBatchJobs = await db.importChapterJob.count({
      where: {
        batchId: job.batchId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
    });

    if (remainingBatchJobs === 0) {
      const failedBatchJobs = await db.importChapterJob.count({
        where: {
          batchId: job.batchId,
          status: "FAILED",
        },
      });

      await db.importBatch.update({
        where: { id: job.batchId },
        data: {
          status: failedBatchJobs === 0 ? "COMPLETED" : "PARTIAL_FAILED",
          finishedAt: new Date(),
        },
      });
    }
  }

  /**
   * Resets all FAILED chapter jobs back to PENDING for retry.
   * Already completed chapters (e.g. 1 to 1400) remain untouched.
   */
  static async retryFailedJobs(batchId: string): Promise<{ retriedCount: number }> {
    const db = await getPrisma();

    const batch = await db.importBatch.findUnique({
      where: { batchId },
    });

    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    const updated = await db.importChapterJob.updateMany({
      where: {
        batchId: batch.id,
        status: "FAILED",
      },
      data: {
        status: "PENDING",
        attempts: 0,
        lockedAt: null,
        workerId: null,
        errorMessage: null,
      },
    });

    if (updated.count > 0 || batch.status !== "PROCESSING") {
      await db.importBatch.update({
        where: { id: batch.id },
        data: {
          status: "QUEUED",
          failedChapters: 0,
          finishedAt: null,
        },
      });
    }

    return { retriedCount: updated.count };
  }

  /**
   * Resumes a batch from its checkpoint: resets any FAILED and CANCELLED jobs back to PENDING.
   * COMPLETED chapters (e.g. 1 to 1400) are preserved permanently without reprocessing.
   */
  static async resumeBatch(batchId: string): Promise<{ resumedCount: number }> {
    const db = await getPrisma();

    const batch = await db.importBatch.findUnique({
      where: { batchId },
    });

    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    const updated = await db.importChapterJob.updateMany({
      where: {
        batchId: batch.id,
        status: { in: ["FAILED", "CANCELLED"] },
      },
      data: {
        status: "PENDING",
        attempts: 0,
        lockedAt: null,
        workerId: null,
        errorMessage: null,
      },
    });

    if (updated.count > 0 || batch.status !== "PROCESSING") {
      await db.importBatch.update({
        where: { id: batch.id },
        data: {
          status: "QUEUED",
          failedChapters: 0,
          finishedAt: null,
        },
      });
    }

    return { resumedCount: updated.count };
  }

  /**
   * Resets a single FAILED chapter job back to PENDING for individual checkpoint recovery.
   */
  static async retryChapterJob(jobId: string): Promise<boolean> {
    const db = await getPrisma();

    const job = await db.importChapterJob.findUnique({
      where: { id: jobId },
      include: { batch: true },
    });

    if (!job) {
      throw new Error(`Chapter job not found: ${jobId}`);
    }

    await db.$transaction(async (tx) => {
      await tx.importChapterJob.update({
        where: { id: jobId },
        data: {
          status: "PENDING",
          attempts: 0,
          lockedAt: null,
          workerId: null,
          errorMessage: null,
        },
      });

      if (job.status === "FAILED") {
        await tx.importBatch.update({
          where: { id: job.batchId },
          data: {
            status: "QUEUED",
            failedChapters: { decrement: 1 },
          },
        });
      } else if (job.batch.status === "CANCELLED" || job.batch.status === "FAILED" || job.batch.status === "PARTIAL_FAILED") {
        await tx.importBatch.update({
          where: { id: job.batchId },
          data: {
            status: "QUEUED",
          },
        });
      }
    });

    return true;
  }

  /**
   * Cancels remaining PENDING chapter jobs in a batch safely.
   */
  static async cancelBatch(batchId: string): Promise<void> {
    const db = await getPrisma();

    const batch = await db.importBatch.findUnique({
      where: { batchId },
    });

    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    await db.$transaction([
      db.importChapterJob.updateMany({
        where: {
          batchId: batch.id,
          status: "PENDING",
        },
        data: { status: "CANCELLED" },
      }),
      db.importBatch.update({
        where: { id: batch.id },
        data: {
          status: "CANCELLED",
          finishedAt: new Date(),
        },
      }),
    ]);
  }

  /**
   * Computes aggregate batch metrics across the entire system.
   */
  static async getGlobalBatchMetrics() {
    const db = await getPrisma();

    const [
      totalBatches,
      activeBatches,
      completedBatches,
      failedBatches,
      batchSums,
    ] = await Promise.all([
      db.importBatch.count(),
      db.importBatch.count({
        where: { status: { in: ["QUEUED", "PROCESSING", "SCANNING", "UPLOADED"] } },
      }),
      db.importBatch.count({ where: { status: "COMPLETED" } }),
      db.importBatch.count({
        where: { status: { in: ["FAILED", "PARTIAL_FAILED"] } },
      }),
      db.importBatch.aggregate({
        _sum: {
          totalChapters: true,
          completedChapters: true,
          failedChapters: true,
          totalPages: true,
          processedPages: true,
          totalInputBytes: true,
          totalOutputBytes: true,
        },
      }),
    ]);

    return {
      totalBatches,
      activeBatches,
      completedBatches,
      failedBatches,
      totalChapters: batchSums._sum.totalChapters || 0,
      completedChapters: batchSums._sum.completedChapters || 0,
      failedChapters: batchSums._sum.failedChapters || 0,
      totalPages: batchSums._sum.totalPages || 0,
      processedPages: batchSums._sum.processedPages || 0,
      totalInputBytes: Number(batchSums._sum.totalInputBytes || BigInt(0)),
      totalOutputBytes: Number(batchSums._sum.totalOutputBytes || BigInt(0)),
    };
  }

  /**
   * Fetches live batch status, checkpoint state, and chapter details with optional pagination and filters.
   */
  static async getBatchStatus(
    batchId: string,
    options?: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
    }
  ): Promise<any | null> {
    const db = await getPrisma();

    const batch = await db.importBatch.findUnique({
      where: { batchId },
      include: {
        comicJobs: true,
      },
    });

    if (!batch) return null;

    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(200, Math.max(1, options?.limit || 50));
    const skip = (page - 1) * limit;

    const chapterWhere: any = { batchId: batch.id };
    if (options?.status && options.status !== "ALL") {
      chapterWhere.status = options.status;
    }
    if (options?.search && options.search.trim()) {
      const q = options.search.trim();
      chapterWhere.OR = [
        { displayNumber: { contains: q } },
        { title: { contains: q, mode: "insensitive" } },
        { chapterKey: { contains: q, mode: "insensitive" } },
      ];
    }

    const [chapterJobs, totalFilteredChapters, statusCountsRaw] = await Promise.all([
      db.importChapterJob.findMany({
        where: chapterWhere,
        orderBy: [{ sortKey: "asc" }, { createdAt: "asc" }],
        skip,
        take: limit,
      }),
      db.importChapterJob.count({ where: chapterWhere }),
      db.importChapterJob.groupBy({
        by: ["status"],
        where: { batchId: batch.id },
        _count: { status: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      FAILED: 0,
      SKIPPED: 0,
      CANCELLED: 0,
    };
    for (const sc of statusCountsRaw) {
      statusCounts[sc.status] = sc._count.status;
    }

    const serializedChapters = chapterJobs.map((ch) => ({
      id: ch.id,
      chapterKey: ch.chapterKey,
      displayNumber: ch.displayNumber,
      sortKey: ch.sortKey,
      title: ch.title,
      volume: ch.volume,
      status: ch.status,
      attempts: ch.attempts,
      maxAttempts: ch.maxAttempts,
      pagesIngested: ch.pagesIngested,
      slicesCreated: ch.slicesCreated,
      outputBytes: Number(ch.outputBytes),
      errorMessage: ch.errorMessage,
      lockedAt: ch.lockedAt,
      workerId: ch.workerId,
      createdAt: ch.createdAt,
      updatedAt: ch.updatedAt,
    }));

    return {
      id: batch.id,
      batchId: batch.batchId,
      status: batch.status,
      sourceMode: batch.sourceMode,
      sourceRef: batch.sourceRef,
      compressionPreset: batch.compressionPreset,
      conflictPolicy: batch.conflictPolicy,
      autoPublish: batch.autoPublish,
      errorSummary: batch.errorSummary,
      counters: {
        totalComics: batch.totalComics,
        totalChapters: batch.totalChapters,
        completedChapters: batch.completedChapters,
        failedChapters: batch.failedChapters,
        totalPages: batch.totalPages,
        processedPages: batch.processedPages,
        totalInputBytes: Number(batch.totalInputBytes),
        totalOutputBytes: Number(batch.totalOutputBytes),
      },
      statusCounts,
      comics: batch.comicJobs.map((c) => ({
        id: c.id,
        slug: c.slug,
        status: c.status,
        totalChapters: c.totalChapters,
        completedChapters: c.completedChapters,
        failedChapters: c.failedChapters,
      })),
      chapterJobs: serializedChapters,
      recentChapters: serializedChapters,
      pagination: {
        page,
        limit,
        total: totalFilteredChapters,
        totalPages: Math.ceil(totalFilteredChapters / limit) || 1,
      },
      checkpoint: {
        isSafe: true,
        completedCount: statusCounts.COMPLETED,
        failedCount: statusCounts.FAILED,
        pendingCount: statusCounts.PENDING,
        resumableCount: statusCounts.FAILED + statusCounts.CANCELLED + statusCounts.PENDING,
      },
      createdAt: batch.createdAt,
      finishedAt: batch.finishedAt,
    };
  }
}
