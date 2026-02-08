module.exports = {
  ADMIN: ["*"],

  DIRETORIA: [
    "LIST_USERS",
    "CREATE_USER",
    "EDIT_USER",
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
    "RELATORIOS_VER",
    "LOGISTICA_GERENCIAR"
  ],

  COLABORADOR: [
    "LIST_USERS",
    "CREATE_USER",
    "EDIT_USER",
    "VIEW_ALL",
    "VIEW_SELF",
    "EDIT_SELF",
    "VOTACAO_VOTAR",
    "PUSH_GERENCIAR",
    "REPASSE_GERENCIAR",
    "NOTICIAS_GERENCIAR",
    "RELATORIOS_VER",
    "LOGISTICA_GERENCIAR"
  ],

  CONSELHEIRO: [
    "LIST_USERS",   // diretório: nome, telefone, avatar
    "VIEW_SELF",       // vê todos os próprios dados
    "EDIT_SELF",       // edita apenas campos permitidos
    "VOTACAO_VOTAR"
  ],

  // Mantendo para retrocompatibilidade se houver resíduos no banco
  FUNCIONARIO: ["LIST_USERS", "CREATE_USER", "EDIT_USER", "VIEW_ALL", "VIEW_SELF", "EDIT_SELF", "VOTACAO_VOTAR", "PUSH_GERENCIAR", "REPASSE_GERENCIAR", "NOTICIAS_GERENCIAR", "RELATORIOS_VER"],
  USER: ["LIST_USERS", "VIEW_SELF", "EDIT_SELF", "VOTACAO_VOTAR"]
};
