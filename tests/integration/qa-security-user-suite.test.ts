import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getPrisma } from "@/lib/database/prisma";
import { AuthService } from "@/modules/auth/auth-service";
import { UserProfileService } from "@/modules/user/user-profile-service";
import { updateLibraryEntry } from "@/modules/library/library-service";
import { Role, UserStatus, LibraryStatus } from "@prisma/client";

describe("QA & Security Penetration Suite: User Profile, Bookmarks & Data Resilience", () => {
  let victimUserId: string;
  let attackerUserId: string;
  let testMangaId: string;
  let testChapterId: string;
  const initialPassword = "StrongPassword123!";

  beforeAll(async () => {
    const db = await getPrisma();
    const hash = await AuthService.hashPassword(initialPassword);

    // Victim User
    const victim = await db.user.create({
      data: {
        email: `victim_${Date.now()}@example.com`,
        username: `victim_${Date.now()}`,
        passwordHash: hash,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });
    victimUserId = victim.id;

    // Attacker User
    const attacker = await db.user.create({
      data: {
        email: `attacker_${Date.now()}@example.com`,
        username: `attacker_${Date.now()}`,
        passwordHash: hash,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });
    attackerUserId = attacker.id;

    // Test Manga
    const manga = await db.manga.create({
      data: {
        title: `Security Test Comic ${Date.now()}`,
        slug: `sec-comic-${Date.now()}`,
        publicationStatus: "READY_TO_PUBLISH",
        status: "ONGOING",
        contentType: "MANGA",
      },
    });
    testMangaId = manga.id;

    const chapter = await db.chapter.create({
      data: {
        mangaId: manga.id,
        chapterNumber: 1,
        chapterTitle: "Chapter 1",
        sortKey: "000001.0000",
      },
    });
    testChapterId = chapter.id;
  });

  afterAll(async () => {
    const db = await getPrisma();
    try {
      if (victimUserId) await db.user.delete({ where: { id: victimUserId } });
      if (attackerUserId) await db.user.delete({ where: { id: attackerUserId } });
      if (testMangaId) await db.manga.delete({ where: { id: testMangaId } });
    } catch {
      // Ignore cleanup
    }
  });

  it("Test 1: Rejects XSS and JavaScript URI injection in avatarUrl", async () => {
    const maliciousUrls = [
      "javascript:alert(document.cookie)",
      "JAVASCRIPT:alert(1)",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "vbscript:msgbox(1)",
    ];

    for (const url of maliciousUrls) {
      await expect(
        UserProfileService.updateUserProfile(victimUserId, { avatarUrl: url })
      ).rejects.toThrow("INVALID_AVATAR_URL");
    }

    // Valid URLs must pass
    const valid = await UserProfileService.updateUserProfile(victimUserId, {
      avatarUrl: "https://secure.example.com/images/avatar.jpg",
    });
    expect(valid.avatarUrl).toBe("https://secure.example.com/images/avatar.jpg");
  });

  it("Test 2: Rejects XSS, HTML tags, and control characters in username", async () => {
    const maliciousUsernames = [
      "<script>alert(1)</script>",
      "user<test>",
      "admin' OR 1=1--",
      "user\x00nullbyte",
      "user\nnewline",
      "spaces in name",
    ];

    for (const uname of maliciousUsernames) {
      await expect(
        UserProfileService.updateUserProfile(victimUserId, { username: uname })
      ).rejects.toThrow("INVALID_USERNAME");
    }
  });

  it("Test 3: Guards against Argon2 CPU exhaustion with excessive password length", async () => {
    // 50,000 character string could pin CPU if hashed with high memory Argon2
    const hugePassword = "A".repeat(50000);

    await expect(
      UserProfileService.changeUserPassword(victimUserId, initialPassword, hugePassword)
    ).rejects.toThrow("PASSWORD_TOO_LONG");
  });

  it("Test 4: Gracefully handles non-existent or deleted manga in toggleBookmark without foreign key crashes", async () => {
    const nonExistentId = "cuid_non_existent_fake_manga_999";

    await expect(
      UserProfileService.toggleBookmark(victimUserId, nonExistentId)
    ).rejects.toThrow("MANGA_NOT_FOUND");
  });

  it("Test 5: Resiliently handles bogus chapter IDs in syncHistory without throwing P2003 Foreign Key error", async () => {
    const corruptHistory = [
      {
        mangaId: testMangaId,
        chapterId: "fake_stale_chapter_id_from_other_system",
        pageNumber: 5,
        percentRead: 50,
        isCompleted: false,
      },
    ];

    // Must not throw Foreign Key Constraint violation!
    const syncRes = await UserProfileService.syncHistory(victimUserId, corruptHistory);
    expect(syncRes.syncedCount).toBe(1);

    // Verify it resolved to the real chapter belonging to the manga
    const userHistory = await UserProfileService.getUserHistory(victimUserId);
    expect(userHistory.items.length).toBe(1);
    expect(userHistory.items[0].chapterId).toBe(testChapterId);
  });

  it("Test 6: Validates target manga existence in updateLibraryEntry", async () => {
    const fakeMangaId = "fake_manga_non_existent_12345";

    await expect(
      updateLibraryEntry(victimUserId, fakeMangaId, {
        status: LibraryStatus.READING,
      })
    ).rejects.toThrow("MANGA_NOT_FOUND");
  });

  it("Test 7: Clamps abnormal scores and trims excessive notes in importUserData", async () => {
    const maliciousImport = {
      library: [
        {
          mangaId: testMangaId,
          status: "READING" as LibraryStatus,
          score: 99999, // Way above maximum 10
          notes: "N".repeat(50000), // Storage exhaustion attack
        },
      ],
    };

    const res = await UserProfileService.importUserData(victimUserId, maliciousImport);
    expect(res.importedLibrary).toBe(1);

    const db = await getPrisma();
    const entry = await db.userLibrary.findUnique({
      where: { userId_mangaId: { userId: victimUserId, mangaId: testMangaId } },
    });

    expect(entry).not.toBeNull();
    expect(entry!.score).toBe(10); // Clamped to 10
    expect(entry!.notes!.length).toBeLessThanOrEqual(2000); // Truncated to safe limit
  });

  it("Test 8: Neutralizes prototype pollution and invalid fields in preferences import", async () => {
    const maliciousPrefImport = {
      preferences: {
        __proto__: { polluted: true },
        constructor: { prototype: { admin: true } },
        injectedArbitraryKey: "hacked",
        readingMode: "VERTICAL_SCROLL",
        pageGap: 16,
      },
    };

    const res = await UserProfileService.importUserData(victimUserId, maliciousPrefImport);
    expect(res.success).toBe(true);

    const db = await getPrisma();
    const pref = await db.readerPreference.findUnique({
      where: { userId: victimUserId },
    });

    expect(pref).not.toBeNull();
    expect(pref!.readingMode).toBe("VERTICAL_SCROLL");
    expect(pref!.pageGap).toBe(16);
    expect((pref as any).injectedArbitraryKey).toBeUndefined();
  });

  it("Test 9: Enforces IDOR boundaries: User cannot delete or overwrite another user's reading history", async () => {
    // Add history for victim
    await UserProfileService.syncHistory(victimUserId, [
      {
        mangaId: testMangaId,
        chapterId: testChapterId,
        pageNumber: 10,
      },
    ]);

    // Attacker tries to delete victim's history using attacker's userId
    await UserProfileService.deleteHistoryEntry(attackerUserId, testMangaId);

    // Victim's history must remain completely intact
    const victimHistory = await UserProfileService.getUserHistory(victimUserId);
    expect(victimHistory.items.length).toBe(1);
    expect(victimHistory.items[0].mangaId).toBe(testMangaId);

    // Attacker tries to clear all history using attacker's userId
    await UserProfileService.clearAllHistory(attackerUserId);

    // Victim's history is still preserved
    const victimHistoryAfter = await UserProfileService.getUserHistory(victimUserId);
    expect(victimHistoryAfter.items.length).toBe(1);
  });
});
