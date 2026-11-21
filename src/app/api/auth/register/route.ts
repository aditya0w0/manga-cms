import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/database/prisma";
import { hashPassword, signUserToken, SESSION_COOKIE_NAME } from "@/lib/security/auth";
import { Role, UserStatus } from "@prisma/client";
import { z } from "zod";

const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }

    const { email, username, password } = parsed.data;
    const db = await getPrisma();

    // Check existing
    const existing = await db.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: existing.email === email.toLowerCase() ? "Email already registered" : "Username already taken" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    // If first user, make SUPER_ADMIN; otherwise USER
    const userCount = await db.user.count();
    const role = userCount === 0 ? Role.SUPER_ADMIN : Role.USER;

    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        username,
        passwordHash,
        role,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    const token = signUserToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    const res = NextResponse.json({ success: true, user });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return res;
  } catch (err: any) {
    if (err.code === "P2002" || err.message?.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Email or username already taken" },
        { status: 409 }
      );
    }
    console.error("Register error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
