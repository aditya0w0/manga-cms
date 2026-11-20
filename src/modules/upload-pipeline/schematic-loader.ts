import readline from "readline";
import path from "path";
import {
  SchematicRoot,
  SchematicRootSchema,
  ComicManifest,
  ComicManifestSchema,
  ChapterItem,
  ChapterItemSchema,
  computeSortKey,
  naturalSort,
  normalizePath,
} from "./schematic-schema";
import { SourceReader, SourceEntry } from "./source-reader";
import { BatchManifestParser } from "./batch-manifest";

export interface NormalizedChapterJobInput {
  chapterKey: string;
  displayNumber: string;
  sortKey: string;
  volume?: number;
  title?: string;
  sourcePath: string;
  sourceType: "directory" | "cbz" | "zip";
  explicitPages?: string[];
  idempotencyKey: string;
}

export interface NormalizedComicJobInput {
  slug: string;
  title?: string;
  manifestJson: Record<string, unknown>;
  chapters: NormalizedChapterJobInput[];
}

export interface ParsedBatchGraph {
  schematic: SchematicRoot;
  comics: NormalizedComicJobInput[];
  totalComics: number;
  totalChapters: number;
  warnings: string[];
  errors: string[];
}

export class SchematicLoader {
  /**
   * Loads and validates the batch graph from any SourceReader.
   * Handles 2-tier schematic.json + manifest.json/ndjson, with automatic fallback for single-comic archives.
   */
  static async loadBatchGraph(
    reader: SourceReader,
    options?: {
      fallbackSlug?: string;
      fallbackBatchId?: string;
    }
  ): Promise<ParsedBatchGraph> {
    await reader.open();
    const warnings: string[] = [];
    const errors: string[] = [];

    // 1. Check for root schematic.json
    let schematicText = await reader.readText("schematic.json");
    let schematicRootPath = "";

    if (!schematicText) {
      // Check inside single top-level folder if archive was wrapped
      const entries = await reader.listEntries();
      const topLevelSchematic = entries.find(
        (e) => !e.isDirectory && e.path.endsWith("/schematic.json") && e.path.split("/").length === 2
      );
      if (topLevelSchematic) {
        schematicText = await reader.readText(topLevelSchematic.path);
        schematicRootPath = path.dirname(topLevelSchematic.path);
      }
    }

    let schematic: SchematicRoot;

    if (schematicText) {
      // Tier 1: Multi-Comic Root Schematic
      try {
        const rawJson = JSON.parse(schematicText);
        const parsed = SchematicRootSchema.safeParse(rawJson);
        if (!parsed.success) {
          throw new Error(`schematic.json validation failed: ${parsed.error.message}`);
        }
        schematic = parsed.data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to parse root schematic.json: ${msg}`);
        return {
          schematic: {
            schemaVersion: "1.0",
            batchId: options?.fallbackBatchId || `batch_${Date.now()}`,
            sourceMode: reader.mode,
            compressionPreset: "auto",
            autoPublish: true,
            defaults: {
              conflictPolicy: "skip_existing",
              pageSort: "natural",
              onChapterError: "continue",
            },
            comics: [],
          },
          comics: [],
          totalComics: 0,
          totalChapters: 0,
          warnings,
          errors,
        };
      }
    } else {
      // Fallback: Single-Comic archive or directory without root schematic
      const batchId = options?.fallbackBatchId || `batch_${Date.now()}`;
      const slug = options?.fallbackSlug || "imported-comic";

      schematic = {
        schemaVersion: "1.0",
        batchId,
        sourceMode: reader.mode,
        compressionPreset: "auto",
        autoPublish: true,
        defaults: {
          conflictPolicy: "skip_existing",
          pageSort: "natural",
          onChapterError: "continue",
        },
        comics: [
          {
            slug,
            manifestPath: "manifest.json",
            createIfMissing: true,
            enabled: true,
          },
        ],
      };
    }

    // 2. Resolve comics and chapters
    const comics: NormalizedComicJobInput[] = [];
    const allEntries = await reader.listEntries();

    for (const comicDecl of schematic.comics) {
      if (comicDecl.enabled === false) continue;

      const comicManifestRelPath = schematicRootPath
        ? `${schematicRootPath}/${comicDecl.manifestPath}`
        : comicDecl.manifestPath;

      const manifestText = await reader.readText(comicManifestRelPath);
      let comicManifest: ComicManifest;

      if (manifestText) {
        try {
          const raw = JSON.parse(manifestText);
          const parsed = ComicManifestSchema.safeParse(raw);
          if (!parsed.success) {
            throw new Error(`Comic manifest validation failed for ${comicDecl.slug}: ${parsed.error.message}`);
          }
          comicManifest = parsed.data;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Manifest error on comic "${comicDecl.slug}": ${msg}`);
          continue;
        }
      } else {
        // Auto-discovery mode if comic-specific manifest.json is absent
        comicManifest = {
          chaptersMode: "auto_with_overrides",
        };
      }

      // 3. Resolve chapter items
      const rawChapters: ChapterItem[] = [];

