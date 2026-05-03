/**
 * OwnTracks Frontend - Login IP Alert Worker
 *
 * Monitors all GET requests under /owntracks/* for HTTP Basic Auth attempts.
 * When a request is seen with an Authorization header (i.e. credentials are
 * being presented), the connecting IP is geolocated using Cloudflare's
 * built-in request.cf data.
 *
 * Seen IPs are tracked in KV per scenario. An email alert is sent via SMTP2GO
 * based on the following cooldown rules:
 *   - Successful login from outside Alberta: alert every 1 day
 *   - Successful login from Alberta:         alert every 30 days
 *   - Failed login:                          alert every 30 days
 *
 * KV keys are scenario-specific so cooldowns don't interfere with each other
 * for the same IP across different scenarios.
 *
 * The worker is observe-only and never blocks requests — it passes all
 * traffic through to origin unmodified.
 *
 * Worker route should be set to:
 *   your-hostname.example.com/owntracks/*
 *
 * Required KV namespace binding (set in Worker Settings → Bindings):
 *   IP_STORE
 *
 * Required secrets (set in Worker Settings → Variables and Secrets):
 *   SMTP2GO_API_KEY
 *   ALERT_TO_EMAIL
 *   ALERT_FROM_EMAIL
 */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SMTP2GO_API_URL = "https://api.smtp2go.com/v3/email/send";

// -----------------------------------------------------------------------------
// ENTRY POINT
// -----------------------------------------------------------------------------
// addEventListener is the service worker API for registering a fetch handler.
// Every HTTP request that matches the worker's route triggers this callback.
// event.respondWith() tells the runtime what response to send back to the
// client — we hand it a Promise that resolves to our response.
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const request = event.request;

  // -------------------------------------------------------------------------
  // PASS-THROUGH TO ORIGIN
  // -------------------------------------------------------------------------
  // We clone the request before forwarding it because a Request body can only
  // be read once. Cloning ensures the original is still intact for any further
  // inspection we need to do (headers, etc.) after the fetch completes.
  const response = await fetch(request.clone());

  // -------------------------------------------------------------------------
  // READING REQUEST DATA
  // -------------------------------------------------------------------------
  // request.url is the full URL string. We wrap it in URL() to get easy access
  // to individual parts like pathname, search params, etc.
  const url = new URL(request.url);

  // request.headers is a Headers object. get() returns the value of a named
  // header, or null if it isn't present. We double-bang (!!) to coerce null
  // into false and a string value into true — giving us a clean boolean.
  const hasAuth = !!request.headers.get("Authorization");

  console.log(`[worker] ${request.method} ${url.pathname} | status=${response.status} | auth=${hasAuth}`);

  // startsWith() lets us match all paths under /owntracks/ rather than only
  // the exact root path — this is why the route uses a wildcard (/owntracks/*).
  if (request.method === "GET" && url.pathname.startsWith("/owntracks/")) {
    if (hasAuth) {
      console.log(`[worker] Auth header present — proceeding to alert logic`);

      // event.waitUntil() tells the Workers runtime to keep the worker alive
      // until the given Promise resolves, even after the response has been
      // sent. Without this, background async work (KV writes, API calls) could
      // be killed mid-execution as soon as the response is returned.
      event.waitUntil(handleLoginAttempt(request, response.status));
    } else {
      console.log(`[worker] No auth header — skipping (unauthenticated probe)`);
    }
  }

  return response;
}

