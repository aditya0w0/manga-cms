import sharp, { Sharp } from "sharp";
import crypto from "crypto";
import { CompressionPreset } from "./schematic-schema";
import { getPrisma } from "@/lib/database/prisma";
import { StorageAdapter } from "../storage/storage-adapter";

// 3.1 Mandatory Server Memory & CPU Protection
// Prevents native libvips C++ memory creep across thousands of sequential images
sharp.cache(false);
// Keeps Node.js event loop responsive & prevents CPU starvation on multi-core hosts
sharp.concurrency(2);

export const MAX_SAFE_WEBTOON_HEIGHT = 16_000;
export const TARGET_SLICE_HEIGHT = 4_000;
export const MAX_DECOMPRESSION_PIXELS = 120_000_000;

export interface ProcessedImageSlice {
  buffer: Buffer;
  width: number;
  height: number;
  byteSize: number;
  format: string;
  sliceIndex: number;
  totalSlices: number;
  sourceSha256: string;
}

export interface ImageProcessingResult {
  isDeduped: boolean;
  cachedUrl?: string;
  sourceSha256: string;
  originalWidth: number;
  originalHeight: number;
  slices: ProcessedImageSlice[];
}

export interface StoredSliceResult {
  key: string;
  publicUrl: string;
  width: number;
  height: number;
  byteSize: number;
  sourceSha256: string;
  compressionPreset: CompressionPreset;
  sliceIndex: number;
  totalSlices: number;
}

