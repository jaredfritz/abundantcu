import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "playwright-core";
import { launchExportBrowser } from "@/lib/export/browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportMode = "zoning" | "permits" | "build";

interface ExportRequestBody {
  mode: ExportMode;
  buildTypeId?: string;
  borderRatio?: number;
  labelBoost?: number;
  sizePx?: number;
  dpr?: number;
  styleOverrides?: object;
  legendConfig?: object;
  filename?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function encodeBase64UrlJson(value: object | undefined): string | null {
  if (!value) return null;
  const json = JSON.stringify(value);
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function safeFilename(input: string | undefined): string {
  const fallback = "map-export.png";
  if (!input) return fallback;
  const cleaned = input.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : fallback;
}

let sharedBrowserPromise: Promise<Browser> | null = null;

async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = launchExportBrowser();
  }

  let browser = await sharedBrowserPromise;
  if (!browser.isConnected()) {
    sharedBrowserPromise = launchExportBrowser();
    browser = await sharedBrowserPromise;
  }
  return browser;
}

export async function POST(request: NextRequest) {
  let context: Awaited<ReturnType<Browser["newContext"]>> | null = null;

  try {
    const body = (await request.json()) as ExportRequestBody;
    const mode: ExportMode =
      body.mode === "permits" || body.mode === "build" ? body.mode : "zoning";
    const buildTypeId = typeof body.buildTypeId === "string" ? body.buildTypeId : "duplex";
    const borderRatio = clamp(typeof body.borderRatio === "number" ? body.borderRatio : 0.1, 0, 0.3);
    const labelBoost = clamp(typeof body.labelBoost === "number" ? body.labelBoost : 4, 0, 8);
    const sizePx = clamp(typeof body.sizePx === "number" ? body.sizePx : 4096, 512, 12000);
    const dpr = clamp(typeof body.dpr === "number" ? body.dpr : 2, 1, 4);
    const viewportSize = Math.max(256, Math.round(sizePx / dpr));
    const filename = safeFilename(body.filename);

    const params = new URLSearchParams({
      mode,
      buildType: buildTypeId,
      border: String(borderRatio),
      labelBoost: String(labelBoost),
    });

    const styleParam = encodeBase64UrlJson(body.styleOverrides);
    if (styleParam) params.set("style", styleParam);

    const legendParam = encodeBase64UrlJson(body.legendConfig);
    if (legendParam) params.set("legend", legendParam);

    const renderUrl = `${request.nextUrl.origin}/data/zoning/print?${params.toString()}`;

    const browser = await getSharedBrowser();
    context = await browser.newContext({
      viewport: { width: viewportSize, height: viewportSize },
      deviceScaleFactor: dpr,
    });
    const page = await context.newPage();

    await page.goto(renderUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.addStyleTag({
      content: `
        nextjs-portal,
        [data-nextjs-dialog],
        [data-nextjs-toast],
        [data-nextjs-error-overlay],
        #__next-build-watcher,
        #__next-prerender-indicator,
        #__next-route-announcer__,
        [id*="nextjs-dev-tools"],
        [class*="nextjs-dev-tools"],
        [id*="nextjs-overlay"],
        [class*="nextjs-overlay"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `,
    });
    await page.evaluate(() => {
      document
        .querySelectorAll(
          "nextjs-portal,[data-nextjs-dialog],[data-nextjs-toast],[data-nextjs-error-overlay],#__next-build-watcher,#__next-prerender-indicator"
        )
        .forEach((node) => node.remove());
    });
    await page.waitForSelector("#print-map-root canvas.maplibregl-canvas", { timeout: 120000 });
    await page.waitForFunction(
      () => (window as { __MAP_EXPORT_READY?: boolean }).__MAP_EXPORT_READY === true,
      { timeout: 120000 }
    );

    const screenshot = await page.locator("#print-map-root").screenshot({ type: "png" });
    const screenshotBytes = new Uint8Array(screenshot);
    await context.close();
    context = null;

    return new NextResponse(screenshotBytes, {
      headers: {
        "content-type": "image/png",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (context) {
      await context.close();
    }
    const message = error instanceof Error ? error.message : "Map export failed.";
    if (message.toLowerCase().includes("browser") || message.toLowerCase().includes("target")) {
      sharedBrowserPromise = null;
    }
    return new NextResponse(message, { status: 500 });
  }
}
