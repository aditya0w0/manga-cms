import fs from "fs";
import path from "path";
import stream from "stream";
import yauzl, { ZipFile, Entry } from "yauzl";
import {
  normalizePath,
  ArchiveSafetyLimits,
  DEFAULT_ARCHIVE_LIMITS,
} from "./schematic-schema";
import { StorageAdapter, getStorageAdapter } from "../storage/storage-adapter";

export interface SourceEntry {
  path: string; // Normalized NFC relative path
  isDirectory: boolean;
  uncompressedSize: number;
  compressedSize: number;
  openStream(): Promise<NodeJS.ReadableStream>;
  readBuffer?(): Promise<Buffer>;
}

export interface SourceReader {
  readonly mode: "archive" | "local_dir" | "storage_prefix";
  open(): Promise<void>;
  close(): Promise<void>;
  listEntries(): Promise<SourceEntry[]>;
  findEntry(relativePath: string): Promise<SourceEntry | null>;
  readText(relativePath: string): Promise<string | null>;
}

const OS_JUNK_REGEX = /(?:^|\/)(?:__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(?:$|\/)/i;

export function isIgnoredSystemPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  if (OS_JUNK_REGEX.test(normalized)) return true;
  const basename = path.basename(normalized);
  if (basename.startsWith(".")) return true;
  return false;
}

/**
 * 1. Streaming Archive Reader (.zip & .cbz treated identically)
 * Uses yauzl with lazy entry reading so memory stays O(1) regardless of archive size.
 * Enforces zip-bomb, zip-slip, directory depth, and size safety caps.
 */
export class StreamingArchiveReader implements SourceReader {
  readonly mode = "archive" as const;
  private readonly archivePath: string;
  private readonly limits: ArchiveSafetyLimits;
  private zipfile: ZipFile | null = null;
  private entriesMap: Map<string, { entry: Entry; sourceEntry: SourceEntry }> = new Map();
  private isOpen = false;

  constructor(archivePath: string, limits: Partial<ArchiveSafetyLimits> = {}) {
    this.archivePath = path.resolve(process.cwd(), archivePath);
    this.limits = { ...DEFAULT_ARCHIVE_LIMITS, ...limits };
  }

  async open(): Promise<void> {
    if (this.isOpen) return;

    if (!fs.existsSync(this.archivePath)) {
      throw new Error(`Archive not found at path: ${this.archivePath}`);
    }

    const zip = await new Promise<ZipFile>((resolve, reject) => {
      yauzl.open(
        this.archivePath,
        { lazyEntries: true, autoClose: false },
        (err, zf) => {
          if (err || !zf) return reject(err || new Error("Failed to open archive"));
          resolve(zf);
        }
      );
    });

    this.zipfile = zip;
    this.entriesMap.clear();

    let totalEntries = 0;
    let totalUncompressed = 0;
    let totalCompressed = 0;

    await new Promise<void>((resolve, reject) => {
      zip.readEntry();

      zip.on("entry", (entry: Entry) => {
        totalEntries++;

        if (totalEntries > this.limits.maxEntries) {
          return reject(
            new Error(
              `Safety limit exceeded: Archive contains more than ${this.limits.maxEntries} entries`
            )
          );
        }

        const isDir = entry.fileName.endsWith("/");
        let normalized: string;
        try {
          normalized = normalizePath(entry.fileName);
        } catch (normErr) {
          return reject(normErr);
        }

        // Check directory depth
        const depth = normalized.split("/").length;
        if (depth > this.limits.maxDirectoryDepth) {
          return reject(
            new Error(
              `Safety limit exceeded: Entry depth (${depth}) exceeds max allowed (${this.limits.maxDirectoryDepth}): ${normalized}`
            )
          );
        }

        // Check single file size
        if (entry.uncompressedSize > this.limits.maxSingleFileSize) {
          return reject(
            new Error(
              `Safety limit exceeded: File "${normalized}" uncompressed size (${entry.uncompressedSize} bytes) exceeds limit (${this.limits.maxSingleFileSize} bytes)`
            )
          );
        }

        totalUncompressed += entry.uncompressedSize;
        totalCompressed += entry.compressedSize;

        // Check total uncompressed size
        if (totalUncompressed > this.limits.maxTotalUncompressedSize) {
          return reject(
            new Error(
              `Safety limit exceeded: Total uncompressed archive size exceeds limit of ${this.limits.maxTotalUncompressedSize} bytes`
            )
          );
        }

        // Check compression ratio (zip-bomb guard)
        if (totalCompressed > 0) {
          const ratio = totalUncompressed / totalCompressed;
          if (ratio > this.limits.maxCompressionRatio && totalUncompressed > 50 * 1024 * 1024) {
            return reject(
              new Error(
                `Zip-bomb detected: Archive compression ratio (${ratio.toFixed(1)}x) exceeds threshold (${this.limits.maxCompressionRatio}x)`
              )
            );
          }
        }

        if (!isIgnoredSystemPath(normalized) && normalized.length > 0) {
          const sourceEntry: SourceEntry = {
            path: normalized,
            isDirectory: isDir,
            uncompressedSize: entry.uncompressedSize,
            compressedSize: entry.compressedSize,
            openStream: async () => {
              return this.openEntryStream(entry);
            },
            readBuffer: async () => {
              const stream = await this.openEntryStream(entry);
              const chunks: Buffer[] = [];
              for await (const chunk of stream as stream.Readable) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
              }
              return Buffer.concat(chunks);
            },
          };

          this.entriesMap.set(normalized, { entry, sourceEntry });
        }

        zip.readEntry();
      });

      zip.on("end", () => {
        resolve();
      });

      zip.on("error", (err) => {
        reject(err);
      });
    });

