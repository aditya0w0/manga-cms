import fs from "fs";
import path from "path";
import crypto from "crypto";
import AdmZip from "adm-zip";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export interface StoredFileResult {
  url: string;
  storageKey: string;
  size: number;
  mimeType: string;
  originalName: string;
}

export interface ExtractedPageResult {
  pageNumber: number;
  filename: string;
  url: string;
  storageKey: string;
  size: number;
}

export interface ZipExtractionReport {
  totalPages: number;
  pages: ExtractedPageResult[];
  skippedFiles: string[];
}

const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || "local").toLowerCase();
const UPLOAD_DIR = path.resolve(process.cwd(), "public", "uploads");

// Ensure local uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

let s3Client: S3Client | null = null;
if (STORAGE_PROVIDER === "s3") {
  s3Client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });
}

function getMimeTypeFromExt(ext: string): string {
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".gif": "image/gif",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

/**
 * Saves a file buffer to the configured storage provider (Local or S3)
 */
export async function saveFile(
  buffer: Buffer,
  originalFilename: string,
  folder = "general"
): Promise<StoredFileResult> {
  const ext = path.extname(originalFilename).toLowerCase() || ".png";
  const hash = crypto.randomBytes(8).toString("hex");
  const cleanBase = path.basename(originalFilename, ext).replace(/[^a-zA-Z0-9-_]/g, "_");
  const storedFilename = `${cleanBase}_${hash}${ext}`;
  const storageKey = `${folder}/${storedFilename}`;
  const mimeType = getMimeTypeFromExt(ext);
  const size = buffer.length;

  if (STORAGE_PROVIDER === "s3" && s3Client) {
    const bucket = process.env.S3_BUCKET || "mangacms";
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    const publicUrl = process.env.S3_PUBLIC_DOMAIN
      ? `${process.env.S3_PUBLIC_DOMAIN}/${storageKey}`
      : `https://${bucket}.s3.amazonaws.com/${storageKey}`;

    return {
      url: publicUrl,
      storageKey,
      size,
      mimeType,
      originalName: originalFilename,
    };
  }

  // Local filesystem storage: validate and sanitize folder path
  if (folder.includes("\0")) {
    throw new Error("INVALID_STORAGE_PATH: Folder path contains null bytes");
  }

  // Split folder into segments, strip any empty, '.', or illegal characters
  const rawSegments = folder.split(/[/\\]+/).filter(Boolean);
  const safeSegments: string[] = [];

  for (const seg of rawSegments) {
    if (seg === ".." || seg === ".") {
      throw new Error("INVALID_STORAGE_PATH: Folder path attempts traversal");
    }
    const cleanSeg = seg.replace(/[^a-zA-Z0-9-_]/g, "");
    if (!cleanSeg) {
      throw new Error("INVALID_STORAGE_PATH: Folder path contains invalid segment characters");
    }
    safeSegments.push(cleanSeg);
  }

  const safeFolder = safeSegments.length > 0 ? safeSegments.join("/") : "general";
  const targetDir = path.resolve(UPLOAD_DIR, ...safeSegments);

  if (!targetDir.startsWith(UPLOAD_DIR + path.sep) && targetDir !== UPLOAD_DIR) {
    throw new Error("INVALID_STORAGE_PATH: Folder path attempts traversal");
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const cleanFilename = path.basename(storedFilename);
  const filePath = path.resolve(targetDir, cleanFilename);
  if (!filePath.startsWith(targetDir + path.sep)) {
    throw new Error("INVALID_STORAGE_PATH: Target file attempts traversal");
  }
  fs.writeFileSync(filePath, buffer);

  return {
    url: `/uploads/${safeFolder}/${cleanFilename}`,
    storageKey: `${safeFolder}/${cleanFilename}`,
    size,
    mimeType,
    originalName: originalFilename,
  };
}

/**
 * Deletes a file from storage by its storageKey
 */
export async function deleteFile(storageKey: string): Promise<boolean> {
  if (storageKey.includes("\0") || storageKey.includes("..")) {
    throw new Error("INVALID_STORAGE_PATH: Attempted path traversal in deleteFile");
  }

  const localPath = path.resolve(UPLOAD_DIR, storageKey);
  if (!localPath.startsWith(UPLOAD_DIR + path.sep) && localPath !== UPLOAD_DIR) {
    throw new Error("INVALID_STORAGE_PATH: Attempted path traversal in deleteFile");
  }

  try {
    if (STORAGE_PROVIDER === "s3" && s3Client) {
      const bucket = process.env.S3_BUCKET || "mangacms";
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: storageKey,
        })
      );
      return true;
    }

    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      return true;
    }
  } catch (err) {
    console.error("Failed to delete file:", err);
  }
  return false;
}

