const ALLOWED_ORIGIN = "https://manmicheal214-maker.github.io";
const LOCAL_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:4173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4173"
]);

const COUNTRIES = {
  "United States": { code: "us", tld: "com" },
  "United Kingdom": { code: "gb", tld: "co.uk" },
  Canada: { code: "ca", tld: "ca" },
  Australia: { code: "au", tld: "com.au" },
  India: { code: "in", tld: "co.in" },
  "United Arab Emirates": { code: "ae", tld: "ae" }
};

const DEVICES = new Set(["desktop", "mobile"]);
const MAX_KEYWORD_LENGTH = 200;
const MAX_REQUEST_BODY_BYTES = 20_000;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const requestBuckets = new Map();

export default async function handler(req, res) {
  const origin = getAllowedOrigin(req.headers?.origin);
  setCorsHeaders(res, origin);

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return jsonError(res, 405, "Method not allowed.");
  }

  if (!origin) return jsonError(res, 403, "Origin not allowed.");

  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    res.setHeader("Retry-After", "60");
    return jsonError(res, 429, "Too many requests. Please try again shortly.");
  }

  if (getContentLength(req) > MAX_REQUEST_BODY_BYTES) {
    return jsonError(res, 413, "Request is too large.");
  }

  try {
    const body = req.body || {};
    const keyword = normalizeKeyword(body.keyword);
    const domain = normalizeDomain(body.domain);
    const country = String(body.country || "United States").trim();
    const device = String(body.device || "desktop").toLowerCase().trim();

    if (!keyword) return jsonError(res, 400, "Keyword is required.");
    if (keyword.length > MAX_KEYWORD_LENGTH) {
      return jsonError(res, 400, "Keyword must be 200 characters or fewer.");
    }
    if (!domain) return jsonError(res, 400, "Enter a valid domain.");
    if (!COUNTRIES[country]) return jsonError(res, 400, "Unsupported country.");
    if (!DEVICES.has(device)) return jsonError(res, 400, "Unsupported device.");

    const apiKey = process.env.ZENROWS_API_KEY;
    if (!apiKey) return jsonError(res, 500, "Ranking service is not configured.");

    const checkedAt = new Date().toISOString();
    const geo = COUNTRIES[country];
    const googleUrl = new URL(`https://www.google.${geo.tld}/search`);
    googleUrl.searchParams.set("q", keyword);
    googleUrl.searchParams.set("num", "100");
    googleUrl.searchParams.set("hl", "en");
    googleUrl.searchParams.set("gl", geo.code);

    // Keep the Universal Scraper endpoint requested by the project spec. Autoparse
    // is preferred; HTML parsing is only a defensive fallback if Google/ZenRows
    // returns an unstructured response.
    const zenRowsUrl = new URL("https://api.zenrows.com/v1/");
    zenRowsUrl.searchParams.set("url", googleUrl.toString());
    zenRowsUrl.searchParams.set("apikey", apiKey);
    zenRowsUrl.searchParams.set("js_render", "true");
    zenRowsUrl.searchParams.set("premium_proxy", "true");
    zenRowsUrl.searchParams.set("proxy_country", geo.code);
    zenRowsUrl.searchParams.set("autoparse", "true");
    zenRowsUrl.searchParams.set("device", device);

    const response = await fetchWithTimeout(zenRowsUrl, 25_000);
    const responseText = await response.text();

    if (!response.ok) {
      console.error("ZenRows HTTP error", { status: response.status });
      if (response.status === 401 || response.status === 403) {
        return jsonError(res, 502, "The ranking service rejected the request.");
      }
      if (response.status === 429) {
        return jsonError(res, 503, "The ranking service is rate-limited. Please try again shortly.");
      }
      return jsonError(res, 502, "The ranking service returned an error.");
    }

    let data = null;
    try {
      data = JSON.parse(responseText);
    } catch {
      // Autoparse may return a non-JSON response for an unsupported target.
      // In that case, use the narrowly scoped Google result fallback parser.
    }

    const results = data
      ? extractOrganicResults(data).slice(0, 100)
      : extractGoogleHtmlResults(responseText).slice(0, 100);

    if (!results.length) {
      return jsonError(res, 502, "The ranking service returned no usable Google results.");
    }

    const match = results.find((item) => domainsMatch(item.url, domain));

    return res.status(200).json({
      success: true,
      keyword,
      domain,
      position: match ? match.position : null,
      url: match ? match.url : null,
      title: match ? match.title : null,
      checkedAt
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      return jsonError(res, 504, "The ranking service timed out. Please try again.");
    }

    console.error("Rank API error", { name: error?.name });
    return jsonError(res, 500, "Unable to check the ranking right now.");
  }
}

