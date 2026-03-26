import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "playwright-core";
import { launchExportBrowser } from "@/lib/export/browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Basemap = "roadmap" | "satellite";

interface ParkingExportRequestBody {
  widthPx?: number;
  heightPx?: number;
  dpr?: number;
  basemap?: Basemap;
  tilt?: boolean;
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
    const body = (await request.json()) as ParkingExportRequestBody;
    const widthPx = clamp(typeof body.widthPx === "number" ? body.widthPx : 1600, 800, 6000);
    const heightPx = clamp(typeof body.heightPx === "number" ? body.heightPx : 1200, 800, 6000);
    const dpr = clamp(typeof body.dpr === "number" ? body.dpr : 2, 1, 4);
    const viewportWidth = Math.round(widthPx / dpr);
    const viewportHeight = Math.round(heightPx / dpr);
    const basemap: Basemap = body.basemap === "roadmap" ? "roadmap" : "satellite";
    const tilt = Boolean(body.tilt);
    const filename = safeFilename(body.filename);

    const params = new URLSearchParams({
      basemap,
      tilt: tilt ? "1" : "0",
      capture: "1",
    });

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

    const screenshot = await page.locator("#parking-print-root").screenshot({ type: "png" });
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
