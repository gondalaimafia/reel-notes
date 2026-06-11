import type { Page } from "playwright";

export type InstagramAuthState = "authenticated" | "login_required" | "challenge" | "unknown";

const challengePhrases = [
  "suspicious activity",
  "confirm it is you",
  "challenge required",
  "help us confirm",
  "we restrict certain activity",
  "try again later"
];

const loginPhrases = ["log in", "sign up", "forgot password", "phone number, username, or email"];

export async function readInstagramAuthState(page: Page): Promise<InstagramAuthState> {
  const url = page.url().toLowerCase();
  const text = (await readBodyText(page)).toLowerCase();

  if (challengePhrases.some((phrase) => text.includes(phrase) || url.includes(phrase.replace(/\s+/g, "_")))) {
    return "challenge";
  }

  const passwordInput = await page.locator('input[name="password"]').count().catch(() => 0);
  if (url.includes("/accounts/login") || passwordInput > 0 || loginPhrases.some((phrase) => text.includes(phrase))) {
    return "login_required";
  }

  const savedLinks = await page
    .locator('a[href*="/saved/"], a[href*="/reel/"], a[href*="/p/"]')
    .count()
    .catch(() => 0);
  if (url.includes("instagram.com") && savedLinks > 0) {
    return "authenticated";
  }

  if (url.includes("/saved/") && !text.includes("log in")) {
    return "authenticated";
  }

  return "unknown";
}

export function explainAuthState(state: InstagramAuthState): string {
  if (state === "authenticated") {
    return "Instagram session is authenticated.";
  }

  if (state === "login_required") {
    return "Instagram login is required. Run npm run login, log in manually, close the browser, then retry.";
  }

  if (state === "challenge") {
    return "Instagram is showing a checkpoint or safety warning. Resolve it manually in the login browser before importing.";
  }

  return "Instagram auth state is unclear. Run npm run login and confirm the Saved page opens.";
}

export async function readBodyText(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => document.body?.innerText || "");
  } catch {
    return "";
  }
}
