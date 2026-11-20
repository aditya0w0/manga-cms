import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch user" }, { status: 500 });
  }
}
