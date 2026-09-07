import { publicRoute, json } from "@/lib/apiHelpers";
import { destroySessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = publicRoute(async () => {
  destroySessionCookie();
  return json({ ok: true });
});
