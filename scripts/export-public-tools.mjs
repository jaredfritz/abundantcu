// Copies the open-source data tools into a separate public repository.
//
//   node scripts/export-public-tools.mjs <path to a checkout of the public repo>
//
// The public repo holds the /data tools (crash dashboard, Value Per Acre, Vacant Land, zoning and permits), their data
// pipelines and data files, without the rest of the site (signup, writings, parking map, editor admin, branding).
// The file list isn't kept by hand: starting from each tool's page, route, and script, the export follows imports, so
// a new shared component comes along automatically. Files in public-tools/ replace their site counterparts (a plain
// page shell and layout, package.json, README, config), and REWRITES adjusts the lines that point at or name the site.
//
// The export deletes everything in the target except .git, node_modules, and .next before copying, so the public
// repo always matches the export exactly. Review the diff there (git status / git diff), then commit and push.

import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OVERRIDES = path.join(ROOT, "public-tools");

/** Where the import walk starts. */
const ENTRIES = [
  "src/app/page.tsx",
  "src/app/layout.tsx",
  "src/app/data/crashes/page.tsx",
  "src/app/data/crashes/location-report/page.tsx",
  "src/app/data/value-per-acre/page.tsx",
  "src/app/data/vacant-land/page.tsx",
  "src/app/data/zoning/page.tsx",
  "src/app/api/nominatim/autocomplete/route.ts",
  "src/app/api/nominatim/geocode/route.ts",
  "scripts/fetch-idot-crashes.mjs",
  "scripts/fetch-parcel-values.mjs",
  "scripts/locate-permits.mjs",
];

/** Files and folders that imports don't reach: data, images, docs, licenses, and config. */
const EXTRA = [
  "src/app/globals.css",
  "src/app/icon.png",
  "public/data/crashes",
  "public/data/parcels",
  "public/data/zoning.geojson",
  "public/crash-dashboard-thumbnail.png",
  "public/value-per-acre-thumbnail.png",
  "public/vacant-land-thumbnail.png",
  "data/permits",
  "docs/value-per-acre-next-steps.md",
  "src/components/crashes/LICENSE-chicago-crash-dashboard.txt",
  "src/components/parcels/LICENSE-chicago-value-per-acre.txt",
  "LICENSE",
  "tsconfig.json",
  "postcss.config.mjs",
];

const PUBLIC_REPO_URL = "https://github.com/jaredfritz/cu-data-tools";

/**
 * Text in shared files that points at the site or names it: links to pages the public repo doesn't have, page titles
 * and URLs, and the User-Agent that identifies requests to data sources (a fork shouldn't send ours). Each rule must
 * match at least once, so a rule that stops matching after a code change fails the export instead of silently doing
 * nothing.
 */
const REWRITES = [
  {
    files: /^src\/components\/parcels\/VacantLandDashboard\.tsx$/,
    pattern: /<Link href="\/data\/parking"/g,
    to: '<Link href="https://www.abundantcu.com/data/parking"',
  },
  { files: /^src\/app\/data\/.*page\.tsx$/, pattern: / \| Abundant CU/g, to: "" },
  { files: /^src\/app\/data\/.*page\.tsx$/, pattern: /\n\s*url: "https:\/\/abundantcu\.com[^"]*",/g, to: "" },
  {
    files: /^src\/app\/api\/nominatim\/.*route\.ts$/,
    pattern: /"AbundantCU\/1\.0 \(abundantcu@gmail\.com\)"/g,
    to: `"cu-data-tools/1.0 (${PUBLIC_REPO_URL})"`,
  },
  {
    files: /^scripts\/fetch-parcel-values\.mjs$/,
    pattern: /"AbundantCU-data\/1\.0 \(\+https:\/\/abundantcu\.com\/data\/value-per-acre\)"/g,
    to: `"cu-data-tools/1.0 (+${PUBLIC_REPO_URL})"`,
  },
];

const EXTENSIONS = ["", ".ts", ".tsx", ".mjs", ".js", ".json", "/index.ts", "/index.tsx"];

/** The source for a repo path: the public-tools/ version when there is one. */
const sourceOf = (relative) => {
  const override = path.join(OVERRIDES, relative);
  return existsSync(override) ? override : path.join(ROOT, relative);
};

function resolveImport(fromRelative, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = path.join("src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.join(path.dirname(fromRelative), specifier);
  else return null; // a package
  for (const extension of EXTENSIONS) {
    const candidate = base + extension;
    for (const dir of [OVERRIDES, ROOT]) {
      const full = path.join(dir, candidate);
      if (existsSync(full) && statSync(full).isFile()) return path.normalize(candidate);
    }
  }
  throw new Error(`Can't resolve "${specifier}" imported from ${fromRelative}`);
}

async function collectImports() {
  const files = new Set();
  const queue = [...ENTRIES];
  while (queue.length > 0) {
    const relative = path.normalize(queue.pop());
    if (files.has(relative)) continue;
    files.add(relative);
    if (!/\.(tsx?|mjs|js)$/.test(relative)) continue;
    const source = await readFile(sourceOf(relative), "utf8");
    const pattern = /(?:import|export)[^"';]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;
    for (const match of source.matchAll(pattern)) {
      const resolved = resolveImport(relative, match[1] ?? match[2] ?? match[3]);
      if (resolved) queue.push(resolved);
    }
  }
  return files;
}

async function main() {
  const target = process.argv[2];
  if (!target) throw new Error("Usage: node scripts/export-public-tools.mjs <path to the public repo checkout>");
  const targetDir = path.resolve(target);
  if (path.relative(ROOT, targetDir) === "" || !path.relative(ROOT, targetDir).startsWith("..")) {
    throw new Error("The target must be a separate checkout outside this repository.");
  }
  await mkdir(targetDir, { recursive: true });

  const files = await collectImports();
  for (const extra of EXTRA) files.add(path.normalize(extra));
  // Every public-tools/ file is part of the export, imported or not (README, package.json, .env.example, ...).
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else files.add(path.relative(OVERRIDES, full));
    }
  };
  await walk(OVERRIDES);

  // Keep the target's git history and local installs; everything else is replaced.
  const KEEP = new Set([".git", "node_modules", ".next"]);
  for (const entry of await readdir(targetDir)) {
    if (!KEEP.has(entry)) await rm(path.join(targetDir, entry), { recursive: true, force: true });
  }

  for (const relative of [...files].sort()) {
    const destination = path.join(targetDir, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    const source = sourceOf(relative);
    if ((await stat(source)).isDirectory()) await cp(source, destination, { recursive: true });
    else await cp(source, destination);
  }

  for (const { files: fileFilter, pattern, to } of REWRITES) {
    let matched = 0;
    for (const relative of files) {
      if (!fileFilter.test(relative.split(path.sep).join("/"))) continue;
      const full = path.join(targetDir, relative);
      const text = await readFile(full, "utf8");
      const next = text.replace(pattern, () => {
        matched += 1;
        return to;
      });
      if (next !== text) await writeFile(full, next);
    }
    if (matched === 0) throw new Error(`Rewrite ${pattern} no longer matches anything; update REWRITES.`);
  }

  console.log(`Exported ${files.size} files and folders to ${targetDir}. Review with git status there, then commit.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
