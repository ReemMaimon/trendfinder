import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_SETTINGS } from "../src/config/defaults";

const prisma = new PrismaClient();

async function main() {
  // settings singleton
  await prisma.setting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", data: DEFAULT_SETTINGS as any },
    update: {},
  });
  console.log("✓ settings singleton ensured");

  // admin user (from env, optional — env admin also works without a DB row)
  const username = process.env.ADMIN_USERNAME || "admin";
  const plain = process.env.SEED_ADMIN_PASSWORD;
  if (plain) {
    const passwordHash = bcrypt.hashSync(plain, 10);
    await prisma.adminUser.upsert({
      where: { username },
      create: { username, passwordHash },
      update: { passwordHash },
    });
    console.log(`✓ admin user "${username}" created/updated from SEED_ADMIN_PASSWORD`);
  } else {
    console.log(
      "• SEED_ADMIN_PASSWORD not set — skipping DB admin. The env admin (ADMIN_USERNAME/ADMIN_PASSWORD_HASH) still works.",
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
