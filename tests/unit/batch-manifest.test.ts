import { describe, it, expect } from "vitest";
import { BatchManifestParser } from "@/modules/upload-pipeline/batch-manifest";

describe("BatchManifestParser", () => {
  describe("Metadata text parsing", () => {
    it("parses volume, chapter, and title with standard dashes", () => {
      const res = BatchManifestParser.parseMetadataFromText("Vol. 1 Ch. 01 - The Beginning.zip");
      expect(res.volume).toBe(1);
      expect(res.chapterNumber).toBe(1);
      expect(res.title).toBe("The Beginning");
    });

    it("parses decimal chapter numbers correctly", () => {
      const res = BatchManifestParser.parseMetadataFromText("Chapter 4.5 - Side Story");
      expect(res.chapterNumber).toBe(4.5);
      expect(res.title).toBe("Side Story");
    });

    it("parses short formats like v2_c12_Final", () => {
      const res = BatchManifestParser.parseMetadataFromText("v2_c12 - Final");
      expect(res.volume).toBe(2);
      expect(res.chapterNumber).toBe(12);
      expect(res.title).toBe("Final");
    });

    it("parses standalone numbers as chapter", () => {
      const res = BatchManifestParser.parseMetadataFromText("07.cbz");
      expect(res.chapterNumber).toBe(7);
    });
  });

  describe("Manifest building with fallback regex", () => {
    it("ignores OS junk files and groups images by chapter folder", () => {
      const entries = [
        { path: "__MACOSX/Chapter 1/._01.jpg", size: 100 },
        { path: ".DS_Store", size: 200 },
        { path: "Chapter 1/.DS_Store", size: 200 },
        { path: "Chapter 1/01.jpg", size: 50000 },
        { path: "Chapter 1/02.jpg", size: 60000 },
        { path: "Chapter 2 - Next/01.png", size: 70000 },
        { path: "Thumbs.db", size: 300 },
      ];

      const manifest = BatchManifestParser.buildManifest(entries);

      expect(manifest.hasSchematic).toBe(false);
      expect(manifest.chapters.length).toBe(2);
      expect(manifest.ignoredFiles.length).toBe(4);

      expect(manifest.chapters[0].chapterNumber).toBe(1);
      expect(manifest.chapters[0].fileCount).toBe(2);

      expect(manifest.chapters[1].chapterNumber).toBe(2);
      expect(manifest.chapters[1].title).toBe("Next");
      expect(manifest.chapters[1].fileCount).toBe(1);
    });

    it("detects multi-file standalone archives at root", () => {
      const entries = [
        { path: "Ch.01 - Intro.zip", size: 500000 },
        { path: "Ch.02 - Action.cbz", size: 600000 },
      ];

      const manifest = BatchManifestParser.buildManifest(entries);
      expect(manifest.chapters.length).toBe(2);
      expect(manifest.chapters[0].chapterNumber).toBe(1);
      expect(manifest.chapters[0].title).toBe("Intro");
      expect(manifest.chapters[1].chapterNumber).toBe(2);
      expect(manifest.chapters[1].title).toBe("Action");
    });

    it("detects duplicate chapter warnings", () => {
      const entries = [
        { path: "Release_A_Ch1/01.jpg", size: 1000 },
        { path: "Release_B_Ch1/01.jpg", size: 1000 },
      ];

      const manifest = BatchManifestParser.buildManifest(entries);
      expect(manifest.globalWarnings.some((w) => w.includes("Duplicate chapter number 1"))).toBe(true);
    });
  });

  describe("Manifest building with schematic.json (Priority 1)", () => {
    it("applies schematic mappings over regex guesses", () => {
      const entries = [
        { path: "folder_alpha/01.jpg", size: 1000 },
        { path: "folder_beta/01.jpg", size: 1000 },
      ];

      const schematic = JSON.stringify({
        chapters: [
          { source: "folder_alpha", chapterNumber: 101, title: "Grand Reopening", volume: 5 },
          { source: "folder_beta", chapterNumber: 102, title: "The Revelation", volume: 5 },
        ],
      });

      const manifest = BatchManifestParser.buildManifest(entries, schematic);

      expect(manifest.hasSchematic).toBe(true);
      expect(manifest.chapters.length).toBe(2);
      expect(manifest.chapters[0].chapterNumber).toBe(101);
      expect(manifest.chapters[0].title).toBe("Grand Reopening");
      expect(manifest.chapters[0].volume).toBe(5);

      expect(manifest.chapters[1].chapterNumber).toBe(102);
      expect(manifest.chapters[1].title).toBe("The Revelation");
    });

    it("handles invalid schematic.json gracefully with warnings", () => {
      const entries = [{ path: "Ch 1/01.jpg", size: 1000 }];
      const badSchematic = "{ malformed json }";

      const manifest = BatchManifestParser.buildManifest(entries, badSchematic);
      expect(manifest.hasSchematic).toBe(false);
      expect(manifest.globalWarnings.length).toBeGreaterThan(0);
      expect(manifest.chapters[0].chapterNumber).toBe(1);
    });
  });
});
