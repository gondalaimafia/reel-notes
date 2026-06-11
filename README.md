# Reel Notes

Reel Notes turns saved social videos into readable Markdown notes.

It was designed for Obsidian first, but the output is just Markdown files in a folder. You can point it at an Obsidian vault folder, a Logseq pages folder, a Dendron vault, a plain notes directory, or any tool that reads Markdown.

The first supported source is Instagram Saved reels and posts. The pipeline uses your own browser session, extracts audio with `yt-dlp`, transcribes it, asks an LLM to create a topic title plus key takeaway lesson, then writes one note per reel.

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
- Chrome or Chromium
- Python, for `yt-dlp`
- `ffmpeg`
- Optional: OpenAI API key for OpenAI transcription and LLM note enrichment
- Optional: ffmpeg with Whisper filter support plus a local Whisper model

## Quick Start

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
TRANSCRIPTION_PROVIDER=local
SUMMARY_PROVIDER=openai
OPENAI_SUMMARY_MODEL=gpt-4.1-mini
```

Run a sample first:

```sh
npm run sample
```

## Login

The tool does not ask for your Instagram password.

It opens a local Chrome profile. Log into Instagram yourself:

```sh
npm run login
```

After login succeeds, close that browser window and start the import.

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

Setup with the tiny English local Whisper model:

```sh
npm run setup -- --with-local-whisper
```

The setup script:

- installs npm dependencies
- installs Playwright Chromium
- checks `ffmpeg`
- checks `yt-dlp`
- creates `.env` from `.env.example` if needed
- optionally downloads the tiny English local Whisper model

## Verification

Before publishing or opening a pull request:

```sh
npm run verify
```

This runs TypeScript checks, builds the project, and scans the repo for common private artifacts such as `.env`, `data/`, browser profiles, local media, local models, and real-looking API keys.

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
