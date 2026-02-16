// src/routes/ressarcimento.routes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const auth = require("../middlewares/auth");
const ressarcimentoController = require("../controllers/ressarcimento.controller");

// Armazenamento simples em disco (pasta temporária)
const upload = multer({
  dest: path.join(__dirname, "../../tmp/ressarcimentos"),
});

// POST /api/ressarcimentos
router.post(
  "/",
  auth,
  upload.array("anexos", 10), // até 10 arquivos
  ressarcimentoController.criarRequerimento
);

module.exports = router;
