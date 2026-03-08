const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/polls.controller");

const router = express.Router();

router.post("/", auth, requirePermission("ENQUETES_GERENCIAR"), controller.create);
router.put("/:id", auth, requirePermission("ENQUETES_GERENCIAR"), controller.update);
router.post("/:id/publish", auth, requirePermission("ENQUETES_GERENCIAR"), controller.publish);
router.get("/", auth, requirePermission("ENQUETES_GERENCIAR"), controller.list);
router.get("/:id", auth, requirePermission("ENQUETES_GERENCIAR"), controller.getById);
router.post("/:id/vote", auth, requirePermission("ENQUETES_GERENCIAR"), controller.vote);
router.get("/:id/results", auth, requirePermission("ENQUETES_GERENCIAR"), controller.results);

module.exports = router;
