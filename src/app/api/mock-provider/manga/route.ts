import { NextRequest, NextResponse } from "next/server";

const mockMangaDatabase = [
  {
    id: "ext-101",
    name: "Tower of God (Universal Sync)",
    synopsis: "What do you desire? Money and wealth? Honor and pride? Authority and power? Revenge? Or something that transcends them all? Whatever you desire: it's here, at the top of the tower.",
    thumbnail: "https://uploads.mangadex.org/covers/c07eb246-3194-46b7-9577-d64e830b8d52/e50b86a8-cf7e-4623-a551-36ba97b83072.jpg.512.jpg",
    author: "SIU",
    artist: "SIU",
    year: 2010,
    status: "ongoing",
    type: "manhwa",
    score: 9.3,
    categories: ["Action", "Adventure", "Fantasy", "Mystery"],
    total_chapters: 580,
  },
  {
    id: "ext-102",
    name: "The Beginning After the End",
    synopsis: "King Grey has unrivaled strength, wealth, and prestige in a world governed by martial ability. However, solitude lingers closely behind those with great power. Beneath the glamorous exterior of a powerful king lurks the shell of a man, devoid of purpose and will.",
    thumbnail: "https://uploads.mangadex.org/covers/48ef0e0a-500b-4652-9694-8097b3708e12/12b8004f-7cf9-42b3-a3d8-4f27beae0fe7.jpg.512.jpg",
    author: "TurtleMe",
    artist: "Fuyuki23",
    year: 2018,
    status: "ongoing",
    type: "webtoon",
    score: 9.5,
    categories: ["Action", "Adventure", "Fantasy", "Isekai"],
    total_chapters: 175,
  },
  {
    id: "ext-103",
    name: "Nano Machine",
    synopsis: "After being held in disdain and having his life put in danger, an orphan from the Demonic Cult, Cheon Yeo-Woon, gets an unexpected visit from his descendant from the future who inserts a nanomachine into his body.",
    thumbnail: "https://uploads.mangadex.org/covers/c133a870-8772-4ea5-8db6-e4cf569df91e/fc2317ad-c554-47da-9a29-79a6d36e2f13.jpg.512.jpg",
    author: "Hanjung Wolya",
    artist: "GGBG",
    year: 2020,
    status: "ongoing",
    type: "manhwa",
    score: 9.1,
    categories: ["Action", "Sci-Fi", "Martial Arts"],
    total_chapters: 210,
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || searchParams.get("query") || searchParams.get("title");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  let results = [...mockMangaDatabase];
  if (q) {
    results = results.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
  }

  const total = results.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginated = results.slice(startIndex, startIndex + limit);

  return NextResponse.json({
    status: "ok",
    results: paginated,
    pagination: {
      current: page,
      last: totalPages,
      total_records: total,
    },
  });
}
