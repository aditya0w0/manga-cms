import { getPrisma } from "../src/lib/database/prisma";
import { MediaStorageService } from "../src/modules/media/media-storage-service";

interface ChapterPlan {
  chapterNumber: number;
  title: string;
  startIndex: number;
  endIndex: number;
}

interface MangaConfig {
  title: string;
  slug: string;
  altTitles: string[];
  description: string;
  author: string;
  artist: string;
  genres: string[];
  contentType: "MANGA" | "MANHWA" | "WEBTOON";
  contentRating: "SAFE" | "SUGGESTIVE" | "MATURE";
  releaseYear: number;
  rating: number;
  viewCount: number;
  isFeatured: boolean;
  isTrending: boolean;
  coverQuery: string;
  mangaDexChapterId: string;
  chapters: ChapterPlan[];
}

const SEED_MANGA: MangaConfig[] = [
  {
    title: "Solo Leveling: Shadow Monarch",
    slug: "solo-leveling-shadow-monarch",
    altTitles: ["Na Honjaman Level Up", "I Alone Level Up", "나 혼자만 레벨업"],
    description: "Ten years ago, after the Gate that connected the real world with the monster world opened, ordinary people received the power to hunt monsters. Sung Jin-Woo, an E-rank hunter known as the World's Weakest, finds a mysterious quest window that allows him alone to level up.",
    author: "Chugong",
    artist: "DUBU (REDICE STUDIO)",
    genres: ["Action", "Fantasy", "Supernatural"],
    contentType: "MANHWA",
    contentRating: "SAFE",
    releaseYear: 2018,
    rating: 9.8,
    viewCount: 1450000,
    isFeatured: true,
    isTrending: true,
    coverQuery: "Solo Leveling",
    mangaDexChapterId: "94d5fe73-cc6c-4cb0-96bb-556945862419",
    chapters: [
      { chapterNumber: 1, title: "Chapter 1: The E-Rank Hunter", startIndex: 0, endIndex: 12 },
      { chapterNumber: 2, title: "Chapter 2: The Double Dungeon", startIndex: 12, endIndex: 24 },
      { chapterNumber: 3, title: "Chapter 3: The Secret Quest", startIndex: 24, endIndex: 36 },
    ],
  },
  {
    title: "Frieren: Beyond Journey's End",
    slug: "frieren-beyond-journeys-end",
    altTitles: ["Sousou no Frieren", "葬送のフリーレン"],
    description: "The demon king has been defeated, and the victorious hero party returns home before disbanding. The four—mage Frieren, hero Himmel, priest Heiter, and warrior Eisen—reminisce over their decade-long journey. For the long-lived elf Frieren, time passes differently, embarking on a new quest to understand humanity.",
    author: "Kanehito Yamada",
    artist: "Tsukasa Abe",
    genres: ["Adventure", "Fantasy", "Drama", "Slice of Life"],
    contentType: "MANGA",
    contentRating: "SAFE",
    releaseYear: 2020,
    rating: 9.7,
    viewCount: 1250000,
    isFeatured: true,
    isTrending: true,
    coverQuery: "Sousou no Frieren",
    mangaDexChapterId: "a1105d32-6fd4-4b42-bf29-3b69e6a6ffab",
    chapters: [
      { chapterNumber: 1, title: "Chapter 1: The End of the Journey", startIndex: 0, endIndex: 14 },
      { chapterNumber: 2, title: "Chapter 2: The Priest's Lie", startIndex: 14, endIndex: 28 },
    ],
  },
  {
    title: "Omniscient Reader's Viewpoint",
    slug: "omniscient-readers-viewpoint",
    altTitles: ["Jeonjijeok Dokja Sijeom", "전지적 독자 시점"],
    description: "Kim Dokja is an ordinary office worker whose sole hobby is reading his favorite web novel, 'Three Ways to Survive the Apocalypse'. But when the novel suddenly becomes reality, he is the only person who knows how the world will end.",
    author: "Sing Shong",
    artist: "Sleepy-C",
    genres: ["Action", "Fantasy", "Supernatural", "Mystery"],
    contentType: "MANHWA",
    contentRating: "SAFE",
    releaseYear: 2020,
    rating: 9.6,
    viewCount: 980000,
    isFeatured: true,
    isTrending: false,
    coverQuery: "Omniscient Reader's Viewpoint",
    mangaDexChapterId: "55aee379-7ceb-48d3-bec0-67d7cc7e3675",
    chapters: [
      { chapterNumber: 1, title: "Chapter 1: Starting the Paid Service", startIndex: 0, endIndex: 10 },
      { chapterNumber: 2, title: "Chapter 2: The First Scenario", startIndex: 10, endIndex: 20 },
    ],
  },
  {
    title: "Chainsaw Man",
    slug: "chainsaw-man",
    altTitles: ["Chainsaw Man", "チェンソーマン"],
    description: "Denji was a small-time devil hunter just trying to survive in a harsh world. After being killed on a job, he is revived by his pet devil Pochita and becomes Chainsaw Man!",
    author: "Tatsuki Fujimoto",
    artist: "Tatsuki Fujimoto",
    genres: ["Action", "Supernatural", "Horror", "Comedy"],
    contentType: "MANGA",
    contentRating: "MATURE",
    releaseYear: 2018,
    rating: 9.4,
    viewCount: 890000,
    isFeatured: false,
    isTrending: true,
    coverQuery: "Chainsaw Man",
    mangaDexChapterId: "98fa0811-939c-4c9f-9a5c-594aaf64f980",
    chapters: [
      { chapterNumber: 1, title: "Chapter 1: Dog & Chainsaw", startIndex: 0, endIndex: 12 },
      { chapterNumber: 2, title: "Chapter 2: The Place Where Pochita Is", startIndex: 12, endIndex: 24 },
      { chapterNumber: 3, title: "Chapter 3: Arrival in Tokyo", startIndex: 24, endIndex: 36 },
    ],
  },
  {
    title: "Spy x Family",
    slug: "spy-x-family",
    altTitles: ["SPY x FAMILY", "スパイファミリー"],
    description: "Master spy Twilight must build a fake family to infiltrate an elite school and preserve world peace. Unbeknownst to him, his adopted daughter is a telepath and his fake wife is a lethal assassin!",
    author: "Tatsuya Endo",
    artist: "Tatsuya Endo",
    genres: ["Action", "Comedy", "Slice of Life"],
    contentType: "MANGA",
    contentRating: "SAFE",
    releaseYear: 2019,
    rating: 9.5,
    viewCount: 760000,
    isFeatured: false,
    isTrending: true,
    coverQuery: "Spy x Family",
    mangaDexChapterId: "07bad4a8-f3b1-40b1-825e-a532aae41227",
    chapters: [
      { chapterNumber: 1, title: "Chapter 1: Mission 1", startIndex: 0, endIndex: 12 },
      { chapterNumber: 2, title: "Chapter 2: Mission 2", startIndex: 12, endIndex: 24 },
    ],
  },
  {
    title: "I Became A Married Man in Another World",
    slug: "i-became-a-married-man-in-another-world",
    altTitles: ["Isekai de Yubunamu ni Natta Hanashi", "이세계에서 유부남이 된 썰"],
    description: "After a sudden accident, an ordinary young man awakens in a magical realm only to discover he has been married to a beautiful high noblewoman! A heartfelt romantic comedy in another world.",
    author: "Park Sung-min",
    artist: "Kim Tae-hoon",
    genres: ["Romance", "Fantasy", "Comedy", "Slice of Life"],
    contentType: "MANHWA",
    contentRating: "SAFE",
    releaseYear: 2023,
    rating: 9.3,
    viewCount: 654000,
    isFeatured: false,
    isTrending: false,
    coverQuery: "Kusuriya no Hitorigoto",
    mangaDexChapterId: "d388d4f8-bff5-4679-8d3b-4fffc7c1cef3",
    chapters: [
      { chapterNumber: 1, title: "Chapter 1: Unexpected Nuptials", startIndex: 0, endIndex: 12 },
      { chapterNumber: 2, title: "Chapter 2: Household Affairs", startIndex: 12, endIndex: 24 },
    ],
  },
];

