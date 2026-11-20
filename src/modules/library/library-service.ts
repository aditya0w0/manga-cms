import { getPrisma } from "@/lib/database/prisma";
import { LibraryStatus, ReadingMode, ReadingDirection, ImageScaling, ReaderBg } from "@prisma/client";

export async function recordReadingProgress(
  userId: string,
  mangaId: string,
  chapterId: string,
  pageNumber: number,
  percentRead: number,
  isCompleted = false
) {
  const db = await getPrisma();

  return db.readingHistory.upsert({
    where: {
      userId_mangaId: { userId, mangaId },
    },
    update: {
      chapterId,
      pageNumber,
      percentRead,
      isCompleted,
      lastReadAt: new Date(),
    },
    create: {
      userId,
      mangaId,
      chapterId,
      pageNumber,
      percentRead,
      isCompleted,
      lastReadAt: new Date(),
    },
  });
}

export async function getUserLibrary(userId: string, status?: LibraryStatus) {
  const db = await getPrisma();
  return db.userLibrary.findMany({
    where: {
      userId,
      ...(status ? { status } : {}),
    },
    include: {
      manga: {
        include: {
          genres: { include: { genre: true } },
          chapters: {
            orderBy: { chapterNumber: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function updateLibraryEntry(
  userId: string,
  mangaId: string,
  data: {
    status?: LibraryStatus;
    score?: number;
    isFavorite?: boolean;
    notes?: string;
  }
) {
  const db = await getPrisma();

  return db.userLibrary.upsert({
    where: {
      userId_mangaId: { userId, mangaId },
    },
    update: {
      ...data,
      updatedAt: new Date(),
    },
    create: {
      userId,
      mangaId,
      status: data.status || LibraryStatus.PLAN_TO_READ,
      score: data.score,
      isFavorite: data.isFavorite ?? false,
      notes: data.notes,
    },
  });
}

export async function getUserPreferences(userId: string) {
  const db = await getPrisma();
  let pref = await db.readerPreference.findUnique({
    where: { userId },
  });

  if (!pref) {
    pref = await db.readerPreference.create({
      data: {
        userId,
        readingMode: ReadingMode.VERTICAL_SCROLL,
        readingDirection: ReadingDirection.LTR,
        imageScaling: ImageScaling.FIT_WIDTH,
        backgroundColor: ReaderBg.DARK,
        pageGap: 12,
        preloadCount: 2,
        showPageNumbers: true,
      },
    });
  }

  return pref;
}

export async function saveUserPreferences(
  userId: string,
  data: Partial<{
    readingMode: ReadingMode;
    readingDirection: ReadingDirection;
    imageScaling: ImageScaling;
    backgroundColor: ReaderBg;
    pageGap: number;
    preloadCount: number;
    showPageNumbers: boolean;
    keyboardShortcuts: any;
  }>
) {
  const db = await getPrisma();
  return db.readerPreference.upsert({
    where: { userId },
    update: data,
    create: {
      userId,
      ...data,
    },
  });
}
