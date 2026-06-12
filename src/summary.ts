import OpenAI from "openai";
import { withRetry } from "./recovery.js";
import type { AppConfig, ReelRecord } from "./types.js";

export interface SummaryResult {
  reel: ReelRecord;
  changed: boolean;
}

export async function summarizeReels(config: AppConfig, reels: ReelRecord[]): Promise<SummaryResult[]> {
  if (config.summaryProvider === "none") {
    return reels.map((reel) => ({ reel, changed: false }));
  }

  const openai = new OpenAI();
  const results: SummaryResult[] = [];

  for (const reel of reels) {
    if (!reel.transcript?.trim() || reel.summary?.trim()) {
      results.push({ reel, changed: false });
      continue;
    }

    let summary: string;
    if (config.summaryProvider === "local" || !process.env.OPENAI_API_KEY) {
      summary = fallbackSummary(reel.transcript);
    } else {
      try {
        const response = await withRetry(
          () =>
            openai.responses.create({
              model: config.openaiSummaryModel,
              input: [
                {
                  role: "system",
                  content:
                    "Write compact Obsidian notes from Instagram reel transcripts. Preserve concrete ideas. Do not invent details."
                },
                {
                  role: "user",
                  content: `Caption:\n${reel.caption || "No caption available."}\n\nTranscript:\n${reel.transcript}`
                }
              ]
            }),
          {
            attempts: config.retryAttempts,
            baseMs: config.retryBaseMs,
            label: `summary ${reel.id}`
          }
        );
        summary = response.output_text.trim();
      } catch {
        summary = fallbackSummary(reel.transcript);
      }
    }

    results.push({
      reel: {
        ...reel,
        summary,
        updatedAt: new Date().toISOString(),
        lastError: undefined
      },
      changed: true
    });
  }

  return results;
}

function fallbackSummary(transcript: string): string {
  const normalized = transcript.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "_Summary pending._";
  }

  const words = normalized.split(" ").slice(0, 45).join(" ");
  return `${words}${normalized.split(" ").length > 45 ? "..." : ""}`;
}
