-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'TRANSLATOR', 'USER', 'GUEST', 'MODERATOR');

-- CreateEnum
CREATE TYPE "ContentRating" AS ENUM ('SAFE', 'SUGGESTIVE', 'MATURE', 'EXPLICIT');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ContributionRole" AS ENUM ('STORY', 'ART', 'STORY_AND_ART', 'TRANSLATOR', 'LETTERER', 'EDITOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ReadingMode" AS ENUM ('VERTICAL_SCROLL', 'SINGLE_PAGE', 'DOUBLE_PAGE', 'WEBTOON');

-- CreateEnum
CREATE TYPE "ReadingDirection" AS ENUM ('LTR', 'RTL', 'VERTICAL');

-- CreateEnum
CREATE TYPE "ImageScaling" AS ENUM ('FIT_WIDTH', 'FIT_HEIGHT', 'ORIGINAL');

-- CreateEnum
CREATE TYPE "ReaderBg" AS ENUM ('DARK', 'BLACK', 'GRAY', 'LIGHT');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'INGESTING', 'READY_TO_PUBLISH', 'PENDING_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IngestStatus" AS ENUM ('PENDING', 'INGESTING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('UPLOADED', 'SCANNING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BatchJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MangaStatus" AS ENUM ('ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('MANGA', 'MANHWA', 'MANHUA', 'COMIC', 'WEBTOON');

-- CreateEnum
CREATE TYPE "LibraryStatus" AS ENUM ('READING', 'COMPLETED', 'ON_HOLD', 'PLAN_TO_READ', 'DROPPED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'S3', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "APIAuthType" AS ENUM ('NONE', 'API_KEY_HEADER', 'API_KEY_QUERY', 'BEARER_TOKEN', 'BASIC', 'CUSTOM_HEADERS');

-- CreateEnum
CREATE TYPE "ProviderHealth" AS ENUM ('HEALTHY', 'DEGRADED', 'FAILING', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('GET', 'POST');

-- CreateEnum
CREATE TYPE "PaginationType" AS ENUM ('PAGE', 'OFFSET', 'CURSOR', 'LINK', 'LIMIT');

-- CreateEnum
CREATE TYPE "MappingEntityType" AS ENUM ('MANGA', 'CHAPTER', 'PAGE');

-- CreateEnum
CREATE TYPE "ImportJobType" AS ENUM ('SINGLE_MANGA', 'BULK_MANGA', 'CHAPTERS', 'FULL_SYNC');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportRecordStatus" AS ENUM ('SUCCESS', 'SKIPPED_DUPLICATE', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReaderPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readingMode" "ReadingMode" NOT NULL DEFAULT 'VERTICAL_SCROLL',
    "readingDirection" "ReadingDirection" NOT NULL DEFAULT 'LTR',
    "imageScaling" "ImageScaling" NOT NULL DEFAULT 'FIT_WIDTH',
    "backgroundColor" "ReaderBg" NOT NULL DEFAULT 'DARK',
    "pageGap" INTEGER NOT NULL DEFAULT 12,
    "preloadCount" INTEGER NOT NULL DEFAULT 2,
    "showPageNumbers" BOOLEAN NOT NULL DEFAULT true,
    "keyboardShortcuts" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manga" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "alternativeTitles" JSONB,
    "description" TEXT,
    "coverImageId" TEXT,
    "coverUrl" TEXT,
    "bannerUrl" TEXT,
    "author" TEXT,
    "artist" TEXT,
    "releaseYear" INTEGER,
    "status" "MangaStatus" NOT NULL DEFAULT 'ONGOING',
    "contentType" "ContentType" NOT NULL DEFAULT 'MANGA',
    "contentRating" "ContentRating" NOT NULL DEFAULT 'SAFE',
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT NOT NULL DEFAULT 'en',
    "originalLanguage" TEXT NOT NULL DEFAULT 'ja',
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'PUBLISHED',
    "scheduledAt" TIMESTAMP(3),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isTrending" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "providerId" TEXT,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Author" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "biography" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MangaAuthor" (
    "id" TEXT NOT NULL,
    "mangaId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "contributionRole" "ContributionRole" NOT NULL DEFAULT 'STORY_AND_ART',

    CONSTRAINT "MangaAuthor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MangaGenre" (
    "mangaId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,

    CONSTRAINT "MangaGenre_pkey" PRIMARY KEY ("mangaId","genreId")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MangaTag" (
    "mangaId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "MangaTag_pkey" PRIMARY KEY ("mangaId","tagId")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "mangaId" TEXT NOT NULL,
    "chapterNumber" DOUBLE PRECISION NOT NULL,
    "volumeNumber" INTEGER,
    "volume" INTEGER,
    "title" TEXT,
    "chapterTitle" TEXT,
    "slug" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "scanlationGroup" TEXT,
    "releaseDate" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publicationStatus" "PublicationStatus" NOT NULL DEFAULT 'PUBLISHED',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "chapterKey" TEXT,
    "sortKey" TEXT,
    "ingestStatus" "IngestStatus" NOT NULL DEFAULT 'COMPLETED',

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterPage" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "imageId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" INTEGER,
    "sourceSha256" TEXT,
    "compressionPreset" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "checksum" TEXT,
    "sourceSha256" TEXT,
    "compressionPreset" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "mangaId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterTranslation" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "translatedTitle" TEXT NOT NULL,
    "translationStatus" "TranslationStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mangaId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mangaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLibrary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mangaId" TEXT NOT NULL,
    "status" "LibraryStatus" NOT NULL DEFAULT 'PLAN_TO_READ',
    "score" DOUBLE PRECISION,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mangaId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL DEFAULT 1,
    "percentRead" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingListItem" (
    "id" TEXT NOT NULL,
    "readingListId" TEXT NOT NULL,
    "mangaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mangaId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT,
    "mangaId" TEXT,
    "chapterId" TEXT,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "moderatorNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "changes" JSONB,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "storageProvider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "hash" TEXT,
    "isOrphan" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "APIProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "baseUrl" TEXT NOT NULL,
    "apiVersion" TEXT,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "authType" "APIAuthType" NOT NULL DEFAULT 'NONE',
    "encryptedCredentials" TEXT,
    "customHeaders" JSONB,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "rateLimitRequests" INTEGER NOT NULL DEFAULT 60,
    "rateLimitWindowSec" INTEGER NOT NULL DEFAULT 60,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "healthStatus" "ProviderHealth" NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APIProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APIEndpoint" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" "HttpMethod" NOT NULL DEFAULT 'GET',
    "urlTemplate" TEXT NOT NULL,
    "queryParams" JSONB,
    "defaultHeaders" JSONB,
    "paginationType" "PaginationType" NOT NULL DEFAULT 'PAGE',
    "paginationConfig" JSONB,
    "cacheTtlSec" INTEGER NOT NULL DEFAULT 300,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APIEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APIFieldMapping" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "entityType" "MappingEntityType" NOT NULL,
    "mappings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "APIFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APIImportJob" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "jobType" "ImportJobType" NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "log" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APIImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APIImportRecord" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "internalMangaId" TEXT,
    "internalChapterId" TEXT,
    "status" "ImportRecordStatus" NOT NULL,
    "errorMessage" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APIImportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APIRequestLog" (
    "id" TEXT NOT NULL,
    "providerId" TEXT,
    "endpointUrl" TEXT NOT NULL,
    "method" "HttpMethod" NOT NULL DEFAULT 'GET',
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "requestHeaders" JSONB,
    "responseSnippet" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APIRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportComicJob" (
    "id" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportComicJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportChapterJob" (
    "id" TEXT NOT NULL,
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
    "idempotencyKey" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportChapterJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderPreference_userId_key" ON "ReaderPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Manga_slug_key" ON "Manga"("slug");

-- CreateIndex
CREATE INDEX "Manga_slug_idx" ON "Manga"("slug");

-- CreateIndex
CREATE INDEX "Manga_title_idx" ON "Manga"("title");

-- CreateIndex
CREATE INDEX "Manga_status_idx" ON "Manga"("status");

-- CreateIndex
CREATE INDEX "Manga_contentType_idx" ON "Manga"("contentType");

-- CreateIndex
CREATE INDEX "Manga_contentRating_idx" ON "Manga"("contentRating");

-- CreateIndex
CREATE INDEX "Manga_publicationStatus_idx" ON "Manga"("publicationStatus");

-- CreateIndex
CREATE INDEX "Manga_isFeatured_idx" ON "Manga"("isFeatured");

-- CreateIndex
CREATE INDEX "Manga_isTrending_idx" ON "Manga"("isTrending");

-- CreateIndex
CREATE INDEX "Manga_rating_idx" ON "Manga"("rating");

-- CreateIndex
CREATE INDEX "Manga_viewCount_idx" ON "Manga"("viewCount");

-- CreateIndex
CREATE INDEX "Manga_deletedAt_idx" ON "Manga"("deletedAt");

-- CreateIndex
CREATE INDEX "Manga_createdAt_idx" ON "Manga"("createdAt");

-- CreateIndex
CREATE INDEX "Manga_updatedAt_idx" ON "Manga"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Manga_providerId_externalId_key" ON "Manga"("providerId", "externalId");

-- CreateIndex
CREATE INDEX "Author_name_idx" ON "Author"("name");

-- CreateIndex
CREATE INDEX "MangaAuthor_mangaId_idx" ON "MangaAuthor"("mangaId");

-- CreateIndex
CREATE INDEX "MangaAuthor_authorId_idx" ON "MangaAuthor"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "MangaAuthor_mangaId_authorId_contributionRole_key" ON "MangaAuthor"("mangaId", "authorId", "contributionRole");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_name_key" ON "Genre"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_slug_key" ON "Genre"("slug");

-- CreateIndex
CREATE INDEX "Genre_slug_idx" ON "Genre"("slug");

-- CreateIndex
CREATE INDEX "MangaGenre_genreId_idx" ON "MangaGenre"("genreId");

-- CreateIndex
CREATE INDEX "MangaGenre_mangaId_idx" ON "MangaGenre"("mangaId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Tag_slug_idx" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "MangaTag_tagId_idx" ON "MangaTag"("tagId");

-- CreateIndex
CREATE INDEX "MangaTag_mangaId_idx" ON "MangaTag"("mangaId");

-- CreateIndex
CREATE INDEX "Chapter_mangaId_idx" ON "Chapter"("mangaId");

-- CreateIndex
CREATE INDEX "Chapter_chapterNumber_idx" ON "Chapter"("chapterNumber");

-- CreateIndex
CREATE INDEX "Chapter_mangaId_sortKey_idx" ON "Chapter"("mangaId", "sortKey");

-- CreateIndex
CREATE INDEX "Chapter_mangaId_chapterKey_idx" ON "Chapter"("mangaId", "chapterKey");

-- CreateIndex
CREATE INDEX "Chapter_ingestStatus_idx" ON "Chapter"("ingestStatus");

-- CreateIndex
CREATE INDEX "Chapter_publicationStatus_idx" ON "Chapter"("publicationStatus");

-- CreateIndex
CREATE INDEX "Chapter_publishedAt_idx" ON "Chapter"("publishedAt");

-- CreateIndex
CREATE INDEX "Chapter_releaseDate_idx" ON "Chapter"("releaseDate");

-- CreateIndex
CREATE INDEX "Chapter_createdAt_idx" ON "Chapter"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_mangaId_chapterNumber_language_key" ON "Chapter"("mangaId", "chapterNumber", "language");

-- CreateIndex
CREATE INDEX "ChapterPage_chapterId_idx" ON "ChapterPage"("chapterId");

-- CreateIndex
CREATE INDEX "ChapterPage_pageNumber_idx" ON "ChapterPage"("pageNumber");

-- CreateIndex
CREATE INDEX "ChapterPage_sourceSha256_idx" ON "ChapterPage"("sourceSha256");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterPage_chapterId_pageNumber_key" ON "ChapterPage"("chapterId", "pageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Media_storageKey_key" ON "Media"("storageKey");

-- CreateIndex
CREATE INDEX "Media_checksum_idx" ON "Media"("checksum");

-- CreateIndex
CREATE INDEX "Media_sourceSha256_idx" ON "Media"("sourceSha256");

-- CreateIndex
CREATE INDEX "Media_storageKey_idx" ON "Media"("storageKey");

-- CreateIndex
CREATE INDEX "Translation_mangaId_idx" ON "Translation"("mangaId");

-- CreateIndex
CREATE INDEX "Translation_status_idx" ON "Translation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_mangaId_languageCode_key" ON "Translation"("mangaId", "languageCode");

-- CreateIndex
CREATE INDEX "ChapterTranslation_chapterId_idx" ON "ChapterTranslation"("chapterId");

-- CreateIndex
CREATE INDEX "ChapterTranslation_translationStatus_idx" ON "ChapterTranslation"("translationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterTranslation_chapterId_languageCode_key" ON "ChapterTranslation"("chapterId", "languageCode");

-- CreateIndex
CREATE INDEX "ReadingProgress_userId_idx" ON "ReadingProgress"("userId");

-- CreateIndex
CREATE INDEX "ReadingProgress_mangaId_idx" ON "ReadingProgress"("mangaId");

-- CreateIndex
CREATE INDEX "ReadingProgress_chapterId_idx" ON "ReadingProgress"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingProgress_userId_mangaId_chapterId_key" ON "ReadingProgress"("userId", "mangaId", "chapterId");

-- CreateIndex
CREATE INDEX "Bookmark_userId_idx" ON "Bookmark"("userId");

-- CreateIndex
CREATE INDEX "Bookmark_mangaId_idx" ON "Bookmark"("mangaId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_mangaId_key" ON "Bookmark"("userId", "mangaId");

-- CreateIndex
CREATE INDEX "UserLibrary_userId_idx" ON "UserLibrary"("userId");

-- CreateIndex
CREATE INDEX "UserLibrary_status_idx" ON "UserLibrary"("status");

-- CreateIndex
CREATE INDEX "UserLibrary_isFavorite_idx" ON "UserLibrary"("isFavorite");

-- CreateIndex
CREATE UNIQUE INDEX "UserLibrary_userId_mangaId_key" ON "UserLibrary"("userId", "mangaId");

-- CreateIndex
CREATE INDEX "ReadingHistory_userId_idx" ON "ReadingHistory"("userId");

-- CreateIndex
CREATE INDEX "ReadingHistory_lastReadAt_idx" ON "ReadingHistory"("lastReadAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingHistory_userId_mangaId_key" ON "ReadingHistory"("userId", "mangaId");

-- CreateIndex
CREATE INDEX "ReadingList_userId_idx" ON "ReadingList"("userId");

-- CreateIndex
CREATE INDEX "ReadingList_isPublic_idx" ON "ReadingList"("isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingList_userId_slug_key" ON "ReadingList"("userId", "slug");

-- CreateIndex
CREATE INDEX "ReadingListItem_readingListId_idx" ON "ReadingListItem"("readingListId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingListItem_readingListId_mangaId_key" ON "ReadingListItem"("readingListId", "mangaId");

-- CreateIndex
CREATE INDEX "UserRating_mangaId_idx" ON "UserRating"("mangaId");

-- CreateIndex
CREATE INDEX "UserRating_score_idx" ON "UserRating"("score");

-- CreateIndex
CREATE UNIQUE INDEX "UserRating_userId_mangaId_key" ON "UserRating"("userId", "mangaId");

-- CreateIndex
CREATE INDEX "ContentReport_status_idx" ON "ContentReport"("status");

-- CreateIndex
CREATE INDEX "ContentReport_createdAt_idx" ON "ContentReport"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_storageProvider_idx" ON "MediaAsset"("storageProvider");

-- CreateIndex
CREATE INDEX "MediaAsset_isOrphan_idx" ON "MediaAsset"("isOrphan");

-- CreateIndex
CREATE INDEX "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "APIProvider_slug_key" ON "APIProvider"("slug");

-- CreateIndex
CREATE INDEX "APIProvider_slug_idx" ON "APIProvider"("slug");

-- CreateIndex
CREATE INDEX "APIProvider_isEnabled_idx" ON "APIProvider"("isEnabled");

-- CreateIndex
CREATE INDEX "APIProvider_healthStatus_idx" ON "APIProvider"("healthStatus");

-- CreateIndex
CREATE INDEX "APIEndpoint_providerId_idx" ON "APIEndpoint"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "APIEndpoint_providerId_name_key" ON "APIEndpoint"("providerId", "name");

-- CreateIndex
CREATE INDEX "APIFieldMapping_providerId_idx" ON "APIFieldMapping"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "APIFieldMapping_providerId_entityType_key" ON "APIFieldMapping"("providerId", "entityType");

-- CreateIndex
CREATE INDEX "APIImportJob_providerId_idx" ON "APIImportJob"("providerId");

-- CreateIndex
CREATE INDEX "APIImportJob_status_idx" ON "APIImportJob"("status");

-- CreateIndex
CREATE INDEX "APIImportJob_createdAt_idx" ON "APIImportJob"("createdAt");

-- CreateIndex
CREATE INDEX "APIImportRecord_jobId_idx" ON "APIImportRecord"("jobId");

-- CreateIndex
CREATE INDEX "APIImportRecord_status_idx" ON "APIImportRecord"("status");

-- CreateIndex
CREATE INDEX "APIImportRecord_externalId_idx" ON "APIImportRecord"("externalId");

-- CreateIndex
CREATE INDEX "APIRequestLog_providerId_idx" ON "APIRequestLog"("providerId");

-- CreateIndex
CREATE INDEX "APIRequestLog_statusCode_idx" ON "APIRequestLog"("statusCode");

-- CreateIndex
CREATE INDEX "APIRequestLog_createdAt_idx" ON "APIRequestLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_batchId_key" ON "ImportBatch"("batchId");

-- CreateIndex
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");

-- CreateIndex
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");

-- CreateIndex
CREATE INDEX "ImportComicJob_batchId_status_idx" ON "ImportComicJob"("batchId", "status");

-- CreateIndex
CREATE INDEX "ImportComicJob_slug_idx" ON "ImportComicJob"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ImportChapterJob_idempotencyKey_key" ON "ImportChapterJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ImportChapterJob_status_lockedAt_idx" ON "ImportChapterJob"("status", "lockedAt");

-- CreateIndex
CREATE INDEX "ImportChapterJob_batchId_status_idx" ON "ImportChapterJob"("batchId", "status");

-- CreateIndex
CREATE INDEX "ImportChapterJob_mangaId_idx" ON "ImportChapterJob"("mangaId");

-- CreateIndex
CREATE INDEX "ImportChapterJob_idempotencyKey_idx" ON "ImportChapterJob"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderPreference" ADD CONSTRAINT "ReaderPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manga" ADD CONSTRAINT "Manga_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manga" ADD CONSTRAINT "Manga_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manga" ADD CONSTRAINT "Manga_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "APIProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MangaAuthor" ADD CONSTRAINT "MangaAuthor_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MangaAuthor" ADD CONSTRAINT "MangaAuthor_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MangaGenre" ADD CONSTRAINT "MangaGenre_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MangaGenre" ADD CONSTRAINT "MangaGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MangaTag" ADD CONSTRAINT "MangaTag_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MangaTag" ADD CONSTRAINT "MangaTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterPage" ADD CONSTRAINT "ChapterPage_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterPage" ADD CONSTRAINT "ChapterPage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Translation" ADD CONSTRAINT "Translation_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterTranslation" ADD CONSTRAINT "ChapterTranslation_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLibrary" ADD CONSTRAINT "UserLibrary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLibrary" ADD CONSTRAINT "UserLibrary_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingHistory" ADD CONSTRAINT "ReadingHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingHistory" ADD CONSTRAINT "ReadingHistory_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingHistory" ADD CONSTRAINT "ReadingHistory_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingList" ADD CONSTRAINT "ReadingList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingListItem" ADD CONSTRAINT "ReadingListItem_readingListId_fkey" FOREIGN KEY ("readingListId") REFERENCES "ReadingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingListItem" ADD CONSTRAINT "ReadingListItem_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRating" ADD CONSTRAINT "UserRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRating" ADD CONSTRAINT "UserRating_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APIEndpoint" ADD CONSTRAINT "APIEndpoint_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "APIProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APIFieldMapping" ADD CONSTRAINT "APIFieldMapping_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "APIProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APIImportJob" ADD CONSTRAINT "APIImportJob_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "APIProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APIImportRecord" ADD CONSTRAINT "APIImportRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "APIImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APIImportRecord" ADD CONSTRAINT "APIImportRecord_internalMangaId_fkey" FOREIGN KEY ("internalMangaId") REFERENCES "Manga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APIImportRecord" ADD CONSTRAINT "APIImportRecord_internalChapterId_fkey" FOREIGN KEY ("internalChapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "APIRequestLog" ADD CONSTRAINT "APIRequestLog_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "APIProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportComicJob" ADD CONSTRAINT "ImportComicJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportComicJob" ADD CONSTRAINT "ImportComicJob_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportChapterJob" ADD CONSTRAINT "ImportChapterJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportChapterJob" ADD CONSTRAINT "ImportChapterJob_comicJobId_fkey" FOREIGN KEY ("comicJobId") REFERENCES "ImportComicJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportChapterJob" ADD CONSTRAINT "ImportChapterJob_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

