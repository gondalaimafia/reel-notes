# Current Task

## Add Self Healing Features

- [x] Map the current pipeline, index state, and command structure.
- [x] Define the self healing scope.
- [x] Add shared retry/backoff helpers for fragile external work.
- [x] Add a `self-heal` command that audits and repairs safe local issues.
- [x] Add stuck-state recovery for indexed reels.
- [x] Document self healing usage in README and agent runbooks.
- [x] Verify with typecheck, build, docs check, site build, sanitize, and command smoke tests.
- [x] Commit and push the fix.

## Scope

Self healing should fix safe local problems automatically: missing workspace folders, missing output folder, stale index state, duplicate index records, records stuck in `failed` after local files now exist, missing notes for reels with transcripts, and missing setup hints for models or API keys.

Self healing should not bypass Instagram challenges, fabricate credentials, delete user media by surprise, or hide permanent failures. It should explain what it fixed, what it could not fix, and what command to run next.

## Review

Verification passed with `npm run verify`. Command smoke tests passed for `self-heal` in a temporary workspace and for corrupted index recovery. The feature adds a safe repair command, shared retry/backoff, index dedupe and status repair, missing note regeneration, setup warnings, and next-step guidance.
