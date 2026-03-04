// src/controllers/instagram.controller.js
const instagramService = require("../services/instagram.service");
const { v4: uuidv4 } = require("uuid");

exports.getFeed = (req, res) => {
  const requestId = req.requestId || uuidv4();
  // Retorna o que está na memória (resposta instantânea, sem esperar a API do Facebook)
  const feed = instagramService.getFeed();
  return res.json({
    ...feed,
    requestId
  });
};