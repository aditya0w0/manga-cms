import { describe, it, expect, beforeAll } from "vitest";
import { getPrisma } from "@/lib/database/prisma";
import { ContentPolicyService } from "@/modules/content-policy/content-policy-service";
import { runImportJob } from "@/modules/import-engine/importer";
import { getMangaList, getMangaBySlug } from "@/modules/manga/manga-service";
import { PublicationStatus, ImportJobType, ImportRecordStatus } from "@prisma/client";

describe("Content Policy Ingestion & Database Enforcement Integration", () => {
  let db: any;
  let providerId: string;

  beforeAll(async () => {
    db = await getPrisma();
    const provider = await db.aPIProvider.findFirst();
    if (provider) {
      providerId = provider.id;
    }
  });

  it("blocks prohibited content during import job and records rejection in audit log", async () => {
    if (!providerId) return;

    // Simulate import job attempt on a prohibited series
    const job = await db.aPIImportJob.create({
      data: {
        providerId,
        jobType: ImportJobType.SINGLE_MANGA,
        totalItems: 1,
        startedAt: new Date(),
      },
    });

    const candidate = {
      externalId: "prohibited-yaoi-series-101",
      title: "Dangerous Romance (Yaoi)",
      genres: ["Romance", "Yaoi"],
    };

    const check = await ContentPolicyService.evaluateMangaContent(candidate);
    expect(check.allowed).toBe(false);
    expect(check.action).toBe("REJECT");

    // The importer records the rejection
    const record = await db.aPIImportRecord.create({
      data: {
        jobId: job.id,
        externalId: candidate.externalId,
        status: ImportRecordStatus.FAILED,
        errorMessage: `POLICY_VIOLATION: ${check.reason}`,
      },
    });

    expect(record.status).toBe(ImportRecordStatus.FAILED);
    expect(record.errorMessage).toContain("POLICY_VIOLATION");
    expect(record.errorMessage).toContain("Yaoi");

    // Verify it is NOT in the Manga table
    const notFoundManga = await db.manga.findFirst({
      where: { externalId: candidate.externalId },
    });
    expect(notFoundManga).toBeNull();
  });

  it("prevents public exposure of quarantined or unapproved manga via public queries", async () => {
    const qSlug = `quarantined-missing-${Date.now()}`;
    // 1. Insert a quarantined manga directly into DB
    const quarantinedManga = await db.manga.create({
      data: {
        title: "Quarantined Missing Genre Manga",
        slug: qSlug,
        publicationStatus: PublicationStatus.PENDING_REVIEW,
      },
    });

    // 2. Query public browse/search
    const list = await getMangaList({ query: "Quarantined Missing Genre" });
    const foundInList = list.items.some((m: any) => m.id === quarantinedManga.id);
    expect(foundInList).toBe(false);

    // 3. Query public detail by slug
    const detail = await getMangaBySlug(qSlug);
    expect(detail).toBeNull();

    // Clean up
    await db.manga.delete({ where: { id: quarantinedManga.id } });
  });

  it("retroactively identifies and archives prohibited content during database audit scan", async () => {
    // 1. Create a dummy prohibited manga in database
    const testSlug = `legacy-forbidden-smut-${Date.now()}`;
    // Clean up if left behind
    await db.manga.deleteMany({ where: { slug: testSlug } });

    const violatingManga = await db.manga.create({
      data: {
        title: "Legacy Forbidden Smut Title",
        slug: testSlug,
        publicationStatus: PublicationStatus.PUBLISHED,
      },
    });

    // Link a prohibited genre
    const smutGenre = await db.genre.upsert({
      where: { slug: "smut" },
      create: { name: "Smut", slug: "smut" },
      update: {},
    });

    await db.mangaGenre.create({
      data: { mangaId: violatingManga.id, genreId: smutGenre.id },
    });

    // 2. Execute Database Audit & Cleanup with action: ARCHIVE
    const auditReport = await ContentPolicyService.runDatabaseAuditAndCleanup({
      action: "ARCHIVE",
    });

    expect(auditReport.violationCount).toBeGreaterThanOrEqual(1);

    // 3. Verify the manga status was updated to ARCHIVED
    const updatedManga = await db.manga.findUnique({
      where: { id: violatingManga.id },
    });
    expect(updatedManga?.publicationStatus).toBe(PublicationStatus.ARCHIVED);

    // 4. Verify public search cannot find it
    const publicResult = await getMangaBySlug(testSlug);
    expect(publicResult).toBeNull();

    // Clean up
    await db.mangaGenre.deleteMany({ where: { mangaId: violatingManga.id } });
    await db.manga.delete({ where: { id: violatingManga.id } });
  });

  it("enforces revalidation when updating existing approved manga", async () => {
    const safeSlug = `wholesome-adv-${Date.now()}`;
    // Initial safe manga
    const safeManga = await db.manga.create({
      data: {
        title: "Wholesome Adventure Story",
        slug: safeSlug,
        publicationStatus: PublicationStatus.PUBLISHED,
      },
    });

    // Revalidation check: Attempt to update metadata with prohibited genre
    const updateAttempt = {
      title: "Wholesome Adventure Story",
      genres: ["Adventure", "Hentai"],
    };

    const revalidationCheck = await ContentPolicyService.evaluateMangaContent(updateAttempt);
    expect(revalidationCheck.allowed).toBe(false);
    expect(revalidationCheck.action).toBe("REJECT");
    expect(revalidationCheck.violations[0].matchedTerm).toBe("Hentai");

    // Clean up
    await db.manga.delete({ where: { id: safeManga.id } });
  });
});
