import fs from "fs";
import path from "path";
import crypto from "crypto";
import AdmZip from "adm-zip";
import { getPrisma } from "@/lib/database/prisma";
import { PublicationStatus, Chapter } from "@prisma/client";
import { MediaStorageService } from "../media/media-storage-service";

export interface PageUploadItem {
  filename: string;
  buffer: Buffer;
  mimeType?: string;
}

export interface IngestedPageItem {
  pageNumber: number;
  imageId: string;
  storageKey: string;
  url: string;
  width: number | null;
  height: number | null;
  fileSize: number;
}

export interface IngestionReport {
  chapterId: string;
  totalPages: number;
  pages: IngestedPageItem[];
  duplicatesFound: number;
  skippedFiles: string[];
  executionTimeMs: number;
  skipped?: boolean;
}

export interface BatchChapterReportItem {
  chapterNumber: number;
  chapterId: string;
  sourceKey: string;
  status: "CREATED" | "UPDATED" | "SKIPPED" | "FAILED";
  pagesCount: number;
  error?: string;
}

export interface BatchIngestionReport {
  totalChapters: number;
  chaptersCreated: number;
  chaptersUpdated: number;
  chaptersSkipped: number;
  totalPagesIngested: number;
  chapters: BatchChapterReportItem[];
  executionTimeMs: number;
}

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024; // 500MB
const MAX_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024; // 1GB
const MAX_FILE_ENTRIES = 5000; // Supports multi-chapter master archives
const MAX_DECOMPRESSION_RATIO = 15;

export class UploadPipelineService {
  /**
   * Natural alphanumeric sort comparison for filenames.
   * Ensures 'page_1.png', 'page_2.png', 'page_10.png' sort sequentially.
   */
  static naturalSortCompare(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  }

  /**
   * Safely unpacks a ZIP archive into memory buffers with Zip-Slip and bomb protection.
   */
  static safeExtractZip(zipBuffer: Buffer): { items: PageUploadItem[]; skipped: string[] } {
    if (zipBuffer.length > MAX_ARCHIVE_BYTES) {
      throw new Error(`ARCHIVE_TOO_LARGE: Uploaded archive exceeds maximum size of ${MAX_ARCHIVE_BYTES / (1024 * 1024)}MB`);
    }

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    if (entries.length > MAX_FILE_ENTRIES) {
      throw new Error(`ARCHIVE_BOMB_DETECTED: Archive exceeds maximum allowed file count of ${MAX_FILE_ENTRIES}`);
    }

    let totalUncompressedSize = 0;
    const items: PageUploadItem[] = [];
    const skipped: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const rawName = entry.entryName;

      // Zip-Slip protection
      if (rawName.includes("..") || rawName.startsWith("/") || rawName.includes("\0")) {
        throw new Error(`MALICIOUS_ARCHIVE: Path traversal detected in archive entry: ${rawName}`);
      }

      const basename = path.basename(rawName);

      // Filter out OS artifacts
      if (
        basename.startsWith(".") ||
        rawName.startsWith("__MACOSX") ||
        basename.toLowerCase() === "thumbs.db"
      ) {
        skipped.push(rawName);
        continue;
      }

      const ext = path.extname(basename).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        skipped.push(rawName);
        continue;
      }

      totalUncompressedSize += entry.header.size;
      if (totalUncompressedSize > MAX_UNCOMPRESSED_BYTES) {
        throw new Error(`ARCHIVE_BOMB_DETECTED: Uncompressed contents exceed safety threshold`);
      }

      const decompressedRatio = entry.header.size / Math.max(1, entry.header.compressedSize);
      if (decompressedRatio > MAX_DECOMPRESSION_RATIO && entry.header.size > 2 * 1024 * 1024) {
        throw new Error(`ARCHIVE_BOMB_DETECTED: Suspicious compression ratio for entry: ${basename}`);
      }

