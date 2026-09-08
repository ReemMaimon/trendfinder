/**
 * Wipe ALL discovery history — daily sets, products, generation runs, candidates,
 * sources, analytics and API logs. KEEPS settings and admin users.
 *
 * Use for a clean slate (e.g. after lots of test runs). This is destructive and
 * cannot be undone.
 *
 *   npx tsx scripts/reset-history.mjs           # asks for confirmation
 *   npx tsx scripts/reset-history.mjs --yes     # skip confirmation
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import readline from "node:readline/promises";

const prisma = new PrismaClient();

async function main() {
  const counts = {
    dailySets: await prisma.dailyProductSet.count(),
    products: await prisma.product.count(),
    runs: await prisma.generationRun.count(),
    views: await prisma.productView.count(),
    clicks: await prisma.productClick.count(),
  };
  console.log("About to delete:", counts);

  if (!process.argv.includes("--yes")) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ans = await rl.question('Type "reset" to confirm: ');
    rl.close();
    if (ans.trim() !== "reset") {
      console.log("Aborted.");
      process.exit(1);
    }
  }

  await prisma.productClick.deleteMany();
  await prisma.productView.deleteMany();
  await prisma.dailyProductItem.deleteMany();
  await prisma.dailyProductSet.deleteMany();
  await prisma.trendSource.deleteMany();
  await prisma.generationCandidate.deleteMany();
  await prisma.productTrendReport.deleteMany();
  await prisma.apiLog.deleteMany();
  await prisma.product.deleteMany();
  await prisma.generationRun.deleteMany();

  console.log("Done. Settings + admin users kept. Run a fresh generation from Admin or `npm run generate:now`.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
