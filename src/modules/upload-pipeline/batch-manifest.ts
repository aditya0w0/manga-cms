import { z } from "zod";
import path from "path";

export const ChapterSchematicSchema = z.object({
  source: z.string().min(1, "Source folder or filename is required"),
  chapterNumber: z.number({ message: "chapterNumber is required" }),
  title: z.string().optional(),
  volume: z.number().optional(),
});

export const BatchSchematicSchema = z.object({
  chapters: z.array(ChapterSchematicSchema),
});

export type ChapterSchematic = z.infer<typeof ChapterSchematicSchema>;
export type BatchSchematic = z.infer<typeof BatchSchematicSchema>;

export interface DetectedChapterItem {
  sourceKey: string; // The folder path or filename
  chapterNumber: number;
  volume?: number;
  title?: string;
  fileCount: number;
  totalBytes: number;
  files: string[]; // Relative paths within this chapter
  warnings: string[];
}

export interface BatchManifestParseResult {
  hasSchematic: boolean;
  schematicErrors?: string[];
  chapters: DetectedChapterItem[];
  globalWarnings: string[];
  ignoredFiles: string[];
}

const OS_JUNK_REGEX = /(?:^|\/)(?:\.|__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(?:$|\/)/i;
const ALLOWED_IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const ARCHIVE_EXTS = new Set([".zip", ".cbz"]);

export class BatchManifestParser {
  /**
   * Checks if an archive path is OS metadata or temporary junk.
   */
  static isIgnoredFile(filepath: string): boolean {
    const normalized = filepath.replace(/\\/g, "/");
    if (OS_JUNK_REGEX.test(normalized)) return true;
    const basename = path.basename(normalized);
    if (basename.startsWith(".")) return true;
    return false;
  }

  /**
   * Checks if a file is an acceptable page image.
   */
  static isImageFile(filepath: string): boolean {
    const ext = path.extname(filepath).toLowerCase();
    return ALLOWED_IMAGE_EXTS.has(ext);
  }

  /**
   * Checks if a file is an individual chapter archive (.zip or .cbz).
   */
  static isArchiveFile(filepath: string): boolean {
    const ext = path.extname(filepath).toLowerCase();
    return ARCHIVE_EXTS.has(ext);
  }

  /**
   * Extracts volume, chapterNumber (including decimals like 4.5), and title from folder or file names.
   * Examples:
   *  "Vol. 1 Ch. 01 - The Beginning.zip" -> vol: 1, ch: 1, title: "The Beginning"
   *  "Chapter 4.5 Special" -> ch: 4.5, title: "Special"
   *  "v2_c12_Final" -> vol: 2, ch: 12, title: "Final"
   *  "05" -> ch: 5
   *  "Ch.10 - Awakening" -> ch: 10, title: "Awakening"
   */
  static parseMetadataFromText(text: string): {
    volume?: number;
    chapterNumber?: number;
    title?: string;
  } {
    // Strip archive extension if present
    const cleanText = text.replace(/\.(zip|cbz)$/i, "").trim();

    let volume: number | undefined;
    let chapterNumber: number | undefined;
    let title: string | undefined;

    // 1. Try to find volume (e.g. "Vol. 1", "Vol 02", "v3", "Volume 4")
    const volMatch = cleanText.match(/(?:^|[\s._\-[\]()])(?:vol(?:ume)?|v)[\s._-]*(\d+)/i);
    let textForChapter = cleanText;
    if (volMatch) {
      volume = parseInt(volMatch[1], 10);
      textForChapter = cleanText.replace(volMatch[0], " ").trim();
    }

    // 2. Try to find chapter number (e.g. "Ch. 1", "Ch 02.5", "Chapter 12", "c4")
    const chMatch = textForChapter.match(/(?:^|[\s._\-[\]()])(?:ch(?:apter)?|c)[\s._-]*(\d+(?:\.\d+)?)/i);
    if (chMatch) {
      chapterNumber = parseFloat(chMatch[1]);
    } else {
      // Fallback: look for standalone decimal/integer number at the start or after separator
      const fallbackNumMatch = textForChapter.match(/(?:^|[-_/\s])(\d+(?:\.\d+)?)(?:[-_/\s]|$)/);
      if (fallbackNumMatch) {
        chapterNumber = parseFloat(fallbackNumMatch[1]);
      }
    }

    // 3. Try to extract optional title after separator like " - " or " : "
    const titleMatch = cleanText.match(/(?:[-:\u2013\u2014]\s*)(.+)$/);
    if (titleMatch) {
      const rawTitle = titleMatch[1].trim();
      // Ensure title isn't just metadata like "Vol 1"
      if (!/^(?:vol|ch|chapter|page|\d+)/i.test(rawTitle)) {
        title = rawTitle;
      }
    }

    return { volume, chapterNumber, title };
  }

  /**
   * Parses an optional schematic.json string.
   */
  static parseSchematic(jsonString: string): {
    valid: boolean;
    data?: BatchSchematic;
    errors?: string[];
  } {
    try {
      const parsed = JSON.parse(jsonString);
      const res = BatchSchematicSchema.safeParse(parsed);
      if (res.success) {
        return { valid: true, data: res.data };
      } else {
        return {
          valid: false,
          errors: res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        };
      }
    } catch (err: any) {
      return { valid: false, errors: [`Malformed JSON: ${err.message}`] };
    }
  }

  /**
   * Pure manifest builder from a flat list of entry paths and sizes.
   * Handles both Master Archive (folder structure) and Multi-File selection.
   */
  static buildManifest(
    entries: Array<{ path: string; size: number }>,
    schematicJson?: string
  ): BatchManifestParseResult {
    const globalWarnings: string[] = [];
    const ignoredFiles: string[] = [];
    let hasSchematic = false;
    let schematicData: BatchSchematic | undefined;
    let schematicErrors: string[] | undefined;

    // Check for schematic.json
    if (schematicJson) {
      const parsed = this.parseSchematic(schematicJson);
      if (parsed.valid && parsed.data) {
        hasSchematic = true;
        schematicData = parsed.data;
      } else {
        schematicErrors = parsed.errors;
        globalWarnings.push("Invalid schematic.json detected; falling back to regex auto-detection.");
      }
    }

    // Map source keys to accumulated files
    const chapterGroups = new Map<string, { files: string[]; totalBytes: number }>();

    for (const entry of entries) {
      const normPath = entry.path.replace(/\\/g, "/").replace(/^\/+/, "");
      if (this.isIgnoredFile(normPath)) {
        ignoredFiles.push(normPath);
        continue;
      }

      // Check if it's the schematic.json itself
      if (normPath.endsWith("schematic.json")) {
        continue;
      }

      const segments = normPath.split("/").filter(Boolean);

      if (segments.length === 1) {
        // Top-level file: can be a standalone chapter archive (.zip, .cbz)
        if (this.isArchiveFile(segments[0])) {
          const key = segments[0];
          if (!chapterGroups.has(key)) {
            chapterGroups.set(key, { files: [], totalBytes: 0 });
          }
          const group = chapterGroups.get(key)!;
          group.files.push(normPath);
          group.totalBytes += entry.size;
        } else if (this.isImageFile(segments[0])) {
          // Loose image at root
          const key = "_root";
          if (!chapterGroups.has(key)) {
            chapterGroups.set(key, { files: [], totalBytes: 0 });
          }
          const group = chapterGroups.get(key)!;
          group.files.push(normPath);
          group.totalBytes += entry.size;
        } else {
          ignoredFiles.push(normPath);
        }
      } else {
        // Nested inside directories: determine the chapter folder key.
        // If segments start with a single top-level wrapper folder, normalize it.
        // e.g. "SeriesName/Chapter 01/01.jpg" -> chapter folder is "Chapter 01"
        let chapterFolder = segments[0];
        if (segments.length >= 3 && !this.parseMetadataFromText(segments[0]).chapterNumber) {
          // First segment looks like a series container, use second segment as chapter folder
          chapterFolder = segments[1];
        }

        if (this.isImageFile(normPath) || this.isArchiveFile(normPath)) {
          if (!chapterGroups.has(chapterFolder)) {
            chapterGroups.set(chapterFolder, { files: [], totalBytes: 0 });
          }
          const group = chapterGroups.get(chapterFolder)!;
          group.files.push(normPath);
          group.totalBytes += entry.size;
        } else {
          ignoredFiles.push(normPath);
        }
      }
    }

    // Build detected chapters
    const chapters: DetectedChapterItem[] = [];
    const schematicMap = new Map<string, ChapterSchematic>();
    if (schematicData) {
      for (const ch of schematicData.chapters) {
        schematicMap.set(ch.source.toLowerCase(), ch);
      }
    }

    for (const [sourceKey, group] of Array.from(chapterGroups.entries())) {
      const warnings: string[] = [];

      let chapterNumber: number = 0;
      let volume: number | undefined;
      let title: string | undefined;

      // Check schematic first (Priority 1)
      const matchingSchematic = schematicMap.get(sourceKey.toLowerCase());
      if (matchingSchematic) {
        chapterNumber = matchingSchematic.chapterNumber;
        volume = matchingSchematic.volume;
        title = matchingSchematic.title;
      } else {
        // Fallback to regex parser
        const meta = this.parseMetadataFromText(sourceKey);
        if (meta.chapterNumber !== undefined) {
          chapterNumber = meta.chapterNumber;
        } else {
          warnings.push(`Could not automatically detect chapter number from "${sourceKey}". Please verify manually.`);
        }
        volume = meta.volume;
        title = meta.title;
      }

      if (group.files.length === 0) {
        warnings.push("Folder contains no valid image or archive files.");
      }

      chapters.push({
        sourceKey,
        chapterNumber,
        volume,
        title,
        fileCount: group.files.length,
        totalBytes: group.totalBytes,
        files: group.files,
        warnings,
      });
    }

    // Sort chapters ascending by chapter number
    chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

    // Check for duplicate chapter numbers in batch
    const seenNumbers = new Map<number, string[]>();
    for (const ch of chapters) {
      if (ch.chapterNumber > 0) {
        const existing = seenNumbers.get(ch.chapterNumber) || [];
        existing.push(ch.sourceKey);
        seenNumbers.set(ch.chapterNumber, existing);
      }
    }

    for (const [num, sources] of Array.from(seenNumbers.entries())) {
      if (sources.length > 1) {
        globalWarnings.push(
          `Duplicate chapter number ${num} detected across multiple sources: ${sources.join(", ")}`
        );
        for (const ch of chapters) {
          if (ch.chapterNumber === num) {
            ch.warnings.push(`Duplicate chapter number ${num} in batch.`);
          }
        }
      }
    }

    return {
      hasSchematic,
      schematicErrors,
      chapters,
      globalWarnings,
      ignoredFiles,
    };
  }
}
