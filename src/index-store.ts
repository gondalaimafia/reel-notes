import fs from "node:fs/promises";
import path from "node:path";
import { dataDir, indexPath, logsDir, mediaDir } from "./paths.js";
import type { ReelIndex, ReelRecord } from "./types.js";

export async function ensureWorkspaceDirs(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(logsDir, { recursive: true });
  await fs.mkdir(mediaDir, { recursive: true });
}

export async function loadIndex(): Promise<ReelIndex> {
  await ensureWorkspaceDirs();

  try {
    const raw = await withFileRetry(() => fs.readFile(indexPath, "utf8"));
    const parsed = JSON.parse(raw) as ReelIndex;
    return {
      version: 1,
      reels: Array.isArray(parsed.reels) ? parsed.reels : []
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, reels: [] };
    }

    throw error;
  }
}

export async function saveIndex(index: ReelIndex): Promise<void> {
  await ensureWorkspaceDirs();
  const sorted: ReelIndex = {
    version: 1,
    reels: [...index.reels].sort((a, b) => a.discoveredAt.localeCompare(b.discoveredAt))
  };
  await withFileRetry(() => fs.writeFile(indexPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8"));
}

export async function upsertReels(records: ReelRecord[]): Promise<{
  added: number;
  updated: number;
  index: ReelIndex;
}> {
  const index = await loadIndex();
  const byUrl = new Map(index.reels.map((reel) => [normalizeReelUrl(reel.url), reel]));
  let added = 0;
  let updated = 0;

  for (const record of records) {
    const key = normalizeReelUrl(record.url);
    const existing = byUrl.get(key);
    if (!existing) {
      index.reels.push(record);
      byUrl.set(key, record);
      added += 1;
      continue;
    }

    const preservedStatus =
      existing.status === "note_written" || existing.status === "failed" ? existing.status : record.status;

    Object.assign(existing, {
      ...record,
      id: existing.id || record.id,
      url: existing.url || record.url,
      discoveredAt: existing.discoveredAt || record.discoveredAt,
      notePath: record.notePath || existing.notePath,
      transcript: record.transcript || existing.transcript,
      summary: record.summary || existing.summary,
      status: preservedStatus
    });
    updated += 1;
  }

  await saveIndex(index);
  return { added, updated, index };
}

export function makeReelRecord(input: Partial<ReelRecord> & { url: string }): ReelRecord {
  const now = new Date().toISOString();
  return {
    id: input.id || reelIdFromUrl(input.url),
    url: input.url,
    creator: input.creator,
    caption: input.caption,
    postedAt: input.postedAt,
    thumbnailUrl: input.thumbnailUrl,
    audioPath: input.audioPath,
    transcript: input.transcript,
    summary: input.summary,
    topicTitle: input.topicTitle,
    keyTakeawayLesson: input.keyTakeawayLesson,
    readableText: input.readableText,
    notePath: input.notePath,
    status: input.status || "discovered",
    discoveredAt: input.discoveredAt || now,
    updatedAt: now,
    lastError: input.lastError
  };
}

export function reelIdFromUrl(url: string): string {
  const match = url.match(/\/(?:reel|p)\/([^/?#]+)/i);
  if (match?.[1]) {
    return match[1];
  }

  return Buffer.from(normalizeReelUrl(url)).toString("base64url").slice(0, 16);
}

export function normalizeReelUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}

export function toAbsoluteNotePath(notePath: string): string {
  return path.resolve(notePath);
}

async function withFileRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const code = (error as NodeJS.ErrnoException).code;
      if (!["EBUSY", "EPERM", "EACCES"].includes(code || "")) {
        throw error;
      }

      await wait(150 * attempt);
    }
  }

  throw lastError;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
