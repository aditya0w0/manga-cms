import { getPrisma } from "@/lib/database/prisma";
import { ContentPolicyService } from "@/modules/content-policy/content-policy-service";
import { PublicationStatus, MangaStatus, ContentType, Prisma } from "@prisma/client";

export interface MangaFilterOptions {
  query?: string;
  genreSlugs?: string[];
  status?: MangaStatus;
  contentType?: ContentType;
  publicationStatus?: PublicationStatus;
  releaseYear?: number;
  minRating?: number;
  language?: string;
  page?: number;
  limit?: number;
  sortBy?: "popularity" | "updated" | "rating" | "latest" | "title";
  sortOrder?: "asc" | "desc";
}

export async function getMangaList(options: MangaFilterOptions = {}) {
  const db = await getPrisma();
  const {
    query,
    genreSlugs,
    status,
    contentType,
    publicationStatus = PublicationStatus.PUBLISHED,
    releaseYear,
    minRating,
    language,
    page = 1,
    limit = 24,
    sortBy = "popularity",
    sortOrder = "desc",
  } = options;

  const where: Prisma.MangaWhereInput = {};

  if (publicationStatus) {
    where.publicationStatus = publicationStatus;
  }

  if (query && query.trim()) {
    const q = query.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { author: { contains: q, mode: "insensitive" } },
      { artist: { contains: q, mode: "insensitive" } },
    ];
  }

  if (status) where.status = status;
  if (contentType) where.contentType = contentType;
  if (releaseYear) where.releaseYear = releaseYear;
  if (minRating) where.rating = { gte: minRating };
  if (language) where.language = language;

  const bannedSlugs = [
    "yaoi", "bl", "boys-love", "shounen-ai", "shonen-ai",
    "yuri", "gl", "girls-love", "shoujo-ai", "shojo-ai",
    "smut", "hentai", "erotica", "pornographic", "adult", "nsfw"
  ];

  if (genreSlugs && genreSlugs.length > 0) {
    where.AND = [
      {
        genres: {
          some: {
            genre: {
              slug: { in: genreSlugs.filter((s) => !bannedSlugs.includes(s.toLowerCase())) },
            },
          },
        },
      },
      {
        genres: {
          none: {
            genre: {
              slug: { in: bannedSlugs },
            },
          },
        },
      },
    ];
  } else {
    where.genres = {
      none: {
        genre: {
          slug: { in: bannedSlugs },
        },
      },
    };
  }

  let orderBy: Prisma.MangaOrderByWithRelationInput = { viewCount: "desc" };
  if (sortBy === "popularity") orderBy = { viewCount: sortOrder };
  else if (sortBy === "updated") orderBy = { updatedAt: sortOrder };
  else if (sortBy === "rating") orderBy = { rating: sortOrder };
  else if (sortBy === "latest") orderBy = { createdAt: sortOrder };
  else if (sortBy === "title") orderBy = { title: sortOrder };

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    db.manga.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        genres: {
          include: { genre: true },
        },
        chapters: {
          where: { publicationStatus: PublicationStatus.PUBLISHED },
          orderBy: { chapterNumber: "desc" },
          take: 1,
          select: {
            id: true,
            chapterNumber: true,
            chapterTitle: true,
            releaseDate: true,
            createdAt: true,
          },
        },
        _count: {
          select: { chapters: true },
        },
      },
    }),
    db.manga.count({ where }),
  ]);

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getFeaturedManga(limit = 6) {
  const db = await getPrisma();
  return db.manga.findMany({
    where: {
      publicationStatus: PublicationStatus.PUBLISHED,
      isFeatured: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      genres: { include: { genre: true } },
      chapters: {
        where: { publicationStatus: PublicationStatus.PUBLISHED },
        orderBy: { chapterNumber: "desc" },
        take: 1,
      },
    },
  });
}

export async function getTrendingManga(limit = 10) {
  const db = await getPrisma();
  const trending = await db.manga.findMany({
    where: {
      publicationStatus: PublicationStatus.PUBLISHED,
      isTrending: true,
    },
    orderBy: { viewCount: "desc" },
    take: limit,
    include: {
      genres: { include: { genre: true } },
      chapters: {
        where: { publicationStatus: PublicationStatus.PUBLISHED },
        orderBy: { chapterNumber: "desc" },
        take: 1,
      },
    },
  });

  if (trending.length < limit) {
    const existingIds = trending.map((m) => m.id);
    const fillers = await db.manga.findMany({
      where: {
        publicationStatus: PublicationStatus.PUBLISHED,
        id: { notIn: existingIds },
      },
      orderBy: { viewCount: "desc" },
      take: limit - trending.length,
      include: {
        genres: { include: { genre: true } },
        chapters: {
          where: { publicationStatus: PublicationStatus.PUBLISHED },
          orderBy: { chapterNumber: "desc" },
          take: 1,
        },
      },
    });
    return [...trending, ...fillers];
  }

  return trending;
}

export async function getRecentlyUpdated(limit = 12) {
  const db = await getPrisma();
  return db.manga.findMany({
    where: { publicationStatus: PublicationStatus.PUBLISHED },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      genres: { include: { genre: true } },
      chapters: {
        where: { publicationStatus: PublicationStatus.PUBLISHED },
        orderBy: { chapterNumber: "desc" },
        take: 2,
      },
    },
  });
}

export async function getRandomManga() {
  const db = await getPrisma();
  const count = await db.manga.count({
    where: { publicationStatus: PublicationStatus.PUBLISHED },
  });
  if (count === 0) return null;
  const skip = Math.floor(Math.random() * count);
  return db.manga.findFirst({
    where: { publicationStatus: PublicationStatus.PUBLISHED },
    skip,
    include: {
      genres: { include: { genre: true } },
      chapters: {
        where: { publicationStatus: PublicationStatus.PUBLISHED },
        orderBy: { chapterNumber: "asc" },
        take: 1,
      },
    },
  });
}

export async function getMangaBySlug(slug: string) {
  const db = await getPrisma();
  const manga = await db.manga.findUnique({
    where: { slug },
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
      provider: { select: { id: true, name: true, slug: true } },
      chapters: {
        where: { publicationStatus: PublicationStatus.PUBLISHED },
        orderBy: { chapterNumber: "asc" },
        include: {
          _count: { select: { pages: true } },
        },
      },
      _count: {
        select: {
          chapters: true,
          userLibraries: true,
          userRatings: true,
        },
      },
    },
  });

  if (!manga) return null;

  // Strict Content Policy Guard: Exclude non-published or policy-violating manga
  if (manga.publicationStatus !== PublicationStatus.PUBLISHED) {
    return null;
  }

  const genreNames = manga.genres.map((g) => g.genre.name);
  const tagNames = manga.tags.map((t) => t.tag.name);
  const check = await ContentPolicyService.evaluateMangaContent({
    title: manga.title,
    alternativeTitles: manga.alternativeTitles,
    description: manga.description || undefined,
    genres: genreNames,
    tags: tagNames,
    rawMetadata: manga.rawMetadata,
  });

  if (!check.allowed || check.action === "REJECT") {
    return null;
  }

  return manga;
}
