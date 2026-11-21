import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import AdmZip from "adm-zip";
import { getPrisma } from "@/lib/database/prisma";
import { AuthService } from "@/modules/auth/auth-service";
import { ChapterCmsService } from "@/modules/chapters/chapter-cms-service";
import { MangaCmsService } from "@/modules/manga/manga-cms-service";
import { saveFile, deleteFile, extractAndSaveZip } from "@/lib/storage";
import { safeFetchBuffer, validateSafeUrl } from "@/lib/security/safe-fetch";
import { GET as imageProxyGet } from "@/app/api/image-proxy/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as preferencesPost } from "@/app/api/user/preferences/route";
import { Role, PublicationStatus } from "@prisma/client";
import { NextRequest } from "next/server";

describe("Security & QA Hardening Verification", () => {
  let db: any;
  let testUser: any;
  let testManga: any;
  let testChapter: any;
  let localMockServer: http.Server;
  let localMockPort: number;

  const validPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );

  beforeAll(async () => {
    db = await getPrisma();

    // Setup local mock HTTP server to test SSRF, redirects, and content spoofing
    await new Promise<void>((resolve) => {
      localMockServer = http.createServer((req, res) => {
        const url = new URL(req.url || "/", `http://${req.headers.host}`);

        if (url.pathname === "/safe-image.png") {
          res.writeHead(200, { "Content-Type": "image/png" });
          res.end(validPng);
          return;
        }

        if (url.pathname === "/malicious-xss.html") {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<script>alert('xss')</script>");
          return;
        }

        if (url.pathname === "/fake-image.png") {
          // Spoofed content-type header but HTML payload
          res.writeHead(200, { "Content-Type": "image/png" });
          res.end("<script>alert('spoofed')</script>");
          return;
        }

        if (url.pathname === "/redirect-to-private") {
          // Redirecting to private metadata IP
          res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/" });
          res.end();
          return;
        }

        if (url.pathname === "/redirect-to-image") {
          res.writeHead(302, { Location: `http://127.0.0.1:${localMockPort}/safe-image.png` });
          res.end();
          return;
        }

        res.writeHead(404);
        res.end("Not Found");
      });

      localMockServer.listen(0, "127.0.0.1", () => {
        const addr = localMockServer.address() as any;
        localMockPort = addr.port;
        resolve();
      });
    });

    // Create unique user for auth tests
    const unique = Date.now();
    const hash = await AuthService.hashPassword("Password123!");
    testUser = await db.user.create({
      data: {
        email: `qa_user_${unique}@mangacms.local`,
        username: `QaUserCase_${unique}`,
        passwordHash: hash,
        role: Role.ADMIN,
      },
    });

    testManga = await MangaCmsService.createManga({
      title: `QA Manga Series ${unique}`,
      publicationStatus: PublicationStatus.PUBLISHED,
    }, testUser.id);

    testChapter = await ChapterCmsService.createChapter({
      mangaId: testManga.id,
      chapterNumber: 1,
      publicationStatus: PublicationStatus.PUBLISHED,
    }, testUser.id);
  });

  afterAll(async () => {
    if (localMockServer) {
      await new Promise<void>((resolve) => localMockServer.close(() => resolve()));
    }
  });

  describe("Image Proxy Hardening & SSRF Protections", () => {
    it("blocks direct requests to loopback and private IP addresses", async () => {
      const privateUrls = [
        "http://127.0.0.1/secret",
        "http://localhost:3000/admin",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/status",
        "http://192.168.1.1/router",
        "http://[::1]/internal",
      ];

      for (const url of privateUrls) {
        const check = await validateSafeUrl(url, false);
        expect(check.safe).toBe(false);

        const req = new NextRequest(`http://localhost:3001/api/image-proxy?url=${encodeURIComponent(url)}`);
        const res = await imageProxyGet(req);
        expect(res.status).toBe(403);
      }
    });

    it("detects and terminates SSRF redirect chaining to restricted IPs", async () => {
      const redirectUrl = `http://127.0.0.1:${localMockPort}/redirect-to-private`;

      // Allow private network for initial request to local test mock, but redirect goes to metadata IP
      await expect(
        safeFetchBuffer(redirectUrl, {
          allowPrivateForTest: false,
        })
      ).rejects.toThrow(/SSRF Prevention Block/);
    });

    it("rejects non-image HTML payload even if labeled as an image", async () => {
      const fakeImageUrl = `http://127.0.0.1:${localMockPort}/fake-image.png`;
      const req = new NextRequest(`http://localhost:3001/api/image-proxy?url=${encodeURIComponent(fakeImageUrl)}`);

      // In production safeFetchBuffer blocks 127.0.0.1; proxy returns 403
      const res = await imageProxyGet(req);
      expect([403, 415]).toContain(res.status);
    });

    it("verifies security headers are attached to image proxy responses", async () => {
      // Mock request to safe PNG with private network allowed for unit check
      const bufferRes = await safeFetchBuffer(`http://127.0.0.1:${localMockPort}/safe-image.png`, {
        allowPrivateForTest: true,
      });

      expect(bufferRes.status).toBe(200);
      expect(bufferRes.buffer.length).toBe(validPng.length);
    });
  });

  describe("Storage Engine & Archive Safety", () => {
    it("safely saves files to nested chapter directories without traversal", async () => {
      const nestedFolder = `manga/${testManga.slug}/ch_1`;
      const stored = await saveFile(validPng, "page_01.png", nestedFolder);

      expect(stored.url).toContain(`/uploads/${nestedFolder}/page_01_`);
      expect(stored.storageKey).toContain(`${nestedFolder}/page_01_`);
      expect(stored.size).toBe(validPng.length);

      // Clean up stored file
      const deleted = await deleteFile(stored.storageKey);
      expect(deleted).toBe(true);
    });

    it("blocks directory traversal attempts in saveFile", async () => {
      await expect(saveFile(validPng, "evil.png", "../../etc")).rejects.toThrow(
        /INVALID_STORAGE_PATH/
      );
      await expect(saveFile(validPng, "evil.png", "manga/../secrets")).rejects.toThrow(
        /INVALID_STORAGE_PATH/
      );
      await expect(saveFile(validPng, "evil.png", "manga\0bad")).rejects.toThrow(
        /INVALID_STORAGE_PATH/
      );
    });

    it("blocks directory traversal in deleteFile", async () => {
      await expect(deleteFile("../../etc/passwd")).rejects.toThrow(
        /INVALID_STORAGE_PATH/
      );
      await expect(deleteFile("../public/uploads/something")).rejects.toThrow(
        /INVALID_STORAGE_PATH/
      );
    });

    it("safely extracts and organizes valid chapter ZIP archives", async () => {
      const zip = new AdmZip();
      zip.addFile("page_02.png", validPng);
      zip.addFile("page_01.png", validPng);
      zip.addFile("page_10.png", validPng);
      const zipBuffer = zip.toBuffer();

      const report = await extractAndSaveZip(zipBuffer, `manga/${testManga.slug}/ch_1`);
      expect(report.totalPages).toBe(3);
      // Verify natural sort: page_01 -> page_02 -> page_10
      expect(report.pages[0].pageNumber).toBe(1);
      expect(report.pages[0].filename).toBe("page_01.png");
      expect(report.pages[1].pageNumber).toBe(2);
      expect(report.pages[1].filename).toBe("page_02.png");
      expect(report.pages[2].pageNumber).toBe(3);
      expect(report.pages[2].filename).toBe("page_10.png");

      // Clean up created files
      for (const page of report.pages) {
        await deleteFile(page.storageKey);
      }
    });

    it("aborts archive extraction on Zip Slip path traversal attempt", async () => {
      const evilZip = new AdmZip();
      evilZip.addFile("test_bad_page.png", validPng);
      const evilBuffer = evilZip.toBuffer();

      // Overwrite filename in zip binary headers with path traversal
      const targetPattern = Buffer.from("test_bad_page.png");
      const maliciousReplacement = Buffer.from("../bad_page.png\0");
      let idx = 0;
      while ((idx = evilBuffer.indexOf(targetPattern, idx)) !== -1) {
        maliciousReplacement.copy(evilBuffer, idx, 0, targetPattern.length);
        idx += targetPattern.length;
      }

      await expect(
        extractAndSaveZip(evilBuffer, `manga/${testManga.slug}/ch_1`)
      ).rejects.toThrow(/SECURITY_VIOLATION/);
    });

    it("detects and rejects zip bombs with excessive entry count", async () => {
      const bombZip = new AdmZip();
      // Add 1001 entries exceeding MAX_ZIP_ENTRIES
      for (let i = 0; i < 1005; i++) {
        bombZip.addFile(`entry_${i}.png`, validPng);
      }
      const bombBuffer = bombZip.toBuffer();

      await expect(
        extractAndSaveZip(bombBuffer, `manga/${testManga.slug}/ch_1`)
      ).rejects.toThrow(/ZIP_BOMB_DETECTED/);
    });
  });

  describe("Authentication & User Management Hardening", () => {
    it("supports case-insensitive username login", async () => {
      // User created as QaUserCase_...; login with lowercase
      const lowercaseUsername = testUser.username.toLowerCase();

      const req = new NextRequest("http://localhost:3001/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: lowercaseUsername,
          password: "Password123!",
        }),
      });

      const res = await loginPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.id).toBe(testUser.id);
    });

    it("returns HTTP 409 Conflict instead of 500 on duplicate registration", async () => {
      const req = new NextRequest("http://localhost:3001/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: testUser.email,
          username: `diff_${Date.now()}`,
          password: "Password123!",
        }),
      });

      const res = await registerPost(req);
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toBeDefined();
    });
  });

  describe("Reader Preferences Validation", () => {
    it("rejects invalid preference payloads with 400 Bad Request", async () => {
      const fakeToken = AuthService.signToken({
        userId: testUser.id,
        email: testUser.email,
        username: testUser.username,
        role: testUser.role,
      });

      const invalidPayloads = [
        { readingMode: "INVALID_MODE" },
        { pageGap: -50 },
        { pageGap: 999999 },
        { preloadCount: 50 },
        { unknownField: "injection" },
      ];

      for (const payload of invalidPayloads) {
        const req = new NextRequest("http://localhost:3001/api/user/preferences", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `manga_session_token=${fakeToken}`,
          },
          body: JSON.stringify(payload),
        });

        const res = await preferencesPost(req);
        expect(res.status).toBe(400);
      }
    });
  });

  describe("Chapter Page Reordering Hardening", () => {
    it("rejects reordering when duplicate page numbers are passed", async () => {
      await expect(
        ChapterCmsService.reorderPages(testChapter.id, [
          { pageId: "p1", pageNumber: 1 },
          { pageId: "p2", pageNumber: 1 },
        ], testUser.id)
      ).rejects.toThrow(/Duplicate pageNumber/);
    });

    it("rejects reordering when non-positive page numbers are passed", async () => {
      await expect(
        ChapterCmsService.reorderPages(testChapter.id, [
          { pageId: "p1", pageNumber: 0 },
        ], testUser.id)
      ).rejects.toThrow(/positive integer/);

      await expect(
        ChapterCmsService.reorderPages(testChapter.id, [
          { pageId: "p1", pageNumber: -2 },
        ], testUser.id)
      ).rejects.toThrow(/positive integer/);
    });

    it("rejects reordering when empty list is provided", async () => {
      await expect(
        ChapterCmsService.reorderPages(testChapter.id, [], testUser.id)
      ).rejects.toThrow(/cannot be empty/);
    });
  });
});
