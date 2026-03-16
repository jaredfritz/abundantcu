#!/usr/bin/env node

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

const EXPORT_VARIANTS = [
  { id: "zoning", filename: "01-zoning-districts.png", mode: "zoning" },
  { id: "permits", filename: "02-residential-permits.png", mode: "permits" },
  { id: "build-sfh", filename: "03-build-single-family-home.png", mode: "build", buildType: "sfh" },
  { id: "build-duplex", filename: "04-build-duplex.png", mode: "build", buildType: "duplex" },
  { id: "build-cafe", filename: "05-build-cafe.png", mode: "build", buildType: "cafe" },
];

const DEFAULTS = {
  size: 4096,
  dpr: 2,
  border: 0.1,
  labelBoost: 4,
  outDir: "exports/map-prints",
  baseUrl: "",
  host: "127.0.0.1",
  port: 3111,
  configPath: "",
  style: undefined,
  legend: undefined,
  variants: {},
};

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const [rawKey, rawValue] = arg.split("=");
    const key = rawKey.replace(/^--/, "");
    const value = rawValue ?? "";
    if (key === "size") args.size = Number.parseInt(value, 10);
    else if (key === "dpr") args.dpr = Number.parseFloat(value);
    else if (key === "border") args.border = Number.parseFloat(value);
    else if (key === "label-boost") args.labelBoost = Number.parseInt(value, 10);
    else if (key === "out") args.outDir = value;
    else if (key === "base-url") args.baseUrl = value;
    else if (key === "host") args.host = value;
    else if (key === "port") args.port = Number.parseInt(value, 10);
    else if (key === "config") args.configPath = value;
  }
  return args;
}

function normalizeOptions(opts) {
  const out = { ...opts };
  if (!Number.isFinite(out.size) || out.size < 512) out.size = DEFAULTS.size;
  if (!Number.isFinite(out.dpr) || out.dpr < 1) out.dpr = DEFAULTS.dpr;
  if (!Number.isFinite(out.border) || out.border < 0 || out.border > 0.3) out.border = DEFAULTS.border;
  if (!Number.isFinite(out.labelBoost) || out.labelBoost < 0 || out.labelBoost > 8) out.labelBoost = DEFAULTS.labelBoost;
  if (!Number.isFinite(out.port) || out.port < 1) out.port = DEFAULTS.port;
  out.baseUrl = typeof out.baseUrl === "string" ? out.baseUrl : "";
  out.host = typeof out.host === "string" && out.host.length > 0 ? out.host : DEFAULTS.host;
  out.outDir = typeof out.outDir === "string" && out.outDir.length > 0 ? out.outDir : DEFAULTS.outDir;
  out.variants = out.variants && typeof out.variants === "object" ? out.variants : {};
  return out;
}

async function loadConfig(configPath) {
  if (!configPath) return {};
  const resolved = path.resolve(process.cwd(), configPath);
  const text = await readFile(resolved, "utf8");
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid config object in ${resolved}`);
  }
  return parsed;
}

function mergeStyle(baseStyle, variantStyle) {
  if (!baseStyle && !variantStyle) return undefined;
  return {
    ...(baseStyle ?? {}),
    ...(variantStyle ?? {}),
    zoningColors: {
      ...((baseStyle ?? {}).zoningColors ?? {}),
      ...((variantStyle ?? {}).zoningColors ?? {}),
    },
    buildColors: {
      ...((baseStyle ?? {}).buildColors ?? {}),
      ...((variantStyle ?? {}).buildColors ?? {}),
    },
    permitColors: {
      ...((baseStyle ?? {}).permitColors ?? {}),
      ...((variantStyle ?? {}).permitColors ?? {}),
    },
  };
}

function mergeLegend(baseLegend, variantLegend) {
  if (!baseLegend && !variantLegend) return undefined;
  const merged = {
    ...(baseLegend ?? {}),
    ...(variantLegend ?? {}),
  };
  if (variantLegend && Object.prototype.hasOwnProperty.call(variantLegend, "items")) {
    merged.items = variantLegend.items;
  } else if (baseLegend && Object.prototype.hasOwnProperty.call(baseLegend, "items")) {
    merged.items = baseLegend.items;
  }
  return merged;
}

function encodeBase64UrlJson(value) {
  if (!value || typeof value !== "object") return "";
  const json = JSON.stringify(value);
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch {
      // Wait and retry while dev server boots.
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

async function run() {
  const cli = parseArgs(process.argv.slice(2));
  const fileConfig = await loadConfig(cli.configPath || DEFAULTS.configPath);
  const options = normalizeOptions({
    ...DEFAULTS,
    ...fileConfig,
    ...cli,
  });

  const outDir = path.resolve(process.cwd(), options.outDir);
  await mkdir(outDir, { recursive: true });

  let serverProc = null;
  const usingExternalServer = Boolean(options.baseUrl);
  const baseUrl = usingExternalServer
    ? options.baseUrl.replace(/\/$/, "")
    : `http://${options.host}:${options.port}`;

  if (!usingExternalServer) {
    console.log(`Starting Next dev server at ${baseUrl} ...`);
    serverProc = spawn(
      "npm",
      ["run", "dev", "--", "--hostname", options.host, "--port", String(options.port)],
      {
        cwd: process.cwd(),
        stdio: "inherit",
      }
    );
    await waitForServer(`${baseUrl}/data/zoning/print`);
  }

  const viewportSize = Math.round(options.size / options.dpr);
  console.log(`Exporting ${EXPORT_VARIANTS.length} maps to ${outDir}`);
  console.log(`Output size: ${options.size}x${options.size}px (dpr=${options.dpr}, viewport=${viewportSize})`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: viewportSize, height: viewportSize },
    deviceScaleFactor: options.dpr,
  });
  const page = await context.newPage();

  try {
    for (const variant of EXPORT_VARIANTS) {
      const variantConfig = options.variants?.[variant.id] ?? {};
      const style = mergeStyle(options.style, variantConfig.style);
      const legend = mergeLegend(options.legend, variantConfig.legend);

      const params = new URLSearchParams({
        mode: variant.mode,
        border: String(options.border),
        labelBoost: String(options.labelBoost),
      });

      if (variant.buildType) params.set("buildType", variant.buildType);

      const styleParam = encodeBase64UrlJson(style);
      if (styleParam) params.set("style", styleParam);

      const legendParam = encodeBase64UrlJson(legend);
      if (legendParam) params.set("legend", legendParam);

      const url = `${baseUrl}/data/zoning/print?${params.toString()}`;
      const outputPath = path.join(outDir, variant.filename);

      console.log(`Rendering ${variant.filename}`);
      await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForSelector("#print-map-root canvas.maplibregl-canvas", { timeout: 120000 });
      await page.waitForFunction(
        () => (window).__MAP_EXPORT_READY === true && document.body.dataset.mapExportReady === "true",
        { timeout: 120000 }
      );
      await sleep(600);
      await page.locator("#print-map-root").screenshot({
        path: outputPath,
        type: "png",
      });
    }
  } finally {
    await browser.close();
    if (serverProc) {
      serverProc.kill("SIGTERM");
    }
  }

  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  console.error("If Playwright browsers are missing, run: npx playwright install chromium");
  process.exitCode = 1;
});
