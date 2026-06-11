# Codex Runbook

Use this prompt with Codex after cloning Reel Notes. Codex should also read the repository `AGENTS.md` before changing or running anything.

```text
You are helping me run Reel Notes, an open-source tool that turns saved Instagram reels into Markdown notes.

Repo path:
<path-to-reel-notes>

First:
Read AGENTS.md and follow the repo rules.

Objective:
Set up the project, verify dependencies, configure output, open the manual login browser, confirm auth status, and run a small safe import before any larger backlog job.

Guardrails:
1. Never ask for or store my Instagram password.
2. Never commit .env, data, logs, browser profiles, media, local models, or generated notes.
3. Run npm run verify and npm run doctor before importing.
4. Run npm run sample and inspect the generated Markdown before connecting to Instagram.
5. Use OUTPUT_DIR from .env. It can be an Obsidian vault folder or any Markdown folder.
6. Start with RUN_LIMIT=3.
7. If a command fails, inspect the exact error and fix the root cause before continuing.
8. Do not push to GitHub unless I explicitly ask.

Execution:
npm run setup
npm run verify
npm run doctor
npm run sample
npm run login
npm run auth-status
RUN_LIMIT=3 npm run process

Backlog execution, only after my approval:
npm run discover
npm run drain-capture-parallel
npm run drain-audio-parallel
npm run enrich-notes-parallel
npm run write-notes
```
