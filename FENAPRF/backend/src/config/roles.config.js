module.exports = {
  ADMIN: ["*"],

  DIRETORIA: [
    "LIST_FILIADOS",
    "CREATE_FILIADO",
    "EDIT_FILIADO",
    "VIEW_ALL",
    "VIEW_SELF",
    "EDIT_SELF",
    "JOGOS_GERENCIAR",
    "VOTACAO_GERENCIAR",
    "VOTACAO_VOTAR",
    "EDIT_CONTENT",
    "PUSH_GERENCIAR",
    "REPASSE_GERENCIAR",
    "NOTICIAS_GERENCIAR",
    "RELATORIOS_VER"
  ],

  COLABORADOR: [
    "LIST_FILIADOS",
    "CREATE_FILIADO",
    "EDIT_FILIADO",
    "VIEW_ALL",
    "VIEW_SELF",
    "EDIT_SELF",
    "VOTACAO_VOTAR",
    "PUSH_GERENCIAR",
    "REPASSE_GERENCIAR",
    "NOTICIAS_GERENCIAR",
    "RELATORIOS_VER"
  ],

  CONSELHEIRO: [
    "LIST_FILIADOS",   // diretório: nome, telefone, avatar
    "VIEW_SELF",       // vê todos os próprios dados
    "EDIT_SELF",       // edita apenas campos permitidos
    "VOTACAO_VOTAR"
  ],

  // Mantendo para retrocompatibilidade se houver resíduos no banco
  FUNCIONARIO: ["LIST_FILIADOS", "CREATE_FILIADO", "EDIT_FILIADO", "VIEW_ALL", "VIEW_SELF", "EDIT_SELF", "VOTACAO_VOTAR", "PUSH_GERENCIAR", "REPASSE_GERENCIAR", "NOTICIAS_GERENCIAR", "RELATORIOS_VER"],
  FILIADO: ["LIST_FILIADOS", "VIEW_SELF", "EDIT_SELF", "VOTACAO_VOTAR"]
};
