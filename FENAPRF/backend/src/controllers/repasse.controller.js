const repasseService = require("../services/repasse.service");

async function getRepasseAno(req, res) {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const data = await repasseService.getRepasseAno(year);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateRepasseMes(req, res) {
  try {
    const { year, month, perCapita, localidades } = req.body;

    if (!year || !month || perCapita === undefined || !Array.isArray(localidades)) {
      return res.status(400).json({ success: false, message: "Dados incompletos." });
    }

    await repasseService.updateRepasseMes(year, month, perCapita, localidades);
    res.json({ success: true, message: "Dados atualizados com sucesso." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listarResponsaveis(req, res) {
  try {
    const { uf } = req.query;
    const responsaveis = await repasseService.listarResponsaveis(uf);
    res.json({ success: true, responsaveis });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getRepasseAno,
  updateRepasseMes,
  listarResponsaveis
};
