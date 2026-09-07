import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { env } from "./env";
import { prisma } from "./db";
import { AuthError } from "./errors";

const COOKIE_NAME = "tf_admin";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8h
const secret = new TextEncoder().encode(env.SESSION_SECRET);

export interface AdminSession {
  sub: string; // admin user id
  username: string;
}

/**
 * Verify credentials against the DB admin_users table, falling back to the
 * env-configured admin (ADMIN_USERNAME / ADMIN_PASSWORD_HASH) so the app is
 * usable immediately after deploy before any DB seeding.
 */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<AdminSession> {
  try {
    const dbUser = await prisma.adminUser.findUnique({ where: { username } });
    if (dbUser && (await bcrypt.compare(password, dbUser.passwordHash))) {
      await prisma.adminUser
        .update({ where: { id: dbUser.id }, data: { lastLoginAt: new Date() } })
        .catch(() => {});
      return { sub: dbUser.id, username: dbUser.username };
    }
  } catch {
    // DB unreachable — fall back to the env-configured admin below.
  }

  if (
    username === env.ADMIN_USERNAME &&
    (await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH))
  ) {
    return { sub: "env-admin", username };
  }

  throw new AuthError("Invalid username or password");
}

export async function createSessionCookie(session: AdminSession): Promise<void> {
  const token = await new SignJWT({ username: session.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret);

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function destroySessionCookie(): void {
  cookies().set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<AdminSession | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      sub: String(payload.sub),
      username: String(payload.username ?? ""),
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<AdminSession> {
  const s = await getSession();
  if (!s) throw new AuthError();
  return s;
}
