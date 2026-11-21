import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";
import { getPrisma } from "@/lib/database/prisma";
import { Role } from "@prisma/client";
import { AuthService } from "@/modules/auth/auth-service";

const JWT_SECRET = process.env.JWT_SECRET || process.env.APP_SECRET || "manga-cms-jwt-token-secret-fallback-production-32char";
const SESSION_COOKIE_NAME = "manga_session_token";
const TOKEN_EXPIRY_DAYS = 30;

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  role: Role;
}

export async function hashPassword(password: string): Promise<string> {
  return AuthService.hashPassword(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return AuthService.verifyPassword(password, hash);
}

export function signUserToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: `${TOKEN_EXPIRY_DAYS}d`,
  });
}

export function verifyUserToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Extracts session token from Cookie or Authorization header
 */
export async function getSessionToken(req?: Request): Promise<string | null> {
  if (req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
      if (match) return match[1];
    }
  }

  try {
    const cookieStore = cookies();
    const tokenCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (tokenCookie?.value) {
      return tokenCookie.value;
    }
  } catch {
    // cookies() might fail outside Next.js request context
  }

  try {
    const headerList = headers();
    const authHeader = headerList.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }
  } catch {
    // headers() might fail outside Next.js request context
  }

  return null;
}

export async function getCurrentUser(req?: Request) {
  const token = await getSessionToken(req);
  if (!token) return null;

  const payload = verifyUserToken(token);
  if (!payload) return null;

  const db = await getPrisma();
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      status: true,
      avatarUrl: true,
      bio: true,
      createdAt: true,
    },
  });

  if (!user || user.status === "SUSPENDED") {
    return null;
  }

  return user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized: Authentication required");
  }
  return user;
}

export async function requireRole(allowedRoles: Role[]) {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new Error(`Forbidden: Insufficient privileges. Required: ${allowedRoles.join(", ")}`);
  }
  return user;
}

export async function requireAdmin() {
  return requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
}

export async function requireModerator() {
  return requireRole([Role.MODERATOR, Role.ADMIN, Role.SUPER_ADMIN]);
}

export { SESSION_COOKIE_NAME };
