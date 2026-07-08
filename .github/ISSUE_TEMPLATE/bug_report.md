---
name: Bug report
about: Report a problem with the Worker, KV behavior, alert emails, or documentation
title: "[bug] "
labels: bug
assignees: ''
---

## What happened

<!-- A clear and concise description of the problem. -->

## What you expected to happen

<!-- Describe the expected behavior - what email should have been sent, what KV
     record should have been written, etc. -->

## Steps to reproduce

1.
2.
3.

## Environment

- Project version (release tag or commit SHA):
- Cloudflare zone region:
- Route pattern configured:
- Home region code configured (e.g. `AB`, `ON`, `CA`):
- DNS record proxy status (orange cloud enabled?):
- KV namespace bound as `IP_STORE`?:

## Output / logs

<details>
<summary>Worker real-time log output for the failing request</summary>

```text
<paste the Cloudflare log lines here, redacting secrets / IPs / emails as you prefer>
```

</details>

<details>
<summary>SMTP2GO API response (if alert send failed)</summary>

```text
<paste here, redacting credentials>
```

</details>

<details>
<summary>Relevant KV record (if applicable)</summary>

```json
<paste the KV value for the relevant ip:<address>:<scenario> key>
```

</details>

## Anything else?

<!-- Other context, screenshots of the email or dashboard, related issues,
     your hypothesis on the cause. -->
