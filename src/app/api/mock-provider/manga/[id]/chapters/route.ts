import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({
    status: 200,
    chapters: [
      {
        chapter_id: `chap-${params.id}-1`,
        chapter_number: 1,
        title: "Chapter 1: The Beginning",
        date: new Date().toISOString(),
      },
      {
        chapter_id: `chap-${params.id}-2`,
        chapter_number: 2,
        title: "Chapter 2: Awakening",
        date: new Date().toISOString(),
      },
    ],
  });
}
