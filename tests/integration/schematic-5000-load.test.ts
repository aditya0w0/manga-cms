import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { LocalDirectoryReader } from "@/modules/upload-pipeline/source-reader";
import { SchematicLoader } from "@/modules/upload-pipeline/schematic-loader";
import { BatchQueueService } from "@/modules/upload-pipeline/batch-queue-service";
import { getPrisma } from "@/lib/database/prisma";

describe("Scale Benchmark: 5,000-Chapter Multi-Comic Batch Load Test", () => {
  const TOTAL_COMICS = 50;
  const CHAPTERS_PER_COMIC = 100;
  const EXPECTED_TOTAL_CHAPTERS = TOTAL_COMICS * CHAPTERS_PER_COMIC; // 5,000
  const BATCH_ID = `batch_loadtest_5000_${Date.now()}`;
  const tempDir = path.join(os.tmpdir(), `schematic_5000_bench_${Date.now()}`);

  beforeAll(async () => {
    // 1. Create root temp directory
    fs.mkdirSync(tempDir, { recursive: true });

    // 2. Generate root schematic.json
    const comicsDeclaration = [];

    for (let c = 1; c <= TOTAL_COMICS; c++) {
      const slug = `dummy-load-manga-${String(c).padStart(2, "0")}`;
      const comicDir = path.join(tempDir, slug);
      fs.mkdirSync(comicDir, { recursive: true });

      comicsDeclaration.push({
        slug,
        title: `Dummy Load Manga ${c}`,
        manifestPath: `${slug}/manifest.json`,
        createIfMissing: true,
        enabled: true,
      });

      // Half use inline manifest, half use ndjson streaming manifest
      if (c % 2 === 1) {
        // Mode A: Inline manifest with 100 chapters
        const chapters = [];
        for (let ch = 1; ch <= CHAPTERS_PER_COMIC; ch++) {
          chapters.push({
            source: `dummy_source/ch_${String(ch).padStart(3, "0")}.zip`,
            chapterKey: String(ch),
            displayNumber: String(ch),
            title: `Chapter ${ch}`,
            volume: Math.ceil(ch / 10),
          });
        }

        const manifest = {
          chaptersMode: "inline",
          chapters,
        };

        fs.writeFileSync(
          path.join(comicDir, "manifest.json"),
          JSON.stringify(manifest, null, 2),
          "utf-8"
        );
      } else {
        // Mode B: NDJSON streaming manifest with 100 chapters
        const manifest = {
          chaptersMode: "ndjson",
          ndjsonPath: "chapters.ndjson",
        };

        fs.writeFileSync(
          path.join(comicDir, "manifest.json"),
          JSON.stringify(manifest, null, 2),
          "utf-8"
        );

        const ndjsonLines = [];
        for (let ch = 1; ch <= CHAPTERS_PER_COMIC; ch++) {
          ndjsonLines.push(
            JSON.stringify({
              source: `dummy_source/ch_${String(ch).padStart(3, "0")}.zip`,
              chapterKey: String(ch),
              displayNumber: String(ch),
              title: `Chapter ${ch}`,
              volume: Math.ceil(ch / 10),
            })
          );
        }

        fs.writeFileSync(
          path.join(comicDir, "chapters.ndjson"),
          ndjsonLines.join("\n"),
          "utf-8"
        );
      }
    }

    const rootSchematic = {
      schemaVersion: "1.0",
      batchId: BATCH_ID,
      sourceMode: "local_dir",
      compressionPreset: "auto",
      autoPublish: true,
      defaults: {
        conflictPolicy: "skip_existing",
        pageSort: "natural",
        onChapterError: "continue",
      },
      comics: comicsDeclaration,
    };

    fs.writeFileSync(
      path.join(tempDir, "schematic.json"),
      JSON.stringify(rootSchematic, null, 2),
      "utf-8"
    );
  });

  afterAll(async () => {
    // Clean up database records
    const db = await getPrisma();
    try {
      const batch = await db.importBatch.findUnique({
        where: { batchId: BATCH_ID },
      });
      if (batch) {
        await db.importBatch.delete({
          where: { id: batch.id },
        });
      }

      // Remove created dummy mangas
      await db.manga.deleteMany({
        where: {
          slug: {
            startsWith: "dummy-load-manga-",
          },
        },
      });
    } catch {
      // Ignore cleanup error
    }

    // Clean up temporary disk folder
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("Step 1: Benchmark schematic loading and validation for 5,000 chapters", async () => {
    const memBefore = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    const reader = new LocalDirectoryReader(tempDir);
    const graph = await SchematicLoader.loadBatchGraph(reader);
    await reader.close();

    const durationMs = performance.now() - startTime;
    const memAfter = process.memoryUsage().heapUsed;
    const memDeltaMb = (memAfter - memBefore) / (1024 * 1024);

    const throughput = Math.round((EXPECTED_TOTAL_CHAPTERS / (durationMs / 1000)));

    console.log(`[Load Benchmark] 5,000 Chapters Graph Load Time: ${durationMs.toFixed(2)}ms`);
    console.log(`[Load Benchmark] Parse Throughput: ${throughput} chapters/sec`);
    console.log(`[Load Benchmark] Heap Memory Delta: ${memDeltaMb.toFixed(2)} MB`);

    expect(graph.errors).toEqual([]);
    expect(graph.warnings).toEqual([]);
    expect(graph.totalComics).toBe(TOTAL_COMICS);
    expect(graph.totalChapters).toBe(EXPECTED_TOTAL_CHAPTERS);
    expect(graph.comics.length).toBe(TOTAL_COMICS);

    // Verify sort keys and idempotency keys on sample comics
    const firstComic = graph.comics[0];
    expect(firstComic.chapters.length).toBe(CHAPTERS_PER_COMIC);
    expect(firstComic.chapters[0].chapterKey).toBe("1");
    expect(firstComic.chapters[0].sortKey).toBe("000001.0000");
    expect(firstComic.chapters[0].idempotencyKey).toBe(`${BATCH_ID}:${firstComic.slug}:1:v1`);

    const lastChapter = firstComic.chapters[CHAPTERS_PER_COMIC - 1];
    expect(lastChapter.chapterKey).toBe("100");
    expect(lastChapter.sortKey).toBe("000100.0000");
    expect(lastChapter.idempotencyKey).toBe(`${BATCH_ID}:${firstComic.slug}:100:v1`);

    // Verify duration target: parsing 5,000 chapters must complete in under 5 seconds
    expect(durationMs).toBeLessThan(5000);
  });

  it("Step 2: Benchmark high-throughput database batch creation for 5,000 chapters", async () => {
    const reader = new LocalDirectoryReader(tempDir);
    const graph = await SchematicLoader.loadBatchGraph(reader);
    await reader.close();

    const dbStartTime = performance.now();
    const result = await BatchQueueService.createBatchJobs(graph, `local://${tempDir}`);
    const dbDurationMs = performance.now() - dbStartTime;

    const dbThroughput = Math.round((EXPECTED_TOTAL_CHAPTERS / (dbDurationMs / 1000)));

    console.log(`[DB Benchmark] 5,000 Chapters DB Insertion Time: ${dbDurationMs.toFixed(2)}ms`);
    console.log(`[DB Benchmark] DB Ingestion Throughput: ${dbThroughput} chapters/sec`);

    expect(result.batchId).toBe(BATCH_ID);
    expect(result.totalComics).toBe(TOTAL_COMICS);
    expect(result.totalChapters).toBe(EXPECTED_TOTAL_CHAPTERS);

    // Verify database counts
    const db = await getPrisma();
    const createdBatch = await db.importBatch.findUnique({
      where: { batchId: BATCH_ID },
    });
    expect(createdBatch).not.toBeNull();
    expect(createdBatch!.totalComics).toBe(TOTAL_COMICS);
    expect(createdBatch!.totalChapters).toBe(EXPECTED_TOTAL_CHAPTERS);
    expect(createdBatch!.status).toBe("QUEUED");

    const comicJobsCount = await db.importComicJob.count({
      where: { batchId: createdBatch!.id },
    });
    expect(comicJobsCount).toBe(TOTAL_COMICS);

    const chapterJobsCount = await db.importChapterJob.count({
      where: { batchId: createdBatch!.id },
    });
    expect(chapterJobsCount).toBe(EXPECTED_TOTAL_CHAPTERS);

    // Insertion target: chunked bulk insert of 5,000 rows must finish in under 10 seconds
    expect(dbDurationMs).toBeLessThan(10000);
  });

  it("Step 3: Verify fast pagination and metric retrieval over 5,000-chapter batch", async () => {
    const pageStartTime = performance.now();
    const status = await BatchQueueService.getBatchStatus(BATCH_ID, {
      page: 1,
      limit: 50,
      status: "ALL",
    });
    const pageDurationMs = performance.now() - pageStartTime;

    console.log(`[Query Benchmark] Batch Status & Pagination Query Time: ${pageDurationMs.toFixed(2)}ms`);

    expect(status).not.toBeNull();
    expect(status.counters.totalChapters).toBe(EXPECTED_TOTAL_CHAPTERS);
    expect(status.counters.totalComics).toBe(TOTAL_COMICS);
    expect(status.pagination.total).toBe(EXPECTED_TOTAL_CHAPTERS);
    expect(status.chapterJobs.length).toBe(50);
    expect(status.pagination.totalPages).toBe(100); // 5000 / 50 = 100 pages

    // Query must complete in under 500ms
    expect(pageDurationMs).toBeLessThan(500);
  });
});
