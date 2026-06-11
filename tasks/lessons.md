# Lessons

### 2026-06-11 - Keep tool output bounded
**Mistake:** A broad recursive file scan in a live workspace walked into runtime folders and produced oversized tool output, which destabilized the Codex Desktop session.
**Correction:** Talal told me to identify the crash cause, report it, fix it, and only then continue.
**Rule:** Use allowlisted paths and bounded commands only. Never recursively enumerate `data`, browser profiles, logs, media, local models, generated notes, `node_modules`, or `dist`.