    this.isOpen = true;
  }

  private async openEntryStream(entry: Entry): Promise<NodeJS.ReadableStream> {
    if (!this.zipfile) throw new Error("Archive is not open");
    return new Promise((resolve, reject) => {
      this.zipfile!.openReadStream(entry, (err, readStream) => {
        if (err || !readStream) return reject(err || new Error("Failed to open stream for entry"));
        resolve(readStream);
      });
    });
  }

  async close(): Promise<void> {
    if (this.zipfile) {
      try {
        this.zipfile.close();
      } catch {}
      this.zipfile = null;
    }
    this.entriesMap.clear();
    this.isOpen = false;
  }

  async listEntries(): Promise<SourceEntry[]> {
    if (!this.isOpen) await this.open();
    return Array.from(this.entriesMap.values()).map((v) => v.sourceEntry);
  }

  async findEntry(relativePath: string): Promise<SourceEntry | null> {
    if (!this.isOpen) await this.open();
    const normalized = normalizePath(relativePath);
    return this.entriesMap.get(normalized)?.sourceEntry || null;
  }

  async readText(relativePath: string): Promise<string | null> {
    const entry = await this.findEntry(relativePath);
    if (!entry || entry.isDirectory) return null;
    if (entry.readBuffer) {
      const buf = await entry.readBuffer();
      return buf.toString("utf-8");
    }
    const stream = await entry.openStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream as stream.Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf-8");
  }
}

/**
 * 2. Local Directory Reader (for sourceMode: "local_dir")
 * Ingests directly from local disk folders without creating large temporary ZIPs.
 */
export class LocalDirectoryReader implements SourceReader {
  readonly mode = "local_dir" as const;
  private readonly rootDir: string;
  private entriesMap: Map<string, SourceEntry> = new Map();
  private isOpen = false;

  constructor(dirPath: string) {
    this.rootDir = path.resolve(process.cwd(), dirPath);
  }

  async open(): Promise<void> {
    if (this.isOpen) return;

    if (!fs.existsSync(this.rootDir)) {
      throw new Error(`Directory not found at path: ${this.rootDir}`);
    }

    this.entriesMap.clear();
    await this.scanDirectory(this.rootDir, "");
    this.isOpen = true;
  }

