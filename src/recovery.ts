import fs from "node:fs";
import path from "node:path";
import type { AppConfig, ReelIndex, ReelRecord, ReelStatus } from "./types.js";
import { ensureWorkspaceDirs, normalizeReelUrl, saveIndex } from "./index-store.js";
import { indexPath } from "./paths.js";

export interface RetryOptions {
  attempts: number;
  baseMs: number;
  label: string;
  isRetryable?: (error: unknown) => boolean;
}

export interface RepairReport {
  changed: boolean;
  fixes: string[];
  warnings: string[];
  nextSteps: string[];
  index: ReelIndex;
}

export async function loadIndexForRepair(fixes: string[]): Promise<ReelIndex> {
  await ensureWorkspaceDirs();

  if (!fs.existsSync(indexPath)) {
    return { version: 1, reels: [] };
  }

  try {
    const raw = await fs.promises.readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw) as ReelIndex;
    return {
      version: 1,
      reels: Array.isArray(parsed.reels) ? parsed.reels : []
    };
  } catch (error) {
    const backupPath = `${indexPath}.broken-${Date.now()}.bak`;
    await fs.promises.copyFile(indexPath, backupPath);
    fixes.push(`backed up unreadable index to ${backupPath}`);
    fixes.push("created a fresh empty index");
    return { version: 1, reels: [] };
  }
}

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  const attempts = Math.max(1, options.attempts);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !(options.isRetryable || isRetryableError)(error)) {
        throw error;
      }

      const delay = Math.max(1, options.baseMs) * attempt * attempt;
      console.warn(`${options.label} failed on attempt ${attempt}. Retrying in ${delay}ms: ${compactError(error)}`);
      await wait(delay);
    }
  }

  throw lastError;
}

export function isRetryableError(error: unknown): boolean {
  const message = compactError(error).toLowerCase();
  return [
    "timeout",
    "timed out",
    "rate_limit",
    "429",
    "temporarily",
    "temporary",
    "econnreset",
    "etimedout",
    "eai_again",
    "ebusy",
    "eperm",
    "network",
    "socket",
    "connection"
  ].some((needle) => message.includes(needle));
}

export function compactError(error: unknown, maxLength = 500): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, maxLength) || "Unknown error";
}

export async function repairWorkspace(config: AppConfig, index: ReelIndex): Promise<RepairReport> {
  const fixes: string[] = [];
  const warnings: string[] = [];
  const nextSteps = new Set<string>();

  await ensureWorkspaceDirs();
  await ensureDirectory(path.resolve(config.outputDir), fixes, "output directory");

  const repaired = repairIndexRecords(index, config, fixes, warnings);

  if (!fs.existsSync(indexPath)) {
    fixes.push("created local index file");
  }

  if (config.transcriptionProvider === "local" && !fs.existsSync(path.resolve(config.localWhisperModel))) {
    warnings.push(`local Whisper model is missing at ${config.localWhisperModel}`);
    nextSteps.add("run npm run setup -- --with-local-whisper or set TRANSCRIPTION_PROVIDER=openai");
  }

  if (needsOpenAiKey(config) && !process.env.OPENAI_API_KEY) {
    warnings.push("OPENAI_API_KEY is missing for the configured model provider");
    nextSteps.add("add OPENAI_API_KEY to .env or switch the provider to local or none");
  }

  if (repaired.changed || fixes.length > 0) {
    await saveIndex(repaired.index);
  }

  addPipelineNextSteps(repaired.index, nextSteps);

  return {
    changed: repaired.changed || fixes.length > 0,
    fixes,
    warnings,
    nextSteps: [...nextSteps],
    index: repaired.index
  };
}

function repairIndexRecords(
  index: ReelIndex,
  config: AppConfig,
  fixes: string[],
  warnings: string[]
): { changed: boolean; index: ReelIndex } {
  let changed = false;
  const byUrl = new Map<string, ReelRecord>();
  const now = new Date().toISOString();

  for (const reel of index.reels) {
    const normalizedUrl = normalizeReelUrl(reel.url);
    const repaired = repairRecord(reel, config, warnings, now);
    const existing = byUrl.get(normalizedUrl);

    if (!existing) {
      byUrl.set(normalizedUrl, repaired.record);
      changed = changed || repaired.changed || normalizedUrl !== reel.url;
      continue;
    }

    byUrl.set(normalizedUrl, mergeRecord(existing, repaired.record));
    changed = true;
  }

  if (byUrl.size !== index.reels.length) {
    fixes.push(`merged ${index.reels.length - byUrl.size} duplicate index record(s)`);
  }

  const reels = [...byUrl.values()].sort((a, b) => a.discoveredAt.localeCompare(b.discoveredAt));
  return { changed, index: { version: 1, reels } };
}

