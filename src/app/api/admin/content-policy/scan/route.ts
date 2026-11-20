import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { ContentPolicyService } from "@/modules/content-policy/content-policy-service";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const action = body.action || "ARCHIVE"; // "ARCHIVE" | "QUARANTINE" | "DELETE" | "DRY_RUN"

    const result = await ContentPolicyService.runDatabaseAuditAndCleanup({
      action,
      limit: body.limit || 5000,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to scan database" }, { status: 500 });
  }
}
