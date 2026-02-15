module.exports = {
  ADMIN: ["*"],

  DIRETORIA: [
    "LIST_USERS",
    "CREATE_USER",
    "EDIT_USER",
    "VIEW_ALL",
    "VIEW_SELF",
    "EDIT_SELF",
    "LOGISTICA_GERENCIAR",
    "VOTACAO_GERENCIAR",
    "VOTACAO_VOTAR",
    "EDIT_CONTENT",
    "PUSH_GERENCIAR",
    "REPASSE_GERENCIAR",
    "NOTICIAS_GERENCIAR",
    "RELATORIOS_VER"
  ],

  COLABORADOR: [
    "LIST_USERS",
    "CREATE_USER",
    "EDIT_USER",
    "VIEW_ALL",
    "VIEW_SELF",
    "EDIT_SELF",
    "VOTACAO_GERENCIAR",
    "VOTACAO_VOTAR",
    "LOGISTICA_GERENCIAR",
    "PUSH_GERENCIAR",
    "REPASSE_GERENCIAR",
    "NOTICIAS_GERENCIAR",
    "RELATORIOS_VER"
  ],

  CONSELHEIRO: [
    "LIST_USERS",   // diretório: nome, telefone, avatar
    "VIEW_SELF",       // vê todos os próprios dados
    "EDIT_SELF",       // edita apenas campos permitidos
    "VOTACAO_VOTAR"
  ]
};
