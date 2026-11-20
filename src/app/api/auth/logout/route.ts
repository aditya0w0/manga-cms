import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/security/auth";

export async function POST() {
  const res = NextResponse.json({ success: true, message: "Logged out" });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
