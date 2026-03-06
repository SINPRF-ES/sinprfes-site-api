const express = require("express");

const { getPublicFeed } = require("../services/instagramOfficialService");

const router = express.Router();

router.get("/instagram-feed", async (_req, res) => {
  const payload = await getPublicFeed();
  return res.json(payload);
});

module.exports = router;