function repairRecord(
  reel: ReelRecord,
  config: AppConfig,
  warnings: string[],
  now: string
): { changed: boolean; record: ReelRecord } {
  let changed = false;
  const record: ReelRecord = { ...reel };

  if (record.url !== normalizeReelUrl(record.url)) {
    record.url = normalizeReelUrl(record.url);
    changed = true;
  }

  if (record.audioPath && !fs.existsSync(path.resolve(record.audioPath))) {
    warnings.push(`missing audio file for ${record.id}`);
    record.audioPath = undefined;
    changed = true;
  }

  const transcriptReady = Boolean(record.transcript?.trim());
  const audioReady = Boolean(record.audioPath);
  const noteReady = Boolean(record.notePath && fs.existsSync(path.resolve(record.notePath)));
  const nextStatus = inferStatus(record.status, transcriptReady, audioReady, noteReady);

  if (nextStatus !== record.status) {
    record.status = nextStatus;
    record.updatedAt = now;
    record.lastError = undefined;
    changed = true;
  }

  if (record.notePath && !record.notePath.startsWith(path.resolve(config.outputDir)) && !fs.existsSync(record.notePath)) {
    record.notePath = undefined;
    changed = true;
  }

  return { changed, record };
}

function inferStatus(
  current: ReelStatus,
  transcriptReady: boolean,
  audioReady: boolean,
  noteReady: boolean
): ReelStatus {
  if (noteReady && transcriptReady) {
    return "note_written";
  }

  if (transcriptReady) {
    return "transcribed";
  }

  if (audioReady) {
    return "metadata_ready";
  }

  if (current === "failed") {
    return "discovered";
  }

  return current;
}

function mergeRecord(left: ReelRecord, right: ReelRecord): ReelRecord {
  return {
    ...left,
    ...right,
    creator: right.creator || left.creator,
    caption: right.caption || left.caption,
    postedAt: right.postedAt || left.postedAt,
    thumbnailUrl: right.thumbnailUrl || left.thumbnailUrl,
    audioPath: right.audioPath || left.audioPath,
    transcript: right.transcript || left.transcript,
    summary: right.summary || left.summary,
    topicTitle: right.topicTitle || left.topicTitle,
    keyTakeawayLesson: right.keyTakeawayLesson || left.keyTakeawayLesson,
    readableText: right.readableText || left.readableText,
    notePath: right.notePath || left.notePath,
    status: statusRank(right.status) >= statusRank(left.status) ? right.status : left.status,
    discoveredAt: left.discoveredAt < right.discoveredAt ? left.discoveredAt : right.discoveredAt,
    updatedAt: left.updatedAt > right.updatedAt ? left.updatedAt : right.updatedAt,
    lastError: right.lastError || left.lastError
  };
}

function statusRank(status: ReelStatus): number {
  switch (status) {
    case "note_written":
      return 4;
    case "transcribed":
      return 3;
    case "metadata_ready":
      return 2;
    case "discovered":
      return 1;
    case "failed":
      return 0;
  }
}

function addPipelineNextSteps(index: ReelIndex, nextSteps: Set<string>): void {
  if (index.reels.some((reel) => reel.status !== "failed" && !reel.audioPath && !reel.transcript)) {
    nextSteps.add("run npm run drain-capture-parallel");
  }

  if (index.reels.some((reel) => reel.status !== "failed" && reel.audioPath && !reel.transcript)) {
    nextSteps.add("run npm run drain-audio-parallel");
  }

  if (index.reels.some((reel) => reel.transcript?.trim() && !reel.topicTitle?.trim())) {
    nextSteps.add("run npm run enrich-notes-parallel");
  }

  if (index.reels.some((reel) => reel.transcript?.trim() && !reel.notePath)) {
    nextSteps.add("run npm run write-notes");
  }
}

function needsOpenAiKey(config: AppConfig): boolean {
  return config.transcriptionProvider === "openai" || config.summaryProvider === "openai";
}

async function ensureDirectory(dir: string, fixes: string[], label: string): Promise<void> {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    fixes.push(`created ${label}: ${dir}`);
    return;
  }

  const marker = path.join(dir, `.reel-notes-write-test-${process.pid}`);
  await fs.promises.writeFile(marker, "ok", "utf8");
  await fs.promises.unlink(marker);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
