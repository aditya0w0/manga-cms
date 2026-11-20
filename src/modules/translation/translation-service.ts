import { getPrisma } from "@/lib/database/prisma";
import { TranslationStatus } from "@prisma/client";

export interface CreateMangaTranslationInput {
  mangaId: string;
  languageCode: string;
  title: string;
  description?: string;
}

export interface CreateChapterTranslationInput {
  chapterId: string;
  languageCode: string;
  translatedTitle: string;
}

export class TranslationService {
  /**
   * Creates or updates a manga translation draft.
   */
  static async upsertMangaTranslation(input: CreateMangaTranslationInput) {
    const db = await getPrisma();
    return db.translation.upsert({
      where: {
        mangaId_languageCode: {
          mangaId: input.mangaId,
          languageCode: input.languageCode.toLowerCase(),
        },
      },
      create: {
        mangaId: input.mangaId,
        languageCode: input.languageCode.toLowerCase(),
        title: input.title,
        description: input.description,
        status: TranslationStatus.DRAFT,
      },
      update: {
        title: input.title,
        description: input.description,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Advances the manga translation workflow.
   * DRAFT -> REVIEW -> APPROVED -> PUBLISHED
   */
  static async advanceMangaTranslationStatus(
    translationId: string,
    targetStatus: TranslationStatus
  ) {
    const db = await getPrisma();
    const current = await db.translation.findUnique({
      where: { id: translationId },
    });
    if (!current) throw new Error("TRANSLATION_NOT_FOUND");

    this.validateTransition(current.status, targetStatus);

    return db.translation.update({
      where: { id: translationId },
      data: { status: targetStatus, updatedAt: new Date() },
    });
  }

  /**
   * Creates or updates a chapter translation.
   */
  static async upsertChapterTranslation(input: CreateChapterTranslationInput) {
    const db = await getPrisma();
    return db.chapterTranslation.upsert({
      where: {
        chapterId_languageCode: {
          chapterId: input.chapterId,
          languageCode: input.languageCode.toLowerCase(),
        },
      },
      create: {
        chapterId: input.chapterId,
        languageCode: input.languageCode.toLowerCase(),
        translatedTitle: input.translatedTitle,
        translationStatus: TranslationStatus.DRAFT,
      },
      update: {
        translatedTitle: input.translatedTitle,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Advances chapter translation workflow.
   * Only APPROVED translations can be PUBLISHED.
   */
  static async advanceChapterTranslationStatus(
    chapterTranslationId: string,
    targetStatus: TranslationStatus
  ) {
    const db = await getPrisma();
    const current = await db.chapterTranslation.findUnique({
      where: { id: chapterTranslationId },
    });
    if (!current) throw new Error("CHAPTER_TRANSLATION_NOT_FOUND");

    this.validateTransition(current.translationStatus, targetStatus);

    return db.chapterTranslation.update({
      where: { id: chapterTranslationId },
      data: {
        translationStatus: targetStatus,
        publishedAt: targetStatus === TranslationStatus.PUBLISHED ? new Date() : current.publishedAt,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Validates state machine rules for translation lifecycle.
   */
  private static validateTransition(from: TranslationStatus, to: TranslationStatus) {
    if (from === to) return;

    if (to === TranslationStatus.PUBLISHED && from !== TranslationStatus.APPROVED) {
      throw new Error(`INVALID_TRANSITION: Cannot publish translation directly from ${from}. Translation must be APPROVED first.`);
    }

    if (from === TranslationStatus.DRAFT && to === TranslationStatus.APPROVED) {
      throw new Error("INVALID_TRANSITION: Translations must enter REVIEW before being APPROVED.");
    }
  }

  /**
   * Lists available translations for a manga.
   */
  static async getMangaTranslations(mangaId: string, includeUnpublished = false) {
    const db = await getPrisma();
    return db.translation.findMany({
      where: {
        mangaId,
        ...(includeUnpublished ? {} : { status: TranslationStatus.PUBLISHED }),
      },
    });
  }

  /**
   * Lists available translations for a chapter.
   */
  static async getChapterTranslations(chapterId: string, includeUnpublished = false) {
    const db = await getPrisma();
    return db.chapterTranslation.findMany({
      where: {
        chapterId,
        ...(includeUnpublished ? {} : { translationStatus: TranslationStatus.PUBLISHED }),
      },
    });
  }
}
