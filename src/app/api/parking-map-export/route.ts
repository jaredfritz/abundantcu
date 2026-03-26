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
    (message.includes("timeout") && message.includes("screenshot")) ||
    message.includes("page.screenshot: timeout") ||
    message.includes("target closed") ||
    message.includes("context closed")
  );
}

function isRecoverableExportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    isTransientScreenshotError(error) ||
    message.includes("target page, context or browser has been closed") ||
    message.includes("browser has been closed") ||
    message.includes("contextresult::kfatalfailure") ||
    message.includes("transferbuffer::initialize() failed") ||
    message.includes("parking features failed to load") ||
    message.includes("parking features missing from capture") ||
    message.includes("parking export never reached ready state") ||
    message.includes("parking overlays not ready for capture") ||
    message.includes("satellite basemap tiles not ready") ||
    message.includes("parking screenshot appears incomplete") ||
    message.includes("sharedimage") ||
    message.includes("gpu")
  );
}

async function captureViewportScreenshot(
  page: Page,
  viewportWidth: number,
  viewportHeight: number,
  preferCdp: boolean
): Promise<Buffer> {
  const screenshotTimeoutMs = preferCdp ? 26000 : 12000;
  const clip = {
    x: 0,
    y: 0,
    width: Math.max(1, Math.round(viewportWidth)),
    height: Math.max(1, Math.round(viewportHeight)),
  };

  const captureWithClip = async () =>
    page.screenshot({
      type: "png",
      clip,
      animations: "disabled",
      caret: "hide",
      timeout: screenshotTimeoutMs,
    });

  const captureWithoutClip = async () =>
    page.screenshot({
      type: "png",
      fullPage: false,
      animations: "disabled",
      caret: "hide",
      timeout: screenshotTimeoutMs,
    });

  const captureWithCdp = async (fromSurface: boolean) => {
    const context = page.context() as unknown as {
      newCDPSession?: (target: Page) => Promise<{
        send: (method: string, params?: Record<string, unknown>) => Promise<{ data?: string }>;
      }>;
    };
    if (typeof context.newCDPSession !== "function") {
      throw new Error("CDP session unavailable for screenshot fallback.");
    }
    const cdp = await context.newCDPSession(page);
    const payload = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface,
      captureBeyondViewport: false,
      clip: { ...clip, scale: 1 },
    });
    if (!payload?.data) {
      throw new Error("CDP screenshot returned no image data.");
    }
    return Buffer.from(payload.data, "base64");
  };

  let lastError: unknown = null;
  const attempts: Array<() => Promise<Buffer>> = preferCdp
    ? [
        () => captureWithCdp(true),
        () => captureWithCdp(false),
        () => captureWithCdp(true),
      ]
    : [captureWithClip, captureWithClip, captureWithoutClip, () => captureWithCdp(true)];

  for (let attempt = 0; attempt < attempts.length; attempt += 1) {
    try {
      return await attempts[attempt]();
    } catch (error) {
      lastError = error;
      if (!isTransientScreenshotError(error) && attempt < attempts.length - 1) {
        continue;
      }
      if (!isTransientScreenshotError(error)) {
        throw error;
      }
      if (attempt < attempts.length - 1) {
        await page.waitForTimeout(220 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to capture screenshot.");
}

function isSuspiciouslySmallScreenshot(
  bytes: Uint8Array,
  viewportWidth: number,
  viewportHeight: number,
  basemap: ParkingBasemap
): boolean {
  const pixels = viewportWidth * viewportHeight;
  const minBytes = basemap === "satellite"
    ? Math.max(170000, Math.floor(pixels * 0.14))
    : Math.max(35000, Math.floor(pixels * 0.015));
  return bytes.byteLength < minBytes;
}

async function renderParkingScreenshot(
  browser: Browser,
  renderUrl: string,
  viewportWidth: number,
  viewportHeight: number,
  dpr: number,
  basemap: ParkingBasemap
): Promise<Uint8Array> {
  let context: Awaited<ReturnType<Browser["newContext"]>> | null = null;
  try {
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
      () => {
        const canvas = document.querySelector("#parking-print-root .gm-style canvas") as
          | HTMLCanvasElement
          | null;
        if (!canvas) return false;
        return canvas.clientWidth > 100 && canvas.clientHeight > 100;
      },
      { timeout: 120000 }
    );
    if (basemap === "satellite") {
      await page.waitForFunction(
        () => {
          const mapRoot = document.querySelector("#parking-print-root .gm-style");
          if (!mapRoot) return false;
          const images = Array.from(mapRoot.querySelectorAll("img")) as HTMLImageElement[];
          const tileImages = images.filter((img) => {
            const src = img.currentSrc || img.src || "";
            if (!src || src.startsWith("data:")) return false;
            const naturalWidth = img.naturalWidth || img.width;
            const naturalHeight = img.naturalHeight || img.height;
            if (naturalWidth < 96 || naturalHeight < 96) return false;
            const looksLikeGoogleTile =
              src.includes("/maps/vt") ||
              src.includes("khms") ||
              src.includes("maps-api-v3") ||
              src.includes("gstatic.com");
            const isTileLikeSize =
              naturalWidth <= 1024 &&
              naturalHeight <= 1024 &&
              (naturalWidth === naturalHeight || naturalWidth === 512 || naturalHeight === 512);
            return looksLikeGoogleTile || isTileLikeSize;
          });
          if (tileImages.length < 6) return false;
          const loaded = tileImages.filter(
            (img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0
          );
          if (loaded.length < 6) return false;
          return loaded.length / tileImages.length >= 0.72;
        },
        { timeout: 20000 }
      );
      await page.waitForTimeout(500);
    }
    await page.waitForFunction(
      () => {
        const payload = window as {
          __PARKING_EXPORT_READY?: boolean;
          __PARKING_EXPORT_FEATURE_ERROR?: string;
        };
        return payload.__PARKING_EXPORT_READY === true || Boolean(payload.__PARKING_EXPORT_FEATURE_ERROR);
      },
      { timeout: 120000 }
    );
    const captureStatus = await page.evaluate(() => {
      const payload = window as {
        __PARKING_EXPORT_READY?: boolean;
        __PARKING_EXPORT_FEATURE_ERROR?: string;
        __PARKING_EXPORT_FEATURE_COUNT?: number;
        __PARKING_EXPORT_OVERLAY_COUNT?: number;
      };
      return {
        ready: Boolean(payload.__PARKING_EXPORT_READY),
        featureError: payload.__PARKING_EXPORT_FEATURE_ERROR ?? "",
        featureCount: payload.__PARKING_EXPORT_FEATURE_COUNT ?? 0,
        overlayCount: payload.__PARKING_EXPORT_OVERLAY_COUNT ?? 0,
      };
    });
    if (captureStatus.featureError) {
      throw new Error(`Parking features failed to load: ${captureStatus.featureError}`);
    }
    if (!captureStatus.ready) {
      throw new Error("Parking export never reached ready state.");
    }
    if (captureStatus.featureCount <= 0) {
      throw new Error("Parking features missing from capture.");
    }
    if (captureStatus.overlayCount < captureStatus.featureCount) {
      try {
        await page.waitForFunction(
          () => {
            const payload = window as {
              __PARKING_EXPORT_FEATURE_COUNT?: number;
              __PARKING_EXPORT_OVERLAY_COUNT?: number;
            };
            const featureCount = payload.__PARKING_EXPORT_FEATURE_COUNT ?? 0;
            const overlayCount = payload.__PARKING_EXPORT_OVERLAY_COUNT ?? 0;
            return featureCount > 0 && overlayCount >= featureCount;
          },
          { timeout: basemap === "roadmap" ? 15000 : 8000 }
        );
      } catch {
        throw new Error("Parking overlays not ready for capture.");
      }
    }
    await page.waitForSelector("#parking-print-root", { timeout: 120000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(120);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTimeout(() => resolve(), 60);
            });
          });
        })
    );

    if (basemap === "satellite") {
      const tilesReady = await page.evaluate(() => {
        const mapRoot = document.querySelector("#parking-print-root .gm-style");
        if (!mapRoot) return false;
        const images = Array.from(mapRoot.querySelectorAll("img")) as HTMLImageElement[];
        const tileImages = images.filter((img) => {
          const src = img.currentSrc || img.src || "";
          if (!src || src.startsWith("data:")) return false;
          const naturalWidth = img.naturalWidth || img.width;
          const naturalHeight = img.naturalHeight || img.height;
          return naturalWidth >= 96 && naturalHeight >= 96;
        });
        if (tileImages.length < 6) return false;
        const loaded = tileImages.filter(
          (img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0
        );
        return loaded.length >= 6 && loaded.length / tileImages.length >= 0.72;
      });
      if (!tilesReady) {
        throw new Error("Satellite basemap tiles not ready.");
      }
    }

    let screenshot = await captureViewportScreenshot(
      page,
      viewportWidth,
      viewportHeight,
      basemap === "satellite"
    );
    if (basemap === "satellite" && isSuspiciouslySmallScreenshot(screenshot, viewportWidth, viewportHeight, basemap)) {
      await page.waitForTimeout(800);
      screenshot = await captureViewportScreenshot(page, viewportWidth, viewportHeight, true);
    }
    if (isSuspiciouslySmallScreenshot(screenshot, viewportWidth, viewportHeight, basemap)) {
      throw new Error("Parking screenshot appears incomplete.");
    }
    return new Uint8Array(screenshot);
  } finally {
    if (context) {
      await context.close();
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ParkingExportRequestBody;
    const widthPx = clamp(typeof body.widthPx === "number" ? body.widthPx : 1600, 800, 6000);
    const heightPx = clamp(typeof body.heightPx === "number" ? body.heightPx : 1200, 800, 6000);
    const dpr = clamp(typeof body.dpr === "number" ? body.dpr : 2, 1, 4);
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

    const baseDpr = Number(dpr.toFixed(2));
    const elevatedDpr = Number(clamp(Math.max(dpr, 2.5), 1, 4).toFixed(2));
    const dprAttempts = basemap === "satellite"
      ? Array.from(new Set([
          elevatedDpr,
          baseDpr,
          Number(Math.min(dpr, 1.5).toFixed(2)),
          1,
        ]))
      : [baseDpr, baseDpr, baseDpr];

    let screenshotBytes: Uint8Array | null = null;
    let lastError: unknown = null;

    for (let attemptIndex = 0; attemptIndex < dprAttempts.length; attemptIndex += 1) {
      const attemptDpr = dprAttempts[attemptIndex];
      const viewportWidth = Math.round(widthPx / attemptDpr);
      const viewportHeight = Math.round(heightPx / attemptDpr);

      try {
        const browser = await getSharedBrowser();
        screenshotBytes = await renderParkingScreenshot(
          browser,
          renderUrl,
          viewportWidth,
          viewportHeight,
          attemptDpr,
          basemap
        );
        break;
      } catch (error) {
        lastError = error;
        const isLastAttempt = attemptIndex === dprAttempts.length - 1;
        if (!isRecoverableExportError(error) || isLastAttempt) {
          throw error;
        }
        sharedBrowserPromise = null;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    if (!screenshotBytes) {
      throw (lastError instanceof Error ? lastError : new Error("Parking map export failed."));
    }

    return new NextResponse(Buffer.from(screenshotBytes), {
      headers: {
        "content-type": "image/png",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Parking map export failed.";
    if (message.toLowerCase().includes("browser") || message.toLowerCase().includes("target")) {
      sharedBrowserPromise = null;
    }

    return new NextResponse(message, { status: 500 });
  }
}
