import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import OpenAI from "openai";
import type { AppConfig, ReelRecord } from "./types.js";

export interface TranscriptionResult {
  reel: ReelRecord;
  changed: boolean;
}

export async function transcribeReels(config: AppConfig, reels: ReelRecord[]): Promise<TranscriptionResult[]> {
  if (config.transcriptionProvider === "none") {
    return reels.map((reel) => ({ reel, changed: false }));
  }

  const openai = new OpenAI();
  const results: TranscriptionResult[] = [];

  for (const reel of reels) {
    if (reel.transcript?.trim()) {
      results.push({ reel, changed: false });
      continue;
    }

    if (!reel.audioPath) {
      results.push({
        reel: {
          ...reel,
          status: "failed",
          updatedAt: new Date().toISOString(),
          lastError: "No audioPath is available for transcription."
        },
        changed: true
      });
      continue;
    }

    const audioPath = path.resolve(reel.audioPath);
    if (!fs.existsSync(audioPath)) {
      results.push({
        reel: {
          ...reel,
          status: "failed",
          updatedAt: new Date().toISOString(),
          lastError: `Audio file not found: ${audioPath}`
        },
        changed: true
      });
      continue;
    }

    let transcriptText: string;
    if (config.transcriptionProvider === "local" || !process.env.OPENAI_API_KEY) {
      transcriptText = await transcribeWithLocalWhisper(config, reel.id, audioPath);
      if (!transcriptText.trim()) {
        results.push({
          reel: {
            ...reel,
            status: "failed",
            updatedAt: new Date().toISOString(),
            lastError: "Local Whisper did not produce a transcript."
          },
          changed: true
        });
        continue;
      }
    } else {
      try {
        const transcript = await openai.audio.transcriptions.create({
          file: fs.createReadStream(audioPath),
          model: config.openaiTranscriptionModel
        });
        transcriptText = transcript.text.trim();
      } catch (error) {
        transcriptText = await transcribeWithLocalWhisper(config, reel.id, audioPath);
        if (!transcriptText.trim()) {
          results.push({
            reel: {
              ...reel,
              status: "failed",
              updatedAt: new Date().toISOString(),
              lastError: error instanceof Error ? error.message : String(error)
            },
            changed: true
          });
          continue;
        }
      }
    }

    const shouldDeleteAudio = config.mediaRetention === "delete_after_transcription";
    if (shouldDeleteAudio) {
      fs.unlinkSync(audioPath);
    }

    results.push({
      reel: {
        ...reel,
        audioPath: shouldDeleteAudio ? undefined : reel.audioPath,
        transcript: transcriptText.trim(),
        status: "transcribed",
        updatedAt: new Date().toISOString(),
        lastError: undefined
      },
      changed: true
    });
  }

  return results;
}

async function transcribeWithLocalWhisper(config: AppConfig, reelId: string, audioPath: string): Promise<string> {
  const modelPath = path.resolve(config.localWhisperModel);
  if (!fs.existsSync(modelPath)) {
    return "";
  }

  const transcriptPath = path.join("data", "logs", `${reelId}-transcript.txt`);
  await fs.promises.mkdir(path.dirname(transcriptPath), { recursive: true });
  const filterModelPath = config.localWhisperModel.replaceAll("\\", "/");
  const filterTranscriptPath = transcriptPath.replaceAll("\\", "/");

  await runCommand("ffmpeg", [
    "-hide_banner",
    "-y",
    "-i",
    audioPath,
    "-af",
    `whisper=model=${filterModelPath}:language=auto:destination=${filterTranscriptPath}:format=text`,
    "-f",
    "null",
    process.platform === "win32" ? "NUL" : "/dev/null"
  ]);

  return fs.readFileSync(transcriptPath, "utf8").trim();
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: false,
      windowsHide: true
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `Command failed with exit code ${code}`));
    });
  });
}
