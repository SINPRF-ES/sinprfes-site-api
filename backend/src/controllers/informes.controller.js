const noticiasController = require("./noticias.controller");

function withEscopoInterno(handler) {
  return (req, res) => {
    req.audienciaEscopo = "INTERNA";
    return handler(req, res);
  };
}

module.exports = {
  listar: withEscopoInterno(noticiasController.listar),
  detalhar: withEscopoInterno(noticiasController.detalhar),
  criar: withEscopoInterno(noticiasController.criar),
  atualizar: withEscopoInterno(noticiasController.atualizar),
  publicar: withEscopoInterno(noticiasController.publicar),
  excluir: withEscopoInterno(noticiasController.excluir),
  adicionarMidia: withEscopoInterno(noticiasController.adicionarMidia),
  adicionarMidiaExterna: withEscopoInterno(noticiasController.adicionarMidiaExterna),
  removerMidia: withEscopoInterno(noticiasController.removerMidia),
  obterAssinaturaUpload: withEscopoInterno(noticiasController.obterAssinaturaUpload),
};
