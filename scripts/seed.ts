import { getPrisma } from "../src/lib/database/prisma";
import bcrypt from "bcryptjs";
import {
  Role,
  UserStatus,
  PublicationStatus,
  MangaStatus,
  ContentType,
  APIAuthType,
  ProviderHealth,
  HttpMethod,
  PaginationType,
  MappingEntityType,
} from "@prisma/client";

async function main() {
  console.log("🌱 Starting MangaCMS Database Seeding...");
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
      bio: "Chief System Administrator & Curator",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    },
  });
  console.log(`✅ Admin user seeded: ${admin.username} (admin@mangacms.local / AdminPassword123!)`);

  // 2. Seed Test Reader
  const readerSalt = await bcrypt.genSalt(10);
  const readerHash = await bcrypt.hash("ReaderPassword123!", readerSalt);

  const reader = await db.user.upsert({
    where: { username: "otaku_reader" },
    update: {},
    create: {
      email: "reader@mangacms.local",
      username: "otaku_reader",
      passwordHash: readerHash,
      role: Role.USER,
      status: UserStatus.ACTIVE,
      bio: "Avid reader of fantasy and isekai manhwa.",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
    },
  });
  console.log(`✅ Reader user seeded: ${reader.username}`);

  // 3. Seed Genres
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

  const createdGenres = new Map();
  for (const g of genresList) {
    const genre = await db.genre.upsert({
      where: { slug: g.slug },
      update: {},
      create: g,
    });
    createdGenres.set(g.slug, genre);
  }
  console.log(`✅ Seeded ${genresList.length} genres`);

  // 4. Seed Showcase Manga Titles
  const sampleManga = [
    {
      title: "Solo Leveling: Shadow Monarch",
      slug: "solo-leveling-shadow-monarch",
      alternativeTitles: ["Na Honjaman Rebeleb", "I Alone Level Up"],
      description: "In a world where hunters awakened with supernatural abilities must battle deadly monsters from invading dungeons, Sung Jinwoo is notoriously known as the weakest hunter of all mankind. After surviving a double dungeon, he receives an enigmatic quest system that grants him the unique ability to level up infinitely.",
      coverUrl: "https://uploads.mangadex.org/covers/ade0306c-f4b6-4890-9edb-1ddf04df2039/fe76445d-387f-4ff6-8340-f06403c20dbe.jpg.512.jpg",
      bannerUrl: "https://uploads.mangadex.org/covers/ade0306c-f4b6-4890-9edb-1ddf04df2039/fe76445d-387f-4ff6-8340-f06403c20dbe.jpg",
      author: "Chugong",
      artist: "DUBU (REDICE Studio)",
      releaseYear: 2018,
      status: MangaStatus.COMPLETED,
      contentType: ContentType.MANHWA,
      rating: 9.6,
      ratingCount: 14200,
      viewCount: 384000,
      isFeatured: true,
      isTrending: true,
      genres: ["action", "fantasy", "adventure"],
      chapters: [
        {
          chapterNumber: 1,
          chapterTitle: "Prologue: The Weakest Hunter",
          pages: [
            "https://uploads.mangadex.org/data/fe508ebfc50a5744ea4a956f726e2409/1-d2115bb5f0bfe7956f18216641274325e73699691b6508d92cf309ddfac661b6.jpg",
            "https://uploads.mangadex.org/data/fe508ebfc50a5744ea4a956f726e2409/2-9eb76c9a7d4e91774f3454a48c68162680a0d7d50899d5c595838ef40bf38041.jpg",
            "https://uploads.mangadex.org/data/fe508ebfc50a5744ea4a956f726e2409/3-41a4a4962eb0ae1bb7ff2b388b63e144a1fa3966fb942f2b4ffca6ecff13d2f2.jpg",
            "https://uploads.mangadex.org/data/fe508ebfc50a5744ea4a956f726e2409/4-28b9d2eb052b6d6f22e8979b940e4f35e5d326efbc2ff52382e75e929a5dfcb7.jpg",
          ],
        },
        {
          chapterNumber: 2,
          chapterTitle: "The Double Dungeon Incident",
          pages: [
            "https://uploads.mangadex.org/data/7220e3f0701d84b5473204aadd03e19b/1-761e563d2f4ad900344a14a2af6e042156f81d8037f62d7b027f645a5baa136b.jpg",
            "https://uploads.mangadex.org/data/7220e3f0701d84b5473204aadd03e19b/2-5b29470284573999588ddf8605b5d6e43e560cf86a7c62a95a291134c733096b.jpg",
            "https://uploads.mangadex.org/data/7220e3f0701d84b5473204aadd03e19b/3-d64fc019053965b2195f4628ee3e4e941198547ca750d75a40a5a31593c6fe6c.jpg",
          ],
        },
        {
          chapterNumber: 3,
          chapterTitle: "The Courage of the Weak",
          pages: [
            "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/1-872d85965e431a92919ed37e3c7fc8def639ee05190c7e05a478692babf38619.jpg",
            "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/2-8cb62ac80990b2d57a16b9988d12aea10559676077b686590543802201abd2bd.jpg",
          ],
        },
      ],
    },
    {
      title: "Omniscient Reader's Viewpoint",
      slug: "omniscient-readers-viewpoint",
      alternativeTitles: ["Jeonjijeok Dokja Sijeom"],
      description: "Dokja was an average office worker whose only hobby was reading his favorite web novel 'Three Ways to Survive in an Apocalyptic World'. But when the novel suddenly becomes reality, he is the only person who knows how the world will end.",
      coverUrl: "https://uploads.mangadex.org/covers/46392cb3-a0f8-42e4-b2ac-b89637df56d9/15ecdd17-790c-436e-a2ac-2da912eab3d8.jpg.512.jpg",
      bannerUrl: "https://uploads.mangadex.org/covers/46392cb3-a0f8-42e4-b2ac-b89637df56d9/15ecdd17-790c-436e-a2ac-2da912eab3d8.jpg",
      author: "Sing Shong",
      artist: "Sleepy-C",
      releaseYear: 2020,
      status: MangaStatus.ONGOING,
      contentType: ContentType.MANHWA,
      rating: 9.4,
      ratingCount: 9800,
      viewCount: 215000,
      isFeatured: true,
      isTrending: true,
      genres: ["action", "fantasy", "supernatural", "mystery"],
      chapters: [
        {
          chapterNumber: 1,
          chapterTitle: "Starting the Paid Service",
          pages: [
            "https://uploads.mangadex.org/data/fe508ebfc50a5744ea4a956f726e2409/1-d2115bb5f0bfe7956f18216641274325e73699691b6508d92cf309ddfac661b6.jpg",
            "https://uploads.mangadex.org/data/fe508ebfc50a5744ea4a956f726e2409/2-9eb76c9a7d4e91774f3454a48c68162680a0d7d50899d5c595838ef40bf38041.jpg",
          ],
        },
        {
          chapterNumber: 2,
          chapterTitle: "The Dokkaebi's Arrival",
          pages: [
            "https://uploads.mangadex.org/data/7220e3f0701d84b5473204aadd03e19b/1-761e563d2f4ad900344a14a2af6e042156f81d8037f62d7b027f645a5baa136b.jpg",
            "https://uploads.mangadex.org/data/7220e3f0701d84b5473204aadd03e19b/2-5b29470284573999588ddf8605b5d6e43e560cf86a7c62a95a291134c733096b.jpg",
          ],
        },
      ],
    },
    {
      title: "Chainsaw Fiend Chronicle",
      slug: "chainsaw-fiend-chronicle",
      alternativeTitles: ["Chensō Man"],
      description: "Denji is a teenage boy living with a Chainsaw Devil named Pochita. Due to the debt his father left behind, he is living a rock-bottom life while repaying his debt by harvesting devil corpses with Pochita.",
      coverUrl: "https://uploads.mangadex.org/covers/e896c48c-3150-437d-ba57-d8567eb399ae/21df1775-f537-41ab-ab75-74a210b8ce5e.jpg.512.jpg",
      bannerUrl: "https://uploads.mangadex.org/covers/e896c48c-3150-437d-ba57-d8567eb399ae/21df1775-f537-41ab-ab75-74a210b8ce5e.jpg",
      author: "Tatsuki Fujimoto",
      artist: "Tatsuki Fujimoto",
      releaseYear: 2018,
      status: MangaStatus.ONGOING,
      contentType: ContentType.MANGA,
      rating: 9.2,
      ratingCount: 11200,
      viewCount: 198000,
      isFeatured: true,
      isTrending: false,
      genres: ["action", "supernatural", "horror"],
      chapters: [
        {
          chapterNumber: 1,
          chapterTitle: "Dog & Chainsaw",
          pages: [
            "https://uploads.mangadex.org/data/fe508ebfc50a5744ea4a956f726e2409/1-d2115bb5f0bfe7956f18216641274325e73699691b6508d92cf309ddfac661b6.jpg",
            "https://uploads.mangadex.org/data/fe508ebfc50a5744ea4a956f726e2409/2-9eb76c9a7d4e91774f3454a48c68162680a0d7d50899d5c595838ef40bf38041.jpg",
          ],
        },
      ],
    },
    {
      title: "Frieren: Beyond Journey's End",
      slug: "frieren-beyond-journeys-end",
      alternativeTitles: ["Sousou no Frieren"],
      description: "The adventure is over, but life goes on for an elf mage just beginning to learn what living is all about. The elf mage Frieren and her courageous fellow adventurers have defeated the Demon King and brought peace to the land.",
      coverUrl: "https://uploads.mangadex.org/covers/b0b721ff-c388-4486-aa0f-c2b0bb321512/75a1cb6f-0554-4447-bf6e-0ef759af3f48.jpg.512.jpg",
      bannerUrl: "https://uploads.mangadex.org/covers/b0b721ff-c388-4486-aa0f-c2b0bb321512/75a1cb6f-0554-4447-bf6e-0ef759af3f48.jpg",
      author: "Kanehito Yamada",
      artist: "Tsukasa Abe",
      releaseYear: 2020,
      status: MangaStatus.ONGOING,
      contentType: ContentType.MANGA,
      rating: 9.7,
      ratingCount: 18400,
      viewCount: 420000,
      isFeatured: false,
      isTrending: true,
      genres: ["adventure", "fantasy"],
      chapters: [
        {
          chapterNumber: 1,
          chapterTitle: "The Journey's End",
          pages: [
            "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/1-872d85965e431a92919ed37e3c7fc8def639ee05190c7e05a478692babf38619.jpg",
            "https://uploads.mangadex.org/data/150377af7635ca8861764ea7a5d71b8f/2-8cb62ac80990b2d57a16b9988d12aea10559676077b686590543802201abd2bd.jpg",
          ],
        },
      ],
    },
  ];

  for (const m of sampleManga) {
    const manga = await db.manga.upsert({
      where: { slug: m.slug },
      update: {},
      create: {
        title: m.title,
        slug: m.slug,
        alternativeTitles: m.alternativeTitles,
        description: m.description,
        coverUrl: m.coverUrl,
        bannerUrl: m.bannerUrl,
        author: m.author,
        artist: m.artist,
        releaseYear: m.releaseYear,
        status: m.status,
        contentType: m.contentType,
        rating: m.rating,
        ratingCount: m.ratingCount,
        viewCount: m.viewCount,
        isFeatured: m.isFeatured,
        isTrending: m.isTrending,
        publicationStatus: PublicationStatus.PUBLISHED,
      },
    });

    // Link Genres
    for (const gSlug of m.genres) {
      const genre = createdGenres.get(gSlug);
      if (genre) {
        await db.mangaGenre.upsert({
          where: { mangaId_genreId: { mangaId: manga.id, genreId: genre.id } },
          update: {},
          create: { mangaId: manga.id, genreId: genre.id },
        });
      }
    }

    // Chapters & Pages
    for (const ch of m.chapters) {
      const chapter = await db.chapter.upsert({
        where: {
          mangaId_chapterNumber_language: {
            mangaId: manga.id,
            chapterNumber: ch.chapterNumber,
            language: "en",
          },
        },
        update: {},
        create: {
          mangaId: manga.id,
          chapterNumber: ch.chapterNumber,
          chapterTitle: ch.chapterTitle,
          language: "en",
          publicationStatus: PublicationStatus.PUBLISHED,
          releaseDate: new Date(),
        },
      });

      for (let pIdx = 0; pIdx < ch.pages.length; pIdx++) {
        await db.chapterPage.upsert({
          where: {
            chapterId_pageNumber: {
              chapterId: chapter.id,
              pageNumber: pIdx + 1,
            },
          },
          update: {},
          create: {
            chapterId: chapter.id,
            pageNumber: pIdx + 1,
            imageUrl: ch.pages[pIdx],
          },
        });
      }
    }
    console.log(`✅ Seeded manga: "${manga.title}" with ${m.chapters.length} chapters`);
  }

  // 5. Seed Built-In Configurable Public API Provider
  const mockProvider = await db.aPIProvider.upsert({
    where: { slug: "manga-simulator-api" },
    update: {},
    create: {
      name: "Global Manga REST Simulator",
      slug: "manga-simulator-api",
      description: "Pre-configured mock public REST provider for testing discovery, field mapping, and live imports.",
      baseUrl: "https://api.mangadex.org", // real public REST base url for testing
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

  // Endpoints for provider
  await db.aPIEndpoint.upsert({
    where: {
      providerId_name: {
        providerId: mockProvider.id,
        name: "search",
      },
    },
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
    where: {
      providerId_name: {
        providerId: mockProvider.id,
        name: "popular",
      },
    },
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

  // Field mappings for Manga
  await db.aPIFieldMapping.upsert({
    where: {
      providerId_entityType: {
        providerId: mockProvider.id,
        entityType: MappingEntityType.MANGA,
      },
    },
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

  console.log(`✅ Seeded API Provider: "${mockProvider.name}"`);
  console.log("🎉 Seeding completed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
