# Reel Notes

Reel Notes turns saved social videos into readable Markdown notes.

It was designed for Obsidian first, but the output is just Markdown files in a folder. You can point it at an Obsidian vault folder, a Logseq pages folder, a Dendron vault, a plain notes directory, or any tool that reads Markdown.

The first supported source is Instagram Saved reels and posts. The pipeline uses your own browser session, extracts audio with `yt-dlp`, transcribes it, asks an LLM to create a topic title plus key takeaway lesson, then writes one note per reel.

Launch article:

[Turn Saved Instagram Reels Into Obsidian Notes](https://reel-notes-phi.vercel.app/)

## What It Creates

Each video becomes a note like this:

```md
---
title: "Product Thinking From Short Videos"
source: instagram
url: "https://www.instagram.com/reel/..."
creator: "creator_handle"
captured: "2026-06-11"
reel_id: "abc123"
status: note_written
tags:
  - instagram/reel
aliases:
  - "instagram abc123"
---

# Product Thinking From Short Videos

Source: [Instagram reel](https://www.instagram.com/reel/...)
Creator: [[creator_handle]]
Captured: 2026-06-11

## Key Takeaway Lesson

Short videos can become useful notes when the core idea is rewritten as a clear lesson.

## Reader Friendly Notes

The rough transcript is rewritten into clean prose or bullet notes without adding new facts.

## Caption

Original caption text.

## Raw Transcript

The unpolished transcript stays here for traceability.
```

## Requirements

- Node.js 20 or newer
- Chrome, Edge, or Playwright Chromium
- Python, for `yt-dlp`
- `ffmpeg`
- Optional: OpenAI API key for OpenAI transcription and LLM note enrichment
- Optional: ffmpeg with Whisper filter support plus a local Whisper model

## Quick Start

Choose one of these paths.

### Option 1: Terminal

```powershell
git clone https://github.com/your-name/reel-notes.git
cd reel-notes
.\setup.ps1
npm run doctor
copy .env.example .env
```

Unix:

```sh
git clone https://github.com/your-name/reel-notes.git
cd reel-notes
sh setup.sh
npm run doctor
cp .env.example .env
```

Then edit `.env`:

```env
OUTPUT_DIR=C:\path\to\your\ObsidianVault\raw\social\instagram
OPENAI_API_KEY=your-api-key
BROWSER_CHANNEL=chromium
TRANSCRIPTION_PROVIDER=local
SUMMARY_PROVIDER=openai
OPENAI_SUMMARY_MODEL=gpt-4.1-mini
```

Run a sample first:

```sh
npm run sample
```

### Option 2: OpenClaw

Clone the repo, then give OpenClaw this runbook:

[examples/agents/openclaw-runbook.md](examples/agents/openclaw-runbook.md)

OpenClaw should run setup, doctor, sample output, login, and then a small `RUN_LIMIT=3` import before any backlog import.

### Option 3: Hermes

Clone the repo, then give Hermes this runbook:

[examples/agents/hermes-runbook.md](examples/agents/hermes-runbook.md)

Hermes should verify the repo, check dependencies, help configure `.env`, and stop after the first small import unless you approve a larger run.

### Option 4: Claude Code

Clone the repo, then give Claude Code this runbook:

[examples/agents/claude-code-runbook.md](examples/agents/claude-code-runbook.md)

Claude Code should verify the repo, check dependencies, help configure `.env`, open the manual login browser, and stop after the first small import unless you approve a larger run.

### Option 5: Codex

Clone the repo, then give Codex this runbook:

[examples/agents/codex-runbook.md](examples/agents/codex-runbook.md)

Codex should read the repo `AGENTS.md`, verify dependencies, help configure `.env`, open the manual login browser, and start with a small `RUN_LIMIT=3` import.

## Login

The tool does not ask for your Instagram password.

It opens a persistent Chromium, Chrome, or Edge profile. Log into Instagram yourself:

```sh
npm run login
```

After login succeeds, close that browser window and check the saved session:

```sh
npm run auth-status
```

The importer uses the same persistent browser profile for discovery. If Instagram shows a login page, checkpoint, challenge, or safety warning, discovery stops and tells you to run `npm run login` again. The tool never asks for your Instagram password and never stores it in `.env`.

Browser channel options:

```env
BROWSER_CHANNEL=chromium
BROWSER_CHANNEL=chrome
BROWSER_CHANNEL=msedge
```

## Import Commands

For a small test:

```sh
RUN_LIMIT=3 npm run process
```

For a backlog import:

```sh
npm run discover
npm run drain-capture-parallel
npm run drain-audio-parallel
npm run enrich-notes-parallel
npm run write-notes
```

For a weekly incremental run:

```sh
npm run weekly
```

All long commands checkpoint to `data/reels-index.json`, so you can stop and resume.

## Self Healing

If a run is interrupted, starts failing after a network issue, or leaves reels half processed, run:

```sh
npm run self-heal
```

Self healing will:

- recreate missing workspace and output folders
- back up an unreadable local index and start a fresh one
- merge duplicate index records by reel URL
- reset failed records when audio, transcript, or note files now exist
- clear stale audio paths when the file is gone
- rewrite missing or stale Markdown notes for reels that already have transcripts
- print warnings for missing model files or API keys
- print the next command to run, such as capture, transcription, enrichment, or note writing

It will not bypass Instagram login challenges, create credentials, or delete user media by surprise.

Retry behavior is configurable:

```env
RETRY_ATTEMPTS=3
RETRY_BASE_MS=750
```

## Output Targets

Obsidian is the default:

```env
OUTPUT_ADAPTER=obsidian
OUTPUT_DIR=/Users/me/Notes/Vault/raw/social/instagram
```

Plain Markdown mode avoids Obsidian wikilinks:

```env
OUTPUT_ADAPTER=markdown
OUTPUT_DIR=/Users/me/notes/social-video-notes
```

Filename modes:

```env
NOTE_FILENAME_MODE=topic
NOTE_FILENAME_MODE=creator_id
NOTE_FILENAME_MODE=id
```

## Model Choices

Transcription:

```env
TRANSCRIPTION_PROVIDER=local
LOCAL_WHISPER_MODEL=data/models/ggml-tiny.en.bin
```

```env
TRANSCRIPTION_PROVIDER=openai
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

```env
TRANSCRIPTION_PROVIDER=none
```

LLM enrichment:

```env
SUMMARY_PROVIDER=openai
OPENAI_SUMMARY_MODEL=gpt-4.1-mini
```

The enrichment pass creates:

- topic title
- key takeaway lesson
- reader friendly notes

If you do not want LLM enrichment, skip `npm run enrich-notes-parallel` and run `npm run write-notes`.

## Setup Details

Basic setup:

```sh
npm run setup
```

During setup, if no local Whisper model and no API key are found, Reel Notes asks which model path you want:

- download the default local Whisper model
- use OpenAI API and enter model names
- skip and configure `.env` later

Non-interactive setup with the tiny English local Whisper model:

```sh
npm run setup -- --with-local-whisper
```

The setup script:

- installs npm dependencies
- installs Playwright Chromium
- checks `ffmpeg`
- checks `yt-dlp`
- creates `.env` from `.env.example` if needed
- asks how you want to configure transcription and enrichment when no model or API key is present
- optionally downloads the tiny English local Whisper model

## Verification

Before publishing or opening a pull request:

```sh
npm run verify
```

This runs TypeScript checks, builds the project, checks the launch article metadata, builds the static article site, and scans the repo for common private artifacts such as `.env`, `data/`, browser profiles, local media, local models, and real-looking API keys.

You may still need to install `ffmpeg` yourself:

Windows:

```powershell
winget install Gyan.FFmpeg
py -m pip install -U yt-dlp
```

macOS:

```sh
brew install ffmpeg
python3 -m pip install -U yt-dlp
```

Linux:

```sh
sudo apt-get install ffmpeg python3-pip
python3 -m pip install -U yt-dlp
```

## Safety

- Use only accounts and content you can access yourself.
- Do not store Instagram credentials in this project.
- Keep `.env`, `data/`, browser profiles, logs, media, and generated notes out of git.
- Respect platform terms and rate limits.
- Start with a small `RUN_LIMIT`.

## Project Status

This is an early open-source package extracted from a working local import. It is intentionally simple: local files, resumable JSON state, and Markdown output.

Planned next steps:

- more source adapters
- better metadata extraction
- optional Obsidian plugin wrapper
- provider adapters beyond OpenAI
