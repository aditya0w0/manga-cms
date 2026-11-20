import { describe, it, expect } from "vitest";
import {
  computeSortKey,
  normalizePath,
  naturalSort,
  SchematicRootSchema,
  ComicManifestSchema,
} from "@/modules/upload-pipeline/schematic-schema";

describe("Schematic Schema & Normalization Utilities", () => {
  describe("computeSortKey", () => {
    it("formats zero-padded sort keys matching /^\\d{6}\\.\\d{4}$/", () => {
      const regex = /^\d{6}\.\d{4}$/;

      expect(computeSortKey("0")).toBe("000000.0000");
      expect(regex.test(computeSortKey("0"))).toBe(true);

      expect(computeSortKey("1")).toBe("000001.0000");
      expect(regex.test(computeSortKey("1"))).toBe(true);

      expect(computeSortKey("4.5")).toBe("000004.0005");
      expect(regex.test(computeSortKey("4.5"))).toBe(true);

      expect(computeSortKey("12.2")).toBe("000012.0002");
      expect(regex.test(computeSortKey("12.2"))).toBe(true);

      expect(computeSortKey("12.10")).toBe("000012.0010");
      expect(regex.test(computeSortKey("12.10"))).toBe(true);

      expect(computeSortKey("500")).toBe("000500.0000");
      expect(regex.test(computeSortKey("500"))).toBe(true);
    });

    it("ensures 12.2 sorts before 12.10", () => {
      const keyA = computeSortKey("12.2");
      const keyB = computeSortKey("12.10");
      expect(keyA < keyB).toBe(true);
    });

    it("handles embedded numbers and special tokens", () => {
      expect(computeSortKey("Ch. 15")).toBe("000015.0000");
      expect(computeSortKey("c4.5")).toBe("000004.0005");
      expect(computeSortKey("prologue")).toBe("000000.0000");
      expect(computeSortKey("extra-content")).toBe("999999.0001");
    });
  });

  describe("normalizePath", () => {
    it("converts backslashes to slashes and applies NFC normalization", () => {
      expect(normalizePath("vol_1\\ch_01\\page_01.png")).toBe("vol_1/ch_01/page_01.png");
      expect(normalizePath("/leading/slash/file.txt")).toBe("leading/slash/file.txt");
    });

    it("rejects path traversal attempts (Zip-Slip guard)", () => {
      expect(() => normalizePath("../secret.txt")).toThrow(/illegal traversal/);
      expect(() => normalizePath("sub/../../secret.txt")).toThrow(/illegal traversal/);
    });
  });

  describe("naturalSort", () => {
    it("sorts page filenames numerically", () => {
      const input = ["10.png", "1.png", "2.png", "20.png", "3.png"];
      const sorted = naturalSort(input);
      expect(sorted).toEqual(["1.png", "2.png", "3.png", "10.png", "20.png"]);
    });
  });

  describe("Zod Validation", () => {
    it("validates valid SchematicRootSchema", () => {
      const validRoot = {
        schemaVersion: "1.0",
        batchId: "batch_20261120_001",
        sourceMode: "archive",
        compressionPreset: "auto",
        autoPublish: true,
        defaults: {
          conflictPolicy: "skip_existing",
          pageSort: "natural",
          onChapterError: "continue",
        },
        comics: [
          {
            slug: "solo-leveling",
            title: "Solo Leveling",
            manifestPath: "solo_leveling/manifest.json",
          },
        ],
      };

      const result = SchematicRootSchema.safeParse(validRoot);
      expect(result.success).toBe(true);
    });

    it("validates discriminated union ComicManifestSchema for ndjson, inline, and auto_with_overrides", () => {
      // NDJSON mode
      const ndjson = ComicManifestSchema.safeParse({
        chaptersMode: "ndjson",
        ndjsonPath: "chapters.ndjson",
      });
      expect(ndjson.success).toBe(true);

      // Inline mode
      const inline = ComicManifestSchema.safeParse({
        chaptersMode: "inline",
        chapters: [
          {
            source: "ch_01",
            chapterKey: "1",
            title: "Awakening",
            volume: 1,
          },
        ],
      });
      expect(inline.success).toBe(true);

      // Auto with overrides mode
      const autoMode = ComicManifestSchema.safeParse({
        chaptersMode: "auto_with_overrides",
        overrides: {
          credits_folder: { skip: true },
        },
      });
      expect(autoMode.success).toBe(true);
    });
  });
});
