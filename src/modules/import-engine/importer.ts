import { getPrisma } from "@/lib/database/prisma";
import { createProviderInstance, NormalizedManga } from "../api-providers/generic-provider";
import { ContentPolicyService } from "../content-policy/content-policy-service";
import { ImportJobType, ImportJobStatus, ImportRecordStatus, MangaStatus, ContentType, PublicationStatus } from "@prisma/client";

export interface ImportOptions {
  jobType: ImportJobType;
  providerId: string;
  externalIds?: string[];
  importChapters?: boolean;
  duplicateStrategy?: "SKIP" | "UPDATE" | "OVERWRITE";
  maxItems?: number;
}

export interface ImportJobSummary {
  jobId: string;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  skippedItems: number;
  status: ImportJobStatus;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Ensures unique slug for Manga
 */
async function generateUniqueSlug(title: string, currentMangaId?: string): Promise<string> {
  const db = await getPrisma();
  let baseSlug = slugify(title) || "manga";
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db.manga.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing || (currentMangaId && existing.id === currentMangaId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

function parseMangaStatus(statusStr?: string): MangaStatus {
  if (!statusStr) return MangaStatus.ONGOING;
  const s = statusStr.toUpperCase();
  if (s.includes("COMPLET")) return MangaStatus.COMPLETED;
  if (s.includes("HIATUS")) return MangaStatus.HIATUS;
  if (s.includes("CANCEL")) return MangaStatus.CANCELLED;
  return MangaStatus.ONGOING;
}

function parseContentType(typeStr?: string): ContentType {
  if (!typeStr) return ContentType.MANGA;
  const t = typeStr.toUpperCase();
  if (t.includes("MANHWA")) return ContentType.MANHWA;
  if (t.includes("MANHUA")) return ContentType.MANHUA;
  if (t.includes("COMIC")) return ContentType.COMIC;
  if (t.includes("WEBTOON")) return ContentType.WEBTOON;
  return ContentType.MANGA;
}

/**
 * Core Importer Engine
 */
export async function runImportJob(options: ImportOptions): Promise<ImportJobSummary> {
  const db = await getPrisma();
  const providerInstance = await createProviderInstance(options.providerId);

  // Create initial job record
  const job = await db.aPIImportJob.create({
    data: {
      providerId: options.providerId,
      jobType: options.jobType,
      status: ImportJobStatus.RUNNING,
      startedAt: new Date(),
    },
  });

  let processedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const logs: string[] = [];

  try {
    let mangasToImport: NormalizedManga[] = [];

    // 1. Fetch data depending on jobType
    if (options.jobType === ImportJobType.SINGLE_MANGA && options.externalIds?.[0]) {
      const res = await providerInstance.getManga(options.externalIds[0]);
      mangasToImport = [res.data];
    } else if (options.jobType === ImportJobType.BULK_MANGA && options.externalIds && options.externalIds.length > 0) {
      for (const extId of options.externalIds) {
        try {
          const res = await providerInstance.getManga(extId);
          mangasToImport.push(res.data);
        } catch (fetchErr: any) {
          logs.push(`Failed to fetch manga ${extId}: ${fetchErr.message}`);
          failedCount++;
        }
      }
    } else {
      // FULL_SYNC or default popular fetch
      const res = await providerInstance.getPopular({ limit: options.maxItems || 20 });
      mangasToImport = res.data;
    }

    await db.aPIImportJob.update({
      where: { id: job.id },
      data: { totalItems: mangasToImport.length },
    });

    // 2. Process each manga record
    for (const item of mangasToImport) {
      try {
        if (!item.externalId || !item.title) {
          throw new Error("Missing externalId or title in normalized record");
        }

        // Strict Global Content Exclusion Policy Evaluation
        const policyCheck = await ContentPolicyService.evaluateMangaContent({
          title: item.title,
          alternativeTitles: item.alternativeTitles,
          description: item.description,
          genres: item.genres,
          tags: item.tags,
          rawMetadata: item.rawMetadata,
          providerId: options.providerId,
          coverUrl: item.coverUrl,
        });

        if (!policyCheck.allowed || policyCheck.action === "REJECT") {
          logs.push(`POLICY REJECTION: "${item.title}" (${item.externalId}) rejected: ${policyCheck.reason}`);
          failedCount++;
          await db.aPIImportRecord.create({
            data: {
              jobId: job.id,
              externalId: item.externalId,
              status: ImportRecordStatus.FAILED,
              errorMessage: `POLICY_VIOLATION: ${policyCheck.reason}`,
              rawPayload: item.rawMetadata,
            },
          });
          await db.auditLog.create({
            data: {
              action: "CONTENT_POLICY_REJECTION",
              entityType: "Manga",
              entityId: item.externalId,
              details: {
                title: item.title,
                externalId: item.externalId,
                providerId: options.providerId,
                reason: policyCheck.reason,
                violations: policyCheck.violations,
              } as any,
            },
          });
          continue; // Complete rejection: no manga record created, no chapters imported
        }

        const isQuarantined = policyCheck.action === "QUARANTINE";
        const initialPubStatus = isQuarantined ? PublicationStatus.PENDING_REVIEW : PublicationStatus.PUBLISHED;

        // Check for existing manga by providerId + externalId
        const existing = await db.manga.findUnique({
          where: {
            providerId_externalId: {
              providerId: options.providerId,
              externalId: item.externalId,
            },
          },
          include: { genres: true },
        });

        let mangaId: string;

        if (existing) {
          if (options.duplicateStrategy === "SKIP") {
            skippedCount++;
            await db.aPIImportRecord.create({
              data: {
                jobId: job.id,
                externalId: item.externalId,
                internalMangaId: existing.id,
                status: ImportRecordStatus.SKIPPED_DUPLICATE,
                rawPayload: item.rawMetadata,
              },
            });
            mangaId = existing.id;
          } else {
            // Update metadata
            const updated = await db.manga.update({
              where: { id: existing.id },
              data: {
                title: item.title,
                alternativeTitles: (item.alternativeTitles || existing.alternativeTitles || undefined) as any,
                description: item.description || existing.description,
                coverUrl: item.coverUrl || existing.coverUrl,
                bannerUrl: item.bannerUrl || existing.bannerUrl,
                author: item.author || existing.author,
                artist: item.artist || existing.artist,
                releaseYear: item.releaseYear || existing.releaseYear,
                status: parseMangaStatus(item.status),
                contentType: parseContentType(item.contentType),
                rawMetadata: item.rawMetadata || existing.rawMetadata,
              },
            });
            mangaId = updated.id;
          }
        } else {
          // Create new Manga
          const slug = await generateUniqueSlug(item.title);
          const created = await db.manga.create({
            data: {
              slug,
              title: item.title,
              alternativeTitles: item.alternativeTitles || [],
              description: item.description,
              coverUrl: item.coverUrl,
              bannerUrl: item.bannerUrl,
              author: item.author,
              artist: item.artist,
              releaseYear: item.releaseYear,
              status: parseMangaStatus(item.status),
              contentType: parseContentType(item.contentType),
              rating: item.rating || 0,
              language: item.language || "en",
              publicationStatus: initialPubStatus,
              providerId: options.providerId,
              externalId: item.externalId,
              rawMetadata: {
                ...(typeof item.rawMetadata === "object" ? item.rawMetadata : {}),
                ...(policyCheck.visualClassification ? { visualClassification: policyCheck.visualClassification } : {}),
                ...(isQuarantined ? { hitlReason: policyCheck.reason, hitlRequired: policyCheck.hitlRequired } : {}),
              },
            },
          });
          mangaId = created.id;

          if (isQuarantined) {
            await db.auditLog.create({
              data: {
                action: "CONTENT_POLICY_QUARANTINE",
                entityType: "Manga",
                entityId: mangaId,
                details: {
                  title: item.title,
                  externalId: item.externalId,
                  providerId: options.providerId,
                  reason: policyCheck.reason,
                  hitlRequired: policyCheck.hitlRequired,
                  visualClassification: policyCheck.visualClassification,
                } as any,
              },
            });
          }
        }

        // Process Genres
        if (item.genres && item.genres.length > 0) {
          for (const genreName of item.genres) {
            const genreSlug = slugify(genreName);
            if (!genreSlug) continue;

            // Upsert Genre
            const genre = await db.genre.upsert({
              where: { slug: genreSlug },
              update: {},
              create: { name: genreName, slug: genreSlug },
            });

            // Upsert MangaGenre link
            await db.mangaGenre.upsert({
              where: {
                mangaId_genreId: { mangaId, genreId: genre.id },
              },
              update: {},
              create: { mangaId, genreId: genre.id },
            });
          }
        }

        // 3. Import Chapters if requested (quarantined content never imports chapters)
        if (options.importChapters && !isQuarantined) {
          try {
            const chapRes = await providerInstance.getChapters(item.externalId);
            for (const chap of chapRes.data) {
              const chapterNum = Number(chap.chapterNumber) || 1;
              const lang = chap.language || "en";

              // Check existing chapter
              let chapter = await db.chapter.findUnique({
                where: {
                  mangaId_chapterNumber_language: {
                    mangaId,
                    chapterNumber: chapterNum,
                    language: lang,
                  },
                },
              });

              if (!chapter) {
                chapter = await db.chapter.create({
                  data: {
                    mangaId,
                    chapterNumber: chapterNum,
                    chapterTitle: chap.chapterTitle,
                    volume: chap.volume,
                    language: lang,
                    scanlationGroup: chap.scanlationGroup,
                    releaseDate: chap.releaseDate ? new Date(chap.releaseDate) : new Date(),
                    externalId: chap.externalId,
                    externalUrl: chap.externalUrl,
                    publicationStatus: PublicationStatus.PUBLISHED,
                  },
                });

                // Fetch chapter pages if chapter externalId present
                if (chap.externalId) {
                  try {
                    const pagesRes = await providerInstance.getChapterPages(chap.externalId);
                    if (pagesRes.data.length > 0) {
                      for (const p of pagesRes.data) {
                        await db.chapterPage.upsert({
                          where: {
                            chapterId_pageNumber: {
                              chapterId: chapter.id,
                              pageNumber: p.pageNumber,
                            },
                          },
                          update: { imageUrl: p.imageUrl },
                          create: {
                            chapterId: chapter.id,
                            pageNumber: p.pageNumber,
                            imageUrl: p.imageUrl,
                          },
                        });
                      }
                    }
                  } catch (pErr) {
                    console.warn(`Could not fetch pages for chapter ${chap.externalId}:`, pErr);
                  }
                }
              }
            }
          } catch (cErr: any) {
            logs.push(`Error fetching chapters for manga ${item.title}: ${cErr.message}`);
          }
        }

        processedCount++;
        await db.aPIImportRecord.create({
          data: {
            jobId: job.id,
            externalId: item.externalId,
            internalMangaId: mangaId,
            status: ImportRecordStatus.SUCCESS,
            rawPayload: item.rawMetadata,
          },
        });
      } catch (itemErr: any) {
        failedCount++;
        logs.push(`Failed importing record "${item.title || item.externalId}": ${itemErr.message}`);
        await db.aPIImportRecord.create({
          data: {
            jobId: job.id,
            externalId: item.externalId || "unknown",
            status: ImportRecordStatus.FAILED,
            errorMessage: itemErr.message || String(itemErr),
            rawPayload: item.rawMetadata,
          },
        });
      }
    }

    const finalStatus =
      failedCount === 0
        ? ImportJobStatus.COMPLETED
        : processedCount > 0
        ? ImportJobStatus.PARTIAL
        : ImportJobStatus.FAILED;

    await db.aPIImportJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        processedItems: processedCount,
        failedItems: failedCount,
        finishedAt: new Date(),
        log: logs.join("\n"),
      },
    });

    return {
      jobId: job.id,
      totalItems: mangasToImport.length,
      processedItems: processedCount,
      failedItems: failedCount,
      skippedItems: skippedCount,
      status: finalStatus,
    };
  } catch (fatalErr: any) {
    await db.aPIImportJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.FAILED,
        finishedAt: new Date(),
        log: `Fatal error: ${fatalErr.message}\n${logs.join("\n")}`,
      },
    });

    throw fatalErr;
  }
}
