import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/auth";
import { getUserPreferences, saveUserPreferences } from "@/modules/library/library-service";
import { ReadingMode, ReadingDirection, ImageScaling, ReaderBg } from "@prisma/client";
import { z } from "zod";

const UpdatePreferencesSchema = z.object({
  readingMode: z.nativeEnum(ReadingMode).optional(),
  readingDirection: z.nativeEnum(ReadingDirection).optional(),
  imageScaling: z.nativeEnum(ImageScaling).optional(),
  backgroundColor: z.nativeEnum(ReaderBg).optional(),
  pageGap: z.number().int().min(0).max(100).optional(),
  preloadCount: z.number().int().min(0).max(10).optional(),
  showPageNumbers: z.boolean().optional(),
  keyboardShortcuts: z.record(z.string(), z.any()).optional().nullable(),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      // Guest reader: do not return mock defaults that overwrite client preferences
      return NextResponse.json({
        guest: true,
        preference: null,
      });
    }

    const preference = await getUserPreferences(user.id);
    return NextResponse.json({ preference });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load preferences" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = UpdatePreferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Invalid preference payload: ${parsed.error.issues[0]?.message || "Validation failed"}` },
        { status: 400 }
      );
    }

    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: true, guest: true, preference: parsed.data });
    }

    const updated = await saveUserPreferences(user.id, parsed.data);
    return NextResponse.json({ success: true, preference: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save preferences" }, { status: 500 });
  }
}
