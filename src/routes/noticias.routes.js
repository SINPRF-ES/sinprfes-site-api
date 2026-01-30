const express = require("express");
const router = express.Router();
const noticiasController = require("../controllers/noticias.controller");
const authMiddleware = require("../middlewares/auth");

router.get("/", authMiddleware, noticiasController.listar);
router.get("/:id", authMiddleware, noticiasController.detalhar);

module.exports = router;
