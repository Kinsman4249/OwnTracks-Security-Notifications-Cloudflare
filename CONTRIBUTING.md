# Contributing to OwnTracks-Security-Notifications-Cloudflare

Thanks for considering a contribution! This is a small project and the process is intentionally lightweight.

## How to report a bug

Open an issue using the **Bug report** template. Please include:

- The version of this project you're running (commit SHA or release tag)
- The exact behavior that triggered the issue (request URL, login result, etc.)
- The full error or unexpected output (redact `SMTP2GO_API_KEY`, recipient addresses, and IPs if you'd rather)
- Relevant excerpts from the Cloudflare Worker log stream
- Your runtime context: Cloudflare zone region, whether the route is correctly proxied (orange cloud), and the home-region code you've configured

## How to propose a feature

Open an issue using the **Feature request** template. Describe the use case before the implementation — knowing *why* is more useful than *what* in early discussion.

## How to submit a change

1. **Fork** the repo and create a feature branch (`git checkout -b feat/short-description`).
2. **Make your change.** Keep changes focused — one logical change per PR.
3. **Test it.**
   - Deploy the Worker to a staging route and trigger login attempts from at least three IPs: one inside your home region (success), one outside (success), and one with bad credentials (failure). Confirm the appropriate email is sent for each scenario, and that re-running the same scenario within the cooldown window does NOT send a duplicate email.
   - Inspect the KV namespace to confirm records are written with the expected key shape and JSON structure.
   - Watch the Cloudflare real-time log stream during the test and confirm no unhandled exceptions.
4. **Update documentation.** If your change alters user-visible behavior, update `README.md` (especially the Alert Scenarios table or Configuration section) and add a note in the PR describing what changed.
5. **Open a PR** against `main`. Fill in the PR template.

## Coding conventions

- **JavaScript / Workers runtime:** target the Cloudflare Workers runtime (modern V8 + Web APIs). Avoid Node-only APIs (`fs`, `process`, etc.).
- **Async/await everywhere.** No raw `.then()` chains except where genuinely clearer.
- **Comments explain *why*, not *what*.** The diff already shows what.
- **No new dependencies** without strong justification — the appeal of this project is that it's a single-file Worker with no build step.
- **No telemetry, ever.** This is a security tool. It must not phone home.
- **Secrets stay in Worker secrets**, never hardcoded, never committed. The `.gitignore` excludes `.dev.vars`; double-check before pushing.

## Commit messages

Conventional Commits style is preferred but not required:

```
feat: add support for multiple home regions
fix: handle missing CF-Connecting-IP header gracefully
docs: clarify SMTP2GO sender verification step
```

Keep the subject under 72 characters. Add a body if the change isn't obvious from the diff.

## Releases

Maintainers cut releases by tagging `vX.Y.Z` on `main`. Pre-1.0 versioning rules:

- `0.X.0` for any user-visible change
- `0.X.Y` for bug-fix-only patch releases

After 1.0, standard SemVer applies.
