import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import stream from "stream";
import { LocalDiskStorageAdapter, getStorageAdapter } from "@/modules/storage/storage-adapter";

describe("StorageAdapter - LocalDiskStorageAdapter", () => {
  const testBaseDir = "data/test-storage";
  let adapter: LocalDiskStorageAdapter;

  beforeEach(() => {
    adapter = new LocalDiskStorageAdapter({
      baseDir: testBaseDir,
      publicBaseUrl: "/media-test",
    });
  });

  afterEach(() => {
    const fullDir = path.resolve(process.cwd(), testBaseDir);
    if (fs.existsSync(fullDir)) {
      fs.rmSync(fullDir, { recursive: true, force: true });
    }
  });

  it("stores a buffer, verifies existence, reads stream, and deletes object", async () => {
    const key = "staging/test-page-01.webp";
    const data = Buffer.from("fake-webp-binary-content-12345");

    const putRes = await adapter.putObject({
      key,
      body: data,
      contentType: "image/webp",
    });

    expect(putRes.key).toBe(key);
    expect(putRes.byteSize).toBe(data.length);
    expect(putRes.publicUrl).toBe("/media-test/staging/test-page-01.webp");

    const existsBefore = await adapter.exists(key);
    expect(existsBefore).toBe(true);

    const readStream = await adapter.getObjectStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of readStream as stream.Readable) {
      chunks.push(Buffer.from(chunk));
    }
    const readBuffer = Buffer.concat(chunks);
    expect(readBuffer.toString()).toBe("fake-webp-binary-content-12345");

    await adapter.deleteObject(key);
    const existsAfter = await adapter.exists(key);
    expect(existsAfter).toBe(false);
  });

  it("blocks directory traversal attempts attempting to escape storage root", async () => {
    const maliciousKey = "../../../etc/passwd";
    await expect(
      adapter.putObject({
        key: maliciousKey,
        body: Buffer.from("hack"),
        contentType: "text/plain",
      })
    ).rejects.toThrow(/Security violation/);
  });

  it("defaults to local driver when STORAGE_DRIVER is unset or local", () => {
    const storage = getStorageAdapter();
    expect(storage.driver).toBe("local");
  });
});
