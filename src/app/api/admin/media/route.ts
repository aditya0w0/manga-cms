import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";
import { saveFile } from "@/lib/storage";

export async function GET() {
  try {
    await requireAdmin();
    const db = await getPrisma();

    const assets = await db.mediaAsset.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ assets });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch media assets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "media";

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const stored = await saveFile(buffer, file.name, folder);
    const db = await getPrisma();

    const asset = await db.mediaAsset.create({
      data: {
        filename: file.name,
        originalName: file.name,
        mimeType: stored.mimeType,
        size: stored.size,
        url: stored.url,
        storageKey: stored.storageKey,
      },
    });

    return NextResponse.json({ success: true, asset }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to upload media asset" }, { status: 500 });
  }
}
