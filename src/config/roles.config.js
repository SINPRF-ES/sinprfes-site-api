// src/config/roles.config.js

module.exports = {
  ADMIN: ["*"],
  DIRETORIA: ["EDIT_FILIADO", "VIEW_ALL", "JOGOS_GERENCIAR", "VIEW_SELF", "EDIT_SELF"], // Garantindo VIEW_SELF
  
  // 🟢 CORREÇÃO: FUNCIONARIO deve ter VIEW_SELF (para carregar o /me)
  // e EDIT_SELF, além de VIEW_ALL e EDIT_FILIADO (para gerenciar outros)
  FUNCIONARIO: ["EDIT_FILIADO", "VIEW_ALL", "VIEW_SELF", "EDIT_SELF"], 
  
  ORGANIZADOR: ["JOGOS_GERENCIAR", "VIEW_INSCRICOES", "VIEW_SELF", "EDIT_SELF"], // Garantindo VIEW_SELF
  FILIADO: ["VIEW_SELF", "EDIT_SELF"]
};