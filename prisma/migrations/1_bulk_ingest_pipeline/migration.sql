-- Alter PublicationStatus Enum
DO $$ BEGIN
  ALTER TYPE "PublicationStatus" ADD VALUE IF NOT EXISTS 'INGESTING';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "PublicationStatus" ADD VALUE IF NOT EXISTS 'READY_TO_PUBLISH';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create IngestStatus Enum
DO $$ BEGIN
  CREATE TYPE "IngestStatus" AS ENUM ('PENDING', 'INGESTING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create BatchStatus Enum
DO $$ BEGIN
  CREATE TYPE "BatchStatus" AS ENUM ('UPLOADED', 'SCANNING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create BatchJobStatus Enum
DO $$ BEGIN
  CREATE TYPE "BatchJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create ContentRating Enum
DO $$ BEGIN
  CREATE TYPE "ContentRating" AS ENUM ('SAFE', 'SUGGESTIVE', 'EROTICA', 'EXPLICIT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Alter Manga
ALTER TABLE "Manga" ADD COLUMN IF NOT EXISTS "coverImageId" TEXT;
ALTER TABLE "Manga" ADD COLUMN IF NOT EXISTS "contentRating" "ContentRating" NOT NULL DEFAULT 'SAFE';
ALTER TABLE "Manga" ADD COLUMN IF NOT EXISTS "originalLanguage" TEXT NOT NULL DEFAULT 'ja';
ALTER TABLE "Manga" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Manga" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Alter Chapter
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "chapterKey" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "sortKey" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "ingestStatus" "IngestStatus" NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "volumeNumber" INTEGER;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

CREATE INDEX IF NOT EXISTS "Chapter_mangaId_sortKey_idx" ON "Chapter"("mangaId", "sortKey");
CREATE INDEX IF NOT EXISTS "Chapter_mangaId_chapterKey_idx" ON "Chapter"("mangaId", "chapterKey");
CREATE INDEX IF NOT EXISTS "Chapter_ingestStatus_idx" ON "Chapter"("ingestStatus");

-- Alter ChapterPage
ALTER TABLE "ChapterPage" ADD COLUMN IF NOT EXISTS "sourceSha256" TEXT;
ALTER TABLE "ChapterPage" ADD COLUMN IF NOT EXISTS "compressionPreset" TEXT;
ALTER TABLE "ChapterPage" ADD COLUMN IF NOT EXISTS "imageId" TEXT;

CREATE INDEX IF NOT EXISTS "ChapterPage_sourceSha256_idx" ON "ChapterPage"("sourceSha256");

-- Alter Author
ALTER TABLE "Author" ADD COLUMN IF NOT EXISTS "biography" TEXT;

-- Alter MangaAuthor
ALTER TABLE "MangaAuthor" ADD COLUMN IF NOT EXISTS "authorId" TEXT;
ALTER TABLE "MangaAuthor" ADD COLUMN IF NOT EXISTS "contributionRole" TEXT;

-- Alter AuditLog
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "actorId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "changes" JSONB;

-- Alter Translation
ALTER TABLE "Translation" ADD COLUMN IF NOT EXISTS "languageCode" TEXT;

-- Alter ChapterTranslation
ALTER TABLE "ChapterTranslation" ADD COLUMN IF NOT EXISTS "languageCode" TEXT;
ALTER TABLE "ChapterTranslation" ADD COLUMN IF NOT EXISTS "translatedTitle" TEXT;
ALTER TABLE "ChapterTranslation" ADD COLUMN IF NOT EXISTS "translationStatus" TEXT;
ALTER TABLE "ChapterTranslation" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

-- Alter Media or Create if not exists
CREATE TABLE IF NOT EXISTS "Media" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "storageKey" TEXT NOT NULL UNIQUE,
  "originalFilename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "checksum" TEXT,
  "sourceSha256" TEXT,
  "compressionPreset" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "sourceSha256" TEXT;
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "compressionPreset" TEXT;

CREATE INDEX IF NOT EXISTS "Media_checksum_idx" ON "Media"("checksum");
CREATE INDEX IF NOT EXISTS "Media_sourceSha256_idx" ON "Media"("sourceSha256");
CREATE INDEX IF NOT EXISTS "Media_storageKey_idx" ON "Media"("storageKey");

-- Create ImportBatch Table
CREATE TABLE IF NOT EXISTS "ImportBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL UNIQUE,
  "status" "BatchStatus" NOT NULL DEFAULT 'UPLOADED',
  "sourceMode" TEXT NOT NULL,
  "sourceRef" TEXT,
  "compressionPreset" TEXT NOT NULL DEFAULT 'auto',
  "conflictPolicy" TEXT NOT NULL DEFAULT 'skip_existing',
  "autoPublish" BOOLEAN NOT NULL DEFAULT true,
  "totalComics" INTEGER NOT NULL DEFAULT 0,
  "totalChapters" INTEGER NOT NULL DEFAULT 0,
  "completedChapters" INTEGER NOT NULL DEFAULT 0,
  "failedChapters" INTEGER NOT NULL DEFAULT 0,
  "totalPages" INTEGER NOT NULL DEFAULT 0,
  "processedPages" INTEGER NOT NULL DEFAULT 0,
  "totalInputBytes" BIGINT NOT NULL DEFAULT 0,
  "totalOutputBytes" BIGINT NOT NULL DEFAULT 0,
  "errorSummary" TEXT,
  "createdById" TEXT,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ImportBatch_status_idx" ON "ImportBatch"("status");
CREATE INDEX IF NOT EXISTS "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");

-- Create ImportComicJob Table
CREATE TABLE IF NOT EXISTS "ImportComicJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "mangaId" TEXT,
  "slug" TEXT NOT NULL,
  "manifestJson" JSONB,
  "status" "BatchJobStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "totalChapters" INTEGER NOT NULL DEFAULT 0,
  "completedChapters" INTEGER NOT NULL DEFAULT 0,
  "failedChapters" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportComicJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImportComicJob_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ImportComicJob_batchId_status_idx" ON "ImportComicJob"("batchId", "status");
CREATE INDEX IF NOT EXISTS "ImportComicJob_slug_idx" ON "ImportComicJob"("slug");

-- Create ImportChapterJob Table
CREATE TABLE IF NOT EXISTS "ImportChapterJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "comicJobId" TEXT NOT NULL,
  "mangaId" TEXT NOT NULL,
  "chapterKey" TEXT NOT NULL,
  "displayNumber" TEXT NOT NULL,
  "sortKey" TEXT NOT NULL,
  "volume" INTEGER,
  "title" TEXT,
  "sourcePath" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "explicitPagesJson" JSONB,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "status" "BatchJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lockedAt" TIMESTAMP(3),
  "workerId" TEXT,
  "errorMessage" TEXT,
  "pagesIngested" INTEGER NOT NULL DEFAULT 0,
  "slicesCreated" INTEGER NOT NULL DEFAULT 0,
  "inputBytes" BIGINT NOT NULL DEFAULT 0,
  "outputBytes" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportChapterJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImportChapterJob_comicJobId_fkey" FOREIGN KEY ("comicJobId") REFERENCES "ImportComicJob"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImportChapterJob_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ImportChapterJob_status_lockedAt_idx" ON "ImportChapterJob"("status", "lockedAt");
CREATE INDEX IF NOT EXISTS "ImportChapterJob_batchId_status_idx" ON "ImportChapterJob"("batchId", "status");
CREATE INDEX IF NOT EXISTS "ImportChapterJob_mangaId_idx" ON "ImportChapterJob"("mangaId");
CREATE INDEX IF NOT EXISTS "ImportChapterJob_idempotencyKey_idx" ON "ImportChapterJob"("idempotencyKey");
