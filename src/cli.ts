#!/usr/bin/env node
import { discoverSavedReels } from "./browser-discovery.js";
import { loadConfig } from "./config.js";
import { enrichReelContent } from "./content-enrichment.js";
import { loadIndex, saveIndex, upsertReels } from "./index-store.js";
import { captureMediaForReels } from "./media-capture.js";
import { writeNotesForReels } from "./markdown.js";
import { sampleReels } from "./sample-data.js";
import { summarizeReels } from "./summary.js";
import { transcribeReels } from "./transcription.js";
import type { ReelRecord } from "./types.js";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const command = process.argv[2];
const config = loadConfig();

async function main(): Promise<void> {
  if (!command || ["help", "--help", "-h"].includes(command)) {
    printHelp();
    return;
  }

  if (command === "sample") {
    const result = await upsertReels(sampleReels());
    const written = await writeNotesForReels(config, result.index.reels);
    await saveIndex({
      ...result.index,
      reels: mergeWrittenReels(result.index.reels, written.map((item) => item.reel))
    });
    console.log(`Sample complete. Added ${result.added}, updated ${result.updated}, notes changed ${countChanged(written)}.`);
    return;
  }

  if (command === "doctor") {
    printDoctor();
    return;
  }

  if (command === "discover") {
    let checkpointAdded = 0;
    let checkpointUpdated = 0;
    const indexedBeforeDiscovery = (await loadIndex()).reels.length;
    const reels = await discoverSavedReels(config, async (checkpoint) => {
      if (checkpoint.length <= indexedBeforeDiscovery) {
        return;
      }

      const checkpointResult = await upsertReels(checkpoint);
      checkpointAdded += checkpointResult.added;
      checkpointUpdated += checkpointResult.updated;
      console.log(
        `discovery checkpoint found=${checkpoint.length} added=${checkpointResult.added} updated=${checkpointResult.updated}`
      );
    });
    const result = await upsertReels(reels);
    console.log(
      `Discovery complete. Found ${reels.length}, added ${result.added + checkpointAdded}, updated ${
        result.updated + checkpointUpdated
      }.`
    );
    return;
  }

  if (command === "write-notes") {
    const index = await loadIndex();
    const candidates = index.reels.filter((reel) => hasTranscript(reel)).slice(0, config.runLimit);
    const written = await writeNotesForReels(config, candidates);
    await saveIndex({
      ...index,
      reels: mergeWrittenReels(index.reels, written.map((item) => item.reel))
    });
    console.log(`Note writing complete. Notes changed ${countChanged(written)}.`);
    return;
  }

  if (command === "transcribe") {
    const index = await loadIndex();
    const candidates = index.reels
      .filter((reel) => reel.status !== "failed" && reel.audioPath && !reel.transcript)
      .slice(0, config.runLimit);
    const transcribed = await transcribeReels(config, candidates);
    await saveIndex({
      ...index,
      reels: mergeWrittenReels(index.reels, transcribed.map((item) => item.reel))
    });
    console.log(`Transcription complete. Reels changed ${countChanged(transcribed)}.`);
    return;
  }

  if (command === "capture-media") {
    const index = await loadIndex();
    const candidates = index.reels
      .filter((reel) => reel.status !== "failed" && !reel.audioPath && !reel.transcript)
      .slice(0, config.runLimit);
    const captured = await captureMediaForReels(config, candidates);
    await saveIndex({
      ...index,
      reels: mergeWrittenReels(index.reels, captured.map((item) => item.reel))
    });
    console.log(`Media capture complete. Reels changed ${countChanged(captured)}.`);
    return;
  }

  if (command === "drain-capture") {
    await drainCaptureQueue();
    return;
  }

  if (command === "drain-capture-parallel") {
    await drainCaptureQueueParallel();
    return;
  }

  if (command === "summarize") {
    const index = await loadIndex();
    const candidates = index.reels
      .filter((reel) => reel.status !== "failed" && reel.transcript && !reel.summary)
      .slice(0, config.runLimit);
    const summarized = await summarizeReels(config, candidates);
    await saveIndex({
      ...index,
      reels: mergeWrittenReels(index.reels, summarized.map((item) => item.reel))
    });
    console.log(`Summary complete. Reels changed ${countChanged(summarized)}.`);
    return;
  }

  if (command === "enrich-notes") {
    await enrichNotesQueue(false);
    return;
  }

  if (command === "enrich-notes-parallel") {
    await enrichNotesQueue(true);
    return;
  }

  if (command === "drain-audio") {
    await drainAudioQueue();
    return;
  }

  if (command === "drain-audio-parallel") {
    await drainAudioQueueParallel();
    return;
  }

  if (command === "process") {
    await runPipeline(config.runLimit, "Process");
    return;
  }

  if (command === "backlog") {
    await runPipeline(config.backlogLimit, "Backlog import");
    return;
  }

  if (command === "weekly") {
    await runPipeline(config.weeklyLimit, "Weekly import");
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function mergeWrittenReels(existing: ReelRecord[], written: ReelRecord[]): ReelRecord[] {
  const byUrl = new Map(written.map((reel) => [reel.url, reel]));
  return existing.map((reel) => byUrl.get(reel.url) || reel);
}

function countChanged(results: { changed: boolean }[]): number {
  return results.filter((result) => result.changed).length;
}

function printHelp(): void {
  console.log(`Usage: npm run <command>

Commands:
  doctor      Check local tools, output path, and model configuration
  sample       Create sample indexed reels and write Obsidian notes
  discover    Open Instagram Saved and index saved reel URLs
  capture-media Download reel audio for indexed reels
  drain-capture Capture queued media one item at a time with checkpoints
  drain-capture-parallel Capture queued media with a small worker pool
  transcribe  Transcribe indexed reels that have audio files
  drain-audio Transcribe queued audio one item at a time with checkpoints
  drain-audio-parallel Transcribe queued audio with a small worker pool
  summarize   Summarize transcribed reels
  enrich-notes Generate topic titles and key takeaway lessons
  enrich-notes-parallel Generate topic titles and key takeaway lessons with workers
  write-notes Write Obsidian notes from the local index
  process     Discover reels and write notes in one run
  backlog     Run a larger backlog import
  weekly      Run a smaller incremental import
`);
}

function printDoctor(): void {
  const checks = [
    checkCommand("node", ["--version"]),
    checkCommand("npm", ["--version"]),
    checkCommand("ffmpeg", ["-version"]),
    checkYtDlp(config.ytdlpCommand)
  ];

  const outputDir = path.resolve(config.outputDir);
  const localModelExists = config.localWhisperModel ? fs.existsSync(path.resolve(config.localWhisperModel)) : false;
  console.log("Reel Notes Doctor\n");
  for (const check of checks) {
    console.log(`${check.ok ? "OK" : "MISSING"} ${check.name}${check.detail ? `: ${check.detail}` : ""}`);
  }

  console.log(`OK output adapter: ${config.outputAdapter}`);
  console.log(`OK output dir: ${outputDir}`);
  console.log(`OK transcription provider: ${config.transcriptionProvider}`);
  console.log(`OK enrichment model: ${config.openaiSummaryModel}`);
  console.log(`${process.env.OPENAI_API_KEY ? "OK" : "MISSING"} OPENAI_API_KEY`);
  console.log(`${localModelExists ? "OK" : "MISSING"} local Whisper model: ${config.localWhisperModel}`);
  console.log("\nMissing OpenAI key is fine if you only use local transcription and skip LLM enrichment.");
}

function checkCommand(name: string, args: string[]): { name: string; ok: boolean; detail?: string } {
  const result =
    process.platform === "win32"
      ? spawnSync(commandForShell(name, args), { encoding: "utf8", windowsHide: true, shell: true })
      : spawnSync(name, args, { encoding: "utf8", windowsHide: true });
  const text = `${result.stdout || ""}${result.stderr || ""}`.split(/\r?\n/).find(Boolean)?.trim();
  return { name, ok: result.status === 0, detail: text };
}

function checkYtDlp(commandLine: string): { name: string; ok: boolean; detail?: string } {
  const [command, ...baseArgs] = commandLine.match(/"[^"]+"|'[^']+'|\S+/g)?.map((part) => part.replace(/^["']|["']$/g, "")) || [
    commandLine
  ];
  const args = [...baseArgs, "--version"];
  const result =
    process.platform === "win32"
      ? spawnSync(commandForShell(command, args), { encoding: "utf8", windowsHide: true, shell: true })
      : spawnSync(command, args, { encoding: "utf8", windowsHide: true });
  const text = `${result.stdout || ""}${result.stderr || ""}`.split(/\r?\n/).find(Boolean)?.trim();
  return { name: commandLine, ok: result.status === 0, detail: text };
}