async function handleLoginAttempt(request, status) {
  // -------------------------------------------------------------------------
  // READING CLOUDFLARE REQUEST METADATA
  // -------------------------------------------------------------------------
  // CF-Connecting-IP is a header Cloudflare adds to every proxied request. It
  // contains the true client IP — not the Cloudflare edge IP. This is safe to
  // trust as long as your origin is only reachable via Cloudflare (orange cloud
  // DNS). If someone bypassed Cloudflare and hit your origin directly, this
  // header could be spoofed.
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) {
    console.log(`[worker] No CF-Connecting-IP header found — aborting`);
    return;
  }

  // request.cf is a Cloudflare-specific object attached to every request. It
  // contains geo and network data that Cloudflare resolves at the edge — no
  // external API calls needed. It's not part of the standard fetch() API, it's
  // a Cloudflare Workers extension. Falls back to an empty object if somehow
  // not present (e.g. during local testing with wrangler).
  const cf = request.cf || {};

  // Pull the fields we care about out of request.cf. Each field falls back to
  // a sensible default if Cloudflare couldn't determine it.
  //
  // Notable fields:
  //   country       — ISO 3166-1 alpha-2 country code (e.g. "CA", "US", "CH")
  //   region        — Full region/state name (e.g. "Alberta")
  //   regionCode    — ISO region code (e.g. "AB", "ON") — used for comparisons
  //   city          — City name
  //   latitude      — Approximate latitude
  //   longitude     — Approximate longitude
  //   timezone      — IANA timezone string (e.g. "America/Edmonton")
  //   asn           — Autonomous System Number of the connecting network
  //   asOrganization — Human-readable name of the ASN owner (e.g. "TELUS-FIBRE")
  const geo = {
    country: cf.country || "Unknown",
    region: cf.region || "Unknown",
    regionCode: cf.regionCode || "",
    city: cf.city || "Unknown",
    latitude: cf.latitude || "Unknown",
    longitude: cf.longitude || "Unknown",
    timezone: cf.timezone || "Unknown",
    asn: cf.asn ? `AS${cf.asn}` : "Unknown",
    asOrganization: cf.asOrganization || "Unknown",
  };

  // -------------------------------------------------------------------------
  // DETERMINE SCENARIO
  // -------------------------------------------------------------------------
  // This drives which KV key we use, what cooldown applies, and whether the
  // email gets flagged as high priority.
  const loginSucceeded = status === 200;
  const outsideAlberta = geo.regionCode !== "AB";
  const highPriority = loginSucceeded && outsideAlberta;

  // Three possible scenarios — each gets its own KV key so their cooldowns
  // are completely independent even for the same IP address.
  const scenario = highPriority ? "outside" : loginSucceeded ? "alberta" : "failed";

  // Cooldown period varies by scenario:
  //   - Successful login from outside Alberta: 1 day
  //   - Successful login from Alberta:         30 days
  //   - Failed login:                          30 days
  const cooldown = highPriority ? ONE_DAY_MS : THIRTY_DAYS_MS;

  console.log(`[worker] IP=${ip} | status=${status} | region=${geo.regionCode} | scenario=${scenario} | highPriority=${highPriority}`);

  // -------------------------------------------------------------------------
  // KV STORAGE — READ
  // -------------------------------------------------------------------------
  // IP_STORE is the KV namespace binding declared in Worker Settings → Bindings.
  // In service worker format it's available as a global variable matching the
  // binding name exactly. KV is a simple key-value store — keys are strings,
  // values are strings. We store JSON and parse it ourselves.
  //
  // Key format: ip:<address>:<scenario>
  // Example:    ip:2001:56a:e992::1:alberta
  //
  // IP_STORE.get(key) returns the stored string value, or null if the key
  // doesn't exist yet. It's async so we await it.
  const kvKey = `ip:${ip}:${scenario}`;
  const now = Date.now();

  let record = null;
  try {
    const stored = await IP_STORE.get(kvKey);
    if (stored) {
      // KV values are always strings — we JSON.parse() to get our object back.
      record = JSON.parse(stored);
    }
  } catch (e) {
    // If KV read fails for any reason, we treat the IP as new. Better to send
    // a duplicate alert than to silently miss one.
    console.error("[worker] KV read error:", e);
  }

  const isNew = record === null;
  const lastAlerted = record?.lastAlerted || 0;
  const isDue = now - lastAlerted >= cooldown;

  console.log(`[worker] isNew=${isNew} | isDue=${isDue} | lastAlerted=${lastAlerted ? new Date(lastAlerted).toUTCString() : "never"}`);

  if (isNew || isDue) {
    const subject = isNew
      ? highPriority
        ? `⚠️ [OwnTracks] URGENT - Successful login from outside Alberta: ${ip}`
        : loginSucceeded
          ? `[OwnTracks] New successful login from Alberta: ${ip}`
          : `[OwnTracks] New failed login attempt: ${ip}`
      : highPriority
        ? `⚠️ [OwnTracks] URGENT - Successful login from outside Alberta (re-alert): ${ip}`
        : loginSucceeded
          ? `[OwnTracks] Monthly re-alert - Successful login from Alberta: ${ip}`
          : `[OwnTracks] Monthly re-alert - Failed login attempt: ${ip}`;

    const firstSeen = isNew
      ? new Date(now).toUTCString()
      : new Date(record.firstSeen).toUTCString();

    const timesAlerted = isNew ? 1 : (record.timesAlerted || 0) + 1;

    const emailBody = buildEmailBody({
      ip,
      geo,
      isNew,
      firstSeen,
      lastAlerted: isNew ? "N/A" : new Date(lastAlerted).toUTCString(),
      timesAlerted,
      timestamp: new Date(now).toUTCString(),
      status,
      highPriority,
    });

    console.log(`[worker] Attempting to send email | subject="${subject}"`);
    const sent = await sendEmail(subject, emailBody, highPriority);
    console.log(`[worker] Email send result: ${sent ? "SUCCESS" : "FAILED"}`);

    // -------------------------------------------------------------------------
    // KV STORAGE — WRITE
    // -------------------------------------------------------------------------
    // Only update KV if the email sent successfully. If the email failed we
    // leave the record as-is so the next request will retry rather than
    // silently marking the IP as alerted when no alert was actually sent.
    //
    // IP_STORE.put(key, value) stores a string. We JSON.stringify() our object
    // since KV only accepts strings as values. Also async, so we await it.
    if (sent) {
      try {
        await IP_STORE.put(kvKey, JSON.stringify({
          ip,
          geo,
          scenario,
          firstSeen: isNew ? now : record.firstSeen,
          lastAlerted: now,
          timesAlerted,
        }));
        console.log(`[worker] KV updated for key=${kvKey}`);
      } catch (e) {
        console.error("[worker] KV write error:", e);
      }
    }
  } else {
    // Within cooldown window — update lastSeen silently without alerting.
    // This lets us track how frequently an IP hits the site even when we're
    // not sending an email about it.
    console.log(`[worker] IP within cooldown window — no email sent`);
    try {
      await IP_STORE.put(kvKey, JSON.stringify({ ...record, lastSeen: now }));
    } catch (e) {
      console.error("[worker] KV write error:", e);
    }
  }
}

