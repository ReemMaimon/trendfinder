import { NextRequest } from "next/server";
import { z } from "zod";
import { publicRoute, json } from "@/lib/apiHelpers";
import { verifyCredentials, createSessionCookie } from "@/lib/session";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { AuthError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const schema = z.object({
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(200),
});

export const POST = publicRoute(async (req: NextRequest) => {
  const ip = clientIp(req.headers);
  rateLimit(`login:${ip}`, { limit: 8, windowMs: 5 * 60_000 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json({ error: { code: "VALIDATION_ERROR", message: "missing credentials" } }, { status: 400 });
  }

  try {
    const session = await verifyCredentials(parsed.data.username, parsed.data.password);
    await createSessionCookie(session);
    logger.info({ username: session.username, ip }, "admin login ok");
    return json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      logger.warn({ ip, username: parsed.data.username }, "admin login failed");
      return json({ error: { code: "UNAUTHORIZED", message: "שם משתמש או סיסמה שגויים" } }, { status: 401 });
    }
    throw err;
  }
});