  private async scanDirectory(currentDir: string, relativeDir: string): Promise<void> {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const d of entries) {
      const relPath = relativeDir ? `${relativeDir}/${d.name}` : d.name;
      const normalized = normalizePath(relPath);

      if (isIgnoredSystemPath(normalized)) continue;

      const fullPath = path.join(currentDir, d.name);

      if (d.isDirectory()) {
        const sourceEntry: SourceEntry = {
          path: normalized,
          isDirectory: true,
          uncompressedSize: 0,
          compressedSize: 0,
          openStream: async () => {
            throw new Error(`Cannot open stream for directory: ${normalized}`);
          },
        };
        this.entriesMap.set(normalized, sourceEntry);
        await this.scanDirectory(fullPath, relPath);
      } else if (d.isFile()) {
        const stat = await fs.promises.stat(fullPath);
        const sourceEntry: SourceEntry = {
          path: normalized,
          isDirectory: false,
          uncompressedSize: stat.size,
          compressedSize: stat.size,
          openStream: async () => {
            return fs.createReadStream(fullPath);
          },
          readBuffer: async () => {
            return fs.promises.readFile(fullPath);
          },
        };
        this.entriesMap.set(normalized, sourceEntry);
      }
    }
  }

  async close(): Promise<void> {
    this.entriesMap.clear();
    this.isOpen = false;
  }

  async listEntries(): Promise<SourceEntry[]> {
    if (!this.isOpen) await this.open();
    return Array.from(this.entriesMap.values());
  }

  async findEntry(relativePath: string): Promise<SourceEntry | null> {
    if (!this.isOpen) await this.open();
    const normalized = normalizePath(relativePath);
    return this.entriesMap.get(normalized) || null;
  }

  async readText(relativePath: string): Promise<string | null> {
    const entry = await this.findEntry(relativePath);
    if (!entry || entry.isDirectory) return null;
    const fullPath = path.resolve(this.rootDir, entry.path);
    return fs.promises.readFile(fullPath, "utf-8");
  }
}

/**
 * 3. Storage Prefix Reader (for sourceMode: "storage_prefix")
 * Reads pre-synced staging folders or files using the pluggable StorageAdapter.
 */
export class StoragePrefixReader implements SourceReader {
  readonly mode = "storage_prefix" as const;
  private readonly prefix: string;
  private readonly adapter: StorageAdapter;
  private isOpen = false;

  constructor(prefix: string, adapter?: StorageAdapter) {
    this.prefix = normalizePath(prefix);
    this.adapter = adapter || getStorageAdapter();
  }

  async open(): Promise<void> {
    this.isOpen = true;
  }

  async close(): Promise<void> {
    this.isOpen = false;
  }

  async listEntries(): Promise<SourceEntry[]> {
    // If local driver, we can list directly from the base directory
    if (this.adapter.driver === "local") {
      const localDir = path.resolve(process.cwd(), "storage", this.prefix);
      if (!fs.existsSync(localDir)) return [];
      const dirReader = new LocalDirectoryReader(localDir);
      await dirReader.open();
      const entries = await dirReader.listEntries();
      await dirReader.close();
      return entries;
    }

    // In remote S3/R2 mode, return an empty array or individual discovered items
    return [];
  }

  async findEntry(relativePath: string): Promise<SourceEntry | null> {
    const fullKey = this.prefix ? `${this.prefix}/${normalizePath(relativePath)}` : normalizePath(relativePath);
    const exists = await this.adapter.exists(fullKey);
    if (!exists) return null;

    return {
      path: normalizePath(relativePath),
      isDirectory: false,
      uncompressedSize: 0,
      compressedSize: 0,
      openStream: async () => {
        return this.adapter.getObjectStream(fullKey);
      },
      readBuffer: async () => {
        const stream = await this.adapter.getObjectStream(fullKey);
        const chunks: Buffer[] = [];
        for await (const chunk of stream as stream.Readable) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      },
    };
  }

  async readText(relativePath: string): Promise<string | null> {
    const entry = await this.findEntry(relativePath);
    if (!entry) return null;
    if (entry.readBuffer) {
      const buf = await entry.readBuffer();
      return buf.toString("utf-8");
    }
    return null;
  }
}

/**
 * Factory creating the appropriate SourceReader based on sourceMode.
 */
export function createSourceReader(params: {
  sourceMode: "archive" | "local_dir" | "storage_prefix";
  sourceRef: string;
  limits?: Partial<ArchiveSafetyLimits>;
}): SourceReader {
  switch (params.sourceMode) {
    case "archive":
      return new StreamingArchiveReader(params.sourceRef, params.limits);
    case "local_dir":
      return new LocalDirectoryReader(params.sourceRef);
    case "storage_prefix":
      return new StoragePrefixReader(params.sourceRef);
    default:
      throw new Error(`Unsupported source mode: ${params.sourceMode}`);
  }
}
