# Security Policy

## Supported Versions

This project is at version 1.0 or later. Because this is a small project, **only the newest major release line** receives security updates. Once a new major version is published, the previous major version is no longer supported - please plan to upgrade.

| Version                              | Supported          |
| ------------------------------------ | ------------------ |
| Newest major, latest patch           | :white_check_mark: |
| Older patches within the newest major | :x: (upgrade to the latest patch) |
| Any older major version              | :x:                |

I don't have the bandwidth to backport security fixes across multiple major versions, so this policy is intentionally narrow. If you need a fix, the path is to upgrade to the newest major.

## Reporting a Vulnerability

If you find a security issue in this project, **please do not file a public GitHub issue**.

Instead, open a private GitHub Security Advisory:

1. Go to the [Security tab](https://github.com/Kinsman4249/OwnTracks-Security-Notifications-Cloudflare/security) of this repository.
2. Click **"Report a vulnerability"**.
3. Provide as much detail as possible: affected version, reproduction steps, impact, and any suggested mitigation.

You should receive an acknowledgment within a few business days. If the issue is confirmed, a fix will be developed privately and released as a patch version on the newest major release line. You'll be credited in the release notes (or anonymously, if you prefer).

## Scope

In-scope:

- Vulnerabilities in `worker.js` or any other code shipped by this repo
- Insecure default configurations recommended in the README (KV bindings, secret handling, route patterns)
- Any path that could allow:
  - Disclosure of `SMTP2GO_API_KEY`, `ALERT_TO_EMAIL`, or `ALERT_FROM_EMAIL` to an unauthorized party
  - Suppression or spoofing of alert emails
  - Bypassing the cooldown logic to flood the configured recipient
  - Injection into the alert email body (e.g. via crafted IP, region, or User-Agent values)

Out of scope:

- Vulnerabilities in the OwnTracks Frontend or backend itself - please report those to the [OwnTracks project](https://github.com/owntracks)
- Vulnerabilities in Cloudflare Workers, KV, or the Cloudflare platform - report those to Cloudflare's security team
- Vulnerabilities in SMTP2GO - report those to SMTP2GO directly
- General hardening suggestions for your own OwnTracks deployment (use a feature request issue instead)

## Note on the project's purpose

This project surfaces login alerts for a privacy-sensitive service. It is itself a piece of security infrastructure, so we take vulnerability reports seriously and prioritize them above all other work.
