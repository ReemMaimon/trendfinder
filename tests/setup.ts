// Ensures a valid (fake) environment for unit tests that import src/lib/env.
const e = process.env as Record<string, string | undefined>;
e.NODE_ENV ??= "test";
e.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/trendfinder_test?schema=public";
e.SESSION_SECRET ??= "test-session-secret-at-least-16-chars-long";
e.ADMIN_USERNAME ??= "admin";
// bcrypt hash of "test-password", computed at load so it always matches
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const bcrypt = require("bcryptjs");
  e.ADMIN_PASSWORD_HASH ??= bcrypt.hashSync("test-password", 10);
}
e.AI_PROVIDER ??= "mock";
e.APP_MODE ??= "TEST";
e.CURRENCY_PROVIDER ??= "fixed";
e.CURRENCY_FIXED_USD_ILS ??= "3.7";
e.CRON_SECRET ??= "test-cron-secret";
