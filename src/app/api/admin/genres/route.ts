import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/database/prisma";
import { requireAdmin } from "@/lib/security/auth";

export async function GET() {
  try {
    const db = await getPrisma();
    const genres = await db.genre.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { mangas: true } },
      },
    });
    return NextResponse.json({ genres });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch genres" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: "Genre name is required" }, { status: 400 });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const db = await getPrisma();

    const genre = await db.genre.create({
      data: { name: name.trim(), slug, description },
    });

    return NextResponse.json({ success: true, genre }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create genre" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Field 'id' is required" }, { status: 400 });
    }

    const db = await getPrisma();
    await db.genre.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deleted: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete genre" }, { status: 500 });
  }
}
