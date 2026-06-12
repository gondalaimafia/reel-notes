---
title: "Turn Saved Instagram Reels Into Obsidian Notes"
seo_title: "Instagram Reels to Obsidian Notes"
description: "Reel Notes transcribes saved Instagram reels, rewrites them into readable Markdown, and saves them to Obsidian or any notes folder."
keywords: "Instagram reels to Obsidian notes, transcribe saved Instagram reels, saved reels Markdown, Obsidian Instagram importer, local Whisper reels transcription, OpenClaw Hermes Codex Claude Code"
layout: default
---

# Turn Saved Instagram Reels Into Obsidian Notes

You save a reel because it has one useful idea.

Then it disappears into a folder you almost never revisit.

Reel Notes is a small open source tool that turns those saved social videos into Markdown notes. It was built first for Obsidian, but it writes normal Markdown files, so it can also feed Logseq, Dendron, a plain notes folder, or any other tool that reads files from disk.

The output is not just a rough transcript. Each reel becomes a note with a topic based filename, a key takeaway lesson, reader friendly notes, and the raw transcript for traceability.

## Quick Answer

Reel Notes turns saved Instagram reels into Obsidian notes by reusing your logged in browser session, finding saved reel links, extracting audio, transcribing speech with local Whisper or OpenAI, then writing each result as a Markdown note.

Each note includes:

- a filename based on the reel topic
- the source reel link
- the creator handle when available
- a key takeaway lesson
- cleaned notes for reading
- the raw transcript for traceability

The tool is local first. It does not ask for your Instagram password, and it can write to Obsidian or any folder based notes app.

```md
# Product Thinking From Short Videos

Source: [Instagram reel](https://www.instagram.com/reel/...)
Creator: [[creator_handle]]

## Key Takeaway Lesson

Short videos can become useful notes when the core idea is rewritten as a clear lesson.

## Reader Friendly Notes

The rough transcript is rewritten into clean prose or bullet notes without adding new facts.

## Raw Transcript

The original transcript stays here for traceability.
```

## Why This Exists

Saved reels are a weak knowledge system.

They are useful in the moment, but they are hard to search, hard to cite, and hard to connect to the rest of your notes. If you use Obsidian, that is especially frustrating because the rest of your thinking already lives in a searchable local graph.

Reel Notes bridges that gap.

It uses your own browser session to access saved Instagram reels, extracts audio with `yt-dlp`, transcribes the audio, asks an LLM to name the note by topic and write a key lesson, then saves the result as Markdown.

## How Reel Notes Works

1. You log in to Instagram manually in a local browser profile.
2. Reel Notes checks whether the session is logged in, blocked, challenged, or signed out.
3. The discovery command collects saved reel and post URLs.
4. The capture command extracts audio with `yt-dlp`.
5. The transcription command uses local Whisper or OpenAI.
6. The enrichment command creates a topic title, key lesson, and readable notes.
7. The writer saves Markdown files into Obsidian or another folder.

Long imports are resumable. If the run stops, Reel Notes keeps an index of what has already been discovered, captured, transcribed, enriched, and written.

## What It Does

Reel Notes can:

- open a local Chromium, Chrome, or Edge profile for manual Instagram login
- detect whether Instagram is logged in, asking for login, or showing a challenge
- discover saved reel and post URLs
- extract audio with `yt-dlp`
- transcribe audio with local Whisper or OpenAI
- use an LLM to create a topic title, key takeaway lesson, and reader-friendly notes
- write Obsidian-style Markdown or plain Markdown
- resume from checkpoints if a long run stops

## Built For Obsidian First

Obsidian is the default output mode.

That means the note writer uses frontmatter, tags, aliases, and wikilinks:

```env
OUTPUT_ADAPTER=obsidian
OUTPUT_DIR=/Users/me/Obsidian/MainVault/raw/social/instagram
NOTE_FILENAME_MODE=topic
```

If you want plain Markdown instead:

```env
OUTPUT_ADAPTER=markdown
OUTPUT_DIR=/Users/me/notes/social-video-notes
```

The files are local. You own them. You can search them, link them, sync them, or delete them.

## Who Should Use It

Use Reel Notes if you:

