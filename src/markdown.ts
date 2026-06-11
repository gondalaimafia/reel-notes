import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "./types.js";
import type { ReelRecord } from "./types.js";

export interface NoteWriteResult {
  reel: ReelRecord;
  changed: boolean;
}

export async function writeNotesForReels(config: AppConfig, reels: ReelRecord[]): Promise<NoteWriteResult[]> {
  if (!config.outputDir) {
    throw new Error("OUTPUT_DIR is required before writing notes.");
  }

  const destination = path.resolve(config.outputDir);
  await fs.mkdir(destination, { recursive: true });

  const results: NoteWriteResult[] = [];
  const names = uniqueNoteFileNames(config, reels);
  for (const reel of reels) {
    const fileName = names.get(reel) || `${safeFilePart(reel.creator || "instagram")} ${reel.id}.md`;
    const notePath = path.join(destination, fileName);
    const content = renderReelNote(config, reel);

    const previous = await readIfExists(notePath);
    if (previous !== content) {
      await fs.writeFile(notePath, content, "utf8");
      await removeOldGeneratedNote(destination, reel.notePath, notePath);
      results.push({
        reel: {
          ...reel,
          notePath,
          status: "note_written",
          updatedAt: new Date().toISOString()
        },
        changed: true
      });
      continue;
    }

    results.push({
      reel: {
        ...reel,
        notePath,
        status: "note_written",
        updatedAt: new Date().toISOString()
      },
      changed: false
    });
  }

  await writeIndexNote(
    config,
    destination,
    results.map((result) => result.reel).filter((reel) => Boolean(reel.transcript?.trim()))
  );
  return results;
}

export function renderReelNote(config: AppConfig, reel: ReelRecord): string {
  const title = noteTitle(reel);
  const captured = dateOnly(reel.discoveredAt);
  const creator = reel.creator || "unknown creator";
  const transcript = reel.transcript?.trim() || "_Transcript pending._";
  const caption = reel.caption?.trim() || "_Caption unavailable._";
  const keyTakeawayLesson = reel.keyTakeawayLesson?.trim() || reel.summary?.trim() || "_Lesson pending._";
  const readableText = reel.readableText?.trim() || transcript;

  const creatorLine =
    config.outputAdapter === "obsidian" ? `Creator: [[${escapeWikilink(creator)}]]` : `Creator: ${creator}`;

  return `---\n${yamlLine("title", title)}source: instagram\n${yamlLine("url", reel.url)}${yamlLine(
    "creator",
    creator
  )}${yamlLine("captured", captured)}${yamlLine("reel_id", reel.id)}status: ${
    reel.status
  }\ntags:\n  - instagram/reel\naliases:\n  - ${JSON.stringify(`instagram ${reel.id}`)}\n---\n\n# ${title}\n\nSource: [Instagram reel](${reel.url})\n${creatorLine}\nCaptured: ${captured}\n\n## Key Takeaway Lesson\n\n${keyTakeawayLesson}\n\n## Reader Friendly Notes\n\n${readableText}\n\n## Caption\n\n${caption}\n\n## Raw Transcript\n\n${transcript}\n\n## Notes\n\n\n`;
}

function noteTitle(reel: ReelRecord): string {
  const topicTitle = reel.topicTitle?.replace(/\s+/g, " ").trim();
  if (topicTitle) {
    return topicTitle;
  }

  const creator = reel.creator || "Instagram";
  const caption = reel.caption?.replace(/\s+/g, " ").trim();
  if (!caption) {
    return `${creator}: ${reel.id}`;
  }

  return `${creator}: ${caption.slice(0, 80)}`;
}

async function writeIndexNote(config: AppConfig, destination: string, reels: ReelRecord[]): Promise<void> {
  const names = uniqueNoteFileNames(config, reels);
  const rows = [...reels]
    .sort((a, b) => noteTitle(a).localeCompare(noteTitle(b)) || a.id.localeCompare(b.id))
    .map((reel) => indexRow(config, names.get(reel) || "", noteTitle(reel)));

  const content = `---\ntitle: Social Video Notes Index\nsource: social-video-notes\nstatus: generated\ntags:\n  - social-video-notes/index\n---\n\n# Social Video Notes Index\n\n${rows.join("\n")}\n`;
  await fs.writeFile(path.join(destination, config.outputIndexFile), content, "utf8");
}

function uniqueNoteFileNames(config: AppConfig, reels: ReelRecord[]): Map<ReelRecord, string> {
  const counts = new Map<string, number>();
  const names = new Map<ReelRecord, string>();

  for (const reel of reels) {
    const existingName = existingGeneratedNoteName(reel.notePath);
    const base = noteFileBase(config, reel, existingName);
    const count = counts.get(base.toLowerCase()) || 0;
    counts.set(base.toLowerCase(), count + 1);
    const suffix = count === 0 ? "" : ` ${reel.id}`;
    names.set(reel, `${base}${suffix}.md`);
  }

  return names;
}

function noteFileBase(config: AppConfig, reel: ReelRecord, existingName: string | undefined): string {
  if (config.noteFilenameMode === "id") {
    return safeFilePart(reel.id);
  }

  if (config.noteFilenameMode === "creator_id") {
    return safeFilePart(`${reel.creator || "instagram"} ${reel.id}`);
  }

  if (reel.topicTitle?.trim()) {
    return safeFilePart(reel.topicTitle);
  }

  return existingName ? withoutMarkdownExtension(existingName) : safeFilePart(`${reel.creator || "instagram"} ${reel.id}`);
}

function indexRow(config: AppConfig, fileName: string, title: string): string {
  const noteName = withoutMarkdownExtension(fileName);
  if (config.outputAdapter === "obsidian") {
    return `- [[${noteName}|${title}]]`;
  }

  return `- [${title}](${encodeURI(fileName)})`;
}

function safeFilePart(value: string): string {
  return value
    .replace(/^@/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "instagram";
}

function withoutMarkdownExtension(value: string): string {
  return value.replace(/\.md$/i, "");
}

function existingGeneratedNoteName(notePath: string | undefined): string | undefined {
  if (!notePath) {
    return undefined;
  }

  const name = path.basename(notePath);
  return name.endsWith(".md") ? name : undefined;
}

function escapeWikilink(value: string): string {
  return value.replace(/[[\]|#^]/g, " ").replace(/\s+/g, " ").trim();
}

function yamlLine(key: string, value: string): string {
  return `${key}: ${JSON.stringify(value)}\n`;
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

async function readIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function removeOldGeneratedNote(destination: string, oldPath: string | undefined, newPath: string): Promise<void> {
  if (!oldPath) {
    return;
  }

  const resolvedOld = path.resolve(oldPath);
  const resolvedNew = path.resolve(newPath);
  const resolvedDestination = path.resolve(destination);
  if (resolvedOld === resolvedNew || !resolvedOld.startsWith(resolvedDestination)) {
    return;
  }

  try {
    const content = await fs.readFile(resolvedOld, "utf8");
    if (content.includes("source: instagram") && content.includes("instagram/reel")) {
      await fs.unlink(resolvedOld);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
