import { makeReelRecord } from "./index-store.js";
import type { ReelRecord } from "./types.js";

export function sampleReels(): ReelRecord[] {
  return [
    makeReelRecord({
      url: "https://www.instagram.com/reel/sample_alpha/",
      creator: "sample_creator",
      caption: "A short saved reel about product thinking.",
      transcript: "This is a placeholder transcript for the first saved reel.",
      summary: "Product thinking note from a saved reel.",
      topicTitle: "Product Thinking From Short Videos",
      keyTakeawayLesson: "Short videos can become useful notes when the core idea is rewritten as a clear lesson.",
      readableText:
        "This sample shows how a saved reel can be turned into a reusable note. The raw transcript stays available, while the main reading section captures the point in cleaner language.",
      status: "transcribed"
    }),
    makeReelRecord({
      url: "https://www.instagram.com/reel/sample_beta/",
      creator: "sample_creator_two",
      caption: "A second saved reel prepared for Obsidian verification.",
      transcript: "This is a placeholder transcript for the second saved reel.",
      summary: "Verification note for the Obsidian writer.",
      topicTitle: "Verifying Markdown Note Output",
      keyTakeawayLesson: "Run a small sample first so you can confirm filenames, frontmatter, and note sections before a large import.",
      readableText:
        "This sample is meant to verify the note writer. It confirms that Markdown files are created with frontmatter, source links, a key lesson, readable notes, and the raw transcript.",
      status: "transcribed"
    })
  ];
}
