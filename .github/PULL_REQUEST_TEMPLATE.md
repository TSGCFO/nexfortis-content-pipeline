<!--
PR template for nexfortis-content-pipeline.
All sections are required unless explicitly marked optional.
-->

## Prompt reference

**Prompt:** Prompt N — `<exact prompt title from cursor-claude-prompt-library.md>`
**Spec reference:** `<path to the Feature PRD section this prompt implements>`

## Summary

<!-- One paragraph: what this PR does, in plain language. -->

## Definition of Done

<!-- Copy the prompt's Definition of Done checklist here, with each item ticked. -->

- [ ] All tests pass (`pnpm test`)
- [ ] No new `any` types
- [ ] Lint passes (`pnpm lint`)
- [ ] Typecheck passes (`pnpm typecheck`)
- [ ] Build passes (`pnpm build`)
- [ ] No changes to files outside the prompt's allowed-file list
- [ ] No new top-level dependencies installed outside the prompt's allowlist
- [ ] No dependency version bumps outside the prompt's allowlist
- [ ] No changes to `lib/db` schemas outside the prompt's allowlist
- [ ] No edits to context files (`AGENTS.md`, `CLAUDE.md`, `.cursor/`, `.github/PULL_REQUEST_TEMPLATE.md`, `.editorconfig`, `.gitignore`, `.env.example`)
- [ ] No use of the words "scrape" / "crawl" in code, comments, or PR text
- [ ] Tests added for happy path + ≥2 edge cases per requirement
- [ ] All async operations wrapped in try/catch with `lib/logger`
- [ ] Idempotency keys on every external write (if applicable)
- [ ] PII / family-law redaction respected if touching capture/ingestion code

## Files changed

<!-- List the files this PR creates or modifies. Confirm each is in the prompt's allowlist. -->

| File | Created / Modified | In prompt allowlist? |
|---|---|---|
|   |   |   |

## Edge cases handled

<!-- For each "Edge cases" item in the prompt, describe how it's handled and where in the code. -->

## Open questions / TODOs

<!-- Any `// TODO(hassan):` notes added, with the reason. -->
<!-- Anything in the spec or prompt that was ambiguous. -->

## Out of scope (confirmed not implemented)

<!-- Copy the prompt's "Out of scope" list here to confirm none of it was implemented. -->

## Verification

<!-- Paste the output of `pnpm typecheck && pnpm test && pnpm lint && pnpm build`. -->

```
<paste here>
```

## Reviewer notes

<!-- Anything Hassan or Computer should look at carefully. -->
