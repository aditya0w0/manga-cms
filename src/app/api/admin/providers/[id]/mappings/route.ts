import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { getPrisma } from "@/lib/database/prisma";
import { MappingEntityType } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const db = await getPrisma();

    const { entityType = "MANGA", mappings } = body;

    if (!mappings || typeof mappings !== "object") {
      return NextResponse.json({ error: "Mappings object is required" }, { status: 400 });
    }

    const fieldMapping = await db.aPIFieldMapping.upsert({
      where: {
        providerId_entityType: {
          providerId: params.id,
          entityType: entityType as MappingEntityType,
        },
      },
      update: {
        mappings,
      },
      create: {
        providerId: params.id,
        entityType: entityType as MappingEntityType,
        mappings,
      },
    });

    await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "FIELD_MAPPING_UPDATED",
        entityType: "APIFieldMapping",
        entityId: fieldMapping.id,
        details: { providerId: params.id, entityType },
      },
    });

    return NextResponse.json({ success: true, fieldMapping });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save field mappings" }, { status: 500 });
  }
}
