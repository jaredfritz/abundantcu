import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";
import type { Browser, LaunchOptions } from "playwright-core";

async function launchVercelBrowser(): Promise<Browser> {
  const launchOptions: LaunchOptions = {
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  };

  return playwrightChromium.launch(launchOptions);
}

async function launchLocalBrowser(): Promise<Browser> {
  const playwright = await import("playwright");
  const browserType = playwright.chromium as unknown as {
    launch: (options: LaunchOptions) => Promise<Browser>;
  };
  return browserType.launch({ headless: true });
}

export async function launchExportBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    return launchVercelBrowser();
  }
  return launchLocalBrowser();
}
