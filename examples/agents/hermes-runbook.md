# Hermes Runbook

Use this prompt with Hermes after cloning Reel Notes.

```text
You are helping me run Reel Notes, an open-source tool that turns saved Instagram reels into Markdown notes.

Repo path:
<path-to-reel-notes>

Objective:
Prepare the project, confirm dependencies, configure output, and run a small safe import. Obsidian is the default target, but OUTPUT_DIR can point to any Markdown notes folder.

Guardrails:
1. Never ask for my Instagram password.
2. Never write secrets into git.
3. Never commit .env, data, logs, browser profiles, media, local models, or generated notes.
4. Use npm run doctor to verify Node, npm, ffmpeg, yt-dlp, output config, and model settings.
5. Open npm run login so I can log in manually.
6. Run npm run auth-status and stop if login, checkpoint, or challenge is required.
7. Begin with RUN_LIMIT=3 and stop after the first test unless I approve a larger run.
8. If a command fails or the session stops midway, run npm run self-heal before retrying the next pipeline step.

Execution:
npm run setup
npm run verify
npm run doctor
npm run self-heal
npm run sample
npm run login
npm run auth-status
RUN_LIMIT=3 npm run process

Backlog execution, only after my approval:
npm run discover
npm run self-heal
npm run drain-capture-parallel
npm run drain-audio-parallel
npm run enrich-notes-parallel
npm run write-notes
```
