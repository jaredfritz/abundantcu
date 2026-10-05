// Records when a dataset behind the /data pages last changed, in src/data/data-updates.json.
// The site shows these dates on each map and dashboard.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const UPDATES_FILE = path.join(process.cwd(), "src", "data", "data-updates.json");

/** Set `dataset`'s date to today (UTC, YYYY-MM-DD). */
export async function markDatasetUpdated(dataset) {
  const updates = JSON.parse(await readFile(UPDATES_FILE, "utf8"));
  updates[dataset] = new Date().toISOString().slice(0, 10);
  await writeFile(UPDATES_FILE, `${JSON.stringify(updates, null, 2)}\n`);
}

/** Write `contents` to `file` only if it differs from what's there. Returns whether it changed. */
export async function writeIfChanged(file, contents) {
  const existing = await readFile(file, "utf8").catch(() => null);
  if (existing === contents) return false;
  await writeFile(file, contents);
  return true;
}
