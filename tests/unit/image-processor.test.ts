import { describe, it, expect, beforeEach, afterEach } from "vitest";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import os from "os";
import { ImageProcessor } from "@/modules/upload-pipeline/image-processor";
import { LocalDiskStorageAdapter } from "@/modules/storage/storage-adapter";
import { getPrisma } from "@/lib/database/prisma";

describe("Phase 3: Server-Safe Adaptive WebP Image Processor", () => {
  const tempDir = path.join(os.tmpdir(), `image_proc_test_${Date.now()}`);

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

  it("computes deterministic SHA-256 hash before encoding", () => {
    const buf = Buffer.from("test-raw-image-bytes");
    const hash = ImageProcessor.computeSha256(buf);
    expect(hash).toHaveLength(64);
    expect(hash).toBe("c97412f788845d784a7d9f61a3d654410db5d64b29d7ba60b20714a808072aaa");
  });

  it("processes standard page and produces WebP with adaptive presets", async () => {
    // Create a 400x600 PNG in memory
    const rawPng = await sharp({
      create: {
        width: 400,
        height: 600,
        channels: 4,
        background: { r: 50, g: 100, b: 200, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await ImageProcessor.processImage(rawPng, "auto");

    expect(result.isDeduped).toBe(false);
    expect(result.originalWidth).toBe(400);
    expect(result.originalHeight).toBe(600);
    expect(result.slices).toHaveLength(1);

    const slice = result.slices[0];
    expect(slice.width).toBe(400);
    expect(slice.height).toBe(600);
    expect(slice.sliceIndex).toBe(1);
    expect(slice.totalSlices).toBe(1);
    expect(slice.format).toBe("webp");

    // Verify output buffer is a valid WebP image
    const metadata = await sharp(slice.buffer).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(400);
    expect(metadata.height).toBe(600);
  }, 15000);

  it("auto-slices tall manhwa images (> 16,000px) into sequential strips", async () => {
    // Create a tall image (100px x 18,000px)
    const tallImage = await sharp({
      create: {
        width: 100,
        height: 18_000,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    const result = await ImageProcessor.processImage(tallImage, "compact");

    expect(result.isDeduped).toBe(false);
    expect(result.originalHeight).toBe(18_000);

    // 18,000px with 4,000px slices = 5 slices (4000, 4000, 4000, 4000, 2000)
    expect(result.slices).toHaveLength(5);

    let accumulatedHeight = 0;
    for (let i = 0; i < result.slices.length; i++) {
      const slice = result.slices[i];
      expect(slice.sliceIndex).toBe(i + 1);
      expect(slice.totalSlices).toBe(5);
      expect(slice.width).toBe(100);
      expect(slice.height).toBeLessThanOrEqual(4000);
      accumulatedHeight += slice.height;

      // Verify each slice is a readable WebP image
      const meta = await sharp(slice.buffer).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.height).toBe(slice.height);
    }

    expect(accumulatedHeight).toBe(18_000);
  });

  it("stores slices with accurate naming and returns URLs", async () => {
    const storage = new LocalDiskStorageAdapter({
      baseDir: tempDir,
      publicBaseUrl: "/media-test",
    });

    const testBuffer = await sharp({
      create: {
        width: 200,
        height: 300,
        channels: 3,
        background: { r: 120, g: 150, b: 180 },
      },
    })
      .jpeg()
      .toBuffer();

    const procResult = await ImageProcessor.processImage(testBuffer, "lossless");
    const stored = await ImageProcessor.storeSlices({
      slices: procResult.slices,
      storage,
      mangaSlug: "solo-leveling",
      chapterKey: "12",
      pageNumber: 3,
      preset: "lossless",
    });

    expect(stored).toHaveLength(1);
    expect(stored[0].key).toBe("media/solo-leveling/12/page_0003.webp");
    expect(stored[0].publicUrl).toBe("/media-test/media/solo-leveling/12/page_0003.webp");
    expect(stored[0].width).toBe(200);
    expect(stored[0].height).toBe(300);

    const exists = await storage.exists(stored[0].key);
    expect(exists).toBe(true);
  });

  it("reuses cached media on SHA-256 match without re-encoding", async () => {
    const db = await getPrisma();
    const rawBuffer = Buffer.from(`unique-test-image-${Date.now()}-${Math.random()}`);
    const sha256 = ImageProcessor.computeSha256(rawBuffer);

    // Seed an existing Media record with this hash
    const uniqueKey = `media/cached/test-page-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
    await db.media.create({
      data: {
        storageKey: uniqueKey,
        originalFilename: "test.webp",
        mimeType: "image/webp",
        fileSize: 12345,
        width: 800,
        height: 1200,
        checksum: sha256,
        sourceSha256: sha256,
        compressionPreset: "auto",
      },
    });

    const result = await ImageProcessor.processImage(rawBuffer, "auto");
    expect(result.isDeduped).toBe(true);
    expect(result.cachedUrl).toBe(`/api/v1/media/${uniqueKey}`);
    expect(result.originalWidth).toBe(800);
    expect(result.originalHeight).toBe(1200);
    expect(result.slices).toHaveLength(0);
  });
});
