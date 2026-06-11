# Contributing

Thanks for helping improve Reel Notes.

## Development Setup

```sh
npm install
npm run typecheck
npm run build
npm run sample
```

## Before Opening a Pull Request

- Run `npm run typecheck`.
- Run `npm run build`.
- Run `npm run sample` and inspect the generated Markdown.
- Do not commit `.env`, `data/`, browser profiles, media files, logs, local models, or generated notes.
- Keep provider secrets in environment variables only.

## Good First Areas

- New output adapters.
- Better metadata extraction.
- Better retry behavior for browser and media capture.
- Provider adapters for other LLMs and transcription services.
- Tests for note rendering and filename collision behavior.

## Safety Rules

- Do not bypass platform access controls.
- Do not ask users for passwords.
- Do not commit private user content.
- Keep imports resumable and idempotent.