function getAllowedOrigin(origin) {
  if (!origin) return null;
  if (origin === ALLOWED_ORIGIN || LOCAL_ORIGINS.has(origin)) return origin;
  return null;
}

function setCorsHeaders(res, origin) {
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
  res.setHeader("Cache-Control", "no-store");
}

function jsonError(res, status, error) {
  return res.status(status).json({ success: false, error });
}

function getClientIp(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

function checkRateLimit(ip) {
  const now = Date.now();
  const bucket = requestBuckets.get(ip);

  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    requestBuckets.set(ip, { startedAt: now, count: 1 });
    if (requestBuckets.size > 1000) pruneRateLimits(now);
    return true;
  }

  bucket.count += 1;
  return bucket.count <= RATE_LIMIT;
}

function pruneRateLimits(now) {
  for (const [key, bucket] of requestBuckets) {
    if (now - bucket.startedAt >= RATE_WINDOW_MS) requestBuckets.delete(key);
  }
}

function getContentLength(req) {
  const value = Number(req.headers?.["content-length"] || 0);
  return Number.isFinite(value) ? value : 0;
}

function normalizeKeyword(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function normalizeDomain(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 253) return null;

  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (parsed.username || parsed.password) return null;

    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    if (!hostname || hostname.includes("..") || !hostname.includes(".")) return null;
    if (!/^[a-z0-9.-]+$/.test(hostname)) return null;

    const labels = hostname.split(".");
    if (labels.some((label) => !label || label.length > 63 || label.startsWith("-") || label.endsWith("-"))) {
      return null;
    }

    return hostname;
  } catch {
    return null;
  }
}

export function domainsMatch(resultUrl, targetDomain) {
  try {
    const hostname = new URL(resultUrl).hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    return hostname === targetDomain || hostname.endsWith(`.${targetDomain}`);
  } catch {
    return false;
  }
}

function extractOrganicResults(data) {
  const candidates = Array.isArray(data?.organic_results)
    ? data.organic_results
    : Array.isArray(data?.organicResults)
      ? data.organicResults
      : Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data?.data?.organic_results)
          ? data.data.organic_results
          : [];

  const results = [];
  const seen = new Set();

  for (const item of candidates) {
    const url = item?.link || item?.url;
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) continue;

    try {
      const parsed = new URL(url);
      if (parsed.hostname === "google.com" || parsed.hostname.endsWith(".google.com")) continue;
    } catch {
      continue;
    }

    if (seen.has(url)) continue;
    seen.add(url);

    results.push({
      position: results.length + 1,
      url,
      title: String(item?.title || "").trim()
    });
  }

  return results;
}

function extractGoogleHtmlResults(html) {
  const results = [];
  const seen = new Set();
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = regex.exec(html)) !== null && results.length < 100) {
    let href = match[1];
    if (href.startsWith("/url?q=")) href = href.slice(7);

    try {
      href = decodeURIComponent(href);
    } catch {
      continue;
    }

    if (!/^https?:\/\//i.test(href)) continue;

    const url = href.split("&")[0];
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      if (hostname.includes("google.") || hostname === "youtube.com" || hostname.endsWith(".youtube.com")) continue;
    } catch {
      continue;
    }

    if (seen.has(url)) continue;
    seen.add(url);

    const title = match[2]
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    if (!title) continue;
    results.push({ position: results.length + 1, url, title });
  }

  return results;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json,text/html;q=0.9,*/*;q=0.8" },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}
