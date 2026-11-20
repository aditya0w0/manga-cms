import { describe, it, expect, beforeAll, afterAll } from "vitest";
import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import os from "os";
import { getPrisma } from "@/lib/database/prisma";
import { UploadPipelineService } from "@/modules/upload-pipeline/upload-pipeline";
import { BatchManifestParser } from "@/modules/upload-pipeline/batch-manifest";

describe("Batch Chapter Upload Integration", () => {
  let testMangaId: string;
  let tempZipPath: string;

  beforeAll(async () => {
    const db = await getPrisma();
    // Create test manga
    const manga = await db.manga.create({
      data: {
        title: "Batch Upload Test Series",
        slug: `batch-test-${Date.now()}`,
        publicationStatus: "PUBLISHED",
      },
    });
    testMangaId = manga.id;
  });

  afterAll(async () => {
    const db = await getPrisma();
    if (testMangaId) {
      await db.chapterPage.deleteMany({
        where: { chapter: { mangaId: testMangaId } },
      });
      await db.chapter.deleteMany({
        where: { mangaId: testMangaId },
      });
      await db.manga.delete({
        where: { id: testMangaId },
      });
    }

    if (tempZipPath && fs.existsSync(tempZipPath)) {
      try {
        fs.unlinkSync(tempZipPath);
      } catch {}
    }
  });

  it("ingests a multi-chapter master archive using schematic.json and auto-creates chapters", async () => {
    const zip = new AdmZip();

    // 1x1 transparent PNG buffer
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    // Add chapter 1 pages
    zip.addFile("ch01/01.png", png1x1);
    zip.addFile("ch01/02.png", png1x1);

    // Add chapter 2 pages
    zip.addFile("ch02/01.png", png1x1);

    // Add schematic.json
    const schematic = {
      chapters: [
        { source: "ch01", chapterNumber: 1, title: "The Awakening", volume: 1 },
        { source: "ch02", chapterNumber: 2, title: "Second Step", volume: 1 },
      ],
    };
    zip.addFile("schematic.json", Buffer.from(JSON.stringify(schematic)));

    // Save to temp file
    tempZipPath = path.join(os.tmpdir(), `test-master-${Date.now()}.zip`);
    zip.writeZip(tempZipPath);

    // Parse manifest
    const entries = zip.getEntries().map((e) => ({ path: e.entryName, size: e.header.size }));
    const manifestResult = BatchManifestParser.buildManifest(entries, JSON.stringify(schematic));

    expect(manifestResult.hasSchematic).toBe(true);
    expect(manifestResult.chapters.length).toBe(2);

    // Execute batch ingestion
    const report = await UploadPipelineService.ingestMultiChapterMasterArchive(
      testMangaId,
      tempZipPath,
      manifestResult.chapters,
      { conflictStrategy: "SKIP" }
    );

    expect(report.chaptersCreated).toBe(2);
    expect(report.totalPagesIngested).toBe(3);

    // Verify in database
    const db = await getPrisma();
    const chapters = await db.chapter.findMany({
      where: { mangaId: testMangaId },
      orderBy: { chapterNumber: "asc" },
      include: { pages: true },
    });

    expect(chapters.length).toBe(2);
    expect(chapters[0].chapterNumber).toBe(1);
    expect(chapters[0].chapterTitle).toBe("The Awakening");
    expect(chapters[0].pages.length).toBe(2);

    expect(chapters[1].chapterNumber).toBe(2);
    expect(chapters[1].chapterTitle).toBe("Second Step");
    expect(chapters[1].pages.length).toBe(1);
  });

  it("respects SKIP conflict strategy on existing chapters with pages", async () => {
    const zip = new AdmZip();
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    zip.addFile("ch01/01.png", png1x1);

    const zipPath = path.join(os.tmpdir(), `test-skip-${Date.now()}.zip`);
    zip.writeZip(zipPath);

    const report = await UploadPipelineService.ingestMultiChapterMasterArchive(
      testMangaId,
      zipPath,
      [{ sourceKey: "ch01", chapterNumber: 1, files: ["ch01/01.png"] }],
      { conflictStrategy: "SKIP" }
    );

    expect(report.chaptersSkipped).toBe(1);
    expect(report.totalPagesIngested).toBe(0);

    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  });
});
