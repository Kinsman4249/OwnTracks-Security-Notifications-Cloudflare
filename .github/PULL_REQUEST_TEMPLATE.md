## Summary

<!-- 1-3 bullets describing what this PR changes and why. -->

-
-

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would change existing behavior)
- [ ] Documentation only

## Testing

How did you verify this works?

- [ ] Deployed the modified Worker to a staging route
- [ ] Triggered a successful login from inside the home region — confirmed normal-priority email
- [ ] Triggered a successful login from outside the home region — confirmed high-priority email
- [ ] Triggered a failed login (401) — confirmed normal-priority email
- [ ] Re-triggered each scenario within the cooldown window — confirmed NO duplicate email
- [ ] Inspected KV records: keys follow `ip:<address>:<scenario>` and values match expected JSON shape
- [ ] Reviewed Cloudflare real-time logs during testing — no unhandled exceptions

<!-- If any of the boxes above don't apply, explain why. -->

## Documentation

- [ ] Updated `README.md` if user-visible behavior changed (Alert Scenarios table, Configuration, etc.)
- [ ] Updated email-example output in `README.md` if subject lines or body format changed
- [ ] No new secrets / env vars introduced — OR — added them to the Setup → Set Secrets section

## Related issues

<!-- Closes #123, refs #456 -->

## Anything else?

<!-- Reviewer notes, follow-up work, screenshots of test emails, etc. -->
