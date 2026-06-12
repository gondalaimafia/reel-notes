import OpenAI from "openai";
import { isRetryableError, withRetry } from "./recovery.js";
import type { AppConfig, ReelRecord } from "./types.js";

export interface ContentEnrichmentResult {
  reel: ReelRecord;
  changed: boolean;
}

interface ReelContentInsight {
  topicTitle: string;
  keyTakeawayLesson: string;
  readableText: string;
}

const fallbackInsight: ReelContentInsight = {
  topicTitle: "Unclear Reel",
  keyTakeawayLesson: "No clear spoken lesson was available in this reel.",
  readableText: "_No clear spoken content was available._"
};

export async function enrichReelContent(
  config: AppConfig,
  reels: ReelRecord[]
): Promise<ContentEnrichmentResult[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for LLM topic naming and lessons.");
  }

  const openai = new OpenAI();
  const results: ContentEnrichmentResult[] = [];

  for (const reel of reels) {
    if (!reel.transcript?.trim()) {
      results.push({ reel, changed: false });
      continue;
    }

    if (reel.topicTitle?.trim() && reel.keyTakeawayLesson?.trim() && reel.readableText?.trim()) {
      results.push({ reel, changed: false });
      continue;
    }

    const insight = await createInsight(openai, config, reel);
    results.push({
      reel: {
        ...reel,
        topicTitle: insight.topicTitle,
        keyTakeawayLesson: insight.keyTakeawayLesson,
        readableText: insight.readableText,
        updatedAt: new Date().toISOString(),
        lastError: undefined
      },
      changed: true
    });
  }

  return results;
}

async function createInsight(openai: OpenAI, config: AppConfig, reel: ReelRecord): Promise<ReelContentInsight> {
  try {
    return await withRetry(() => createInsightOnce(openai, config, reel), {
      attempts: config.retryAttempts,
      baseMs: config.retryBaseMs,
      label: `content enrichment ${reel.id}`,
      isRetryable: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        return !message.includes("insufficient_quota") && isRetryableError(error);
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("insufficient_quota") || message.includes("rate_limit") || message.includes("429")) {
      throw error;
    }

    return fallbackFromTranscript(reel);
  }
}

async function createInsightOnce(openai: OpenAI, config: AppConfig, reel: ReelRecord): Promise<ReelContentInsight> {
  try {
    const response = await openai.responses.create({
      model: config.openaiSummaryModel,
      input: [
        {
          role: "system",
          content:
            "Analyze Instagram reel transcripts for an Obsidian knowledge vault. Return only compact JSON. Base every field only on the caption and transcript. Do not invent context."
        },
        {
          role: "user",
          content: `Return JSON with exactly these keys:
topicTitle: a specific 4 to 9 word note title about the reel's topic, no creator name, no quote marks.
keyTakeawayLesson: one practical sentence that states the main lesson from the reel.
readableText: rewrite the transcript into clear reader friendly prose or bullet notes. Fix obvious transcription punctuation and spacing. Remove repeated music markers and filler. Preserve meaning. Do not add facts, names, claims, or examples that are not in the transcript. If a word is unclear, write around it naturally instead of using question marks, guesses in parentheses, or awkward uncertainty markers.

If the transcript is only music, noise, or too unclear to infer a lesson, use topicTitle "Music Only Clip" or "Unclear Reel", say no clear spoken lesson was available, and set readableText to "_No clear spoken content was available._"

Caption:
${clipText(reel.caption || "No caption available.", 1200)}

Transcript:
${clipText(reel.transcript || "", 10000)}`
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "reel_content_insight",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              topicTitle: {
                type: "string"
              },
              keyTakeawayLesson: {
                type: "string"
              },
              readableText: {
                type: "string"
              }
            },
            required: ["topicTitle", "keyTakeawayLesson", "readableText"]
          }
        }
      },
      max_output_tokens: 900
    });

    return normalizeInsight(JSON.parse(response.output_text) as ReelContentInsight);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("insufficient_quota") || message.includes("rate_limit")) {
      throw error;
    }

    return fallbackFromTranscript(reel);
  }
}

function normalizeInsight(insight: ReelContentInsight): ReelContentInsight {
  const topicTitle = cleanInline(insight.topicTitle).slice(0, 90) || fallbackInsight.topicTitle;
  const keyTakeawayLesson =
    cleanInline(insight.keyTakeawayLesson).slice(0, 260) || fallbackInsight.keyTakeawayLesson;
  const readableText = cleanReadableText(insight.readableText) || fallbackInsight.readableText;

  return {
    topicTitle,
    keyTakeawayLesson,
    readableText
  };
}

function fallbackFromTranscript(reel: ReelRecord): ReelContentInsight {
  const text = cleanInline(reel.transcript || "");
  if (!text || musicOnly(text)) {
    return fallbackInsight;
  }

  const words = text.split(" ").filter(Boolean);
  const topicTitle = words.slice(0, 7).join(" ") || fallbackInsight.topicTitle;
  const keyTakeawayLesson = `${words.slice(0, 28).join(" ")}${words.length > 28 ? "." : ""}`;
  const readableText = text;
  return normalizeInsight({ topicTitle, keyTakeawayLesson, readableText });
}

function musicOnly(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[()\[\].,!?]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return true;
  }

  const words = normalized.split(" ");
  const musicWords = words.filter((word) => ["music", "upbeat", "audio", "sound"].includes(word)).length;
  return musicWords / words.length > 0.7;
}

function clipText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function cleanInline(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/["`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanReadableText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}
