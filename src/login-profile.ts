import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { loadConfig } from "./config.js";
import { explainAuthState, readInstagramAuthState } from "./instagram-auth.js";

const config = loadConfig();
const userDataDir = path.resolve(config.chromeUserDataDir);
fs.mkdirSync(userDataDir, { recursive: true });

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  channel: config.browserChannel === "chromium" ? undefined : config.browserChannel,
  args: [`--profile-directory=${config.chromeProfileDir}`],
  viewport: { width: 1365, height: 900 }
});

const page = context.pages()[0] || (await context.newPage());
await page.goto(config.instagramSavedUrl, { waitUntil: "commit", timeout: 120_000 });
await page.waitForTimeout(2500);

const initialState = await readInstagramAuthState(page);
console.log(explainAuthState(initialState));
console.log("Use the browser window to log into Instagram or resolve any checkpoint.");
console.log("Close the browser window when the Saved page opens successfully.");

await page.waitForEvent("close").catch(() => undefined);
await context.close().catch(() => undefined);
console.log("Login browser closed.");
