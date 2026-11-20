import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import { StreamingArchiveReader, LocalDirectoryReader } from "@/modules/upload-pipeline/source-reader";
import { SchematicLoader } from "@/modules/upload-pipeline/schematic-loader";

describe("Phase 2: Bulletproof 2-Tier Schematic Parser & Security Guards", () => {
  const tempDir = path.join(os.tmpdir(), `schematic_test_${Date.now()}`);

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("parses 2-tier schematic.json + manifest.json with ndjson streaming", async () => {
    const zip = new AdmZip();

    // 1. Root schematic.json
    const rootSchematic = {
      schemaVersion: "1.0",
      batchId: "batch_test_tier2_001",
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
    zip.addFile("schematic.json", Buffer.from(JSON.stringify(rootSchematic, null, 2)));

    // 2. Comic manifest.json (ndjson mode)
    const comicManifest = {
      chaptersMode: "ndjson",
      ndjsonPath: "chapters.ndjson",
    };
    zip.addFile("solo_leveling/manifest.json", Buffer.from(JSON.stringify(comicManifest, null, 2)));

    // 3. chapters.ndjson lines (out of order to verify deterministic sorting)
    const ndjsonLines = [
      JSON.stringify({ source: "solo_leveling/ch_02", chapterKey: "2", title: "Chapter 2", volume: 1 }),
      JSON.stringify({ source: "solo_leveling/ch_01", chapterKey: "1", title: "Chapter 1", volume: 1 }),
      JSON.stringify({ source: "solo_leveling/ch_02_5", chapterKey: "2.5", title: "Side Story", volume: 1 }),
    ].join("\n");
    zip.addFile("solo_leveling/chapters.ndjson", Buffer.from(ndjsonLines));

    // 4. Sample page files
    zip.addFile("solo_leveling/ch_01/01.png", Buffer.from("png1"));
    zip.addFile("solo_leveling/ch_01/02.png", Buffer.from("png2"));
    zip.addFile("solo_leveling/ch_02/01.png", Buffer.from("png1"));

    const zipPath = path.join(tempDir, "multi_tier_archive.zip");
    zip.writeZip(zipPath);

    const reader = new StreamingArchiveReader(zipPath);
    const graph = await SchematicLoader.loadBatchGraph(reader);
    await reader.close();

    expect(graph.errors).toEqual([]);
    expect(graph.totalComics).toBe(1);
    expect(graph.totalChapters).toBe(3);

    const comic = graph.comics[0];
    expect(comic.slug).toBe("solo-leveling");
    expect(comic.title).toBe("Solo Leveling");

    // Chapters should be deterministically sorted: Ch. 1 (000001.0000), Ch. 2 (000002.0000), Ch. 2.5 (000002.0005)
    expect(comic.chapters[0].chapterKey).toBe("1");
    expect(comic.chapters[0].sortKey).toBe("000001.0000");
    expect(comic.chapters[0].idempotencyKey).toBe("batch_test_tier2_001:solo-leveling:1:v1");

    expect(comic.chapters[1].chapterKey).toBe("2");
    expect(comic.chapters[1].sortKey).toBe("000002.0000");

    expect(comic.chapters[2].chapterKey).toBe("2.5");
    expect(comic.chapters[2].sortKey).toBe("000002.0005");
  });

  it("handles single-comic archive fallback when schematic.json is missing", async () => {
    const zip = new AdmZip();

    // Auto-discoverable folders without schematic.json
    zip.addFile("Vol 1/Ch 01 - The Beginning/01.jpg", Buffer.from("jpg1"));
    zip.addFile("Vol 1/Ch 01 - The Beginning/02.jpg", Buffer.from("jpg2"));
    zip.addFile("Chapter 2 - Awakening/01.jpg", Buffer.from("jpg1"));
    zip.addFile("Chapter 10/01.jpg", Buffer.from("jpg1"));

    // Add OS junk to ensure it is ignored
    zip.addFile("__MACOSX/._dummy", Buffer.from("junk"));
    zip.addFile(".DS_Store", Buffer.from("junk"));

    const zipPath = path.join(tempDir, "fallback_archive.zip");
    zip.writeZip(zipPath);

    const reader = new StreamingArchiveReader(zipPath);
    const graph = await SchematicLoader.loadBatchGraph(reader, {
      fallbackSlug: "tower-of-god",
    });
    await reader.close();

    expect(graph.errors).toEqual([]);
    expect(graph.totalComics).toBe(1);
    expect(graph.totalChapters).toBe(3);

    const comic = graph.comics[0];
    expect(comic.slug).toBe("tower-of-god");

    // Sorted by chapter number ascending: 1, 2, 10
    expect(comic.chapters[0].chapterKey).toBe("1");
    expect(comic.chapters[0].volume).toBe(1);
    expect(comic.chapters[0].title).toBe("The Beginning");

    expect(comic.chapters[1].chapterKey).toBe("2");
    expect(comic.chapters[1].title).toBe("Awakening");

    expect(comic.chapters[2].chapterKey).toBe("10");
  });

  it("enforces archive safety limit guards (maxEntries)", async () => {
    const zip = new AdmZip();
    for (let i = 0; i < 15; i++) {
      zip.addFile(`file_${i}.txt`, Buffer.from("test"));
    }
    const zipPath = path.join(tempDir, "bomb_archive.zip");
    zip.writeZip(zipPath);

    const strictReader = new StreamingArchiveReader(zipPath, {
      maxEntries: 10,
    });

    await expect(strictReader.open()).rejects.toThrow(/Safety limit exceeded: Archive contains more than 10 entries/);
  });

  it("reads from local directory via LocalDirectoryReader without archiving", async () => {
    const localDir = path.join(tempDir, "local_library");
    fs.mkdirSync(path.join(localDir, "Ch 01"), { recursive: true });
    fs.mkdirSync(path.join(localDir, "Ch 02"), { recursive: true });

    fs.writeFileSync(path.join(localDir, "Ch 01", "p1.png"), "page1");
    fs.writeFileSync(path.join(localDir, "Ch 02", "p1.png"), "page2");

    const reader = new LocalDirectoryReader(localDir);
    const graph = await SchematicLoader.loadBatchGraph(reader, {
      fallbackSlug: "local-manga",
    });
    await reader.close();

    expect(graph.totalComics).toBe(1);
    expect(graph.totalChapters).toBe(2);
    expect(graph.comics[0].chapters[0].chapterKey).toBe("1");
    expect(graph.comics[0].chapters[1].chapterKey).toBe("2");
  });
});
