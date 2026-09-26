// Copy the LeoToby build (dist-leotoby/) into a LeoToby checkout at
// public/games/bank-it/, replacing whatever was there.
//
//   npm run build:leotoby && npm run copy:leotoby -- ../leotoby
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const target = resolve(process.argv[2] ?? "../leotoby");
const src = resolve("dist-leotoby");
if (!existsSync(join(src, "index.html"))) {
  console.error("dist-leotoby/index.html is missing: run `npm run build:leotoby` first.");
  process.exit(1);
}
if (!existsSync(join(target, "lib", "games.ts"))) {
  console.error(`${target} doesn't look like the LeoToby repository (no lib/games.ts).`);
  process.exit(1);
}
const dest = join(target, "public", "games", "bank-it");
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`Copied ${readdirSync(dest).length} entries to ${dest}`);
