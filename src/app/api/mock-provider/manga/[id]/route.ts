import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({
    data: {
      id: params.id,
      name: "Simulated Manga " + params.id,
      synopsis: "Full detail representation from external provider simulator.",
      thumbnail: "https://uploads.mangadex.org/covers/ade0306c-f4b6-4890-9edb-1ddf04df2039/fe76445d-387f-4ff6-8340-f06403c20dbe.jpg.512.jpg",
      author: "Simulator Author",
      artist: "Simulator Artist",
      year: 2023,
      status: "ongoing",
      type: "manhwa",
      score: 9.4,
      categories: ["Action", "Fantasy"],
    },
  });
}
