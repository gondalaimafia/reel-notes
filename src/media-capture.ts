import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mediaDir } from "./paths.js";
import type { AppConfig, ReelRecord } from "./types.js";

export interface MediaCaptureResult {
  reel: ReelRecord;
  changed: boolean;
}

export async function captureMediaForReels(config: AppConfig, reels: ReelRecord[]): Promise<MediaCaptureResult[]> {
  await fs.promises.mkdir(mediaDir, { recursive: true });
  const results: MediaCaptureResult[] = [];

  for (const reel of reels) {
    if (reel.audioPath && fs.existsSync(reel.audioPath)) {
      results.push({ reel, changed: false });
      continue;
    }

    const outputTemplate = path.join(mediaDir, `${safeFilePart(reel.id)}.%(ext)s`);
    const args = [
      "--no-playlist",
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "5",
      "--output",
      outputTemplate,
      "--print",
      "after_move:filepath",
      "--cookies-from-browser",
      config.ytdlpCookiesFromBrowser,
      reel.url
    ];

    try {
      const stdout = await runCommand(config.ytdlpCommand, args);
      const audioPath = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .at(-1);

      if (!audioPath || !fs.existsSync(audioPath)) {
        throw new Error("yt-dlp did not produce an audio file path.");
      }

      results.push({
        reel: {
          ...reel,
          audioPath,
          status: "metadata_ready",
          updatedAt: new Date().toISOString(),
          lastError: undefined
        },
        changed: true
      });
    } catch (error) {
      results.push({
        reel: {
          ...reel,
          status: "failed",
          updatedAt: new Date().toISOString(),
          lastError: error instanceof Error ? error.message : String(error)
        },
        changed: true
      });
    }
  }

  return results;
}

function runCommand(commandLine: string, args: string[]): Promise<string> {
  const [command, ...baseArgs] = splitCommand(commandLine);

  return new Promise((resolve, reject) => {
    const child = spawn(command, [...baseArgs, ...args], {
      cwd: process.cwd(),
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr.trim() || `Command failed with exit code ${code}`));
    });
  });
}

function splitCommand(commandLine: string): string[] {
  const matches = commandLine.match(/"[^"]+"|'[^']+'|\S+/g) || [];
  return matches.map((part) => part.replace(/^["']|["']$/g, ""));
}

function safeFilePart(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").slice(0, 120);
}
