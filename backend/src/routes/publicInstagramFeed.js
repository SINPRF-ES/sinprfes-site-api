const express = require("express");

const { getInstagramFeed } = require("../services/instagramFeedService");

const router = express.Router();

router.get("/instagram-feed", async (req, res) => {
  try {
    const posts = await getInstagramFeed();

    return res.json({
      ok: true,
      total: posts.length,
      posts,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "instagram_feed_error",
    });
  }
});

module.exports = router;
