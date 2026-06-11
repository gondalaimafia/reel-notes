# Hermes Community Post

Title:

```text
Reel Notes: a Hermes-ready workflow for turning saved reels into notes
```

Body:

```text
I published Reel Notes, an open-source tool that turns saved Instagram reels into Markdown notes.

It includes a Hermes runbook:
https://github.com/gondalaimafia/reel-notes/blob/main/examples/agents/hermes-runbook.md

The workflow is designed to be safe for agent execution:
- verify the repo
- check dependencies
- configure .env
- open the manual login browser
- run auth-status
- start with RUN_LIMIT=3
- stop before any backlog import unless approved

It writes Obsidian-style Markdown by default, but can also write plain Markdown to any folder.

Article:
https://gondalaimafia.github.io/reel-notes/

Repo:
https://github.com/gondalaimafia/reel-notes
```