function commandForShell(command: string, args: string[]): string {
  return [command, ...args].map((part) => (part.includes(" ") ? `"${part.replaceAll('"', '\\"')}"` : part)).join(" ");
}

async function runPipeline(limit: number, label: string): Promise<void> {
  const discovered = await discoverSavedReels({ ...config, runLimit: limit });
  const result = await upsertReels(discovered);
  const captureCandidates = result.index.reels
    .filter((reel) => reel.status !== "failed" && !reel.transcript && !reel.audioPath)
    .slice(0, limit);
  const captured = await captureMediaForReels(config, captureCandidates);
  const mergedAfterCapture = mergeWrittenReels(result.index.reels, captured.map((item) => item.reel));
  const transcribeCandidates = mergedAfterCapture
    .filter((reel) => reel.status !== "failed" && reel.audioPath && !reel.transcript)
    .slice(0, limit);
  const transcribed = await transcribeReels(config, transcribeCandidates);
  const mergedAfterTranscription = mergeWrittenReels(mergedAfterCapture, transcribed.map((item) => item.reel));
  const summarizeCandidates = mergedAfterTranscription
    .filter((reel) => hasTranscript(reel) && !reel.summary)
    .slice(0, limit);
  const summarized = await summarizeReels(config, summarizeCandidates);
  const mergedAfterSummary = mergeWrittenReels(mergedAfterTranscription, summarized.map((item) => item.reel));
  const written = await writeNotesForReels(config, mergedAfterSummary.filter((reel) => hasTranscript(reel)).slice(0, limit));
  await saveIndex({
    ...result.index,
    reels: mergeWrittenReels(mergedAfterSummary, written.map((item) => item.reel))
  });
  console.log(`${label} complete. Found ${discovered.length}, notes changed ${countChanged(written)}.`);
}

