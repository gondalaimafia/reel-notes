# Agent Guide

## Purpose

Reel Notes converts saved social videos into Markdown notes. Obsidian is the default output style, but the writer must remain usable for any folder based Markdown tool.

## Commands

- `npm run typecheck`: TypeScript check.
- `npm run build`: Compile to `dist`.
- `npm run sample`: Write sample notes to `OUTPUT_DIR`.
- `npm run doctor`: Check local tools and model configuration.
- `npm run login`: Open the browser profile for manual login.
- `npm run auth-status`: Check whether the browser profile is logged into Instagram.

## Architecture

- `src/browser-discovery.ts`: Uses Playwright to find saved Instagram reel links.
- `src/media-capture.ts`: Uses `yt-dlp` to extract audio.
- `src/transcription.ts`: Uses local ffmpeg Whisper or OpenAI transcription.
- `src/content-enrichment.ts`: Uses an LLM to create topic titles, key lessons, and readable notes.
- `src/markdown.ts`: Writes Markdown notes and an index note.
- `src/index-store.ts`: Stores resumable state in `data/reels-index.json`.
- `src/config.ts`: Reads `.env` and process environment config.

## Rules

- Never commit `.env`, `data/`, logs, Chrome profiles, media files, local models, or generated notes.
- Keep long work checkpointed after each item.
- Keep note output deterministic and idempotent.
- Prefer provider settings in `.env` over hard-coded models.
- Do not add credentials or personal paths to defaults.
- Keep tool output bounded. Never recursively enumerate `data`, browser profiles, logs, media, local models, generated notes, `node_modules`, or `dist`.
