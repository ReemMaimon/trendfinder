/**
 * Generate a bcrypt hash for the admin password.
 *   npx tsx scripts/hash-password.ts 'my-strong-password'
 * Put the output in ADMIN_PASSWORD_HASH.
 */
import bcrypt from "bcryptjs";

const pw = process.argv[2];
if (!pw) {
  console.error("Usage: npx tsx scripts/hash-password.ts '<password>'");
  process.exit(1);
}
const hash = bcrypt.hashSync(pw, 10);
console.log("\nRaw hash:\n" + hash);
console.log("\nFor .env (each $ escaped as \\$ — paste this line):");
console.log("ADMIN_PASSWORD_HASH=" + hash.replace(/\$/g, "\\$"));
