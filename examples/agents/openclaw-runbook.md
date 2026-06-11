# OpenClaw Runbook

Use this prompt with OpenClaw after cloning Reel Notes.

```text
You are helping me run Reel Notes, an open-source tool that turns saved Instagram reels into Markdown notes.

Repo path:
<path-to-reel-notes>

Goal:
Set up the repo, verify tools, help me configure .env, open the login browser, then run a small import before any larger backlog import.

Rules:
1. Do not ask for or store my Instagram password.
2. Do not commit .env, data, logs, browser profiles, media, local models, or generated notes.
3. Run npm run doctor before importing.
4. Run npm run sample first and inspect the generated Markdown.
5. Use OUTPUT_DIR from .env. It can be an Obsidian vault folder or any Markdown folder.
6. Run npm run auth-status and stop if login, checkpoint, or challenge is required.
7. Start with RUN_LIMIT=3.
8. If a command fails, read the log and fix the root cause before continuing.

Commands:
npm run setup
npm run doctor
npm run sample
npm run login
npm run auth-status
RUN_LIMIT=3 npm run process

After the small import works, ask me before running:
npm run discover
npm run drain-capture-parallel
npm run drain-audio-parallel
npm run enrich-notes-parallel
npm run write-notes
```
