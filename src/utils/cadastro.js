// src/utils/cadastro.js
// Vocabulário padronizado:
// - Situação funcional do servidor: ATIVO | VETERANO | PENSIONISTA
// - Estado do cadastro (administrativo): CADASTRO_ATIVO | ARQUIVADO

const SITUACAO_FUNCIONAL = ["ATIVO", "VETERANO", "PENSIONISTA"];
const ESTADO_CADASTRO = ["CADASTRO_ATIVO", "ARQUIVADO"];

function estadoCadastro(filiado) {
  return filiado && filiado.arquivado_em ? "ARQUIVADO" : "CADASTRO_ATIVO";
}

function anexarEstadoCadastro(obj) {
  if (!obj) return obj;
  return { ...obj, estado_cadastro: estadoCadastro(obj) };
}

function anexarEstadoCadastroLista(lista) {
  return (lista || []).map(anexarEstadoCadastro);
}

module.exports = {
  SITUACAO_FUNCIONAL,
  ESTADO_CADASTRO,
  estadoCadastro,
  anexarEstadoCadastro,
  anexarEstadoCadastroLista,
};
