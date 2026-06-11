export type ReelStatus =
  | "discovered"
  | "metadata_ready"
  | "transcribed"
  | "note_written"
  | "failed";

export interface AppConfig {
  instagramSavedUrl: string;
  chromeUserDataDir: string;
  chromeProfileDir: string;
  browserChannel: "chromium" | "chrome" | "msedge";
  outputDir: string;
  outputAdapter: "obsidian" | "markdown";
  outputIndexFile: string;
  noteFilenameMode: "topic" | "creator_id" | "id";
  runLimit: number;
  backlogLimit: number;
  weeklyLimit: number;
  headless: boolean;
  discoveryScrolls: number;
  paceMs: number;
  ytdlpCommand: string;
  ytdlpCookiesFromBrowser: string;
  transcriptionProvider: "openai" | "local" | "none";
  summaryProvider: "openai" | "local" | "none";
  openaiTranscriptionModel: string;
  openaiSummaryModel: string;
  localWhisperModel: string;
  mediaRetention: "delete_after_transcription" | "retain";
}

export interface ReelRecord {
  id: string;
  url: string;
  creator?: string;
  caption?: string;
  postedAt?: string;
  thumbnailUrl?: string;
  audioPath?: string;
  transcript?: string;
  summary?: string;
  topicTitle?: string;
  keyTakeawayLesson?: string;
  readableText?: string;
  notePath?: string;
  status: ReelStatus;
  discoveredAt: string;
  updatedAt: string;
  lastError?: string;
}

export interface ReelIndex {
  version: 1;
  reels: ReelRecord[];
}
