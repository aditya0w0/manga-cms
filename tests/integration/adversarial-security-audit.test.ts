import { describe, it, expect, beforeAll, afterAll } from "vitest";
import AdmZip from "adm-zip";
import { getPrisma } from "@/lib/database/prisma";
import { AuthService } from "@/modules/auth/auth-service";
import { MangaCmsService } from "@/modules/manga/manga-cms-service";
import { ChapterCmsService } from "@/modules/chapters/chapter-cms-service";
import { MediaStorageService } from "@/modules/media/media-storage-service";
import { UploadPipelineService } from "@/modules/upload-pipeline/upload-pipeline";
import { ReaderProgressService } from "@/modules/reader/reader-progress-service";
import { saveFile, deleteFile } from "@/lib/storage";
import { Role, PublicationStatus, ContentRating } from "@prisma/client";

describe("Adversarial Security & System Reliability Audit", () => {
  let db: any;
  let adminUser: any;
  let editorUser: any;
  let regularUser: any;

  let mangaA: any;
  let mangaB: any;
  let chapterA: any;
  let chapterB: any;
  let pageA: any;
  let pageB: any;

  // 1x1 valid PNG fixture
  const validPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );

  beforeAll(async () => {
    db = await getPrisma();

    // Setup accounts
    const adminPass = await AuthService.hashPassword("AdminPass123!");
    adminUser = await db.user.upsert({
      where: { email: "sec_admin_audit@mangacms.local" },
      create: {
        email: "sec_admin_audit@mangacms.local",
        username: "sec_admin_audit",
        passwordHash: adminPass,
        role: Role.ADMIN,
      },
      update: { role: Role.ADMIN },
    });

    const editorPass = await AuthService.hashPassword("EditorPass123!");
    editorUser = await db.user.upsert({
      where: { email: "sec_editor_audit@mangacms.local" },
      create: {
        email: "sec_editor_audit@mangacms.local",
        username: "sec_editor_audit",
        passwordHash: editorPass,
        role: Role.EDITOR,
      },
      update: { role: Role.EDITOR },
    });

    const userPass = await AuthService.hashPassword("UserPass123!");
    regularUser = await db.user.upsert({
      where: { email: "sec_user_audit@mangacms.local" },
      create: {
        email: "sec_user_audit@mangacms.local",
        username: "sec_user_audit",
        passwordHash: userPass,
        role: Role.USER,
      },
      update: { role: Role.USER },
    });

    // Create Manga A and Manga B
    mangaA = await MangaCmsService.createManga({
      title: `Series Alpha ${Date.now()}`,
      publicationStatus: PublicationStatus.PUBLISHED,
    }, editorUser.id);

    mangaB = await MangaCmsService.createManga({
      title: `Series Beta ${Date.now()}`,
      publicationStatus: PublicationStatus.PUBLISHED,
    }, editorUser.id);

    chapterA = await ChapterCmsService.createChapter({
      mangaId: mangaA.id,
      chapterNumber: 1,
      publicationStatus: PublicationStatus.DRAFT,
    }, editorUser.id);

    chapterB = await ChapterCmsService.createChapter({
      mangaId: mangaB.id,
      chapterNumber: 1,
      publicationStatus: PublicationStatus.DRAFT,
    }, editorUser.id);

    const mediaA = await MediaStorageService.storeMedia(validPng, "pageA.png", "image/png");
    const mediaB = await MediaStorageService.storeMedia(validPng, "pageB.png", "image/png");

    pageA = await ChapterCmsService.addPage(chapterA.id, mediaA.id, 1, editorUser.id);
    pageB = await ChapterCmsService.addPage(chapterB.id, mediaB.id, 1, editorUser.id);
  });

  afterAll(async () => {
    // Cleanup
    if (mangaA) {
      await db.chapterPage.deleteMany({ where: { chapter: { mangaId: mangaA.id } } });
      await db.chapter.deleteMany({ where: { mangaId: mangaA.id } });
      await db.manga.delete({ where: { id: mangaA.id } }).catch(() => {});
    }
    if (mangaB) {
      await db.chapterPage.deleteMany({ where: { chapter: { mangaId: mangaB.id } } });
      await db.chapter.deleteMany({ where: { mangaId: mangaB.id } });
      await db.manga.delete({ where: { id: mangaB.id } }).catch(() => {});
    }
    await db.user.deleteMany({
      where: {
        email: {
          in: [
            "sec_admin_audit@mangacms.local",
            "sec_editor_audit@mangacms.local",
            "sec_user_audit@mangacms.local",
          ],
        },
      },
    }).catch(() => {});
  });

  // 1. Arbitrary File Upload & Stored XSS Prevention
  it("blocks non-image files, executable extensions, and malicious SVG uploads", async () => {
    // Malicious SVG with JavaScript
    const xssSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>');
    await expect(
      MediaStorageService.storeMedia(xssSvg, "payload.svg", "image/svg+xml")
    ).rejects.toThrow("INVALID_FILE_TYPE");

    // Executable upload
    const fakeExe = Buffer.from("MZ90000FAKEEXEBYTES");
    await expect(
      MediaStorageService.storeMedia(fakeExe, "backdoor.exe", "application/x-msdownload")
    ).rejects.toThrow("INVALID_FILE_TYPE");

    // PHP script upload
    const phpScript = Buffer.from("<?php echo 'pwned'; ?>");
    await expect(
      MediaStorageService.storeMedia(phpScript, "shell.php", "application/x-httpd-php")
    ).rejects.toThrow("INVALID_FILE_TYPE");

    // Corrupted file spoofing a PNG extension
    const corruptedPng = Buffer.from("NOT_A_REAL_PNG_JUST_RANDOM_TEXT_BYTES");
    await expect(
      MediaStorageService.storeMedia(corruptedPng, "fake_image.png", "image/png")
    ).rejects.toThrow("CORRUPTED_OR_INVALID_IMAGE");

    // Empty buffer
    await expect(
      MediaStorageService.storeMedia(Buffer.alloc(0), "empty.jpg", "image/jpeg")
    ).rejects.toThrow("EMPTY_FILE");
  });

  // 2. Cross-Chapter IDOR Page Hijacking Defense
  it("prevents an editor from hijacking or reordering pages across different chapters", async () => {
    // Attacker tries to submit pageB (which belongs to Chapter B) in Chapter A's reorder array
    const maliciousOrder = [
      { pageId: pageB.id, pageNumber: 1 },
    ];

    await expect(
      ChapterCmsService.reorderPages(chapterA.id, maliciousOrder, editorUser.id)
    ).rejects.toThrow("PAGE_CHAPTER_MISMATCH");

    // Verify pageB still belongs to chapterB
    const checkPageB = await db.chapterPage.findUnique({ where: { id: pageB.id } });
    expect(checkPageB?.chapterId).toBe(chapterB.id);
  });

  // 3. Storage Directory Path Traversal Defense
  it("blocks directory traversal attempts in legacy storage helpers", async () => {
    // Attempting to delete outside target directory
    await expect(
      deleteFile("../../../etc/passwd")
    ).rejects.toThrow("INVALID_STORAGE_PATH");

    // Attempting to write outside target directory
    await expect(
      saveFile(Buffer.from("safe"), "test.png", "../../../etc")
    ).rejects.toThrow("INVALID_STORAGE_PATH");
  });

  // 4. Soft-Deleted Slug Collision & Resurrection
  it("allows immediate slug reuse after a manga is soft-deleted without database collisions", async () => {
    const slug = `hero-legend-${Date.now()}`;
    const firstManga = await MangaCmsService.createManga({
      title: "Hero Legend",
      slug,
      publicationStatus: PublicationStatus.PUBLISHED,
    }, editorUser.id);

    expect(firstManga.slug).toBe(slug);

    // Soft delete first manga
    await MangaCmsService.deleteManga(firstManga.id, adminUser.id);

    // Creating second manga with the exact same slug must succeed
    const secondManga = await MangaCmsService.createManga({
      title: "Hero Legend Remake",
      slug,
      publicationStatus: PublicationStatus.PUBLISHED,
    }, editorUser.id);

    expect(secondManga.id).not.toBe(firstManga.id);
    expect(secondManga.slug).toBe(slug);

    // Cleanup
    await db.manga.delete({ where: { id: firstManga.id } });
    await db.manga.delete({ where: { id: secondManga.id } });
  });

  // 5. Reading Progress Integrity & IDOR Defense
  it("validates reading progress bounds and cross-entity relational consistency", async () => {
    // Negative page number
    await expect(
      ReaderProgressService.updateProgress(regularUser.id, mangaA.id, chapterA.id, -1)
    ).rejects.toThrow("INVALID_PAGE_NUMBER");

    // Decimal page number
    await expect(
      ReaderProgressService.updateProgress(regularUser.id, mangaA.id, chapterA.id, 2.5)
    ).rejects.toThrow("INVALID_PAGE_NUMBER");

    // Chapter belongs to Manga B, but mangaId is passed as Manga A
    await expect(
      ReaderProgressService.updateProgress(regularUser.id, mangaA.id, chapterB.id, 1)
    ).rejects.toThrow("INVALID_CHAPTER_REFERENCE");

    // Bookmarking non-existent manga
    await expect(
      ReaderProgressService.toggleBookmark(regularUser.id, "non-existent-manga-id-999")
    ).rejects.toThrow("MANGA_NOT_FOUND");
  });

  // 6. Chapter Input Boundary Defense
  it("rejects negative chapter numbers and invalid inputs", async () => {
    await expect(
      ChapterCmsService.createChapter({
        mangaId: mangaA.id,
        chapterNumber: -5,
      }, editorUser.id)
    ).rejects.toThrow("INVALID_CHAPTER_NUMBER");

    await expect(
      ChapterCmsService.createChapter({
        mangaId: mangaA.id,
        chapterNumber: 2,
        volumeNumber: -1,
      }, editorUser.id)
    ).rejects.toThrow("INVALID_VOLUME_NUMBER");
  });

  // 7. Role Authorization Restrictions
  it("strictly enforces RBAC boundaries against vertical privilege escalation", () => {
    // USER cannot edit or delete
    expect(AuthService.hasPermission(Role.USER, Role.EDITOR)).toBe(false);
    expect(AuthService.hasPermission(Role.USER, Role.ADMIN)).toBe(false);

    // TRANSLATOR cannot publish or delete
    expect(AuthService.hasPermission(Role.TRANSLATOR, Role.ADMIN)).toBe(false);

    // EDITOR cannot publish or delete
    expect(AuthService.hasPermission(Role.EDITOR, Role.ADMIN)).toBe(false);

    // ADMIN can publish and delete
    expect(AuthService.hasPermission(Role.ADMIN, Role.ADMIN)).toBe(true);
  });
});