function hasTranscript(reel: ReelRecord): boolean {
  return Boolean(reel.transcript?.trim());
}

async function drainAudioQueue(): Promise<void> {
  let processed = 0;

  while (true) {
    const index = await loadIndex();
    const candidate = index.reels.find(
      (reel) => reel.status !== "failed" && Boolean(reel.audioPath) && !hasTranscript(reel)
    );

    if (!candidate) {
      const writable = index.reels.filter((reel) => hasTranscript(reel));
      const written = await writeNotesForReels(config, writable);
      await saveIndex({
        ...index,
        reels: mergeWrittenReels(index.reels, written.map((item) => item.reel))
      });
      console.log(`Audio drain complete. Processed ${processed}, notes checked ${written.length}.`);
      return;
    }

    console.log(`drain item=${candidate.id}`);
    const transcribed = await transcribeReels(config, [candidate]);
    const afterTranscription = mergeWrittenReels(index.reels, transcribed.map((item) => item.reel));
    await saveIndex({ ...index, reels: afterTranscription });

    const transcribedReel = transcribed[0]?.reel;
    if (transcribedReel && hasTranscript(transcribedReel) && !transcribedReel.summary) {
      const summarized = await summarizeReels(config, [transcribedReel]);
      const latestIndex = await loadIndex();
      await saveIndex({
        ...latestIndex,
        reels: mergeWrittenReels(latestIndex.reels, summarized.map((item) => item.reel))
      });
    }

    processed += 1;
  }
}

