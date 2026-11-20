import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { runImportJob } from "@/modules/import-engine/importer";
import { ImportJobType } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const body = await req.json();

    const {
      jobType = ImportJobType.SINGLE_MANGA,
      externalIds,
      importChapters = true,
      duplicateStrategy = "UPDATE",
      maxItems = 20,
    } = body;

    const summary = await runImportJob({
      providerId: params.id,
      jobType: jobType as ImportJobType,
      externalIds,
      importChapters,
      duplicateStrategy,
      maxItems,
    });

    return NextResponse.json({ success: true, summary });
  } catch (err: any) {
    console.error("Import execution error:", err);
    return NextResponse.json({ error: err.message || "Failed to execute import job" }, { status: 500 });
  }
}
