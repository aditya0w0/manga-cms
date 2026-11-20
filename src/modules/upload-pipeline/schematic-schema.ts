import { z } from "zod";

/**
 * Computes a zero-padded, collision-safe sort key matching /^\d{6}\.\d{4}$/.
 * Examples:
 *   "0"     -> "000000.0000"
 *   "1"     -> "000001.0000"
 *   "4.5"   -> "000004.0005"
 *   "12.2"  -> "000012.0002"
 *   "12.10" -> "000012.0010"
 *   "500"   -> "000500.0000"
 */
export function computeSortKey(displayNumber: string | number): string {
  const str = String(displayNumber).trim();
  const match = str.match(/^(\d+)(?:\.(\d+))?$/);

  if (match) {
    const intPart = parseInt(match[1], 10);
    const rawDec = match[2] || "0";
    const decPart = parseInt(rawDec, 10);

    const paddedInt = String(Math.min(intPart, 999999)).padStart(6, "0");
    const paddedDec = String(Math.min(decPart, 9999)).padStart(4, "0");
    return `${paddedInt}.${paddedDec}`;
  }

  // Handle strings with prefixes (e.g. "Ch. 12", "c4.5")
  const embedded = str.match(/(\d+)(?:\.(\d+))?/);
  if (embedded) {
    const intPart = parseInt(embedded[1], 10);
    const rawDec = embedded[2] || "0";
    const decPart = parseInt(rawDec, 10);

    const paddedInt = String(Math.min(intPart, 999999)).padStart(6, "0");
    const paddedDec = String(Math.min(decPart, 9999)).padStart(4, "0");
    return `${paddedInt}.${paddedDec}`;
  }

  // Fallback for special non-numeric extras (e.g. "prologue" -> 0, other extras -> 999999.0001)
  if (/^prologue$/i.test(str)) {
    return "000000.0000";
  }

  return "999999.0001";
}

/**
 * Normalizes relative file and directory paths:
 * 1. Converts backslashes to forward slashes.
 * 2. Applies Unicode NFC normalization (prevents macOS NFD vs Linux NFC mismatch).
 * 3. Strips redundant slashes and dots.
 * 4. Guards against Zip-Slip by blocking leading slashes or ".." path traversal.
 */
export function normalizePath(pathStr: string): string {
  if (!pathStr) return "";

  // 1. NFC normalization
  const nfc = pathStr.normalize("NFC");

  // 2. Convert backslashes to slashes
  const forward = nfc.replace(/\\/g, "/");

  // 3. Split and process path segments
  const segments = forward.split("/").filter((s) => s.length > 0 && s !== ".");

  // Zip-Slip check: reject any segment that is ".."
  for (const seg of segments) {
    if (seg === "..") {
      throw new Error(`Security violation: Path "${pathStr}" contains illegal traversal ("..")`);
    }
  }

  return segments.join("/");
}

/**
 * Natural language page sort: ensures 2.png comes before 10.png.
 */
export function naturalSort(items: string[]): string[] {
  return [...items].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
}

/**
 * Archive safety constraints to guard against zip-bombs and decompression attacks.
 */
export interface ArchiveSafetyLimits {
  maxEntries: number;
  maxSingleFileSize: number;
  maxTotalUncompressedSize: number;
  maxCompressionRatio: number;
  maxDirectoryDepth: number;
}

export const DEFAULT_ARCHIVE_LIMITS: ArchiveSafetyLimits = {
  maxEntries: 100_000,
  maxSingleFileSize: 250 * 1024 * 1024, // 250 MB per file
  maxTotalUncompressedSize: 20 * 1024 * 1024 * 1024, // 20 GB total
  maxCompressionRatio: 100, // Max 100x expansion ratio
  maxDirectoryDepth: 12,
};

// -----------------------------------------------------------------------------
// Zod Schemas for 2-Tier Modular Schematic Architecture
// -----------------------------------------------------------------------------

export const CompressionPresetSchema = z.enum(["lossless", "auto", "compact", "raw"]);
export type CompressionPreset = z.infer<typeof CompressionPresetSchema>;

export const ConflictPolicySchema = z.enum(["skip_existing", "upsert_metadata", "replace_pages"]);
export type ConflictPolicy = z.infer<typeof ConflictPolicySchema>;

export const PageSortSchema = z.enum(["natural", "lexicographical"]);
export type PageSort = z.infer<typeof PageSortSchema>;

export const ChapterErrorStrategySchema = z.enum(["continue", "abort_comic", "abort_batch"]);
export type ChapterErrorStrategy = z.infer<typeof ChapterErrorStrategySchema>;

export const SourceModeSchema = z.enum(["archive", "local_dir", "storage_prefix"]);
export type SourceMode = z.infer<typeof SourceModeSchema>;

/**
 * Individual Chapter Item inside an inline manifest or an ndjson line.
 */
export const ChapterItemSchema = z.object({
  source: z.string().min(1, "source folder or archive filename is required"),
  chapterKey: z.string().min(1, "chapterKey is required"),
  displayNumber: z.string().optional(),
  title: z.string().optional(),
  volume: z.number().int().optional(),
  pages: z.array(z.string()).optional(), // Optional explicit page order
});
export type ChapterItem = z.infer<typeof ChapterItemSchema>;

/**
 * Per-Comic manifest.json (Discriminated Union by chaptersMode).
 */
export const ComicManifestSchema = z.discriminatedUnion("chaptersMode", [
  // 1. NDJSON mode: points to a chapters.ndjson file for streaming large chapter lists
  z.object({
    chaptersMode: z.literal("ndjson"),
    ndjsonPath: z.string().min(1, "ndjsonPath is required"),
  }),
  // 2. Inline mode: explicit array of chapters
  z.object({
    chaptersMode: z.literal("inline"),
    chapters: z.array(ChapterItemSchema).min(1, "chapters array cannot be empty"),
  }),
  // 3. Auto with Overrides: discovers chapters via regex with per-folder overrides
  z.object({
    chaptersMode: z.literal("auto_with_overrides"),
    volumeRegex: z.string().optional(),
    chapterRegex: z.string().optional(),
    titleRegex: z.string().optional(),
    overrides: z
      .record(
        z.string(),
        z.object({
          chapterKey: z.string().optional(),
          displayNumber: z.string().optional(),
          title: z.string().optional(),
          volume: z.number().int().optional(),
          skip: z.boolean().optional(),
        })
      )
      .optional(),
  }),
]);
export type ComicManifest = z.infer<typeof ComicManifestSchema>;

/**
 * Root schematic.json (Multi-Comic Orchestrator).
 */
export const SchematicRootSchema = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  batchId: z.string().min(1, "batchId is required"),
  sourceMode: SourceModeSchema.default("archive"),
  sourceRef: z.string().optional(),
  compressionPreset: CompressionPresetSchema.default("auto"),
  autoPublish: z.boolean().default(true),
  defaults: z
    .object({
      conflictPolicy: ConflictPolicySchema.default("skip_existing"),
      pageSort: PageSortSchema.default("natural"),
      onChapterError: ChapterErrorStrategySchema.default("continue"),
    })
    .default({
      conflictPolicy: "skip_existing",
      pageSort: "natural",
      onChapterError: "continue",
    }),
  comics: z
    .array(
      z.object({
        slug: z.string().min(1, "slug is required"),
        title: z.string().optional(),
        manifestPath: z.string().min(1, "manifestPath is required"),
        createIfMissing: z.boolean().default(true),
        enabled: z.boolean().default(true),
      })
    )
    .min(1, "At least one comic must be declared in schematic"),
});
export type SchematicRoot = z.infer<typeof SchematicRootSchema>;
