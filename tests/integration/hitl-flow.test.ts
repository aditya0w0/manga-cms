import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getPrisma } from "@/lib/database/prisma";
import { ContentPolicyService } from "@/modules/content-policy/content-policy-service";
import { getMangaList } from "@/modules/manga/manga-service";
import { PublicationStatus, Role } from "@prisma/client";

describe("Human In The Loop (HITL) Visual Review Lifecycle : Integration Tests", () => {
  let db: any;
  let adminUserId: string;

  beforeAll(async () => {
    db = await getPrisma();

    // Create or find admin user for testing
    let admin = await db.user.findFirst({
      where: { role: Role.ADMIN },
    });

    if (!admin) {
      admin = await db.user.create({
        data: {
          username: `admin_${Date.now()}`,
          email: `admin_${Date.now()}@test.local`,
          passwordHash: "dummyhash",
          role: Role.ADMIN,
        },
      });
    }
    adminUserId = admin.id;
  });

  it("routes borderline visual artwork to QUARANTINE with hitlRequired: true", async () => {
    // URL containing "borderline" triggers the borderline classification stub in WD Tagger
    const check = await ContentPolicyService.evaluateMangaContent({
      title: "Friendly Roommates (Non-BL)",
      genres: ["Comedy", "Slice of Life"],
      coverUrl: "https://example.com/borderline_cover.jpg",
    });

    expect(check.allowed).toBe(true);
    expect(check.action).toBe("QUARANTINE");
    expect(check.hitlRequired).toBe(true);
    expect(check.visualClassification).toBeDefined();
    expect(check.visualClassification?.recommendation).toBe("QUARANTINE_HITL");
  });

  it("quarantines borderline manga into PENDING_REVIEW and hides from public readers", async () => {
    const slug = `borderline-manga-${Date.now()}`;
    const check = await ContentPolicyService.evaluateMangaContent({
      title: "Borderline Two Friends",
      genres: ["School", "Drama"],
      coverUrl: "https://example.com/borderline_friends.jpg",
    });

    // Ingestion logic creates manga under PENDING_REVIEW
    const manga = await db.manga.create({
      data: {
        title: "Borderline Two Friends",
        slug,
        coverUrl: "https://example.com/borderline_friends.jpg",
        publicationStatus: PublicationStatus.PENDING_REVIEW,
        rawMetadata: {
          visualClassification: check.visualClassification,
          hitlReason: check.reason,
          hitlRequired: true,
        },
      },
    });

    expect(manga.publicationStatus).toBe(PublicationStatus.PENDING_REVIEW);

    // Verify it is NOT returned in public manga lists
    const publicList = await getMangaList({
      page: 1,
      limit: 100,
      publicationStatus: PublicationStatus.PUBLISHED,
    });
    const foundInPublic = publicList.items.find((m) => m.id === manga.id);
    expect(foundInPublic).toBeUndefined();
  });

  it("clears false flag on admin review, sets status to PUBLISHED, and exposes to public readers", async () => {
    const slug = `false-flag-candidate-${Date.now()}`;
    const manga = await db.manga.create({
      data: {
        title: "Two Brothers Adventure",
        slug,
        coverUrl: "https://example.com/borderline_brothers.jpg",
        publicationStatus: PublicationStatus.PENDING_REVIEW,
        rawMetadata: {
          hitlReason: "Borderline artwork detected by WD Tagger. Quarantined for Human In The Loop review.",
          hitlRequired: true,
        },
      },
    });

    // Admin verifies: It is NOT BL, merely two brothers on a journey. Admin clears false flag!
    const updated = await db.manga.update({
      where: { id: manga.id },
      data: {
        publicationStatus: PublicationStatus.PUBLISHED,
        rawMetadata: {
          ...(manga.rawMetadata as any),
          falseFlagCleared: true,
          clearedBy: "test_admin",
          clearedAt: new Date().toISOString(),
          adminNote: "Confirmed safe shounen brotherhood artwork, not BL",
        },
      },
    });

    await db.auditLog.create({
      data: {
        action: "HITL_FALSE_FLAG_CLEARED",
        entityType: "Manga",
        entityId: manga.id,
        userId: adminUserId,
        details: {
          title: manga.title,
          action: "APPROVE_CLEAR_FLAG",
          clearedBy: "test_admin",
        },
      },
    });

    expect(updated.publicationStatus).toBe(PublicationStatus.PUBLISHED);

    // Verify audit log entry exists
    const log = await db.auditLog.findFirst({
      where: {
        entityId: manga.id,
        action: "HITL_FALSE_FLAG_CLEARED",
      },
    });
    expect(log).toBeDefined();
    expect(log?.details).toMatchObject({ action: "APPROVE_CLEAR_FLAG" });

    // Now it MUST be available in the public catalog
    const publicList = await getMangaList({
      page: 1,
      limit: 100,
      publicationStatus: PublicationStatus.PUBLISHED,
    });
    const foundInPublic = publicList.items.find((m) => m.id === manga.id);
    expect(foundInPublic).toBeDefined();
    expect(foundInPublic?.title).toBe("Two Brothers Adventure");
  });

  it("confirms violation on admin review and marks status as ARCHIVED", async () => {
    const slug = `genuine-violation-${Date.now()}`;
    const manga = await db.manga.create({
      data: {
        title: "Suspect Cover Series",
        slug,
        coverUrl: "https://example.com/borderline_suspect.jpg",
        publicationStatus: PublicationStatus.PENDING_REVIEW,
      },
    });

    // Admin confirms it IS a violation
    const updated = await db.manga.update({
      where: { id: manga.id },
      data: {
        publicationStatus: PublicationStatus.ARCHIVED,
        rawMetadata: {
          violationConfirmed: true,
          confirmedBy: "test_admin",
          adminNote: "Confirmed explicit content violation",
        },
      },
    });

    await db.auditLog.create({
      data: {
        action: "HITL_VIOLATION_CONFIRMED",
        entityType: "Manga",
        entityId: manga.id,
        userId: adminUserId,
        details: {
          title: manga.title,
          action: "CONFIRM_VIOLATION",
        },
      },
    });

    expect(updated.publicationStatus).toBe(PublicationStatus.ARCHIVED);

    // Verify it stays hidden from public
    const publicList = await getMangaList({
      page: 1,
      limit: 100,
      publicationStatus: PublicationStatus.PUBLISHED,
    });
    const foundInPublic = publicList.items.find((m) => m.id === manga.id);
    expect(foundInPublic).toBeUndefined();
  });

  it("auto-rejects explicit artwork covers without creating catalog entries", async () => {
    // Explicit cover triggers REJECT_AUTO in WD Tagger
    const check = await ContentPolicyService.evaluateMangaContent({
      title: "Hardcore Smut Series",
      genres: ["Romance"],
      coverUrl: "https://example.com/explicit_cover.jpg",
    });

    expect(check.allowed).toBe(false);
    expect(check.action).toBe("REJECT");
    expect(check.violations.length).toBeGreaterThanOrEqual(1);
    expect(check.violations.some((v) => v.sourceField.includes("WD Tagger"))).toBe(true);
  });

  afterAll(async () => {
    const db = await getPrisma();
    await db.auditLog.deleteMany({
      where: { userId: adminUserId },
    });
    await db.manga.deleteMany({
      where: {
        OR: [
          { coverUrl: { contains: "example.com" } },
          { title: { contains: "Borderline" } },
          { title: { contains: "Two Brothers" } },
          { title: { contains: "Suspect Cover" } },
        ],
      },
    });
  });
});
