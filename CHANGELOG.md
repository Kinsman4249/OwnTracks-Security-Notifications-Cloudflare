# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-05-03

### Added

- Initial release
- Cloudflare Worker monitors all `GET /owntracks/*` requests for HTTP Basic Auth attempts
- IP geolocation using Cloudflare's built-in `request.cf` object — country, region, city, lat/lon, timezone, ASN, and organization
- Three independent alert scenarios tracked per IP in Cloudflare KV:
  - Successful login from outside home region (1-day cooldown, high priority)
  - Successful login from home region (30-day cooldown, normal priority)
  - Failed login (30-day cooldown, normal priority)
- Per-scenario KV keys so cooldown timers are fully independent for the same IP across scenarios
- Email alerting via SMTP2GO API with `text_body`, scenario-specific subjects, and `custom_headers` for high priority (`X-Priority`, `X-MSMail-Priority`, `Importance`)
- Six distinct email subject line variants covering new/re-alert × success-outside/success-local/failed
- Pass-through architecture — worker never blocks or modifies origin requests
- `event.waitUntil()` used for background alert processing to avoid adding latency to the response
- KV writes only occur on successful email send to prevent false suppression on API failures
- Structured `console.log` output at every decision point for real-time log stream debugging:
  - Request method, path, status, and auth header presence
  - IP, region code, scenario, and priority classification
  - `isNew`, `isDue`, and last alerted timestamp
  - Email subject before send and success/failure result after
  - KV write confirmation
  - Explicit log when IP is within cooldown and no email is sent
- Inline code comments covering service worker API, `request.cf` fields, KV read/write patterns, secrets access, and SMTP2GO response handling

### Technical Notes

- Written in service worker format (`addEventListener("fetch", ...)`) for compatibility with the Cloudflare dashboard editor — does not require Wrangler CLI to deploy
- Secrets (`SMTP2GO_API_KEY`, `ALERT_TO_EMAIL`, `ALERT_FROM_EMAIL`) and KV binding (`IP_STORE`) accessed as globals per service worker convention
- Home region check defaults to Alberta (`AB`) — configurable via `regionCode` comparison in `handleLoginAttempt`
