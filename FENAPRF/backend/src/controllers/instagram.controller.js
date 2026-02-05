// src/controllers/instagram.controller.js
const instagramService = require("../services/instagram.service");

exports.getFeed = (req, res) => {
  // Retorna o que está na memória (resposta instantânea, sem esperar a API do Facebook)
  const feed = instagramService.getFeed();
  return res.json(feed);
};