const SESSION_KEY = "mind_mirror_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createSessionToken() {
  return globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`;
}

function upsertSessionRecord() {
  const now = Date.now();
  const existing = readJson(SESSION_KEY);

  if (existing && now - new Date(existing.lastSeenAt).getTime() <= SESSION_TTL_MS) {
    const updated = {
      ...existing,
      lastSeenAt: new Date(now).toISOString(),
    };
    writeJson(SESSION_KEY, updated);
    return updated;
  }

  const created = {
    token: createSessionToken(),
    firstSeenAt: new Date(now).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
  };
  writeJson(SESSION_KEY, created);
  return created;
}

function collectUtmParams() {
  const params = new URLSearchParams(window.location.search);
  const fields = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  return fields.reduce((accumulator, key) => {
    const value = params.get(key);
    if (value) {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});
}

function inferDeviceType() {
  const width = window.innerWidth;
  if (width <= 720) {
    return "mobile";
  }
  if (width <= 1024) {
    return "tablet";
  }
  return "desktop";
}

export function getClientContext() {
  const session = upsertSessionRecord();

  return {
    sessionToken: session.token,
    firstSeenAt: session.firstSeenAt,
    lastSeenAt: session.lastSeenAt,
    referrer: document.referrer || "",
    utm: collectUtmParams(),
    deviceMeta: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
      },
      deviceType: inferDeviceType(),
      platform: navigator.platform,
    },
  };
}
