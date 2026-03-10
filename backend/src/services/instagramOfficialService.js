const crypto = require("crypto");

const log = require("../utils/log");

const PROFILE_URL = "https://instagram.com/sinprfes";
const REQUEST_TIMEOUT_MS = 8000;
const FEED_CACHE_MS = 15 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;

let feedCache = {
  timestamp: 0,
  data: null,
};

let runtimeAuth = {
  accessToken: "",
  expiresAt: null,
  tokenSource: null,
  userId: process.env.INSTAGRAM_ACCOUNT_ID || "",
};

const pendingStates = new Map();

function getConfig() {
  const scopes = (process.env.INSTAGRAM_SCOPES || "user_profile,user_media")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)
    .join(",");

  return {
    appId: process.env.INSTAGRAM_APP_ID || "",
    appSecret: process.env.INSTAGRAM_APP_SECRET || "",
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI || "",
    apiBaseUrl: (process.env.INSTAGRAM_API_BASE_URL || "https://graph.instagram.com").replace(/\/+$/, ""),
    graphVersion: (process.env.INSTAGRAM_GRAPH_VERSION || "").replace(/^\/+/, ""),
    scopes,
    staticAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN || "",
    refreshEnabled: String(process.env.INSTAGRAM_REFRESH_ENABLED || "false").toLowerCase() === "true",
    accountId: process.env.INSTAGRAM_ACCOUNT_ID || "",
  };
}

function isConfigured(config = getConfig()) {
  return Boolean(config.appId && config.appSecret && config.redirectUri);
}

function getActiveAccessToken(config = getConfig()) {
  if (runtimeAuth.accessToken) return runtimeAuth.accessToken;
  return config.staticAccessToken;
}

function getApiUrl(pathname, config = getConfig()) {
  const trimmedPath = pathname.replace(/^\/+/, "");
  if (!config.graphVersion) {
    return `${config.apiBaseUrl}/${trimmedPath}`;
  }
  return `${config.apiBaseUrl}/${config.graphVersion}/${trimmedPath}`;
}

function createState() {
  const state = crypto.randomBytes(16).toString("hex");
  pendingStates.set(state, Date.now() + STATE_TTL_MS);
  return state;
}

function validateState(state) {
  const expiresAt = pendingStates.get(state);
  pendingStates.delete(state);
  return Boolean(expiresAt && expiresAt > Date.now());
}

function buildAuthorizationUrl() {
  const config = getConfig();
  if (!isConfigured(config)) {
    throw new Error("instagram_official_not_configured");
  }

  const state = createState();
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scopes,
    state,
  });

  const url = `https://www.instagram.com/oauth/authorize?${params.toString()}`;

  log.info("InstagramOfficialAuthStarted", {
    hasScopes: Boolean(config.scopes),
    redirectUriHost: new URL(config.redirectUri).host,
  });

  return { url, state };
}

async function fetchWithTimeout(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return response;
}

async function exchangeCodeForShortLivedToken(code) {
  const config = getConfig();

  const body = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
    code,
  });

  const response = await fetchWithTimeout("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = await response.json();

  if (!response.ok || !payload?.access_token) {
    log.warn("InstagramOfficialTokenExchangeFailed", {
      stage: "short_lived",
      status: response.status,
      hasPayload: Boolean(payload),
      errorType: payload?.error_type,
    });
    throw new Error("instagram_short_lived_exchange_failed");
  }

  return payload;
}

async function exchangeShortForLongLivedToken(shortLivedAccessToken) {
  const config = getConfig();

  const url = new URL(getApiUrl("access_token", config));
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("access_token", shortLivedAccessToken);

  const response = await fetchWithTimeout(url.toString(), {
    method: "GET",
  });

  const payload = await response.json();

  if (!response.ok || !payload?.access_token) {
    log.warn("InstagramOfficialTokenExchangeFailed", {
      stage: "long_lived",
      status: response.status,
      hasPayload: Boolean(payload),
      errorCode: payload?.error?.code,
    });
    throw new Error("instagram_long_lived_exchange_failed");
  }

  return payload;
}

async function getCurrentUser(accessToken = getActiveAccessToken()) {
  const url = new URL(getApiUrl("me"));
  url.searchParams.set("fields", "id,username,account_type,media_count");
  url.searchParams.set("access_token", accessToken);

  const response = await fetchWithTimeout(url.toString(), { method: "GET" });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error("instagram_current_user_fetch_failed");
  }

  return payload;
}

async function getRecentMedia(accessToken = getActiveAccessToken()) {
  const fields =
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_url,thumbnail_url,media_type}";

  const media = [];
  let nextUrl = new URL(getApiUrl("me/media"));
  nextUrl.searchParams.set("fields", fields);
  nextUrl.searchParams.set("limit", "100");
  nextUrl.searchParams.set("access_token", accessToken);

  while (nextUrl) {
    const response = await fetchWithTimeout(nextUrl.toString(), { method: "GET" });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error("instagram_recent_media_fetch_failed");
    }

    const pageData = Array.isArray(payload?.data) ? payload.data : [];
    media.push(...pageData);

    nextUrl = payload?.paging?.next ? new URL(payload.paging.next) : null;
  }

  return media;
}

