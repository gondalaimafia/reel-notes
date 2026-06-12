import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AppConfig } from "./types.js";

function loadDotEnv(): void {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function envString(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function envBoolean(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function envTranscriptionProvider(): "openai" | "local" | "none" {
  const value = envString("TRANSCRIPTION_PROVIDER", "local").toLowerCase();
  if (value === "none") {
    return "none";
  }

  return value === "openai" ? "openai" : "local";
}

function envSummaryProvider(): "openai" | "local" | "none" {
  const value = envString("SUMMARY_PROVIDER", "local").toLowerCase();
  if (value === "none") {
    return "none";
  }

  return value === "openai" ? "openai" : "local";
}

function envMediaRetention(): "delete_after_transcription" | "retain" {
  const value = envString("MEDIA_RETENTION", "delete_after_transcription").toLowerCase();
  return value === "retain" ? "retain" : "delete_after_transcription";
}

function envOutputAdapter(): "obsidian" | "markdown" {
  const value = envString("OUTPUT_ADAPTER", "obsidian").toLowerCase();
  return value === "markdown" ? "markdown" : "obsidian";
}

function envNoteFilenameMode(): "topic" | "creator_id" | "id" {
  const value = envString("NOTE_FILENAME_MODE", "topic").toLowerCase();
  if (value === "creator_id" || value === "id") {
    return value;
  }

  return "topic";
}

function envBrowserChannel(): "chromium" | "chrome" | "msedge" {
  const value = envString("BROWSER_CHANNEL", "chromium").toLowerCase();
  if (value === "chrome" || value === "msedge") {
    return value;
  }

  return "chromium";
}

function defaultChromeUserDataDir(): string {
  if (process.platform === "win32") {
    return path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "User Data");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Google", "Chrome");
  }

  return path.join(os.homedir(), ".config", "google-chrome");
}

export function loadConfig(): AppConfig {
  loadDotEnv();

  return {
    instagramSavedUrl: envString("INSTAGRAM_SAVED_URL", "https://www.instagram.com/saved/all-posts/"),
    chromeUserDataDir: envString("CHROME_USER_DATA_DIR", defaultChromeUserDataDir()),
    chromeProfileDir: envString("CHROME_PROFILE_DIR", "Default"),
    browserChannel: envBrowserChannel(),
    outputDir: envString("OUTPUT_DIR", path.join(process.cwd(), "notes")),
    outputAdapter: envOutputAdapter(),
    outputIndexFile: envString("OUTPUT_INDEX_FILE", "Social Video Notes Index.md"),
    noteFilenameMode: envNoteFilenameMode(),
    runLimit: envNumber("RUN_LIMIT", 3),
    backlogLimit: envNumber("BACKLOG_LIMIT", 25),
    weeklyLimit: envNumber("WEEKLY_LIMIT", 10),
    headless: envBoolean("HEADLESS", false),
    discoveryScrolls: envNumber("DISCOVERY_SCROLLS", 4),
    paceMs: envNumber("PACE_MS", 2500),
    ytdlpCommand: envString("YTDLP_COMMAND", "py -m yt_dlp"),
    ytdlpCookiesFromBrowser: envString("YTDLP_COOKIES_FROM_BROWSER", "chrome"),
    transcriptionProvider: envTranscriptionProvider(),
    summaryProvider: envSummaryProvider(),
    openaiTranscriptionModel: envString("OPENAI_TRANSCRIPTION_MODEL", "gpt-4o-mini-transcribe"),
    openaiSummaryModel: envString("OPENAI_SUMMARY_MODEL", "gpt-4.1-mini"),
    localWhisperModel: envString("LOCAL_WHISPER_MODEL", "data/models/ggml-tiny.en.bin"),
    mediaRetention: envMediaRetention(),
    retryAttempts: envNumber("RETRY_ATTEMPTS", 3),
    retryBaseMs: envNumber("RETRY_BASE_MS", 750)
  };
}
