// src/utils/textos.js

module.exports = {
  // Mensagens de SUCESSO gerais
  SUCESSO: {
    DADOS_ATUALIZADOS: "Dados atualizados com sucesso.",
    LOGIN_REALIZADO: "Login realizado com sucesso.",
    SENHA_REDEFINIDA: "Senha redefinida com sucesso. Você já pode fazer login com a nova senha.",
    CRIADO_SUCESSO: "Cadastro realizado com sucesso.",
    INSCRICAO_JOGOS_SUCESSO: "Pré-inscrição enviada com sucesso! Aguarde o contato da secretaria.",
  },

  // Mensagens de ERRO e VALIDAÇÃO no fluxo de AUTENTICAÇÃO
  AUTH: {
    INFORME_CREDENCIAIS: "Informe CPF e senha para entrar.",
    CREDENCIAIS_INVALIDAS: "CPF ou senha inválidos.",
    CADASTRO_INATIVO: "Seu cadastro não está ativo na base do sindicato.",
    CODIGO_2FA_REQUERIDO: "É necessário informar o código de 2FA.",
    CODIGO_2FA_INVALIDO: "Código 2FA inválido.",
  },

  // Mensagens de ERRO e VALIDAÇÃO no fluxo de SENHA/RESET
  SENHA: {
    INFORME_CPF: "Informe o CPF.",
    MENSAGEM_RESET_PADRAO: "Se houver um cadastro para este CPF, um e-mail com link de redefinição de senha foi enviado.",
    EMAIL_NAO_CADASTRADO: "CPF localizado, mas não há e-mail válido cadastrado. Por favor, entre em contato com a secretaria do sindicato pela página de contato.",
    TOKEN_SENHA_EXPIRADO: "Link de redefinição inválido ou expirado. Solicite novamente.",
    SENHA_MUITO_CURTA: "A nova senha deve ter pelo menos 6 caracteres.",
    TOKEN_E_SENHA_OBRIGATORIOS: "Token e nova senha são obrigatórios.",
    TOKEN_TIPO_INVALIDO: "Token de redefinição inválido.",
  },

  // Mensagens de ERRO e VALIDAÇÃO no fluxo de FILIADOS/CRUD
  FILIADOS: {
    ID_INVALIDO: "ID inválido.",
    FILIADO_NAO_ENCONTRADO: "Filiado não encontrado.",
    PERMISSAO_CRIAR: "Você não tem permissão para criar filiados.",
    CAMPOS_OBRIGATORIOS: "Campos obrigatórios: nome, cpf, email1.",
    CPF_DUPLICADO: "CPF já cadastrado na base de dados.",
  },
  
  // Mensagens de ERRO internas (Erro 500)
  ERROS_INTERNOS: {
    LOGIN: "Erro interno ao realizar login.",
    CARREGAR_DADOS: "Erro interno ao carregar seus dados.",
    LISTAR_FILIADOS: "Erro interno ao listar filiados.",
    ATUALIZAR_DADOS: "Erro interno ao atualizar dados.",
    CRIAR_FILIADO: "Erro interno ao criar filiado.",
    RESET_SENHA: "Erro interno ao redefinir a senha.",
  }
};