- save Instagram reels for ideas, tutorials, product thinking, recipes, fitness cues, or research
- use Obsidian as your main notes app
- want saved social videos to become searchable Markdown
- prefer local files instead of another social media dashboard
- want to run the workflow with OpenClaw, Hermes, Claude Code, or Codex

Skip it if you want a hosted social media analytics product. Reel Notes is a local note making pipeline.

## Model Choices

You can use local transcription:

```env
TRANSCRIPTION_PROVIDER=local
LOCAL_WHISPER_MODEL=data/models/ggml-tiny.en.bin
```

Or OpenAI transcription:

```env
TRANSCRIPTION_PROVIDER=openai
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

For LLM enrichment:

```env
SUMMARY_PROVIDER=openai
OPENAI_SUMMARY_MODEL=gpt-4.1-mini
```

During setup, if Reel Notes cannot find a local Whisper model or an API key, it asks what you want to do:

1. download the default local Whisper model
2. use OpenAI API and enter model names
3. skip and configure later

For non-interactive setup, run:

```sh
npm run setup -- --with-local-whisper
```

## Run It Yourself

Clone the repo:

```sh
git clone https://github.com/gondalaimafia/reel-notes.git
cd reel-notes
npm run setup
npm run doctor
```

Open the login browser:

```sh
npm run login
npm run auth-status
```

Run a small test:

```sh
RUN_LIMIT=3 npm run process
```

After that works, run the backlog pipeline:

```sh
npm run discover
npm run drain-capture-parallel
npm run drain-audio-parallel
npm run enrich-notes-parallel
npm run write-notes
```

## Run It With An Agent

If you use agentic coding tools, the repo includes runbooks.

- [OpenClaw runbook](https://github.com/gondalaimafia/reel-notes/blob/main/examples/agents/openclaw-runbook.md)
- [Hermes runbook](https://github.com/gondalaimafia/reel-notes/blob/main/examples/agents/hermes-runbook.md)
- [Claude Code runbook](https://github.com/gondalaimafia/reel-notes/blob/main/examples/agents/claude-code-runbook.md)
- [Codex runbook](https://github.com/gondalaimafia/reel-notes/blob/main/examples/agents/codex-runbook.md)

Each runbook tells the agent to verify dependencies, avoid committing secrets, open the login browser, check auth status, and start with a small import before any backlog job.

## Safety

Reel Notes does not ask for your Instagram password.

You log in manually in a browser profile you control. The tool reuses that browser session and stops if Instagram shows a login page, checkpoint, challenge, or safety warning.

The repo also includes a sanitizer:

```sh
npm run verify
```

That checks TypeScript, builds the project, checks the article metadata, and scans for common private artifacts such as `.env`, `data/`, browser profiles, local media, local models, and real looking API keys.

## FAQ

### Is Reel Notes an Obsidian plugin?

Not yet. The first version is a command line tool that writes Obsidian ready Markdown into any vault folder. That keeps the workflow simple and also supports Logseq, Dendron, and plain Markdown folders.

### Does Reel Notes need my Instagram password?

No. You log in manually in a browser profile that you control. Reel Notes reuses that browser session and stops when Instagram asks for login, checkpoint, challenge, or a safety review.

### Can Reel Notes run without an OpenAI API key?

Yes. Transcription can use a local Whisper model. LLM enrichment needs a model provider if you want topic based filenames, key takeaway lessons, and reader friendly notes.

### Can I choose the model?

Yes. The `.env` file lets you choose local Whisper, OpenAI transcription models, and OpenAI summary models. The setup flow asks what to do if it cannot find a local model or API key.

### Can agents run this workflow?

Yes. The repo includes runbooks for OpenClaw, Hermes, Claude Code, and Codex. Each runbook starts with dependency checks, auth status checks, and a small import before backlog processing.

## Get It

GitHub repo:

[github.com/gondalaimafia/reel-notes](https://github.com/gondalaimafia/reel-notes)

Release:

[Reel Notes v0.1.0](https://github.com/gondalaimafia/reel-notes/releases/tag/v0.1.0)

The project is early, local-first, and intentionally simple. The goal is not to build a social media dashboard. The goal is to make the useful ideas you already saved show up where your notes actually live.
