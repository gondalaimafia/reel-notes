# Lessons

### 2026-06-11 - Keep tool output bounded
**Mistake:** A broad recursive file scan in a live workspace walked into runtime folders and produced oversized tool output, which destabilized the Codex Desktop session.
**Correction:** Talal told me to identify the crash cause, report it, fix it, and only then continue.
**Rule:** Use allowlisted paths and bounded commands only. Never recursively enumerate `data`, browser profiles, logs, media, local models, generated notes, `node_modules`, or `dist`.

### 2026-06-12 - Verify published links for safety
**Mistake:** I called the article published after a basic status check, but Talal opened it and saw an unsafe-site warning.
**Correction:** Talal told me to make the link safe to open and optimize it for SEO and AEO.
**Rule:** Before calling a public page ready, verify HTTPS enforcement, browser access, mixed-content risks, canonical metadata, and crawl metadata.

