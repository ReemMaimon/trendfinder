import { NextRequest } from "next/server";
import { adminRoute, json } from "@/lib/apiHelpers";
import { SettingsService } from "@/services/settings/SettingsService";
import { settingsSchema } from "@/config/defaults";
import { getSession } from "@/lib/session";
import { ValidationError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => {
  const settings = await SettingsService.get(true);
  return json({ settings });
});

export const PUT = adminRoute(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const parsed = settingsSchema.partial().safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid settings payload", parsed.error.issues);
  }
  const session = await getSession();
  const settings = await SettingsService.update(parsed.data, session?.username);
  return json({ settings });
});
