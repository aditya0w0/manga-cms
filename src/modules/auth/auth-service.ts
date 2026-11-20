import argon2 from "argon2";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPrisma } from "@/lib/database/prisma";
import { Role, UserStatus } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || process.env.APP_SECRET || "manga-cms-jwt-token-secret-fallback-production-32char";
const SESSION_COOKIE_NAME = "manga_session_token";
const TOKEN_EXPIRY_DAYS = 30;

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  role: Role;
}

export const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 50,
  ADMIN: 40,
  EDITOR: 30,
  TRANSLATOR: 20,
  MODERATOR: 20,
  USER: 10,
  GUEST: 0,
};

export class AuthService {
  /**
   * Hashes a password using Argon2id.
   */
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verifies a password against an Argon2id or legacy bcrypt hash.
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!hash || !password) return false;

    // Check if Argon2 hash
    if (hash.startsWith("$argon2")) {
      try {
        return await argon2.verify(hash, password);
      } catch {
        return false;
      }
    }

    // Fallback for legacy bcrypt hashes
    if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
      try {
        return await bcrypt.compare(password, hash);
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Checks if userRole satisfies minimum requiredRole.
   */
  static hasPermission(userRole: Role, requiredRole: Role): boolean {
    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
    return userLevel >= requiredLevel;
  }

  /**
   * Generates a signed JWT session token.
   */
  static signToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: `${TOKEN_EXPIRY_DAYS}d`,
    });
  }

  /**
   * Verifies and decodes a JWT session token.
   */
  static verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch {
      return null;
    }
  }

  /**
   * Resolves the authenticated user from a Request or Authorization header.
   */
  static async authenticateRequest(req?: Request): Promise<{
    user: {
      id: string;
      email: string;
      username: string;
      role: Role;
      status: UserStatus;
    };
  } | null> {
    let token: string | null = null;

    if (req) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      } else {
        const cookieHeader = req.headers.get("cookie");
        if (cookieHeader) {
          const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
          if (match) token = match[1];
        }
      }
    }

    if (!token) return null;

    const payload = this.verifyToken(token);
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
      },
    });

    if (!user || user.status === UserStatus.SUSPENDED || user.status === UserStatus.INACTIVE) {
      return null;
    }

    return { user };
  }

  /**
   * Middleware guard requiring authenticated user with optional role check.
   */
  static async requireUser(req: Request, requiredRole?: Role) {
    const auth = await this.authenticateRequest(req);
    if (!auth) {
      throw new Error("UNAUTHORIZED: Authentication required");
    }

    if (requiredRole && !this.hasPermission(auth.user.role, requiredRole)) {
      throw new Error(`FORBIDDEN: Insufficient privileges. Required role: ${requiredRole}`);
    }

    return auth.user;
  }
}