function buildEmailBody({ ip, geo, isNew, firstSeen, lastAlerted, timesAlerted, timestamp, status, highPriority }) {
  const loginResult = status === 200 ? "SUCCESS (200)" : `FAILED (${status})`;
  const priorityNote = highPriority ? "\n⚠️  HIGH PRIORITY: Successful login from outside Alberta.\n" : "";

  // Template literals (backtick strings) let us embed variables directly with
  // ${} syntax and preserve newlines — convenient for building email bodies.
  return `
OwnTracks Login Alert
=====================
${priorityNote}
${isNew ? "A NEW IP address has been seen logging in to your OwnTracks frontend." : "A previously seen IP has reached its re-alert threshold."}

Timestamp     : ${timestamp}
Login Result  : ${loginResult}
IP Address    : ${ip}
First Seen    : ${firstSeen}
Last Alerted  : ${lastAlerted}
Times Alerted : ${timesAlerted}

Geolocation (Cloudflare)
------------------------
Country       : ${geo.country}
Region/State  : ${geo.region}
City          : ${geo.city}
Latitude      : ${geo.latitude}
Longitude     : ${geo.longitude}
Timezone      : ${geo.timezone}

Network
-------
ASN           : ${geo.asn}
Organization  : ${geo.asOrganization}

--
This alert was generated automatically by your Cloudflare Worker.
  `.trim();
}

async function sendEmail(subject, body, highPriority = false) {
  // -------------------------------------------------------------------------
  // SECRETS
  // -------------------------------------------------------------------------
  // SMTP2GO_API_KEY, ALERT_TO_EMAIL, and ALERT_FROM_EMAIL are secrets set in
  // Worker Settings → Variables and Secrets. Like KV bindings, they are
  // available as globals in service worker format. Secrets are encrypted at
  // rest and never visible in the dashboard after being set — unlike plain
  // text variables. Never hardcode credentials in the worker source itself.
  try {
    const payload = {
      api_key: SMTP2GO_API_KEY,
      to: [ALERT_TO_EMAIL],       // SMTP2GO expects an array of recipients
      sender: ALERT_FROM_EMAIL,
      subject,
      text_body: body,            // SMTP2GO requires text_body, html_body, or template_id
      custom_headers: highPriority
        ? [
            // These three headers together mark the email as high priority in
            // most email clients. X-Priority is the most widely supported.
            { header: "X-Priority", value: "1" },
            { header: "X-MSMail-Priority", value: "High" },
            { header: "Importance", value: "High" },
          ]
        : [],
    };

    // Standard fetch() API — same as in a browser or Node.js. Workers support
    // outbound fetch() to any external HTTPS endpoint.
    const res = await fetch(SMTP2GO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // res.json() parses the response body as JSON. Also async.
    const result = await res.json();

    // SMTP2GO returns HTTP 200 for most responses but puts the actual success
    // or error status inside the JSON body, so we check both.
    if (!res.ok || result?.data?.error) {
      console.error("[worker] SMTP2GO error:", JSON.stringify(result));
      return false;
    }

    return true;
  } catch (e) {
    console.error("[worker] Email send exception:", e);
    return false;
  }
}
