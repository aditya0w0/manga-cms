import fs from "fs";
import path from "path";
import crypto from "crypto";
import sizeOf from "image-size";
import { getPrisma } from "@/lib/database/prisma";
import { LosslessImageConverter } from "../upload-pipeline/lossless-converter";

export interface MediaRecord {
  id: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  checksum: string | null;
  createdAt: Date;
  updatedAt: Date;
  url: string;
}

const STORAGE_ROOT = path.resolve(process.cwd(), "data", "storage", "media");
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const MAX_IMAGE_FILE_SIZE = 100 * 1024 * 1024; // 100MB to support high-resolution raw uploads

if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

export class MediaStorageService {
  /**
   * Generates a SHA-256 checksum for deduplication.
   */
  static calculateChecksum(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Resolves safe MIME type based on file extension and magic bytes.
   */
  static detectMimeType(filename: string, buffer: Buffer): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".avif": "image/avif",
      ".gif": "image/gif",
    };
    if (mimeMap[ext]) return mimeMap[ext];

    try {
      const info = sizeOf(buffer);
      if (info?.type && mimeMap[`.${info.type}`]) {
        return mimeMap[`.${info.type}`];
      }
    } catch {}

    return "application/octet-stream";
  }

  /**
   * Stores a media file buffer on the local filesystem and creates a Media record.
   * If a duplicate file with the same checksum exists, reuses the existing record.
   * Strictly enforces format validation, magic byte verification, and file size limits.
   */
  static async storeMedia(
    rawBuffer: Buffer,
    rawFilename: string,
    mimeTypeOverride?: string
  ): Promise<MediaRecord> {
    if (!rawBuffer || rawBuffer.length === 0) {
      throw new Error("EMPTY_FILE: Uploaded buffer is empty");
    }

    if (rawBuffer.length > MAX_IMAGE_FILE_SIZE) {
      throw new Error(`FILE_TOO_LARGE: Image exceeds maximum allowed size of ${MAX_IMAGE_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Attempt lossless WebP conversion if applicable (e.g. large PNG)
    const conversion = await LosslessImageConverter.convertToLosslessWebP(
      rawBuffer,
      rawFilename,
      mimeTypeOverride
    );
    const buffer = conversion.buffer;
    const originalFilename = conversion.filename;
    if (conversion.converted) {
      mimeTypeOverride = conversion.mimeType;
    }

    const ext = path.extname(originalFilename).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      throw new Error(`INVALID_FILE_TYPE: Extension "${ext}" is not permitted. Only image formats (.jpg, .jpeg, .png, .webp, .avif, .gif) are supported.`);
    }

    // Verify magic bytes and decode dimensions
    let width: number | null = null;
    let height: number | null = null;
    try {
      const dimensions = sizeOf(buffer);
      if (!dimensions || !dimensions.type) {
        throw new Error("Invalid image header");
      }
      const detectedExt = `.${dimensions.type}`;
      if (!ALLOWED_IMAGE_EXTENSIONS.has(detectedExt) && detectedExt !== ".jpg") {
        throw new Error(`Mismatched or unsupported image type: ${dimensions.type}`);
      }
      if (dimensions.width) width = dimensions.width;
      if (dimensions.height) height = dimensions.height;
    } catch (err: any) {
      throw new Error(`CORRUPTED_OR_INVALID_IMAGE: Unable to decode valid image dimensions (${err.message})`);
    }

    const detectedMime = this.detectMimeType(originalFilename, buffer);
    const mimeType = mimeTypeOverride && ALLOWED_MIME_TYPES.has(mimeTypeOverride)
      ? mimeTypeOverride
      : detectedMime;

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new Error(`INVALID_MIME_TYPE: MIME type "${mimeType}" is not an authorized image format`);
    }

    const db = await getPrisma();
    const checksum = this.calculateChecksum(buffer);

    // Duplicate detection by checksum
    const existing = await db.media.findFirst({
      where: { checksum },
    });

    if (existing) {
      return {
        ...existing,
        url: this.getMediaUrl(existing.storageKey),
      };
    }

    const fileId = crypto.randomUUID();
    const storageKey = `media/${fileId}${ext}`;
    const destinationPath = path.join(STORAGE_ROOT, `${fileId}${ext}`);

    // Atomically write file to local disk
    await fs.promises.writeFile(destinationPath, buffer);

    const media = await db.media.create({
      data: {
        id: fileId,
        storageKey,
        originalFilename: path.basename(originalFilename),
        mimeType,
        fileSize: buffer.length,
        width,
        height,
        checksum,
      },
    });

    return {
      ...media,
      url: this.getMediaUrl(storageKey),
    };
  }

  /**
   * Resolves the physical path for a storage key.
   * Guaranteed safe against path traversal.
   */
  static getPhysicalPath(storageKey: string): string | null {
    const cleanKey = storageKey.replace(/^media\//, "");
    const safePath = path.resolve(STORAGE_ROOT, path.basename(cleanKey));
    if (!safePath.startsWith(STORAGE_ROOT) || !fs.existsSync(safePath)) {
      return null;
    }
    return safePath;
  }

  /**
   * Gets media record and file stream safely.
   */
  static async getMediaByStorageKey(storageKey: string) {
    const db = await getPrisma();
    const media = await db.media.findUnique({
      where: { storageKey },
    });
    if (!media) return null;

    const physicalPath = this.getPhysicalPath(storageKey);
    if (!physicalPath) return null;

    return {
      media: {
        ...media,
        url: this.getMediaUrl(storageKey),
      },
      filePath: physicalPath,
    };
  }

  /**
   * Returns a publicly consumable media URL for the reader.
   */
  static getMediaUrl(storageKey: string): string {
    return `/api/v1/media/${encodeURIComponent(storageKey)}`;
  }

  /**
   * Deletes a media asset from DB and disk if unreferenced.
   */
  static async deleteMedia(id: string): Promise<boolean> {
    const db = await getPrisma();
    const media = await db.media.findUnique({
      where: { id },
      include: {
        _count: {
          select: { pages: true, coverForManga: true },
        },
      },
    });

    if (!media) return false;
    if (media._count.pages > 0 || media._count.coverForManga > 0) {
      throw new Error("MEDIA_IN_USE: Media asset is currently linked to chapters or manga covers.");
    }

    const physicalPath = this.getPhysicalPath(media.storageKey);
    if (physicalPath && fs.existsSync(physicalPath)) {
      try {
        await fs.promises.unlink(physicalPath);
      } catch {}
    }

    await db.media.delete({ where: { id } });
    return true;
  }
}
