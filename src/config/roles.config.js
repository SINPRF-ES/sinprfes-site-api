// src/config/roles.config.js

module.exports = {
  // O ADMIN tem acesso irrestrito a todos os recursos
  ADMIN: ["*"], 

  // Diretoria tem acesso a ver e editar filiados, e gerenciar jogos
  DIRETORIA: ["EDIT_FILIADO", "VIEW_ALL", "JOGOS_GERENCIAR"], 

  // Funcionário tem acesso a ver e editar filiados, mas sem gerenciar jogos
  FUNCIONARIO: ["EDIT_FILIADO", "VIEW_ALL"], 
  
  // Organizador tem foco apenas nos jogos
  ORGANIZADOR: ["JOGOS_GERENCIAR", "VIEW_INSCRICOES"],
  
  // Filiado comum só pode ver e editar seus próprios dados
  FILIADO: ["VIEW_SELF", "EDIT_SELF"] 
};