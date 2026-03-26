import { NextRequest, NextResponse } from "next/server";
import type { Browser, Page } from "playwright-core";
import { launchExportBrowser } from "@/lib/export/browser";
import type { ParkingBasemap, ParkingLegendConfig, ParkingStyleOverrides } from "@/lib/parkingExport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ParkingExportRequestBody {
  widthPx?: number;
  heightPx?: number;
  dpr?: number;
  basemap?: ParkingBasemap;
  tilt?: boolean;
  borderRatio?: number;
  roadLabelBoost?: number;
  styleOverrides?: ParkingStyleOverrides;
  legendConfig?: ParkingLegendConfig;
  filename?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeFilename(input: string | undefined): string {
  const fallback = "parking-map-export.png";
  if (!input) return fallback;
  const cleaned = input.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : fallback;
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

function isTransientScreenshotError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("capture screenshot") ||
    message.includes("page.capturescreenshot") ||
    message.includes("target closed") ||
    message.includes("context closed")
  );
}

async function captureViewportScreenshot(
  page: Page,
  viewportWidth: number,
  viewportHeight: number
): Promise<Buffer> {
  const clip = {
    x: 0,
    y: 0,
    width: Math.max(1, Math.round(viewportWidth)),
    height: Math.max(1, Math.round(viewportHeight)),
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.screenshot({
        type: "png",
        clip,
        animations: "disabled",
        caret: "hide",
      });
    } catch (error) {
      lastError = error;
      if (!isTransientScreenshotError(error) || attempt === 2) {
        throw error;
      }
      await page.waitForTimeout(250 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to capture screenshot.");
}

export async function POST(request: NextRequest) {
  let context: Awaited<ReturnType<Browser["newContext"]>> | null = null;

  try {
    const body = (await request.json()) as ParkingExportRequestBody;
    const widthPx = clamp(typeof body.widthPx === "number" ? body.widthPx : 1600, 800, 6000);
    const heightPx = clamp(typeof body.heightPx === "number" ? body.heightPx : 1200, 800, 6000);
    const dpr = clamp(typeof body.dpr === "number" ? body.dpr : 2, 1, 4);
    const viewportWidth = Math.round(widthPx / dpr);
    const viewportHeight = Math.round(heightPx / dpr);
    const basemap: ParkingBasemap = body.basemap === "roadmap" ? "roadmap" : "satellite";
    const tilt = Boolean(body.tilt);
    const borderRatio = clamp(typeof body.borderRatio === "number" ? body.borderRatio : 0, 0, 0.18);
    const roadLabelBoost = clamp(typeof body.roadLabelBoost === "number" ? body.roadLabelBoost : 0, 0, 8);
    const filename = safeFilename(body.filename);

    const params = new URLSearchParams({
      basemap,
      tilt: tilt ? "1" : "0",
      border: borderRatio.toFixed(4),
      labelBoost: String(Math.round(roadLabelBoost)),
      capture: "1",
    });

    const styleParam = encodeBase64UrlJson(body.styleOverrides);
    if (styleParam) params.set("style", styleParam);

    const legendParam = encodeBase64UrlJson(body.legendConfig);
    if (legendParam) params.set("legend", legendParam);

    const renderUrl = `${request.nextUrl.origin}/data/parking/print?${params.toString()}`;

    const browser = await getSharedBrowser();
    context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
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

    await page.waitForSelector("#parking-print-root .gm-style canvas", { timeout: 120000 });
    await page.waitForFunction(
      () => (window as { __PARKING_EXPORT_READY?: boolean }).__PARKING_EXPORT_READY === true,
      { timeout: 120000 }
    );
    await page.waitForSelector("#parking-print-root", { timeout: 120000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(80);

    const screenshot = await captureViewportScreenshot(page, viewportWidth, viewportHeight);
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

    const message = error instanceof Error ? error.message : "Parking map export failed.";
    if (message.toLowerCase().includes("browser") || message.toLowerCase().includes("target")) {
      sharedBrowserPromise = null;
    }

    return new NextResponse(message, { status: 500 });
  }
}
