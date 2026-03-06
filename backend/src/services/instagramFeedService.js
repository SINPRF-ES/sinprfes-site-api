const log = require("../utils/log");

const CACHE_TIME = 15 * 60 * 1000;
const MAX_POSTS = 5;
const USERNAME = "sinprfes";
const REQUEST_TIMEOUT_MS = 8000;
const ERROR_RETRY_BACKOFF_MS = 2 * 60 * 1000;
const RATE_LIMIT_BACKOFF_MS = Number(process.env.INSTAGRAM_RATE_LIMIT_BACKOFF_MS || 15 * 60 * 1000);
const ERROR_LOG_THROTTLE_MS = 5 * 60 * 1000;

const DEFAULT_RSSHUB_BASE_URLS = [
  "https://rsshub.app",
  "https://rsshub.rssforever.com",
  "https://rsshub.feeded.xyz",
];

const RSSHUB_BASE_URLS = (
  process.env.INSTAGRAM_RSSHUB_BASE_URLS || DEFAULT_RSSHUB_BASE_URLS.join(",")
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const RSSHUB_ROUTE_TEMPLATE = process.env.INSTAGRAM_RSSHUB_ROUTE_TEMPLATE || "/instagram/user/:username";

let cache = {
  timestamp: 0,
  data: null,
};

let fetchState = {
  nextRetryAt: 0,
  lastUnavailableLogAt: 0,
};

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function readTag(xmlChunk, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xmlChunk.match(regex);
  return match ? decodeXml(match[1]) : "";
}

function readMediaUrl(xmlChunk) {
  const enclosureUrl = xmlChunk.match(/<enclosure[^>]*url="([^"]+)"/i);
  if (enclosureUrl?.[1]) return decodeXml(enclosureUrl[1]);

  const mediaContentUrl = xmlChunk.match(/<media:content[^>]*url="([^"]+)"/i);
  if (mediaContentUrl?.[1]) return decodeXml(mediaContentUrl[1]);

  const thumbnailUrl = xmlChunk.match(/<media:thumbnail[^>]*url="([^"]+)"/i);
  if (thumbnailUrl?.[1]) return decodeXml(thumbnailUrl[1]);

  return "";
}

function parseRssItems(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((entry) => entry[1]);

  return items
    .slice(0, MAX_POSTS)
    .map((item) => ({
      title: readTag(item, "title"),
      link: readTag(item, "link"),
      image: readMediaUrl(item),
      date: readTag(item, "pubDate"),
    }))
    .filter((post) => post.link);
}

function buildRssUrl(baseUrl) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const path = RSSHUB_ROUTE_TEMPLATE.replace(":username", USERNAME).replace(/^\/+/, "");
  return `${normalizedBase}/${path}`;
}

async function fetchFeedFromBase(baseUrl) {
  const rssUrl = buildRssUrl(baseUrl);
  const response = await fetch(rssUrl, {
    headers: {
      "User-Agent": "SINPRFES-InstagramFeed/1.3",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const error = new Error(`instagram_rss_http_${response.status}`);
    error.status = response.status;
    error.rssUrl = rssUrl;
    throw error;
  }

  const xml = await response.text();
  return parseRssItems(xml);
}

async function fetchFeed() {
  const failures = [];

  for (const baseUrl of RSSHUB_BASE_URLS) {
    try {
      const posts = await fetchFeedFromBase(baseUrl);

      if (failures.length > 0) {
        log.info("InstagramRssRecoveredWithFallback", {
          successBaseUrl: baseUrl,
          routeTemplate: RSSHUB_ROUTE_TEMPLATE,
          previousFailures: failures,
        });
      }

      return posts;
    } catch (err) {
      failures.push({
        baseUrl,
        rssUrl: err?.rssUrl || buildRssUrl(baseUrl),
        status: err?.status || null,
        errorMessage: err?.message || String(err),
      });
    }
  }

  const error = new Error("instagram_rss_unavailable");
  error.failures = failures;
  throw error;
}

function shouldLogUnavailable(now) {
  return now - fetchState.lastUnavailableLogAt >= ERROR_LOG_THROTTLE_MS;
}

function isLikelyBotBlocked(failures = []) {
  if (!Array.isArray(failures) || failures.length === 0) return false;
  return failures.every((failure) => [403, 429].includes(failure?.status));
}

function hasRateLimitFailure(failures = []) {
  return Array.isArray(failures) && failures.some((failure) => failure?.status === 429);
}

async function getInstagramFeed() {
  const now = Date.now();

  if (cache.data && now - cache.timestamp < CACHE_TIME) {
    return cache.data;
  }

  if (fetchState.nextRetryAt && now < fetchState.nextRetryAt) {
    return cache.data || [];
  }

  try {
    const posts = await fetchFeed();

    cache = {
      timestamp: now,
      data: posts,
    };

    fetchState = {
      nextRetryAt: 0,
      lastUnavailableLogAt: fetchState.lastUnavailableLogAt,
    };

    return posts;
  } catch (err) {
    const failures = Array.isArray(err?.failures) ? err.failures : [];
    const nextRetryInMs = hasRateLimitFailure(failures)
      ? RATE_LIMIT_BACKOFF_MS
      : ERROR_RETRY_BACKOFF_MS;

    fetchState.nextRetryAt = now + nextRetryInMs;

    if (shouldLogUnavailable(now)) {
      fetchState.lastUnavailableLogAt = now;
      const logPayload = {
        usedCachedData: Boolean(cache.data),
        routeTemplate: RSSHUB_ROUTE_TEMPLATE,
        nextRetryInMs,
        failures,
      };

      if (isLikelyBotBlocked(failures)) {
        log.info("InstagramRssLikelyBotBlocked", logPayload);
      } else {
        log.warn("InstagramRssUnavailable", logPayload);
      }
    }

    if (cache.data) {
      return cache.data;
    }

    return [];
  }
}

module.exports = { getInstagramFeed };
