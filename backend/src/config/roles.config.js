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
    "RELATORIOS_VER",
    "CONSULTA_PROCESSUAL_CONSULTAR"
  ],

  FUNCIONARIO: [
    "LIST_FILIADOS",
    "CREATE_FILIADO",
    "EDIT_FILIADO",

    "VIEW_ALL",
    "VIEW_SELF",
    "EDIT_SELF",

    "JOGOS_GERENCIAR",
    "VOTACAO_VOTAR",
    "PUSH_GERENCIAR",
    "EDIT_CONTENT",
    "REPASSE_GERENCIAR",
    "NOTICIAS_GERENCIAR",
    "RELATORIOS_VER",
    "CONSULTA_PROCESSUAL_CONSULTAR"
  ],

  ORGANIZADOR: [
    "LIST_FILIADOS",

    "JOGOS_GERENCIAR",
    "VIEW_INSCRICOES",

    "VIEW_SELF",
    "EDIT_SELF",

    "VOTACAO_VOTAR"
  ],

  FILIADO: [
    "LIST_FILIADOS",   // diretório: nome, telefone, avatar
    "VIEW_SELF",       // vê todos os próprios dados
    "EDIT_SELF",       // edita apenas campos permitidos
    "VOTACAO_VOTAR"
  ],

  COMUNICADOR: [
    "VIEW_SELF",
    "EDIT_SELF",
    "EDIT_CONTENT",
    "NOTICIAS_GERENCIAR"
  ]
};
