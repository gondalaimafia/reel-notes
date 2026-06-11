import path from "node:path";
import { chromium } from "playwright";
import type { Page } from "playwright";
import type { AppConfig, ReelRecord } from "./types.js";
import { makeReelRecord, normalizeReelUrl } from "./index-store.js";

const stopPhrases = [
  "suspicious activity",
  "confirm it is you",
  "try again later",
  "challenge required",
  "we restrict certain activity",
  "help us confirm"
];

type DiscoveryCheckpoint = (reels: ReelRecord[]) => Promise<void>;

export async function discoverSavedReels(
  config: AppConfig,
  onCheckpoint?: DiscoveryCheckpoint
): Promise<ReelRecord[]> {
  const userDataDir = path.resolve(config.chromeUserDataDir);
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: config.headless,
    channel: "chrome",
    args: [`--profile-directory=${config.chromeProfileDir}`],
    viewport: { width: 1365, height: 900 }
  });

  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(config.instagramSavedUrl, { waitUntil: "commit", timeout: 120_000 });
    await page.waitForTimeout(config.paceMs);
    await stopIfInstagramWarning(pageText(await readBodyText(page)));
    await openAllPostsCollectionIfNeeded(page, config.paceMs);

    if (process.env.DEBUG_DISCOVERY === "true") {
      await page.screenshot({ path: "data/logs/discovery-page.png", fullPage: true });
      const text = await readBodyText(page);
      await import("node:fs/promises").then((fs) =>
        fs.writeFile("data/logs/discovery-page.txt", text.slice(0, 8000), "utf8")
      );
    }

    const found = new Map<string, ReelRecord>();
    let lastCheckpointSize = 0;
    for (let scroll = 0; scroll <= config.discoveryScrolls; scroll += 1) {
      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
          .map((anchor) => anchor.href)
          .filter((href) => /instagram\.com\/(?:reel|p)\//i.test(href));
      });

      for (const link of links) {
        const normalized = normalizeReelUrl(link);
        if (!found.has(normalized)) {
          found.set(normalized, makeReelRecord({ url: normalized }));
        }
      }

      if (scroll > 0 && scroll % 50 === 0) {
        console.log(`discovery progress scroll=${scroll} found=${found.size}`);
      }

      if (onCheckpoint && found.size > lastCheckpointSize) {
        const reels = Array.from(found.values()).slice(0, config.runLimit);
        await onCheckpoint(reels);
        lastCheckpointSize = found.size;
      }

      if (found.size >= config.runLimit) {
        break;
      }

      await page.mouse.wheel(0, 1400);
      await page.waitForTimeout(config.paceMs);
      await stopIfInstagramWarning(pageText(await readBodyText(page)));
    }

    const reels = Array.from(found.values()).slice(0, config.runLimit);
    if (onCheckpoint) {
      await onCheckpoint(reels);
    }
    return reels;
  } finally {
    await context.close();
  }
}

async function openAllPostsCollectionIfNeeded(page: Page, paceMs: number): Promise<void> {
  const currentUrl = page.url();
  if (currentUrl.includes("/saved/all-posts/")) {
    return;
  }

  const allPostsHref = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
    return links.find((anchor) => anchor.href.includes("/saved/all-posts/"))?.href;
  });

  if (!allPostsHref) {
    return;
  }

  await page.goto(allPostsHref, { waitUntil: "commit", timeout: 120_000 });
  await page.waitForTimeout(paceMs);
}

function pageText(value: string | null): string {
  return (value || "").toLowerCase();
}

async function readBodyText(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => document.body?.innerText || "");
  } catch {
    return "";
  }
}

async function stopIfInstagramWarning(text: string): Promise<void> {
  const phrase = stopPhrases.find((candidate) => text.includes(candidate));
  if (phrase) {
    throw new Error(`Instagram warning detected: ${phrase}`);
  }
}
