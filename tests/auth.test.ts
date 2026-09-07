import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    adminUser: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
  },
}));
vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));

// env admin password is "test-password" (hash set in tests/setup.ts)
import { verifyCredentials } from "@/lib/session";
import { AuthError } from "@/lib/errors";

describe("admin authentication", () => {
  it("accepts the env admin with the right password", async () => {
    const s = await verifyCredentials("admin", "test-password");
    expect(s.username).toBe("admin");
  });

  it("rejects a wrong password", async () => {
    await expect(verifyCredentials("admin", "nope")).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects an unknown user", async () => {
    await expect(verifyCredentials("intruder", "test-password")).rejects.toBeInstanceOf(AuthError);
  });
});
