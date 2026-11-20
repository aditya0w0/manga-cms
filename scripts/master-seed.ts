import { getPrisma } from "../src/lib/database/prisma";
import bcrypt from "bcryptjs";
import fs from "fs";
import {
  Role,
  UserStatus,
  PublicationStatus,
  MangaStatus,
  ContentType,
  ProviderHealth,
  APIAuthType,
  HttpMethod,
  PaginationType,
  MappingEntityType,
} from "@prisma/client";

async function main() {
  console.log("🚀 Starting MangaCMS Master Seed with REAL Manga Scan Pages...");
  const db = await getPrisma();

  // 1. Seed Super Admin
  const adminSalt = await bcrypt.genSalt(10);
  const adminHash = await bcrypt.hash("AdminPassword123!", adminSalt);
  const admin = await db.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      email: "admin@mangacms.local",
      username: "admin",
      passwordHash: adminHash,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      bio: "Chief System Administrator",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    },
  });
  console.log(`✅ Admin user seeded: ${admin.username}`);

  // 2. Seed Genres
  const genresList = [
    { name: "Action", slug: "action", description: "High-intensity battles and adrenaline-pumping sequences." },
    { name: "Adventure", slug: "adventure", description: "Journeys into uncharted territories and grand quests." },
    { name: "Fantasy", slug: "fantasy", description: "Magical worlds, mythical creatures, and sorcery." },
    { name: "Romance", slug: "romance", description: "Stories of love, emotional depth, and relationships." },
    { name: "Sci-Fi", slug: "sci-fi", description: "Futuristic technology, space exploration, and cybernetics." },
    { name: "Supernatural", slug: "supernatural", description: "Ghosts, spirits, deities, and occult mysteries." },
    { name: "Isekai", slug: "isekai", description: "Reincarnation or transport into an alternate universe." },
    { name: "Martial Arts", slug: "martial-arts", description: "Cultivation, hand-to-hand combat, and ancient sects." },
    { name: "Mystery", slug: "mystery", description: "Deductive detective cases, conspiracies, and enigmas." },
  ];

  for (const g of genresList) {
    await db.genre.upsert({
      where: { slug: g.slug },
      update: {},
      create: g,
    });
  }
  console.log(`✅ Seeded ${genresList.length} genres`);

  // 3. Seed Providers (Comix API + Global Manga REST Simulator)
  const provider = await db.aPIProvider.upsert({
    where: { slug: "comix-api" },
    update: { isEnabled: true, healthStatus: ProviderHealth.HEALTHY },
    create: {
      name: "Comix API",
      slug: "comix-api",
      baseUrl: "https://comix-api.vercel.app",
      isEnabled: true,
      rateLimitRequests: 60,
      rateLimitWindowSec: 60,
      timeoutMs: 12000,
      healthStatus: ProviderHealth.HEALTHY,
    },
  });
  console.log(`✅ Seeded API Provider: Comix API`);

  const mockProvider = await db.aPIProvider.upsert({
    where: { slug: "manga-simulator-api" },
    update: { isEnabled: true, healthStatus: ProviderHealth.HEALTHY },
    create: {
      name: "Global Manga REST Simulator",
      slug: "manga-simulator-api",
      description: "Pre-configured mock public REST provider for testing discovery, field mapping, and live imports.",
      baseUrl: "https://api.mangadex.org",
      defaultLanguage: "en",
      authType: APIAuthType.NONE,
      healthStatus: ProviderHealth.HEALTHY,
      lastCheckedAt: new Date(),
      timeoutMs: 10000,
      rateLimitRequests: 60,
      rateLimitWindowSec: 60,
      isEnabled: true,
    },
  });

  await db.aPIEndpoint.upsert({
    where: { providerId_name: { providerId: mockProvider.id, name: "search" } },
    update: {},
    create: {
      providerId: mockProvider.id,
      name: "search",
      method: HttpMethod.GET,
      urlTemplate: "/manga",
      queryParams: { limit: 10 },
      paginationType: PaginationType.PAGE,
      cacheTtlSec: 300,
    },
  });

  await db.aPIEndpoint.upsert({
    where: { providerId_name: { providerId: mockProvider.id, name: "popular" } },
    update: {},
    create: {
      providerId: mockProvider.id,
      name: "popular",
      method: HttpMethod.GET,
      urlTemplate: "/manga",
      queryParams: { limit: 15, "order[followedCount]": "desc" },
      paginationType: PaginationType.PAGE,
      cacheTtlSec: 300,
    },
  });

  await db.aPIFieldMapping.upsert({
    where: { providerId_entityType: { providerId: mockProvider.id, entityType: MappingEntityType.MANGA } },
    update: {},
    create: {
      providerId: mockProvider.id,
      entityType: MappingEntityType.MANGA,
      mappings: {
        id: { path: "id", required: true },
        title: { path: "attributes.title.en", defaultValue: "Untitled Series" },
        description: { path: "attributes.description.en", defaultValue: "No description available." },
        status: { path: "attributes.status", transform: "uppercase" },
        release_year: { path: "attributes.year", transform: "to_integer" },
        content_type: { path: "type", transform: "uppercase" },
      },
    },
  });
  console.log(`✅ Seeded API Provider: Global Manga REST Simulator`);

  // 4. Fetch Real Manga Pages from MangaDex
  console.log("📥 Fetching authentic manga scan pages from MangaDex CDN...");
  const rawChapters: { pages: string[] }[] = [];
  try {
    const mdRes = await fetch(
      "https://api.mangadex.org/chapter?limit=10&translatedLanguage[]=en&contentRating[]=safe&order[createdAt]=desc",
      { headers: { "User-Agent": "MangaCMS/1.0" } }
    );
    const mdData = await mdRes.json();
    for (const ch of mdData.data || []) {
      if (ch.attributes.pages < 4) continue;
      const sRes = await fetch("https://api.mangadex.org/at-home/server/" + ch.id, {
        headers: { "User-Agent": "MangaCMS/1.0" },
      });
      if (!sRes.ok) continue;
      const sData = await sRes.json();
      const hash = sData.chapter?.hash;
      const files = sData.chapter?.data || [];
      if (hash && files.length > 0) {
        rawChapters.push({
          pages: files.slice(0, 10).map((f: string) => `https://uploads.mangadex.org/data/${hash}/${f}`),
        });
      }
      if (rawChapters.length >= 6) break;
    }
  } catch (e) {
    console.warn("Could not fetch fresh MangaDex scans, using fallback cache...", e);
  }

  // Guaranteed fallback authentic manga scan pages if MangaDex rate limits
  if (rawChapters.length === 0) {
    rawChapters.push({
      pages: [
        "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/1-872d85965e431a92919ed37e3c7fc8def639ee05190c7e05a478692babf38619.jpg",
        "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/2-8cb62ac80990b2d57a16b9988d12aea10559676077b686590543802201abd2bd.jpg",
        "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/3-12777d4c38babade06991c145716ac6eb5192d0ddc23c71cd9247f6caf00407f.jpg",
        "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/4-f87c538da264c92b8d4bbbe924d5e94b28db761595d2cba560091811e582845c.jpg",
      ],
    });
  }
  console.log(`✅ Loaded ${rawChapters.length} real manga chapter page templates`);

  // 5. Seed Core Showcase Series
  const showcase = [
    {
      title: "Solo Leveling: Shadow Monarch",
      slug: "solo-leveling-shadow-monarch",
      coverUrl: "https://uploads.mangadex.org/covers/ade0306c-f4b6-4890-9edb-1ddf04df2039/fe76445d-387f-4ff6-8340-f06403c20dbe.jpg.512.jpg",
      bannerUrl: "https://uploads.mangadex.org/covers/ade0306c-f4b6-4890-9edb-1ddf04df2039/fe76445d-387f-4ff6-8340-f06403c20dbe.jpg",
      description: "Sung Jinwoo is notoriously known as the weakest hunter of all mankind. After surviving a double dungeon, he receives an enigmatic quest system that grants him the unique ability to level up infinitely.",
      rating: 9.6,
      viewCount: 384000,
      isFeatured: true,
      isTrending: true,
      genres: ["action", "fantasy", "adventure"],
    },
    {
      title: "Frieren: Beyond Journey's End",
      slug: "frieren-beyond-journeys-end",
      coverUrl: "https://uploads.mangadex.org/covers/b0b721ff-c388-4486-aa0f-c2b0bb321512/75a1cb6f-0554-4447-bf6e-0ef759af3f48.jpg.512.jpg",
      bannerUrl: "https://uploads.mangadex.org/covers/b0b721ff-c388-4486-aa0f-c2b0bb321512/75a1cb6f-0554-4447-bf6e-0ef759af3f48.jpg",
      description: "The mage Frieren defeated the Demon King alongside the hero Himmel's party after a 10-year quest. As an elf, she lives for over a thousand years. She embarks on a journey to understand human hearts.",
      rating: 9.7,
      viewCount: 420000,
      isFeatured: true,
      isTrending: true,
      genres: ["adventure", "fantasy"],
    },
    {
      title: "Omniscient Reader's Viewpoint",
      slug: "omniscient-readers-viewpoint",
      coverUrl: "https://uploads.mangadex.org/covers/46392cb3-a0f8-42e4-b2ac-b89637df56d9/15ecdd17-790c-436e-a2ac-2da912eab3d8.jpg.512.jpg",
      bannerUrl: "https://uploads.mangadex.org/covers/46392cb3-a0f8-42e4-b2ac-b89637df56d9/15ecdd17-790c-436e-a2ac-2da912eab3d8.jpg",
      description: "Kim Dokja is an ordinary office worker whose only hobby is reading his favorite web novel. But when the novel suddenly becomes reality, he is the only person who knows how the world will end.",
      rating: 9.4,
      viewCount: 215000,
      isFeatured: true,
      isTrending: true,
      genres: ["action", "fantasy", "supernatural", "mystery"],
    },
    {
      title: "Chainsaw Fiend Chronicle",
      slug: "chainsaw-fiend-chronicle",
      coverUrl: "https://uploads.mangadex.org/covers/e896c48c-3150-437d-ba57-d8567eb399ae/21df1775-f537-41ab-ab75-74a210b8ce5e.jpg.512.jpg",
      bannerUrl: "https://uploads.mangadex.org/covers/e896c48c-3150-437d-ba57-d8567eb399ae/21df1775-f537-41ab-ab75-74a210b8ce5e.jpg",
      description: "Denji is a young man living in extreme poverty, working off his deceased father's debt to the yakuza by harvesting devil corpses with Pochita, the Chainsaw Devil.",
      rating: 9.2,
      viewCount: 198000,
      isFeatured: true,
      isTrending: true,
      genres: ["action", "supernatural"],
    },
  ];

  for (const s of showcase) {
    const manga = await db.manga.upsert({
      where: { slug: s.slug },
      update: {
        coverUrl: s.coverUrl,
        bannerUrl: s.bannerUrl,
        publicationStatus: PublicationStatus.PUBLISHED,
        isFeatured: s.isFeatured,
        isTrending: s.isTrending,
      },
      create: {
        title: s.title,
        slug: s.slug,
        coverUrl: s.coverUrl,
        bannerUrl: s.bannerUrl,
        description: s.description,
        rating: s.rating,
        viewCount: s.viewCount,
        isFeatured: s.isFeatured,
        isTrending: s.isTrending,
        status: MangaStatus.ONGOING,
        contentType: ContentType.MANHWA,
        publicationStatus: PublicationStatus.PUBLISHED,
      },
    });

    for (const gSlug of s.genres) {
      const g = await db.genre.findUnique({ where: { slug: gSlug } });
      if (g) {
        await db.mangaGenre.upsert({
          where: { mangaId_genreId: { mangaId: manga.id, genreId: g.id } },
          update: {},
          create: { mangaId: manga.id, genreId: g.id },
        });
      }
    }
  }

  // 6. Fetch Comix Feed and Upsert 50 Titles
  console.log("📥 Fetching Comix catalog...");
  try {
    const cRes = await fetch("https://comix-api.vercel.app/api/manga/home");
    const cData = await cRes.json();
    const popular = cData.popular || [];

    for (let i = 0; i < popular.length; i++) {
      const item = popular[i];
      const title = item.title || "Untitled Manga";
      const cleanSlug = item.id || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      let cover = item.img || "";
      if (cover && !cover.startsWith("http")) {
        cover = "https://comix.to" + (cover.startsWith("/") ? "" : "/") + cover;
      }

      await db.manga.upsert({
        where: { slug: cleanSlug },
        update: {
          publicationStatus: PublicationStatus.PUBLISHED,
          coverUrl: cover,
          viewCount: 50000 - i * 800,
          isFeatured: i < 3,
          isTrending: i < 8,
        },
        create: {
          title,
          slug: cleanSlug,
          coverUrl: cover,
          providerId: provider.id,
          externalId: item.id || cleanSlug,
          publicationStatus: PublicationStatus.PUBLISHED,
          isFeatured: i < 3,
          isTrending: i < 8,
          viewCount: 50000 - i * 800,
          status: MangaStatus.ONGOING,
          contentType: ContentType.MANGA,
          rating: 8.5 + (i % 10) * 0.1,
          rawMetadata: item,
        },
      });
    }
    console.log(`✅ Upserted ${popular.length} Comix series`);
  } catch (err) {
    console.warn("Could not fetch Comix feed:", err);
  }

  // 7. Seed Real Manga Chapters and Real Pages for ALL Series
  const allManga = await db.manga.findMany({
    include: { chapters: true },
  });

  console.log(`⚙️ Seeding real manga chapters across ${allManga.length} series...`);
  let totalChaptersCreated = 0;
  let totalPagesCreated = 0;

  for (let mIdx = 0; mIdx < allManga.length; mIdx++) {
    const m = allManga[mIdx];
    if (m.chapters.length > 0) {
      // If chapter already has pages, skip
      const existingPages = await db.chapterPage.count({
        where: { chapter: { mangaId: m.id } },
      });
      if (existingPages > 0) continue;
    }

    let targetTotal = 30;
    const SPECIAL_COUNTS: Record<string, number> = {
      "qqwrm-full-time-awakening": 170,
      "solo-leveling-shadow-monarch": 179,
      "chainsaw-fiend-chronicle": 175,
      "omniscient-readers-viewpoint": 150,
      "frieren-beyond-journeys-end": 130,
    };

    if (SPECIAL_COUNTS[m.slug]) {
      targetTotal = SPECIAL_COUNTS[m.slug];
    } else {
      const rawMeta = m.rawMetadata as any;
      if (rawMeta?.chapter && typeof rawMeta.chapter === "string") {
        const match = rawMeta.chapter.match(/\d+(\.\d+)?/);
        if (match) {
          targetTotal = Math.round(parseFloat(match[0]));
        }
      }
    }
    if (!targetTotal || targetTotal < 10) targetTotal = 30;

    const chapterData = [];
    const now = Date.now();
    for (let cNum = 1; cNum <= targetTotal; cNum++) {
      let title = `Chapter ${cNum}`;
      if (cNum === 1) title = `Chapter 1: The Beginning`;
      else if (cNum === 2) title = `Chapter 2: The Path Forward`;
      else if (cNum === targetTotal) title = `Chapter ${targetTotal}: Latest Release`;
      else title = `Chapter ${cNum}: Episode ${cNum}`;

      chapterData.push({
        mangaId: m.id,
        chapterNumber: cNum,
        chapterTitle: title,
        language: "en",
        scanlationGroup: "Official Translations",
        publicationStatus: PublicationStatus.PUBLISHED,
        releaseDate: new Date(now - (targetTotal - cNum) * 86400000 * 3),
      });
    }

    for (let i = 0; i < chapterData.length; i += 100) {
      await db.chapter.createMany({
        data: chapterData.slice(i, i + 100),
        skipDuplicates: true,
      });
    }

    const createdChapters = await db.chapter.findMany({
      where: { mangaId: m.id },
      select: { id: true, chapterNumber: true },
    });

    const pagesToInsert: { chapterId: string; pageNumber: number; imageUrl: string }[] = [];
    for (const ch of createdChapters) {
      const template = rawChapters[(mIdx + ch.chapterNumber) % rawChapters.length];
      for (let pIdx = 0; pIdx < template.pages.length; pIdx++) {
        pagesToInsert.push({
          chapterId: ch.id,
          pageNumber: pIdx + 1,
          imageUrl: template.pages[pIdx],
        });
      }
    }

    for (let i = 0; i < pagesToInsert.length; i += 500) {
      await db.chapterPage.createMany({
        data: pagesToInsert.slice(i, i + 500),
        skipDuplicates: true,
      });
    }

    totalChaptersCreated += createdChapters.length;
    totalPagesCreated += pagesToInsert.length;
  }

  console.log(`🎉 Master Seed Complete! Created ${totalChaptersCreated} chapters with ${totalPagesCreated} authentic manga pages.`);
  const mangaCount = await db.manga.count();
  const chapterCount = await db.chapter.count();
  const pageCount = await db.chapterPage.count();
  console.log(`📊 Current DB Stats: ${mangaCount} Manga | ${chapterCount} Chapters | ${pageCount} Real Manga Pages`);
}

main().catch(console.error);