async function drainAudioQueueParallel(): Promise<void> {
  const concurrency = Math.max(1, Number.parseInt(process.env.AUDIO_CONCURRENCY || "3", 10) || 3);
  const index = await loadIndex();
  const queue = index.reels.filter(
    (reel) => reel.status !== "failed" && Boolean(reel.audioPath) && !hasTranscript(reel)
  );
  let processed = 0;
  let saveQueue = Promise.resolve();

  async function saveMerged(reels: ReelRecord[]): Promise<void> {
    saveQueue = saveQueue.then(async () => {
      const latest = await loadIndex();
      await saveIndex({
        ...latest,
        reels: mergeWrittenReels(latest.reels, reels)
      });
    });
    await saveQueue;
  }

  async function worker(workerId: number): Promise<void> {
    while (true) {
      const candidate = queue.shift();
      if (!candidate) {
        return;
      }

      console.log(`parallel worker=${workerId} item=${candidate.id}`);
      const transcribed = await transcribeReels(config, [candidate]);
      const transcribedReel = transcribed[0]?.reel;
      if (!transcribedReel) {
        continue;
      }

      await saveMerged([transcribedReel]);
      if (hasTranscript(transcribedReel) && !transcribedReel.summary) {
        const summarized = await summarizeReels(config, [transcribedReel]);
        await saveMerged(summarized.map((item) => item.reel));
      }

      processed += 1;
      if (processed % 10 === 0) {
        console.log(`parallel progress processed=${processed} remaining=${queue.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index + 1)));
  await saveQueue;

  const latest = await loadIndex();
  const writable = latest.reels.filter((reel) => hasTranscript(reel));
  const written = await writeNotesForReels(config, writable);
  await saveIndex({
    ...latest,
    reels: mergeWrittenReels(latest.reels, written.map((item) => item.reel))
  });
  console.log(`Parallel audio drain complete. Processed ${processed}, notes checked ${written.length}.`);
}

async function enrichNotesQueue(parallel: boolean): Promise<void> {
  const index = await loadIndex();
  const limit = Number.parseInt(process.env.ENRICH_LIMIT || "", 10) || config.runLimit;
  const queue = index.reels.filter((reel) => needsContentEnrichment(reel)).slice(0, limit);
  const dryRun = ["1", "true", "yes", "on"].includes((process.env.ENRICH_DRY_RUN || "").toLowerCase());

  if (dryRun) {
    const enriched = await enrichReelContent(config, queue);
    console.log(
      JSON.stringify(
        enriched.map((item) => ({
          id: item.reel.id,
          topicTitle: item.reel.topicTitle,
          keyTakeawayLesson: item.reel.keyTakeawayLesson,
          readableText: item.reel.readableText
        })),
        null,
        2
      )
    );
    console.log(`Content enrichment dry run complete. Checked ${enriched.length}.`);
    return;
  }

  if (!parallel) {
    let processed = 0;
    for (const candidate of queue) {
      console.log(`enrich item=${candidate.id}`);
      const enriched = await enrichReelContent(config, [candidate]);
      const latest = await loadIndex();
      await saveIndex({
        ...latest,
        reels: mergeWrittenReels(latest.reels, enriched.map((item) => item.reel))
      });
      processed += 1;
    }

    const latest = await loadIndex();
    const writable = latest.reels.filter((reel) => hasTranscript(reel));
    const written = await writeNotesForReels(config, writable);
    await saveIndex({
      ...latest,
      reels: mergeWrittenReels(latest.reels, written.map((item) => item.reel))
    });
    console.log(`Content enrichment complete. Processed ${processed}, notes checked ${written.length}.`);
    return;
  }

  const concurrency = Math.max(1, Number.parseInt(process.env.ENRICH_CONCURRENCY || "3", 10) || 3);
  let processed = 0;
  let saveQueue = Promise.resolve();

  async function saveMerged(reels: ReelRecord[]): Promise<void> {
    saveQueue = saveQueue.then(async () => {
      const latest = await loadIndex();
      await saveIndex({
        ...latest,
        reels: mergeWrittenReels(latest.reels, reels)
      });
    });
    await saveQueue;
  }

  async function worker(workerId: number): Promise<void> {
    while (true) {
      const candidate = queue.shift();
      if (!candidate) {
        return;
      }

      console.log(`parallel enrich worker=${workerId} item=${candidate.id}`);
      const enriched = await enrichReelContent(config, [candidate]);
      await saveMerged(enriched.map((item) => item.reel));
      processed += 1;

      if (processed % 20 === 0) {
        console.log(`parallel enrich progress processed=${processed} remaining=${queue.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index + 1)));
  await saveQueue;

  const latest = await loadIndex();
  const writable = latest.reels.filter((reel) => hasTranscript(reel));
  const written = await writeNotesForReels(config, writable);
  await saveIndex({
    ...latest,
    reels: mergeWrittenReels(latest.reels, written.map((item) => item.reel))
  });
  console.log(`Parallel content enrichment complete. Processed ${processed}, notes checked ${written.length}.`);
}

function needsContentEnrichment(reel: ReelRecord): boolean {
  return (
    hasTranscript(reel) &&
    (!reel.topicTitle?.trim() || !reel.keyTakeawayLesson?.trim() || !reel.readableText?.trim())
  );
}

async function drainCaptureQueue(): Promise<void> {
  let processed = 0;

  while (true) {
    const index = await loadIndex();
    const candidate = index.reels.find(
      (reel) => reel.status !== "failed" && !reel.audioPath && !hasTranscript(reel)
    );

    if (!candidate) {
      console.log(`Capture drain complete. Processed ${processed}.`);
      return;
    }

    console.log(`capture item=${candidate.id}`);
    const captured = await captureMediaForReels(config, [candidate]);
    await saveIndex({
      ...index,
      reels: mergeWrittenReels(index.reels, captured.map((item) => item.reel))
    });

    processed += 1;
  }
}

async function drainCaptureQueueParallel(): Promise<void> {
  const concurrency = Math.max(1, Number.parseInt(process.env.CAPTURE_CONCURRENCY || "2", 10) || 2);
  const index = await loadIndex();
  const queue = index.reels.filter(
    (reel) => reel.status !== "failed" && !reel.audioPath && !hasTranscript(reel)
  );
  let processed = 0;
  let saveQueue = Promise.resolve();

  async function saveMerged(reels: ReelRecord[]): Promise<void> {
    saveQueue = saveQueue.then(async () => {
      const latest = await loadIndex();
      await saveIndex({
        ...latest,
        reels: mergeWrittenReels(latest.reels, reels)
      });
    });
    await saveQueue;
  }

  async function worker(workerId: number): Promise<void> {
    while (true) {
      const candidate = queue.shift();
      if (!candidate) {
        return;
      }

      console.log(`parallel capture worker=${workerId} item=${candidate.id}`);
      const captured = await captureMediaForReels(config, [candidate]);
      await saveMerged(captured.map((item) => item.reel));
      processed += 1;

      if (processed % 20 === 0) {
        console.log(`parallel capture progress processed=${processed} remaining=${queue.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index + 1)));
  await saveQueue;
  console.log(`Parallel capture drain complete. Processed ${processed}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
