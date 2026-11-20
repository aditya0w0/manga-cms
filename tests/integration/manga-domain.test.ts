import { describe, it, expect, beforeAll } from "vitest";
import { getMangaList, getMangaBySlug } from "@/modules/manga/manga-service";
import { getChapterWithPages } from "@/modules/chapters/chapter-service";
import { recordReadingProgress, getUserLibrary, updateLibraryEntry } from "@/modules/library/library-service";
import { getPrisma } from "@/lib/database/prisma";
import { LibraryStatus, Role } from "@prisma/client";

describe("Manga Domain & Reading Services Integration", () => {
  let db: any;
  let testUserId: string;

  beforeAll(async () => {
    db = await getPrisma();
    const user = await db.user.findFirst({
      where: { role: Role.USER },
    });
    if (user) {
      testUserId = user.id;
    }
  });

  it("retrieves published manga list with pagination and ordering", async () => {
    const result = await getMangaList({ page: 1, limit: 10, sortBy: "popularity" });
    expect(result).toBeDefined();
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.pagination.total).toBeGreaterThanOrEqual(1);

    const firstManga = result.items[0];
    expect(firstManga.title).toBeDefined();
    expect(firstManga.slug).toBeDefined();
  });

  it("filters manga by search keyword query", async () => {
    const result = await getMangaList({ query: "Solo Leveling" });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items[0].title).toContain("Solo Leveling");
  });

  it("filters manga by genre slug", async () => {
    const result = await getMangaList({ genreSlugs: ["action"] });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    const hasActionGenre = result.items[0].genres.some((g: any) => g.genre.slug === "action");
    expect(hasActionGenre).toBe(true);
  });

  it("retrieves complete manga details by slug with chapters", async () => {
    const manga = await getMangaBySlug("solo-leveling-shadow-monarch");
    expect(manga).not.toBeNull();
    expect(manga?.title).toBe("Solo Leveling: Shadow Monarch");
    expect(manga?.chapters.length).toBeGreaterThanOrEqual(1);
  });

  it("retrieves chapter pages with strict natural order and adjacent chapter linking", async () => {
    const manga = await getMangaBySlug("solo-leveling-shadow-monarch");
    expect(manga).not.toBeNull();

    // Chapter 2 should have both prev (ch 1) and next (ch 3)
    const ch2 = manga!.chapters.find((c: any) => c.chapterNumber === 2);
    expect(ch2).toBeDefined();

    const chapterDetail = await getChapterWithPages(ch2!.id);
    expect(chapterDetail).not.toBeNull();
    expect(chapterDetail?.pages.length).toBeGreaterThanOrEqual(1);

    // Verify natural page sorting
    for (let i = 0; i < chapterDetail!.pages.length - 1; i++) {
      expect(chapterDetail!.pages[i].pageNumber).toBeLessThan(chapterDetail!.pages[i + 1].pageNumber);
    }

    // Verify adjacent chapters
    expect(chapterDetail?.prevChapter).not.toBeNull();
    expect(chapterDetail?.prevChapter?.chapterNumber).toBe(1);
    expect(chapterDetail?.nextChapter).not.toBeNull();
    expect(chapterDetail?.nextChapter?.chapterNumber).toBe(3);
  });

  it("records reading progress and library updates for authenticated user", async () => {
    if (!testUserId) return;

    const manga = await getMangaBySlug("solo-leveling-shadow-monarch");
    expect(manga).not.toBeNull();
    const ch1 = manga!.chapters.find((c: any) => c.chapterNumber === 1);
    expect(ch1).toBeDefined();

    // Update library status
    await updateLibraryEntry(testUserId, manga!.id, { status: LibraryStatus.READING });
    const userLibrary = await getUserLibrary(testUserId, LibraryStatus.READING);
    const entry = userLibrary.find((e: any) => e.mangaId === manga!.id);
    expect(entry).toBeDefined();
    expect(entry?.status).toBe(LibraryStatus.READING);

    // Record reading progress
    const progress = await recordReadingProgress(testUserId, manga!.id, ch1!.id, 2, 66.6, false);
    expect(progress).toBeDefined();
    expect(progress.pageNumber).toBe(2);
    expect(progress.isCompleted).toBe(false);
  });
});
