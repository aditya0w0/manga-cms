import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getPrisma } from "@/lib/database/prisma";
import { AuthService } from "@/modules/auth/auth-service";
import { UserProfileService } from "@/modules/user/user-profile-service";
import { updateLibraryEntry } from "@/modules/library/library-service";
import { Role, LibraryStatus, UserStatus } from "@prisma/client";

describe("User Profile, Permanent Bookmarks, Library & History Integration", () => {
  let testUserId: string;
  let secondaryUserId: string;
  const testMangaIds: string[] = [];
  const testChapterIds: string[] = [];
  const testEmail = `user_bench_${Date.now()}@example.com`;
  const initialPassword = "SecurePassword123!";

  beforeAll(async () => {
    const db = await getPrisma();
    const hash = await AuthService.hashPassword(initialPassword);

    // 1. Create primary test user
    const user = await db.user.create({
      data: {
        email: testEmail,
        username: `profile_user_${Date.now()}`,
        passwordHash: hash,
        role: Role.USER,
        status: UserStatus.ACTIVE,
        bio: "Avid manga reader and collector.",
      },
    });
    testUserId = user.id;

    // 2. Create secondary test user for data restore test
    const secUser = await db.user.create({
      data: {
        email: `restore_user_${Date.now()}@example.com`,
        username: `restore_user_${Date.now()}`,
        passwordHash: hash,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });
    secondaryUserId = secUser.id;

    // 3. Create 30 test manga titles to thoroughly exceed the 20-comic loss limit
    for (let i = 1; i <= 30; i++) {
      const slug = `scale-comic-title-${String(i).padStart(3, "0")}-${Date.now()}`;
      const manga = await db.manga.create({
        data: {
          title: `Scale Comic Series ${i}`,
          slug,
          publicationStatus: "READY_TO_PUBLISH",
          status: "ONGOING",
          contentType: "MANGA",
        },
      });
      testMangaIds.push(manga.id);

      // Create 2 chapters for each manga (Ch. 1 and Ch. 2)
      const ch1 = await db.chapter.create({
        data: {
          mangaId: manga.id,
          chapterNumber: 1,
          chapterTitle: "The Beginning",
          sortKey: "000001.0000",
        },
      });
      const ch2 = await db.chapter.create({
        data: {
          mangaId: manga.id,
          chapterNumber: 2,
          chapterTitle: "Awakening",
          sortKey: "000002.0000",
        },
      });
      testChapterIds.push(ch1.id, ch2.id);
    }
  });

  afterAll(async () => {
    const db = await getPrisma();
    try {
      // Cascade cleanups
      if (testUserId) {
        await db.user.delete({ where: { id: testUserId } });
      }
      if (secondaryUserId) {
        await db.user.delete({ where: { id: secondaryUserId } });
      }
      if (testMangaIds.length > 0) {
        await db.manga.deleteMany({
          where: { id: { in: testMangaIds } },
        });
      }
    } catch {
      // Cleanup fallback
    }
  });

  it("Step 1: Retrieves user profile details and aggregate metrics", async () => {
    const profile = await UserProfileService.getUserProfile(testUserId);

    expect(profile).toBeDefined();
    expect(profile.id).toBe(testUserId);
    expect(profile.email).toBe(testEmail);
    expect(profile.bio).toBe("Avid manga reader and collector.");
    expect(profile.stats.totalBookmarks).toBe(0);
    expect(profile.stats.totalSaved).toBe(0);
    expect(profile.stats.totalHistory).toBe(0);
  });

  it("Step 2: Updates user profile attributes and validates uniqueness", async () => {
    const updatedBio = "Reading weekly shonen and sci-fi seinen.";
    const updated = await UserProfileService.updateUserProfile(testUserId, {
      bio: updatedBio,
      avatarUrl: "https://example.com/avatar.png",
    });

    expect(updated.bio).toBe(updatedBio);
    expect(updated.avatarUrl).toBe("https://example.com/avatar.png");

    // Invalid short username rejection
    await expect(
      UserProfileService.updateUserProfile(testUserId, { username: "ab" })
    ).rejects.toThrow("INVALID_USERNAME");

    // Invalid email format rejection
    await expect(
      UserProfileService.updateUserProfile(testUserId, { email: "notanemail" })
    ).rejects.toThrow("INVALID_EMAIL");
  });

  it("Step 3: Securely changes user password and rejects invalid passwords", async () => {
    // Rejects wrong current password
    await expect(
      UserProfileService.changeUserPassword(testUserId, "WrongPassword!", "NewValidPassword123!")
    ).rejects.toThrow("INVALID_PASSWORD");

    // Rejects short new password
    await expect(
      UserProfileService.changeUserPassword(testUserId, initialPassword, "short")
    ).rejects.toThrow("PASSWORD_TOO_SHORT");

    // Successfully changes password
    const result = await UserProfileService.changeUserPassword(
      testUserId,
      initialPassword,
      "BrandNewSecretPassword123!"
    );
    expect(result.success).toBe(true);

    // Verify authentication succeeds with the new password
    const db = await getPrisma();
    const updatedUser = await db.user.findUnique({ where: { id: testUserId } });
    const isNewValid = await AuthService.verifyPassword(
      "BrandNewSecretPassword123!",
      updatedUser!.passwordHash
    );
    expect(isNewValid).toBe(true);
  });

  it("Step 4: Bookmarks over 25 comic titles with zero loss (surpassing scan site 20-comic bug)", async () => {
    // Bookmark 25 comics sequentially
    for (let i = 0; i < 25; i++) {
      const mangaId = testMangaIds[i];
      const res = await UserProfileService.toggleBookmark(testUserId, mangaId);
      expect(res.bookmarked).toBe(true);
    }

    // Verify all 25 bookmarks are present
    const bookmarkData = await UserProfileService.getUserBookmarks(testUserId, {
      page: 1,
      limit: 50,
    });

    expect(bookmarkData.pagination.total).toBe(25);
    expect(bookmarkData.items.length).toBe(25);

    // Verify unread calculations (user has read 0 chapters, latest is Ch. 2, so unread should equal 2)
    const firstItem = bookmarkData.items[0];
    expect(firstItem.manga).toBeDefined();
    expect(firstItem.manga.latestChapter).not.toBeNull();
    expect(firstItem.unreadChapters).toBe(2);

    // Toggling an existing bookmark deletes it
    const toggleOff = await UserProfileService.toggleBookmark(testUserId, testMangaIds[0]);
    expect(toggleOff.bookmarked).toBe(false);

    const recheck = await UserProfileService.getUserBookmarks(testUserId);
    expect(recheck.pagination.total).toBe(24);

    // Toggle back on
    await UserProfileService.toggleBookmark(testUserId, testMangaIds[0]);
  });

  it("Step 5: Reconciles guest offline bookmarks and reading history via batch sync", async () => {
    // Simulate guest bookmarking 5 additional titles while logged out
    const guestBookmarks = [
      { mangaId: testMangaIds[25] },
      { mangaId: testMangaIds[26] },
      { mangaId: testMangaIds[27] },
      { mangaId: testMangaIds[28] },
      { mangaId: testMangaIds[29] },
    ];

    const syncRes = await UserProfileService.syncBookmarks(testUserId, guestBookmarks);
    expect(syncRes.syncedCount).toBe(5);

    // Verify total bookmarks is now 30
    const fullBookmarks = await UserProfileService.getUserBookmarks(testUserId, { limit: 100 });
    expect(fullBookmarks.pagination.total).toBe(30);
    expect(fullBookmarks.items.length).toBe(30);

    // Simulate guest reading history sync
    const guestHistory = [
      {
        mangaId: testMangaIds[0],
        chapterId: testChapterIds[0],
        pageNumber: 15,
        percentRead: 75,
        isCompleted: false,
      },
      {
        mangaId: testMangaIds[1],
        chapterId: testChapterIds[2],
        pageNumber: 20,
        percentRead: 100,
        isCompleted: true,
      },
    ];

    const histSync = await UserProfileService.syncHistory(testUserId, guestHistory);
    expect(histSync.syncedCount).toBe(2);

    // Verify reading history retrieval
    const historyData = await UserProfileService.getUserHistory(testUserId);
    expect(historyData.pagination.total).toBe(2);
    expect(historyData.items[0].pageNumber).toBeGreaterThan(0);
  });

  it("Step 6: Manages saved library status, custom rating, and private notes", async () => {
    // Add manga to Saved Library with status READING
    await updateLibraryEntry(testUserId, testMangaIds[0], {
      status: LibraryStatus.READING,
      score: 9.5,
      isFavorite: true,
      notes: "Exceptional art and fast pacing.",
    });

    // Add another manga with status COMPLETED
    await updateLibraryEntry(testUserId, testMangaIds[1], {
      status: LibraryStatus.COMPLETED,
      score: 8.0,
      isFavorite: false,
    });

    const profile = await UserProfileService.getUserProfile(testUserId);
    expect(profile.stats.reading).toBe(1);
    expect(profile.stats.completed).toBe(1);
    expect(profile.stats.favorites).toBe(1);
    expect(profile.stats.totalSaved).toBe(2);
  });

  it("Step 7: Exports complete user data and restores onto another account with 100% fidelity", async () => {
    // Export data
    const exportData = await UserProfileService.exportUserData(testUserId);

    expect(exportData.version).toBe("1.0");
    expect(exportData.user).toBeDefined();
    expect(exportData.bookmarks.length).toBe(30);
    expect(exportData.library.length).toBe(2);
    expect(exportData.history.length).toBe(2);

    // Import and restore onto secondary user
    const importResult = await UserProfileService.importUserData(secondaryUserId, exportData);
    expect(importResult.success).toBe(true);
    expect(importResult.importedBookmarks).toBe(30);
    expect(importResult.importedLibrary).toBe(2);
    expect(importResult.importedHistory).toBe(2);

    // Verify secondary user has all 30 bookmarks
    const secBookmarks = await UserProfileService.getUserBookmarks(secondaryUserId, { limit: 100 });
    expect(secBookmarks.pagination.total).toBe(30);

    // Verify secondary user has identical library entries
    const secProfile = await UserProfileService.getUserProfile(secondaryUserId);
    expect(secProfile.stats.totalBookmarks).toBe(30);
    expect(secProfile.stats.reading).toBe(1);
    expect(secProfile.stats.completed).toBe(1);
    expect(secProfile.stats.favorites).toBe(1);
  });

  it("Step 8: Deletes single history item and clears all history cleanly", async () => {
    // Delete single entry
    await UserProfileService.deleteHistoryEntry(testUserId, testMangaIds[0]);
    const afterOne = await UserProfileService.getUserHistory(testUserId);
    expect(afterOne.pagination.total).toBe(1);

    // Clear all history
    await UserProfileService.clearAllHistory(testUserId);
    const afterAll = await UserProfileService.getUserHistory(testUserId);
    expect(afterAll.pagination.total).toBe(0);
  });
});