function normalizeMediaForFrontend(mediaList = []) {
  return mediaList
    .map((item) => {
      const children = Array.isArray(item?.children?.data) ? item.children.data : [];
      const firstChild = children[0] || {};
      const image = item.media_url || item.thumbnail_url || firstChild.media_url || firstChild.thumbnail_url || "";

      return {
        id: item.id || "",
        title: item.caption || "Post no Instagram",
        link: item.permalink || PROFILE_URL,
        image,
        date: item.timestamp || null,
      };
    })
    .filter((item) => item.link && item.image);
}

function getStatus() {
  const config = getConfig();
  const token = getActiveAccessToken(config);

  return {
    configured: isConfigured(config),
    hasAccessToken: Boolean(token),
    refreshEnabled: config.refreshEnabled,
    accountId: runtimeAuth.userId || config.accountId || null,
    tokenSource: runtimeAuth.accessToken ? runtimeAuth.tokenSource : (config.staticAccessToken ? "env" : null),
    tokenExpiresAt: runtimeAuth.expiresAt,
  };
}

function getTokenPreview(token = "") {
  if (!token) return null;
  if (token.length <= 10) return `${token.slice(0, 2)}***`;
  return `${token.slice(0, 6)}***${token.slice(-4)}`;
}

async function refreshLongLivedAccessToken(accessToken = getActiveAccessToken()) {
  if (!accessToken) {
    throw new Error("instagram_access_token_missing");
  }

  const config = getConfig();
  const url = new URL(getApiUrl("refresh_access_token", config));
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);

  const response = await fetchWithTimeout(url.toString(), { method: "GET" });
  const payload = await response.json();

  if (!response.ok || !payload?.access_token) {
    log.warn("InstagramOfficialTokenExchangeFailed", {
      stage: "refresh_long_lived",
      status: response.status,
      hasPayload: Boolean(payload),
      errorCode: payload?.error?.code,
    });
    throw new Error("instagram_long_lived_refresh_failed");
  }

  runtimeAuth = {
    ...runtimeAuth,
    accessToken: payload.access_token,
    expiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : runtimeAuth.expiresAt,
    tokenSource: "refresh_runtime",
  };

  log.info("InstagramOfficialTokenRefreshSucceeded", {
    tokenSourceAfterRefresh: runtimeAuth.tokenSource,
    expiresInSeconds: payload.expires_in || null,
    tokenPreview: getTokenPreview(payload.access_token),
    persistedInEnvironment: false,
  });

  return getStatus();
}

async function handleOAuthCallback({ code, state }) {
  if (!code) {
    throw new Error("instagram_oauth_code_missing");
  }

  if (!state || !validateState(state)) {
    throw new Error("instagram_oauth_state_invalid");
  }

  log.info("InstagramOfficialAuthCallbackReceived", {
    hasCode: Boolean(code),
  });

  const shortLived = await exchangeCodeForShortLivedToken(code);
  const longLived = await exchangeShortForLongLivedToken(shortLived.access_token);

  runtimeAuth = {
    accessToken: longLived.access_token,
    expiresAt: longLived.expires_in ? Date.now() + longLived.expires_in * 1000 : null,
    tokenSource: "oauth_callback",
    userId: shortLived.user_id ? String(shortLived.user_id) : runtimeAuth.userId,
  };

  log.info("InstagramOfficialConfigured", {
    hasLongLivedToken: Boolean(runtimeAuth.accessToken),
    hasExpiresAt: Boolean(runtimeAuth.expiresAt),
    hasUserId: Boolean(runtimeAuth.userId),
  });

  return getStatus();
}

async function getPublicFeed() {
  const status = getStatus();

  if (!status.configured || !status.hasAccessToken) {
    return {
      ok: true,
      configured: false,
      source: "fallback",
      posts: [],
      profileUrl: PROFILE_URL,
    };
  }

  const now = Date.now();
  if (feedCache.data && now - feedCache.timestamp < FEED_CACHE_MS) {
    log.info("InstagramOfficialFeedServed", {
      source: "cache",
      posts: feedCache.data.posts.length,
    });
    return feedCache.data;
  }

  try {
    const media = await getRecentMedia();
    const posts = normalizeMediaForFrontend(media);

    const payload = {
      ok: true,
      configured: true,
      source: "meta_official",
      posts,
      profileUrl: PROFILE_URL,
    };

    feedCache = {
      timestamp: now,
      data: payload,
    };

    log.info("InstagramOfficialFeedServed", {
      source: "meta_official",
      posts: posts.length,
    });

    return payload;
  } catch (error) {
    log.warn("InstagramOfficialFeedFetchFailed", {
      hasCachedData: Boolean(feedCache.data),
      errorMessage: error?.message,
    });

    if (feedCache.data) {
      return {
        ...feedCache.data,
        source: "meta_official_cache",
      };
    }

    return {
      ok: true,
      configured: true,
      source: "fallback",
      posts: [],
      profileUrl: PROFILE_URL,
    };
  }
}

module.exports = {
  buildAuthorizationUrl,
  exchangeCodeForShortLivedToken,
  exchangeShortForLongLivedToken,
  getCurrentUser,
  getRecentMedia,
  normalizeMediaForFrontend,
  getPublicFeed,
  getStatus,
  handleOAuthCallback,
  refreshLongLivedAccessToken,
};
