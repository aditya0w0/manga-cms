import { getPrisma } from "@/lib/database/prisma";
import { extractAndSaveZip } from "@/lib/storage";
import { PublicationStatus } from "@prisma/client";

export async function getChapterWithPages(chapterId: string) {
  const db = await getPrisma();

  const chapter = await db.chapter.findUnique({
    where: { id: chapterId },
    include: {
      manga: {
        select: {
          id: true,
          slug: true,
          title: true,
          coverUrl: true,
          publicationStatus: true,
        },
      },
      pages: {
        orderBy: { pageNumber: "asc" },
      },
    },
  });

  if (!chapter) return null;

  // Strict Policy Check: Do not serve chapters of unpublished or quarantined manga
  if (chapter.manga.publicationStatus !== PublicationStatus.PUBLISHED) {
    return null;
  }

  // Fetch adjacent chapters
  const [prevChapter, nextChapter] = await Promise.all([
    db.chapter.findFirst({
      where: {
        mangaId: chapter.mangaId,
        chapterNumber: { lt: chapter.chapterNumber },
        publicationStatus: PublicationStatus.PUBLISHED,
      },
      orderBy: { chapterNumber: "desc" },
      select: { id: true, chapterNumber: true, chapterTitle: true },
    }),
    db.chapter.findFirst({
      where: {
        mangaId: chapter.mangaId,
        chapterNumber: { gt: chapter.chapterNumber },
        publicationStatus: PublicationStatus.PUBLISHED,
      },
      orderBy: { chapterNumber: "asc" },
      select: { id: true, chapterNumber: true, chapterTitle: true },
    }),
  ]);

  // Asynchronously increment view counts
  db.chapter.update({
    where: { id: chapterId },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {});

  db.manga.update({
    where: { id: chapter.mangaId },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {});

  return {
    ...chapter,
    prevChapter,
    nextChapter,
  };
}

export async function processChapterZipUpload(chapterId: string, zipBuffer: Buffer) {
  const db = await getPrisma();
  const chapter = await db.chapter.findUnique({
    where: { id: chapterId },
    include: { manga: true },
  });

  if (!chapter) {
    throw new Error(`Chapter not found: ${chapterId}`);
  }

  const folder = `manga/${chapter.manga.slug}/ch_${chapter.chapterNumber}`;
  const report = await extractAndSaveZip(zipBuffer, folder);

  // Clear existing pages for this chapter in a transaction and insert new pages
  await db.$transaction(async (tx) => {
    await tx.chapterPage.deleteMany({
      where: { chapterId },
    });

    for (const page of report.pages) {
      await tx.chapterPage.create({
        data: {
          chapterId,
          pageNumber: page.pageNumber,
          imageUrl: page.url,
          storageKey: page.storageKey,
          fileSize: page.size,
        },
      });
    }
  });

  return report;
}
