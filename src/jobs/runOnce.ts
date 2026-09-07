/**
 * One-off manual generation from the CLI: `npm run generate:now [-- YYYY-MM-DD] [--force]`
 */
import "dotenv/config";
import { runDailyGeneration } from "./runGeneration";
import { jerusalemDateString } from "@/lib/time";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const targetDate = dateArg ?? jerusalemDateString();

  // eslint-disable-next-line no-console
  console.log(`Running generation for ${targetDate} (force=${force})...`);
  const result = await runDailyGeneration({ trigger: "MANUAL", targetDate, force });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "FAILED" ? 1 : 0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
