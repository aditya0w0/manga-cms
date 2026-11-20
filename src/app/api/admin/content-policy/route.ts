import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { ContentPolicyService, CORE_BANNED_CATEGORIES } from "@/modules/content-policy/content-policy-service";
import { getPrisma } from "@/lib/database/prisma";
import { PublicationStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const config = await ContentPolicyService.getConfig();
    const db = await getPrisma();

    const [totalManga, quarantinedCount, rejectedCount] = await Promise.all([
      db.manga.count(),
      db.manga.count({
        where: { publicationStatus: PublicationStatus.PENDING_REVIEW },
      }),
      db.aPIImportRecord.count({
        where: {
          errorMessage: { contains: "POLICY_VIOLATION" },
        },
      }),
    ]);

    return NextResponse.json({
      coreCategories: CORE_BANNED_CATEGORIES,
      config,
      stats: {
        totalManga,
        quarantinedCount,
        rejectedCount,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();

    const updated = await ContentPolicyService.updateConfig({
      unknownGenrePolicy: body.unknownGenrePolicy,
      customAliases: body.customAliases,
      providerMappings: body.providerMappings,
    });

    const db = await getPrisma();
    await db.auditLog.create({
      data: {
        action: "UPDATE_CONTENT_POLICY_CONFIG",
        entityType: "SiteSetting",
        entityId: "content_policy_settings",
        details: updated as any,
      },
    });

    return NextResponse.json({
      success: true,
      config: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update policy" }, { status: 400 });
  }
}