      if (comicManifest.chaptersMode === "inline") {
        rawChapters.push(...comicManifest.chapters);
      } else if (comicManifest.chaptersMode === "ndjson") {
        const ndjsonPath = path.dirname(comicManifestRelPath)
          ? `${path.dirname(comicManifestRelPath)}/${comicManifest.ndjsonPath}`
          : comicManifest.ndjsonPath;

        const ndjsonEntry = await reader.findEntry(ndjsonPath);
        if (!ndjsonEntry) {
          errors.push(`Missing ndjson file "${ndjsonPath}" for comic "${comicDecl.slug}"`);
          continue;
        }

        const ndjsonStream = await ndjsonEntry.openStream();
        const rl = readline.createInterface({
          input: ndjsonStream as NodeJS.ReadableStream,
          crlfDelay: Infinity,
        });

        let lineNum = 0;
        for await (const line of rl) {
          lineNum++;
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsedLine = JSON.parse(trimmed);
            const validated = ChapterItemSchema.safeParse(parsedLine);
            if (!validated.success) {
              warnings.push(
                `Line ${lineNum} in ${ndjsonPath} for ${comicDecl.slug} has invalid format: ${validated.error.message}`
              );
            } else {
              rawChapters.push(validated.data);
            }
          } catch {
            warnings.push(`Malformed JSON on line ${lineNum} in ${ndjsonPath}`);
          }
        }
      } else if (comicManifest.chaptersMode === "auto_with_overrides") {
        // Regex discovery using all entries in archive/directory
        const comicPrefix = path.dirname(comicManifestRelPath);
        const candidateEntries = allEntries.filter((e) => {
          if (!comicPrefix || comicPrefix === ".") return true;
          return e.path.startsWith(`${comicPrefix}/`);
        });

        // Group into chapters by folder or archive
        const chapterSourcesMap = new Map<string, { files: string[]; parentMeta?: { volume?: number } }>();

        for (const e of candidateEntries) {
          if (e.isDirectory) continue;
          const subPath = comicPrefix && comicPrefix !== "." ? e.path.slice(comicPrefix.length + 1) : e.path;
          const segments = subPath.split("/").filter(Boolean);

          if (segments.length === 1) {
            // Standalone archive file (.zip, .cbz)
            if (subPath.endsWith(".zip") || subPath.endsWith(".cbz")) {
              if (!chapterSourcesMap.has(subPath)) chapterSourcesMap.set(subPath, { files: [] });
              chapterSourcesMap.get(subPath)!.files.push(e.path);
            }
          } else {
            // Nested inside directory
            let folderKey = segments[0];
            let parentMeta: { volume?: number } | undefined;

            if (segments.length >= 3) {
              const outerMeta = BatchManifestParser.parseMetadataFromText(segments[0]);
              if (!outerMeta.chapterNumber) {
                // Outer segment is a volume or series wrapper
                parentMeta = { volume: outerMeta.volume };
                folderKey = segments[1];
              }
            }

            if (!chapterSourcesMap.has(folderKey)) {
              chapterSourcesMap.set(folderKey, { files: [], parentMeta });
            }
            chapterSourcesMap.get(folderKey)!.files.push(e.path);
          }
        }

        for (const [sourceKey, group] of Array.from(chapterSourcesMap.entries())) {
          const override = comicManifest.overrides?.[sourceKey];
          if (override?.skip) continue;

          const meta = BatchManifestParser.parseMetadataFromText(sourceKey);
          const chNum = override?.displayNumber
            ? parseFloat(override.displayNumber)
            : meta.chapterNumber ?? 1;

          rawChapters.push({
            source: sourceKey,
            chapterKey: override?.chapterKey || String(chNum),
            displayNumber: override?.displayNumber || String(chNum),
            title: override?.title || meta.title,
            volume: override?.volume ?? meta.volume ?? group.parentMeta?.volume,
          });
        }
      }

      // 4. Normalize and sort chapters
      const chapterKeysSeen = new Set<string>();
      const normalizedChapters: NormalizedChapterJobInput[] = [];

      for (const ch of rawChapters) {
        const chapterKey = String(ch.chapterKey).trim();
        if (chapterKeysSeen.has(chapterKey)) {
          warnings.push(`Duplicate chapterKey "${chapterKey}" in comic "${comicDecl.slug}". Skipping duplicate.`);
          continue;
        }
        chapterKeysSeen.add(chapterKey);

        const displayNumber = ch.displayNumber || chapterKey;
        const sortKey = computeSortKey(displayNumber);
        const lowerSource = ch.source.toLowerCase();
        const sourceType: "cbz" | "zip" | "directory" = lowerSource.endsWith(".cbz")
          ? "cbz"
          : lowerSource.endsWith(".zip")
          ? "zip"
          : "directory";

        const sourcePath = schematicRootPath
          ? `${schematicRootPath}/${ch.source}`
          : ch.source;

        normalizedChapters.push({
          chapterKey,
          displayNumber,
          sortKey,
          volume: ch.volume,
          title: ch.title,
          sourcePath: normalizePath(sourcePath),
          sourceType,
          explicitPages: ch.pages ? naturalSort(ch.pages) : undefined,
          idempotencyKey: `${schematic.batchId}:${comicDecl.slug}:${chapterKey}:v1`,
        });
      }

      // Deterministic sort by sortKey ascending
      normalizedChapters.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

      comics.push({
        slug: comicDecl.slug,
        title: comicDecl.title,
        manifestJson: comicManifest as unknown as Record<string, unknown>,
        chapters: normalizedChapters,
      });
    }

    const totalChapters = comics.reduce((acc, c) => acc + c.chapters.length, 0);

    return {
      schematic,
      comics,
      totalComics: comics.length,
      totalChapters,
      warnings,
      errors,
    };
  }
}