export class ImageProcessor {
  /**
   * Computes SHA-256 hash of raw input image before encoding.
   */
  static computeSha256(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Checks if an identical image with the same compression preset already exists in the database.
   */
  static async findExistingMedia(
    sourceSha256: string,
    compressionPreset: CompressionPreset,
    storage?: StorageAdapter
  ): Promise<{ url: string; width: number; height: number; byteSize: number } | null> {
    try {
      const db = await getPrisma();

      // Check ChapterPage first
      const existingPage = await db.chapterPage.findFirst({
        where: {
          sourceSha256,
          compressionPreset,
        },
        select: {
          imageUrl: true,
          storageKey: true,
          width: true,
          height: true,
          fileSize: true,
        },
      });

      if (existingPage && existingPage.width && existingPage.height && existingPage.fileSize) {
        if (storage && existingPage.storageKey) {
          const fileExists = await storage.exists(existingPage.storageKey).catch(() => false);
          if (fileExists) {
            return {
              url: existingPage.imageUrl,
              width: existingPage.width,
              height: existingPage.height,
              byteSize: existingPage.fileSize,
            };
          }
        } else {
          return {
            url: existingPage.imageUrl,
            width: existingPage.width,
            height: existingPage.height,
            byteSize: existingPage.fileSize,
          };
        }
      }

      // Check Media table
      const existingMedia = await db.media.findFirst({
        where: {
          sourceSha256,
          compressionPreset,
        },
        select: {
          storageKey: true,
          width: true,
          height: true,
          fileSize: true,
        },
      });

      if (existingMedia && existingMedia.width && existingMedia.height && existingMedia.fileSize) {
        const publicUrl = storage
          ? storage.getPublicUrl(existingMedia.storageKey)
          : `/api/v1/media/${existingMedia.storageKey}`;

        return {
          url: publicUrl,
          width: existingMedia.width,
          height: existingMedia.height,
          byteSize: existingMedia.fileSize,
        };
      }
    } catch {
      // If database is not available during standalone unit tests, proceed without cache
    }

    return null;
  }

  /**
   * Processes an image buffer with WebP adaptive encoding and auto-slicing for tall webtoons.
   */
  static async processImage(
    rawBuffer: Buffer,
    preset: CompressionPreset = "auto",
    storage?: StorageAdapter
  ): Promise<ImageProcessingResult> {
    if (!rawBuffer || rawBuffer.length === 0) {
      throw new Error("Cannot process empty image buffer");
    }

    // 3.2 Pre-Encode SHA-256 Deduplication
    const sourceSha256 = this.computeSha256(rawBuffer);

    const cached = await this.findExistingMedia(sourceSha256, preset, storage);
    if (cached) {
      return {
        isDeduped: true,
        cachedUrl: cached.url,
        sourceSha256,
        originalWidth: cached.width,
        originalHeight: cached.height,
        slices: [],
      };
    }

    // 3.1 Metadata Inspection with Decompression Bomb Limits
    const imagePipeline = sharp(rawBuffer, {
      limitInputPixels: MAX_DECOMPRESSION_PIXELS,
    }).rotate(); // Auto-orient EXIF orientation

    const metadata = await imagePipeline.metadata();
    const width = metadata.width || 1;
    const height = metadata.height || 1;
    const inputFormat = (metadata.format || "").toLowerCase();
    const hasAlpha = Boolean(metadata.hasAlpha);

    // 3.3 16,383px Auto-Slicer (Manhwa / Webtoon Long-Strip Protection)
    if (height > MAX_SAFE_WEBTOON_HEIGHT) {
      const sliceCount = Math.ceil(height / TARGET_SLICE_HEIGHT);
      const slices: ProcessedImageSlice[] = [];

      for (let i = 0; i < sliceCount; i++) {
        const top = i * TARGET_SLICE_HEIGHT;
        const sliceHeight = Math.min(TARGET_SLICE_HEIGHT, height - top);

        const slicePipeline = sharp(rawBuffer, {
          limitInputPixels: MAX_DECOMPRESSION_PIXELS,
        })
          .rotate()
          .extract({
            left: 0,
            top,
            width,
            height: sliceHeight,
          });

        const encodedBuffer = await this.encodeBuffer(slicePipeline, preset, inputFormat, hasAlpha);

        slices.push({
          buffer: encodedBuffer,
          width,
          height: sliceHeight,
          byteSize: encodedBuffer.length,
          format: "webp",
          sliceIndex: i + 1,
          totalSlices: sliceCount,
          sourceSha256,
        });
      }

      return {
        isDeduped: false,
        sourceSha256,
        originalWidth: width,
        originalHeight: height,
        slices,
      };
    }

    // Single Page Processing (Height <= 16,000px)
    const encodedBuffer = await this.encodeBuffer(imagePipeline, preset, inputFormat, hasAlpha);

    const singleSlice: ProcessedImageSlice = {
      buffer: encodedBuffer,
      width,
      height,
      byteSize: encodedBuffer.length,
      format: preset === "raw" && (inputFormat === "webp" || inputFormat === "jpeg") ? inputFormat : "webp",
      sliceIndex: 1,
      totalSlices: 1,
      sourceSha256,
    };

    return {
      isDeduped: false,
      sourceSha256,
      originalWidth: width,
      originalHeight: height,
      slices: [singleSlice],
    };
  }

  /**
   * 3.4 Encodes a Sharp instance into the requested compression preset.
   * Locks effort to 4 (effort: 6 incurs high CPU load for <2% size difference).
   */
  private static async encodeBuffer(
    pipeline: Sharp,
    preset: CompressionPreset,
    inputFormat: string,
    hasAlpha: boolean
  ): Promise<Buffer> {
    switch (preset) {
      case "lossless":
        return pipeline
          .webp({
            lossless: true,
            effort: 4,
          })
          .toBuffer();

      case "compact":
        return pipeline
          .webp({
            quality: 75,
            effort: 4,
            smartSubsample: true,
          })
          .toBuffer();

      case "raw":
        // If already webp or jpeg and requested raw, keep webp quality 90
        if (inputFormat === "webp") {
          return pipeline.toBuffer();
        }
        return pipeline
          .webp({
            quality: 85,
            effort: 4,
          })
          .toBuffer();

      case "auto":
      default:
        // True lossless if source is PNG / has alpha transparency, high quality 85 for photo/JPEG
        if (inputFormat === "png" || hasAlpha) {
          return pipeline
            .webp({
              lossless: true,
              effort: 4,
            })
            .toBuffer();
        }
        return pipeline
          .webp({
            quality: 85,
            effort: 4,
          })
          .toBuffer();
    }
  }

  /**
   * Stores processed slices in the configured storage adapter.
   */
  static async storeSlices(params: {
    slices: ProcessedImageSlice[];
    storage: StorageAdapter;
    mangaSlug: string;
    chapterKey: string;
    pageNumber: number;
    preset: CompressionPreset;
  }): Promise<StoredSliceResult[]> {
    const results: StoredSliceResult[] = [];
    const padPage = String(params.pageNumber).padStart(4, "0");

    for (const slice of params.slices) {
      const sliceSuffix = slice.totalSlices > 1 ? `_s${String(slice.sliceIndex).padStart(2, "0")}` : "";
      const extension = slice.format === "jpeg" ? "jpg" : slice.format;
      const key = `media/${params.mangaSlug}/${params.chapterKey}/page_${padPage}${sliceSuffix}.${extension}`;

      const putRes = await params.storage.putObject({
        key,
        body: slice.buffer,
        contentType: slice.format === "webp" ? "image/webp" : `image/${slice.format}`,
      });

      results.push({
        key: putRes.key,
        publicUrl: putRes.publicUrl,
        width: slice.width,
        height: slice.height,
        byteSize: putRes.byteSize,
        sourceSha256: slice.sourceSha256,
        compressionPreset: params.preset,
        sliceIndex: slice.sliceIndex,
        totalSlices: slice.totalSlices,
      });
    }

    return results;
  }
}
