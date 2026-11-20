import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/auth";
import { getDashboardStats } from "@/modules/cms/dashboard-service";

export async function GET() {
  try {
    await requireAdmin();
    const stats = await getDashboardStats();
    return NextResponse.json(stats);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch dashboard statistics" }, { status: 500 });
  }
}
