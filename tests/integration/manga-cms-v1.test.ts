import { describe, it, expect, beforeAll, afterAll } from "vitest";
import AdmZip from "adm-zip";
import { getPrisma } from "@/lib/database/prisma";
import { AuthService } from "@/modules/auth/auth-service";
import { MangaCmsService } from "@/modules/manga/manga-cms-service";
import { ChapterCmsService } from "@/modules/chapters/chapter-cms-service";
import { MediaStorageService } from "@/modules/media/media-storage-service";
import { UploadPipelineService } from "@/modules/upload-pipeline/upload-pipeline";
import { TranslationService } from "@/modules/translation/translation-service";
import { Role, PublicationStatus, ContentRating, TranslationStatus } from "@prisma/client";

describe("MangaCMS Self-Hosted REST API & Content Management System v1", () => {
  let db: any;
  let adminUser: any;
  let editorUser: any;
  let translatorUser: any;
  let regularUser: any;
  let testMangaId: string;
  let testMangaSlug: string;
  let testChapterId: string;
  const createdMediaIds: string[] = [];

  // Helper 1x1 transparent PNG buffer
  const samplePng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );

  beforeAll(async () => {
    db = await getPrisma();

    // Setup test users with Argon2id passwords
    const adminPasswordHash = await AuthService.hashPassword("AdminPass123!");
    adminUser = await db.user.upsert({
      where: { email: "cms_admin_test@mangacms.local" },
      create: {
        email: "cms_admin_test@mangacms.local",
        username: "cms_admin_test",
        passwordHash: adminPasswordHash,
        role: Role.ADMIN,
      },
      update: { role: Role.ADMIN, passwordHash: adminPasswordHash },
    });

    const editorPasswordHash = await AuthService.hashPassword("EditorPass123!");
    editorUser = await db.user.upsert({
      where: { email: "cms_editor_test@mangacms.local" },
      create: {
        email: "cms_editor_test@mangacms.local",
        username: "cms_editor_test",
        passwordHash: editorPasswordHash,
        role: Role.EDITOR,
      },
      update: { role: Role.EDITOR, passwordHash: editorPasswordHash },
    });

    const transPasswordHash = await AuthService.hashPassword("TransPass123!");
    translatorUser = await db.user.upsert({
      where: { email: "cms_trans_test@mangacms.local" },
      create: {
        email: "cms_trans_test@mangacms.local",
        username: "cms_trans_test",
        passwordHash: transPasswordHash,
        role: Role.TRANSLATOR,
      },
      update: { role: Role.TRANSLATOR, passwordHash: transPasswordHash },
    });

    const userPasswordHash = await AuthService.hashPassword("UserPass123!");
    regularUser = await db.user.upsert({
      where: { email: "cms_user_test@mangacms.local" },
      create: {
        email: "cms_user_test@mangacms.local",
        username: "cms_user_test",
        passwordHash: userPasswordHash,
        role: Role.USER,
      },
      update: { role: Role.USER, passwordHash: userPasswordHash },
    });
  });

  afterAll(async () => {
    // Clean up created test data
    if (testMangaId) {
      await db.chapterPage.deleteMany({ where: { chapter: { mangaId: testMangaId } } });
      await db.chapterTranslation.deleteMany({ where: { chapter: { mangaId: testMangaId } } });
      await db.chapter.deleteMany({ where: { mangaId: testMangaId } });
      await db.translation.deleteMany({ where: { mangaId: testMangaId } });
      await db.mangaAuthor.deleteMany({ where: { mangaId: testMangaId } });
      await db.mangaGenre.deleteMany({ where: { mangaId: testMangaId } });
      await db.mangaTag.deleteMany({ where: { mangaId: testMangaId } });
      await db.manga.delete({ where: { id: testMangaId } }).catch(() => {});
    }

    for (const mid of createdMediaIds) {
      await MediaStorageService.deleteMedia(mid).catch(() => {});
    }

    await db.user.deleteMany({
      where: {
        email: {
          in: [
            "cms_admin_test@mangacms.local",
            "cms_editor_test@mangacms.local",
            "cms_trans_test@mangacms.local",
            "cms_user_test@mangacms.local",
          ],
        },
      },
    }).catch(() => {});
  });

  // 1. Authentication & Argon2id Password Hashing
  it("enforces Argon2id password hashing and JWT token verification", async () => {
    const rawPassword = "SecurePassword@2026!";
    const hash = await AuthService.hashPassword(rawPassword);

    expect(hash).toContain("$argon2id$");
    expect(await AuthService.verifyPassword(rawPassword, hash)).toBe(true);
    expect(await AuthService.verifyPassword("WrongPassword123", hash)).toBe(false);

    // JWT sign & verify
    const token = AuthService.signToken({
      userId: adminUser.id,
      email: adminUser.email,
      username: adminUser.username,
      role: adminUser.role,
    });
    expect(token).toBeDefined();

    const verified = AuthService.verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(adminUser.id);
    expect(verified?.role).toBe(Role.ADMIN);
  });

  // 2. Role-Based Access Control (RBAC) Matrix
  it("evaluates role hierarchy and access permissions correctly", () => {
    expect(AuthService.hasPermission(Role.SUPER_ADMIN, Role.ADMIN)).toBe(true);
    expect(AuthService.hasPermission(Role.ADMIN, Role.EDITOR)).toBe(true);
    expect(AuthService.hasPermission(Role.EDITOR, Role.TRANSLATOR)).toBe(true);
    expect(AuthService.hasPermission(Role.TRANSLATOR, Role.USER)).toBe(true);
    expect(AuthService.hasPermission(Role.USER, Role.GUEST)).toBe(true);

    // Negative permissions
    expect(AuthService.hasPermission(Role.USER, Role.EDITOR)).toBe(false);
    expect(AuthService.hasPermission(Role.TRANSLATOR, Role.ADMIN)).toBe(false);
    expect(AuthService.hasPermission(Role.EDITOR, Role.ADMIN)).toBe(false);
  });

  // 3. Manga Management (CRUD & Soft Deletion)
  it("creates, updates, and soft-deletes a manga series with internal metadata", async () => {
    const testSlug = `self-hosted-odyssey-${Date.now()}`;
    const manga = await MangaCmsService.createManga(
      {
        title: "Self-Hosted Odyssey",
        slug: testSlug,
        description: "An authentic self-hosted manga managed purely by CMS.",
        contentRating: ContentRating.SAFE,
        publicationStatus: PublicationStatus.PUBLISHED,
        originalLanguage: "ja",
        releaseYear: 2026,
      },
      editorUser.id
    );

    expect(manga.id).toBeDefined();
    expect(manga.slug).toBe(testSlug);
    expect(manga.publicationStatus).toBe(PublicationStatus.PUBLISHED);
    testMangaId = manga.id;
    testMangaSlug = manga.slug;

    // Update manga
    const updated = await MangaCmsService.updateManga(
      manga.id,
      {
        description: "Updated description for Self-Hosted Odyssey.",
        contentRating: ContentRating.SUGGESTIVE,
      },
      editorUser.id
    );
    expect(updated.description).toBe("Updated description for Self-Hosted Odyssey.");
    expect(updated.contentRating).toBe(ContentRating.SUGGESTIVE);

    // Verify retrieval by slug
    const fetched = await MangaCmsService.getMangaBySlug(testSlug);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(manga.id);
  });

  // 4. Chapter Management (Decimal Numbering & Volumes)
  it("supports decimal chapter numbering, volume assignment, and publishing toggle", async () => {
    // Create Chapter 10.5 in Volume 2
    const chapter = await ChapterCmsService.createChapter(
      {
        mangaId: testMangaId,
        chapterNumber: 10.5,
        volumeNumber: 2,
        title: "The Special Interlude",
        slug: "ch-10-5-interlude",
        language: "en",
        publicationStatus: PublicationStatus.DRAFT,
      },
      editorUser.id
    );

    expect(chapter.id).toBeDefined();
    expect(chapter.chapterNumber).toBe(10.5);
    expect(chapter.volumeNumber).toBe(2);
    expect(chapter.publicationStatus).toBe(PublicationStatus.DRAFT);
    testChapterId = chapter.id;

    // Unapproved/Draft chapters are NEVER returned by public navigation
    const publicNavBefore = await ChapterCmsService.getChapterNavigation(chapter.id, false);
    expect(publicNavBefore).toBeNull();

    // Cannot publish chapter without pages
    await expect(ChapterCmsService.publishChapter(chapter.id, adminUser.id)).rejects.toThrow(
      "CANNOT_PUBLISH_EMPTY_CHAPTER"
    );
  });

  // 5. Media Upload, Dimension Extraction & SHA-256 Deduplication
  it("stores media with SHA-256 deduplication and dimension extraction", async () => {
    const media1 = await MediaStorageService.storeMedia(samplePng, "panel_01.png", "image/png");
    createdMediaIds.push(media1.id);

    expect(media1.id).toBeDefined();
    expect(media1.storageKey).toMatch(/^media\/[a-f0-9-]+\.(png|webp)$/);
    expect(media1.width).toBe(1);
    expect(media1.height).toBe(1);
    expect(media1.checksum).toBeDefined();

    // Upload exact same buffer: deduplication must return identical record without redundant file
    const media2 = await MediaStorageService.storeMedia(samplePng, "panel_duplicate.png", "image/png");
    expect(media2.id).toBe(media1.id);
    expect(media2.storageKey).toBe(media1.storageKey);
    expect(media2.checksum).toBe(media1.checksum);
  });

  // 6. Natural Page Sorting & Bulk Image Ingestion
  it("applies deterministic natural sorting to chapter page filenames", async () => {
    // Intentionally out-of-order filenames
    const unsortedUploads = [
      { filename: "page_10.png", buffer: samplePng },
      { filename: "page_1.png", buffer: samplePng },
      { filename: "page_2.png", buffer: samplePng },
      { filename: "page_20.png", buffer: samplePng },
    ];

    const report = await UploadPipelineService.ingestChapterPages(testChapterId, unsortedUploads);

    expect(report.totalPages).toBe(4);
    expect(report.pages[0].pageNumber).toBe(1);
    expect(report.pages[1].pageNumber).toBe(2);
    expect(report.pages[2].pageNumber).toBe(3);
    expect(report.pages[3].pageNumber).toBe(4);

    // Verify deterministic retrieval from DB
    const dbPages = await db.chapterPage.findMany({
      where: { chapterId: testChapterId },
      orderBy: { pageNumber: "asc" },
    });
    expect(dbPages.length).toBe(4);
    expect(dbPages[0].pageNumber).toBe(1);
    expect(dbPages[3].pageNumber).toBe(4);
  });

  // 7. Publishing Workflow & Chapter Navigation
  it("enforces publishing lifecycle and serves public navigation only after publish", async () => {
    // Publish Chapter 10.5 now that it has pages
    const publishedChapter = await ChapterCmsService.publishChapter(testChapterId, adminUser.id);
    expect(publishedChapter.publicationStatus).toBe(PublicationStatus.PUBLISHED);

    // Create Chapter 10.0 (previous) and Chapter 11.0 (next)
    const ch10 = await ChapterCmsService.createChapter(
      {
        mangaId: testMangaId,
        chapterNumber: 10,
        publicationStatus: PublicationStatus.PUBLISHED,
      },
      editorUser.id
    );
    const ch11 = await ChapterCmsService.createChapter(
      {
        mangaId: testMangaId,
        chapterNumber: 11,
        publicationStatus: PublicationStatus.PUBLISHED,
      },
      editorUser.id
    );

    // Now navigation must resolve previous (10) and next (11)
    const nav = await ChapterCmsService.getChapterNavigation(testChapterId, false);
    expect(nav).not.toBeNull();
    expect(nav?.previous?.chapterNumber).toBe(10);
    expect(nav?.next?.chapterNumber).toBe(11);
    expect(nav?.current.chapterNumber).toBe(10.5);

    // Full reader manifest verification
    const manifest = await ChapterCmsService.getReaderManifest(testMangaSlug, testChapterId, false);
    expect(manifest).not.toBeNull();
    expect(manifest?.totalPages).toBe(4);
    expect(manifest?.readingDirection).toBe("VERTICAL");
    expect(manifest?.pages[0].url).toContain("/api/v1/media/");
  });

  // 8. ZIP Extraction Pipeline & Path Traversal (ZipSlip) Protection
  it("safely extracts ZIP archives and blocks malicious path traversal attempts", () => {
    // 1. Valid ZIP
    const validZip = new AdmZip();
    validZip.addFile("page_01.jpg", samplePng);
    validZip.addFile("page_02.jpg", samplePng);
    const validBuffer = validZip.toBuffer();

    const extracted = UploadPipelineService.safeExtractZip(validBuffer);
    expect(extracted.items.length).toBe(2);

    // 2. Malicious ZIP with path traversal
    const evilZip = new AdmZip();
    evilZip.addFile("dummy.jpg", Buffer.from("root:x:0:0"));
    const evilEntries = evilZip.getEntries();
    if (evilEntries[0]) {
      evilEntries[0].entryName = "../evil.jpg";
    }
    const evilBuffer = evilZip.toBuffer();

    expect(() => UploadPipelineService.safeExtractZip(evilBuffer)).toThrow("Path traversal detected");
  });

  // 9. Translation Workflow (DRAFT -> REVIEW -> APPROVED -> PUBLISHED)
  it("enforces translation lifecycle and prevents unauthorized publication", async () => {
    // Create Indonesian translation draft
    const translation = await TranslationService.upsertMangaTranslation({
      mangaId: testMangaId,
      languageCode: "id",
      title: "Pengembaraan Mandiri",
      description: "Terjemahan resmi mandiri",
    });

    expect(translation.status).toBe(TranslationStatus.DRAFT);

    // Direct transition from DRAFT to PUBLISHED must fail
    await expect(
      TranslationService.advanceMangaTranslationStatus(translation.id, TranslationStatus.PUBLISHED)
    ).rejects.toThrow("Cannot publish translation directly from DRAFT");

    // Advance to REVIEW
    const inReview = await TranslationService.advanceMangaTranslationStatus(
      translation.id,
      TranslationStatus.REVIEW
    );
    expect(inReview.status).toBe(TranslationStatus.REVIEW);

    // Advance to APPROVED
    const approved = await TranslationService.advanceMangaTranslationStatus(
      translation.id,
      TranslationStatus.APPROVED
    );
    expect(approved.status).toBe(TranslationStatus.APPROVED);

    // Finally publish
    const published = await TranslationService.advanceMangaTranslationStatus(
      translation.id,
      TranslationStatus.PUBLISHED
    );
    expect(published.status).toBe(TranslationStatus.PUBLISHED);
  });

  // 10. Parametric Discovery, Filtering, and Pagination
  it("filters catalog by content rating, search query, and pagination", async () => {
    const searchResult = await MangaCmsService.queryManga({
      query: "Self-Hosted",
      page: 1,
      limit: 10,
      includeUnpublished: false,
    });

    expect(searchResult.items.length).toBeGreaterThanOrEqual(1);
    expect(searchResult.meta.page).toBe(1);
    expect(searchResult.items.some((m) => m.id === testMangaId)).toBe(true);

    // Verify soft-deleted manga is hidden
    await MangaCmsService.deleteManga(testMangaId, adminUser.id);
    const afterDelete = await MangaCmsService.getMangaBySlug(testMangaSlug);
    expect(afterDelete).toBeNull();
  });
});