/**
 * Extracts a chapter ZIP archive, filters images, sorts them naturally,
 * and saves them using the active storage provider.
 * Protects against zip bombs, zip-slip, and memory exhaustion.
 */
export async function extractAndSaveZip(
  zipBuffer: Buffer,
  folderPrefix: string
): Promise<ZipExtractionReport> {
  const MAX_ZIP_ENTRIES = 1000;
  const MAX_TOTAL_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // 500MB
  const MAX_COMPRESSION_RATIO = 100;

  const zip = new AdmZip(zipBuffer);
  const zipEntries = zip.getEntries();

  if (zipEntries.length > MAX_ZIP_ENTRIES) {
    throw new Error(`ZIP_BOMB_DETECTED: Archive exceeds maximum allowed entry count of ${MAX_ZIP_ENTRIES}`);
  }

  let totalUncompressed = 0;

  for (const entry of zipEntries) {
    // Zip-slip guard
    if (entry.entryName.includes("..") || entry.entryName.includes("\0")) {
      throw new Error("SECURITY_VIOLATION: Zip entry path contains illegal traversal characters");
    }

    const uncompSize = entry.header?.size ?? 0;
    const compSize = entry.header?.compressedSize ?? 0;

    totalUncompressed += uncompSize;

    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error(`ZIP_BOMB_DETECTED: Archive exceeds maximum uncompressed size of ${MAX_TOTAL_UNCOMPRESSED_BYTES / (1024 * 1024)}MB`);
    }

    if (compSize > 0 && (uncompSize / compSize) > MAX_COMPRESSION_RATIO) {
      throw new Error(`ZIP_BOMB_DETECTED: Compression ratio exceeds safety limit of ${MAX_COMPRESSION_RATIO}x`);
    }
  }

  const validExtensions = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"];
  const skippedFiles: string[] = [];

  // Filter image entries and ignore __MACOSX and hidden files
  const imageEntries = zipEntries.filter((entry) => {
    if (entry.isDirectory) return false;
    const name = entry.name;
    if (name.startsWith(".") || entry.entryName.includes("__MACOSX")) {
      return false;
    }
    const ext = path.extname(name).toLowerCase();
    if (validExtensions.includes(ext)) {
      return true;
    }
    skippedFiles.push(entry.entryName);
    return false;
  });

  if (imageEntries.length === 0) {
    throw new Error("No valid image files found in the provided ZIP archive");
  }

  // Natural alphabetical/numerical sort: page_1, page_2, page_10
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  imageEntries.sort((a, b) => collator.compare(a.name, b.name));

  const pages: ExtractedPageResult[] = [];

  for (let i = 0; i < imageEntries.length; i++) {
    const entry = imageEntries[i];
    const pageNumber = i + 1;
    const buffer = entry.getData();

    if (buffer.length > 50 * 1024 * 1024) {
      throw new Error("FILE_TOO_LARGE: Extracted page image exceeds maximum single page limit of 50MB");
    }

    const stored = await saveFile(buffer, path.basename(entry.name), folderPrefix);

    pages.push({
      pageNumber,
      filename: entry.name,
      url: stored.url,
      storageKey: stored.storageKey,
      size: stored.size,
    });
  }

  return {
    totalPages: pages.length,
    pages,
    skippedFiles,
  };
}
