// src/utils/cadastro.js
const { SITUACAO_FUNCIONAL, ESTADO_CADASTRO } = require("../../shared/canon");

function estadoCadastro(filiado) {
  return filiado && filiado.arquivado_em ? ESTADO_CADASTRO.ARQUIVADO : ESTADO_CADASTRO.CADASTRO_ATIVO;
}

function anexarEstadoCadastro(obj) {
  if (!obj) return obj;
  return { ...obj, estado_cadastro: estadoCadastro(obj) };
}

function anexarEstadoCadastroLista(lista) {
  return (lista || []).map(anexarEstadoCadastro);
}

module.exports = {
  SITUACAO_FUNCIONAL: Object.values(SITUACAO_FUNCIONAL),
  ESTADO_CADASTRO: Object.values(ESTADO_CADASTRO),
  estadoCadastro,
  anexarEstadoCadastro,
  anexarEstadoCadastroLista,
};