async function fetchAniListCover(searchQuery: string): Promise<Buffer | null> {
  try {
    const query = `
      query ($search: String) {
        Media(search: $search, type: MANGA) {
          coverImage { extraLarge large }
        }
      }
    `;
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { search: searchQuery } }),
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json();
    const coverUrl = json.data?.Media?.coverImage?.extraLarge || json.data?.Media?.coverImage?.large;
    if (!coverUrl) return null;

    const imgRes = await fetch(coverUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!imgRes.ok) return null;
    return Buffer.from(await imgRes.arrayBuffer());
  } catch (err) {
    console.warn(`[AniList Cover Error for ${searchQuery}]:`, err);
    return null;
  }
}

async function fetchMangaDexPagesRange(
  chapterId: string,
  startIndex: number,
  endIndex: number
): Promise<{ filename: string; buffer: Buffer }[]> {
  const pages: { filename: string; buffer: Buffer }[] = [];
  try {
    const atHomeRes = await fetch(`https://api.mangadex.org/at-home/server/${chapterId}`, {
      headers: { "User-Agent": "MangaCMS/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!atHomeRes.ok) return pages;

    const atHomeJson = await atHomeRes.json();
    const baseUrl = atHomeJson.baseUrl;
    const hash = atHomeJson.chapter?.hash;
    const dataFiles = atHomeJson.chapter?.data || [];

    const selectedFiles = dataFiles.slice(startIndex, endIndex);

    for (let i = 0; i < selectedFiles.length; i++) {
      const fileName = selectedFiles[i];
      const pageUrl = `${baseUrl}/data/${hash}/${fileName}`;
      try {
        const imgRes = await fetch(pageUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(10000),
        });
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          pages.push({ filename: fileName, buffer: buf });
        }
      } catch {}
    }
  } catch (err) {
    console.warn(`[MangaDex Fetch Error for ${chapterId}]:`, err);
  }
  return pages;
}

export async function runMasterSeed() {
  console.log("=== STARTING MASTER SELF-HOSTED CMS SEED ===");
  const db = await getPrisma();

  // 1. Purge all legacy data
  console.log("Purging all previous chapter pages, chapters, and manga...");
  await db.chapterPage.deleteMany({});
  await db.chapter.deleteMany({});
  await db.mangaGenre.deleteMany({});
  await db.mangaAuthor.deleteMany({});
  await db.readingProgress.deleteMany({});
  await db.bookmark.deleteMany({});
  await db.userLibrary.deleteMany({});
  await db.readingHistory.deleteMany({});
  await db.manga.deleteMany({});
  console.log("Database cleared.");

  for (const cfg of SEED_MANGA) {
    console.log(`\n========================================`);
    console.log(`Processing: "${cfg.title}" (${cfg.slug})`);

    // Download and store cover locally
    let coverMedia = null;
    const coverBuf = await fetchAniListCover(cfg.coverQuery);
    if (coverBuf && coverBuf.length > 0) {
      coverMedia = await MediaStorageService.storeMedia(coverBuf, `${cfg.slug}-cover.jpg`);
      console.log(`Saved local cover: ${coverMedia.storageKey} (${coverMedia.fileSize} bytes)`);
    }

    // Upsert Author
    let authorRecord = await db.author.findFirst({ where: { name: cfg.author } });
    if (!authorRecord) {
      authorRecord = await db.author.create({
        data: { name: cfg.author, biography: `Creator of ${cfg.title}` },
      });
    }

    // Create Manga
    const manga = await db.manga.create({
      data: {
        title: cfg.title,
        slug: cfg.slug,
        alternativeTitles: cfg.altTitles,
        description: cfg.description,
        author: cfg.author,
        artist: cfg.artist,
        contentType: cfg.contentType,
        contentRating: cfg.contentRating,
        releaseYear: cfg.releaseYear,
        rating: cfg.rating,
        ratingCount: Math.round(cfg.viewCount / 100),
        viewCount: cfg.viewCount,
        isFeatured: cfg.isFeatured,
        isTrending: cfg.isTrending,
        coverImageId: coverMedia?.id || null,
        coverUrl: coverMedia ? `/api/v1/media/${coverMedia.storageKey}` : null,
        publicationStatus: "PUBLISHED",
      },
    });

    // Link Author
    await db.mangaAuthor.create({
      data: {
        mangaId: manga.id,
        authorId: authorRecord.id,
        contributionRole: "STORY",
      },
    });

    // Link Genres
    for (const gName of cfg.genres) {
      const gSlug = gName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      let genreRecord = await db.genre.findUnique({ where: { slug: gSlug } });
      if (!genreRecord) {
        genreRecord = await db.genre.create({ data: { name: gName, slug: gSlug } });
      }
      await db.mangaGenre.create({
        data: { mangaId: manga.id, genreId: genreRecord.id },
      });
    }

    // Create Chapters and store Pages
    for (const chPlan of cfg.chapters) {
      console.log(`  Downloading Chapter ${chPlan.chapterNumber}: "${chPlan.title}" (indices ${chPlan.startIndex}..${chPlan.endIndex})...`);
      const pages = await fetchMangaDexPagesRange(
        cfg.mangaDexChapterId,
        chPlan.startIndex,
        chPlan.endIndex
      );

      const chapter = await db.chapter.create({
        data: {
          mangaId: manga.id,
          chapterNumber: chPlan.chapterNumber,
          chapterTitle: chPlan.title,
          title: chPlan.title,
          slug: `chapter-${chPlan.chapterNumber}`,
          publicationStatus: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      console.log(`  Storing ${pages.length} pages in Media Storage for Chapter ${chPlan.chapterNumber}...`);
      for (let pIdx = 0; pIdx < pages.length; pIdx++) {
        const pageItem = pages[pIdx];
        const pageMedia = await MediaStorageService.storeMedia(
          pageItem.buffer,
          `${cfg.slug}-ch${chPlan.chapterNumber}-p${pIdx + 1}.jpg`
        );

        await db.chapterPage.create({
          data: {
            chapterId: chapter.id,
            pageNumber: pIdx + 1,
            imageId: pageMedia.id,
            imageUrl: `/api/v1/media/${pageMedia.storageKey}`,
            storageKey: pageMedia.storageKey,
            width: pageMedia.width || 800,
            height: pageMedia.height || 1200,
            fileSize: pageMedia.fileSize,
          },
        });
      }
      console.log(`  Finished Chapter ${chPlan.chapterNumber} with ${pages.length} pages.`);
    }
  }

  console.log("=== MASTER SELF-HOSTED CMS SEED FINISHED ===");
}

if (require.main === module) {
  runMasterSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Fatal seed error:", err);
      process.exit(1);
    });
}
