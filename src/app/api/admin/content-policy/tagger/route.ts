import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { WdTaggerService, WdTaggerConfig } from "@/modules/content-policy/wd-tagger-service";
import { getPrisma } from "@/lib/database/prisma";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const [config, health] = await Promise.all([
      WdTaggerService.getConfig(),
      WdTaggerService.checkHealth(),
    ]);

    return NextResponse.json({
      config,
      health,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdmin();
    const body = await req.json();

    const patch: Partial<WdTaggerConfig> = {};

    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (typeof body.endpoint === "string" && body.endpoint.trim()) {
      patch.endpoint = body.endpoint.trim();
    }
    if (typeof body.batchSize === "number" && body.batchSize > 0) {
      patch.batchSize = Math.min(128, Math.max(1, Math.round(body.batchSize)));
    }
    if (typeof body.hitlLowerThreshold === "number") {
      patch.hitlLowerThreshold = Math.min(1, Math.max(0, body.hitlLowerThreshold));
    }
    if (typeof body.autoRejectThreshold === "number") {
      patch.autoRejectThreshold = Math.min(1, Math.max(0, body.autoRejectThreshold));
    }
    if (typeof body.explicitRatingThreshold === "number") {
      patch.explicitRatingThreshold = Math.min(1, Math.max(0, body.explicitRatingThreshold));
    }
    if (typeof body.questionableRatingThreshold === "number") {
      patch.questionableRatingThreshold = Math.min(1, Math.max(0, body.questionableRatingThreshold));
    }
    if (typeof body.maxQueueWaitMs === "number") {
      patch.maxQueueWaitMs = Math.min(500, Math.max(5, Math.round(body.maxQueueWaitMs)));
    }

    const updated = await WdTaggerService.updateConfig(patch);

    const db = await getPrisma();
    await db.auditLog.create({
      data: {
        action: "UPDATE_WD_TAGGER_CONFIG",
        entityType: "SiteSetting",
        entityId: "wd_tagger_config",
        userId: adminUser.id,
        details: updated as any,
      },
    });

    return NextResponse.json({
      success: true,
      config: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update tagger configuration" },
      { status: 400 }
    );
  }
}
