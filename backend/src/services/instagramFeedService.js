const log = require("../utils/log");

const CACHE_TIME = 15 * 60 * 1000;
const MAX_POSTS = 5;
const USERNAME = "sinprfes";

let cache = {
  timestamp: 0,
  data: null,
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

  return items.slice(0, MAX_POSTS).map((item) => ({
    title: readTag(item, "title"),
    link: readTag(item, "link"),
    image: readMediaUrl(item),
    date: readTag(item, "pubDate"),
  })).filter((post) => post.link);
}

async function fetchFeed() {
  const rssUrl = `https://rsshub.app/instagram/user/${USERNAME}`;
  const response = await fetch(rssUrl, {
    headers: {
      "User-Agent": "SINPRFES-InstagramFeed/1.0",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`instagram_rss_http_${response.status}`);
  }

  const xml = await response.text();
  return parseRssItems(xml);
}

async function getInstagramFeed() {
  const now = Date.now();

  if (cache.data && now - cache.timestamp < CACHE_TIME) {
    return cache.data;
  }

  try {
    const posts = await fetchFeed();

    cache = {
      timestamp: now,
      data: posts,
    };

    return posts;
  } catch (err) {
    log.error("InstagramRssError", err?.message || err);

    if (cache.data) {
      return cache.data;
    }

    return [];
  }
}

module.exports = { getInstagramFeed };