      const buffer = entry.getData();
      items.push({
        filename: basename,
        buffer,
      });
    }

    const globalRatio = totalUncompressedSize / Math.max(1, zipBuffer.length);
    if (globalRatio > MAX_DECOMPRESSION_RATIO && totalUncompressedSize > 10 * 1024 * 1024) {
      throw new Error("ARCHIVE_BOMB_DETECTED: Suspicious overall compression ratio");
    }

    return { items, skipped };
  }

  /**
   * Finds or creates a chapter record under a manga.
   */
  static async findOrCreateChapter(
    mangaId: string,
    chapterNumber: number,
    options?: {
      volumeNumber?: number | null;
      title?: string | null;
      language?: string;
      publicationStatus?: PublicationStatus;
      createdById?: string;
    }
  ): Promise<{ chapter: Chapter; isNew: boolean }> {
    const db = await getPrisma();
    const language = (options?.language || "en").toLowerCase();

    const existing = await db.chapter.findUnique({
      where: {
        mangaId_chapterNumber_language: {
          mangaId,
          chapterNumber,
          language,
        },
      },
    });

    if (existing) {
      if (
        (options?.title && !existing.chapterTitle) ||
        (options?.volumeNumber !== undefined && existing.volume === null)
      ) {
        const updated = await db.chapter.update({
          where: { id: existing.id },
          data: {
            title: options.title || existing.title,
            chapterTitle: options.title || existing.chapterTitle,
            volume: options.volumeNumber !== undefined ? options.volumeNumber : existing.volume,
            volumeNumber: options.volumeNumber !== undefined ? options.volumeNumber : existing.volumeNumber,
          },
        });
        return { chapter: updated, isNew: false };
      }
      return { chapter: existing, isNew: false };
    }

    const created = await db.chapter.create({
      data: {
        mangaId,
        chapterNumber,
        volumeNumber: options?.volumeNumber ?? null,
        volume: options?.volumeNumber ?? null,
        title: options?.title ?? null,
        chapterTitle: options?.title ?? null,
        slug: `ch-${chapterNumber}`,
        language,
        publicationStatus: options?.publicationStatus || PublicationStatus.PUBLISHED,
        publishedAt: new Date(),
        createdById: options?.createdById,
      },
    });

    return { chapter: created, isNew: true };
  }

  /**
   * Processes an array of page items and attaches them to a chapter deterministically.
   * Execution is fully transactional: rolls back if any error occurs.
   */
  static async ingestChapterPages(
    chapterId: string,
    rawPages: PageUploadItem[],
    options?: { conflictStrategy?: "SKIP" | "OVERWRITE" }
  ): Promise<IngestionReport> {
    const startTime = Date.now();
    const db = await getPrisma();

    // Verify chapter exists
    const chapter = await db.chapter.findUnique({
      where: { id: chapterId },
    });
    if (!chapter) {
      throw new Error(`CHAPTER_NOT_FOUND: Chapter ${chapterId} does not exist`);
    }

    const existingPageCount = await db.chapterPage.count({ where: { chapterId } });
    if (existingPageCount > 0 && options?.conflictStrategy === "SKIP") {
      return {
        chapterId,
        totalPages: existingPageCount,
        pages: [],
        duplicatesFound: 0,
        skippedFiles: [],
        executionTimeMs: Date.now() - startTime,
        skipped: true,
      };
    }

    if (rawPages.length === 0) {
      throw new Error("NO_VALID_PAGES: No valid image files found in upload");
    }

    // Sort pages naturally
    const sorted = [...rawPages].sort((a, b) =>
      this.naturalSortCompare(a.filename, b.filename)
    );

    let duplicatesFound = 0;
    const mediaRecords: Array<{ item: PageUploadItem; media: any }> = [];

    // Step 1: Store media files using MediaStorageService (with SHA-256 deduplication and lossless conversion)
    for (const item of sorted) {
      const checksum = MediaStorageService.calculateChecksum(item.buffer);
      const existingMedia = await db.media.findFirst({ where: { checksum } });
      if (existingMedia) {
        duplicatesFound++;
        mediaRecords.push({
          item,
          media: {
            ...existingMedia,
            url: MediaStorageService.getMediaUrl(existingMedia.storageKey),
          },
        });
      } else {
        const stored = await MediaStorageService.storeMedia(item.buffer, item.filename, item.mimeType);
        mediaRecords.push({ item, media: stored });
      }
    }

    // Step 2: Ingest into database transactionally
    const ingestedPages: IngestedPageItem[] = [];

    await db.$transaction(async (tx) => {
      // Clear existing pages for this chapter to ensure clean deterministic replacement
      await tx.chapterPage.deleteMany({
        where: { chapterId },
      });

      for (let i = 0; i < mediaRecords.length; i++) {
        const pageNumber = i + 1;
        const { media } = mediaRecords[i];

        await tx.chapterPage.create({
          data: {
            chapterId,
            pageNumber,
            imageId: media.id,
            imageUrl: media.url,
            storageKey: media.storageKey,
            width: media.width,
            height: media.height,
            fileSize: media.fileSize,
          },
        });

        ingestedPages.push({
          pageNumber,
          imageId: media.id,
          storageKey: media.storageKey,
          url: media.url,
          width: media.width,
          height: media.height,
          fileSize: media.fileSize,
        });
      }

      await tx.chapter.update({
        where: { id: chapterId },
        data: { updatedAt: new Date() },
      });
    });

    return {
      chapterId,
      totalPages: ingestedPages.length,
      pages: ingestedPages,
      duplicatesFound,
      skippedFiles: [],
      executionTimeMs: Date.now() - startTime,
      skipped: false,
    };
  }

  /**
   * High-level entrypoint: Ingests a ZIP archive directly into a single chapter.
   */
  static async ingestChapterZip(
    chapterId: string,
    zipBuffer: Buffer,
    options?: { conflictStrategy?: "SKIP" | "OVERWRITE" }
  ): Promise<IngestionReport> {
    const startTime = Date.now();
    const { items, skipped } = this.safeExtractZip(zipBuffer);
    const report = await this.ingestChapterPages(chapterId, items, options);
    report.skippedFiles = skipped;
    report.executionTimeMs = Date.now() - startTime;
    return report;
  }

  /**
   * Memory-safe batch ingestion from a master ZIP archive on disk.
   * Reads entries chapter-by-chapter to avoid loading all images into RAM at once.
   */
  static async ingestMultiChapterMasterArchive(
    mangaId: string,
    tempZipPath: string,
    confirmedManifest: Array<{
      sourceKey: string;
      chapterNumber: number;
      volume?: number;
      title?: string;
      files: string[];
    }>,
    options: {
      conflictStrategy: "SKIP" | "OVERWRITE";
      actorId?: string;
      language?: string;
    }
  ): Promise<BatchIngestionReport> {
    const startTime = Date.now();
    const db = await getPrisma();

    // Verify manga exists
    const manga = await db.manga.findUnique({
      where: { id: mangaId },
    });
    if (!manga) {
      throw new Error(`MANGA_NOT_FOUND: Manga ${mangaId} does not exist`);
    }

    const zip = new AdmZip(tempZipPath);
    const entries = zip.getEntries();
    const entryMap = new Map<string, any>();
    for (const e of entries) {
      entryMap.set(e.entryName.replace(/\\/g, "/").replace(/^\/+/, ""), e);
    }

    let chaptersCreated = 0;
    let chaptersUpdated = 0;
    let chaptersSkipped = 0;
    let totalPagesIngested = 0;
    const chapterReports: BatchChapterReportItem[] = [];

    for (const item of confirmedManifest) {
      try {
        const { chapter, isNew } = await this.findOrCreateChapter(mangaId, item.chapterNumber, {
          volumeNumber: item.volume,
          title: item.title,
          language: options.language,
          createdById: options.actorId,
        });

        // Check if existing chapter has pages and we should skip
        const existingPages = await db.chapterPage.count({ where: { chapterId: chapter.id } });
        if (existingPages > 0 && options.conflictStrategy === "SKIP") {
          chaptersSkipped++;
          chapterReports.push({
            chapterNumber: item.chapterNumber,
            chapterId: chapter.id,
            sourceKey: item.sourceKey,
            status: "SKIPPED",
            pagesCount: existingPages,
          });
          continue;
        }

        // Extract pages for THIS chapter only
        const chapterPageItems: PageUploadItem[] = [];

        for (const relPath of item.files) {
          const entry = entryMap.get(relPath);
          if (!entry || entry.isDirectory) continue;

          // Check for nested archive (.zip / .cbz)
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === ".zip" || ext === ".cbz") {
            const nestedZipBuffer = entry.getData();
            const { items: nestedPages } = this.safeExtractZip(nestedZipBuffer);
            chapterPageItems.push(...nestedPages);
          } else if (ALLOWED_EXTENSIONS.has(ext)) {
            chapterPageItems.push({
              filename: entry.name,
              buffer: entry.getData(),
            });
          }
        }

        if (chapterPageItems.length === 0) {
          chapterReports.push({
            chapterNumber: item.chapterNumber,
            chapterId: chapter.id,
            sourceKey: item.sourceKey,
            status: "FAILED",
            pagesCount: 0,
            error: "No valid image files found for this chapter",
          });
          continue;
        }

        // Ingest pages for this chapter
        const ingestReport = await this.ingestChapterPages(chapter.id, chapterPageItems, {
          conflictStrategy: options.conflictStrategy,
        });

        totalPagesIngested += ingestReport.totalPages;
        if (isNew) {
          chaptersCreated++;
        } else {
          chaptersUpdated++;
        }

        chapterReports.push({
          chapterNumber: item.chapterNumber,
          chapterId: chapter.id,
          sourceKey: item.sourceKey,
          status: isNew ? "CREATED" : "UPDATED",
          pagesCount: ingestReport.totalPages,
        });

        // Allow memory to be reclaimed
        chapterPageItems.length = 0;
      } catch (err: any) {
        chapterReports.push({
          chapterNumber: item.chapterNumber,
          chapterId: "",
          sourceKey: item.sourceKey,
          status: "FAILED",
          pagesCount: 0,
          error: err.message || "Failed to process chapter",
        });
      }
    }

    return {
      totalChapters: confirmedManifest.length,
      chaptersCreated,
      chaptersUpdated,
      chaptersSkipped,
      totalPagesIngested,
      chapters: chapterReports,
      executionTimeMs: Date.now() - startTime,
    };
  }
}
