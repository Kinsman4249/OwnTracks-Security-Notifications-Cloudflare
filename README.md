# OwnTracks-Security-Notifications-Cloudflare

A Cloudflare Worker that monitors HTTP Basic Auth login attempts to an [OwnTracks Frontend](https://github.com/owntracks/frontend) instance and sends email alerts via [SMTP2GO](https://www.smtp2go.com/) when new or notable IPs are seen.

## Features

- Detects login attempts (both successful and failed) using the `Authorization` header on `GET /owntracks/*`
- Geolocates connecting IPs using Cloudflare's built-in `request.cf` data - no external geo API required
- Tracks seen IPs in Cloudflare KV with per-scenario cooldowns
- Sends email alerts via the SMTP2GO API with scenario-specific subjects and priority headers
- Fully pass-through - never blocks or modifies requests to your origin
- Structured `console.log` output throughout for easy debugging via Cloudflare's real-time log stream

## Alert Scenarios

| Scenario | Cooldown | Priority |
|---|---|---|
| Successful login from outside your home region | 1 day | High |
| Successful login from your home region | 30 days | Normal |
| Failed login (any location) | 30 days | Normal |

> The region check is currently hardcoded to Alberta (`AB`). See [Configuration](#configuration) to change it.

Each scenario is tracked independently in KV - a failed login and a successful login from the same IP do not share a cooldown.

## Requirements

- A Cloudflare account with your OwnTracks domain proxied (orange cloud DNS)
- Cloudflare Workers free tier (100k requests/day)
- Cloudflare KV free tier (1GB storage, 100k reads/day)
- An SMTP2GO account (free tier: 1,000 emails/month) with a verified sender address

## Setup

### 1. Create the KV Namespace

In the Cloudflare dashboard: **Workers & Pages -> KV -> Create namespace**

Name it `IP_STORE`.

### 2. Create the Worker

**Workers & Pages -> Create -> Create Worker**

Paste the contents of `owntracks-login-alert-worker.js` into the editor and deploy.

### 3. Bind the KV Namespace

**Worker -> Settings -> Bindings -> Add binding**

- Type: KV Namespace
- Variable name: `IP_STORE`
- Namespace: select the one you created in step 1

### 4. Set Secrets

**Worker -> Settings -> Variables and Secrets**

Add the following as type **Secret** (not plain text variable):

| Secret name | Value |
|---|---|
| `SMTP2GO_API_KEY` | Your SMTP2GO API key |
| `ALERT_TO_EMAIL` | Address to send alerts to |
| `ALERT_FROM_EMAIL` | Verified sender address in SMTP2GO |

### 5. Add the Worker Route

**Your domain -> Workers Routes -> Add route**

- Pattern: `your-hostname.example.com/owntracks/*`
- Worker: select your worker

> Make sure the DNS record for your domain has the orange cloud (proxied) enabled, otherwise `CF-Connecting-IP` and `request.cf` will not be populated.

## Configuration

The following constants at the top of `owntracks-login-alert-worker.js` can be adjusted to suit your setup:

```js
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // Re-alert cooldown for normal scenarios
const ONE_DAY_MS     = 24 * 60 * 60 * 1000;       // Re-alert cooldown for high priority
```

To change the home region check, find this line in `handleLoginAttempt`:

```js
const outsideAlberta = geo.regionCode !== "AB";
```

Replace `"AB"` with the ISO 3166-2 region code for your area. For example:
- Ontario: `"ON"`
- British Columbia: `"BC"`
- California: `"CA"`
- Texas: `"TX"`

You may also want to rename the variable and update the related email subjects and comments to match.

## Email Examples

**New failed login attempt:**
```
Subject: [OwnTracks] New failed login attempt: 2001:db8::1

OwnTracks Login Alert
=====================

A NEW IP address has been seen logging in to your OwnTracks frontend.

Timestamp     : Sun, 03 May 2026 12:00:00 GMT
Login Result  : FAILED (401)
IP Address    : 2001:db8::1
First Seen    : Sun, 03 May 2026 12:00:00 GMT
Last Alerted  : N/A
Times Alerted : 1
...
```

**Successful login from outside home region:**
```
Subject: ⚠️ [OwnTracks] URGENT - Successful login from outside Alberta: 2001:db8::2
```

## Debugging

Enable real-time logs in the Cloudflare dashboard under **Workers & Pages -> your worker -> Logs -> Start Log Stream**, then trigger a login. Every request logs:

- Method, path, response status, and whether an `Authorization` header was present
- IP, region, scenario, and priority classification
- Whether an email was attempted and whether it succeeded
- KV read/write outcomes
- Explicit log when an IP is within its cooldown window and no email is sent

## KV Record Structure

Each IP+scenario combination is stored as a JSON object:

```json
{
  "ip": "2001:db8::1",
  "scenario": "failed",
  "geo": { "country": "CA", "region": "Alberta", "regionCode": "AB", ... },
  "firstSeen": 1746273600000,
  "lastAlerted": 1746273600000,
  "lastSeen": 1746273600000,
  "timesAlerted": 1
}
```

Keys follow the format `ip:<address>:<scenario>` where scenario is one of `outside`, `alberta`, or `failed`.

## Releases

See [CHANGELOG.md](CHANGELOG.md) for the full version history. Releases are tagged `vX.Y.Z` on `main` and the [release workflow](.github/workflows/release.yml) creates a GitHub Release with a zipped bundle of the worker, README, CHANGELOG, and LICENSE attached.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to report bugs, propose features, and submit pull requests. By participating, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

To report a security vulnerability, see [SECURITY.md](SECURITY.md). Please do not file public issues for security problems.

## License

Apache 2.0 - see [LICENSE](LICENSE).
