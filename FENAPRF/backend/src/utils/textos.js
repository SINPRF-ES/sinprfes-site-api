// src/utils/textos.js

module.exports = {
  // Mensagens de SUCESSO gerais
  SUCESSO: {
    DADOS_ATUALIZADOS: "Dados atualizados com sucesso.",
    LOGIN_REALIZADO: "Login realizado com sucesso.",
    SENHA_REDEFINIDA: "Senha redefinida com sucesso. Você já pode fazer login com a nova senha.",
    CRIADO_SUCESSO: "Cadastro realizado com sucesso.",
  },

  // Mensagens de ERRO e VALIDAÇÃO no fluxo de AUTENTICAÇÃO
  AUTH: {
    INFORME_CREDENCIAIS: "Informe CPF e senha para entrar.",
    CREDENCIAIS_INVALIDAS: "CPF ou senha inválidos.",
    CADASTRO_INATIVO: "Seu cadastro encontra-se inativo junto à FENAPRF. Favor entrar em contato com a secretaria.",
    TOKEN_NAO_INFORMADO: "Token de acesso não informado.",
    TOKEN_INVALIDO: "Sessão inválida ou expirada. Por favor, entre novamente.",
    ACESSO_BLOQUEADO: "Acesso bloqueado. Contate a FENAPRF.",
    PERMISSAO_INSUFICIENTE: "Você não tem permissão para realizar esta ação.",
  },

  // Mensagens de ERRO e VALIDAÇÃO no fluxo de SENHA/RESET
  SENHA: {
    INFORME_CPF: "Informe o CPF.",
    MENSAGEM_RESET_PADRAO: "Se houver um cadastro para este CPF, um e-mail com link de redefinição de senha foi enviado.",
    EMAIL_NAO_CADASTRADO: "CPF localizado, mas não há e-mail válido cadastrado. Por favor, entre em contato com a secretaria da FENAPRF pela página de contato.",
    TOKEN_SENHA_EXPIRADO: "Link de redefinição inválido ou expirado. Solicite novamente.",
    SENHA_MUITO_CURTA: "A nova senha deve ter pelo menos 6 caracteres.",
    TOKEN_E_SENHA_OBRIGATORIOS: "Token e nova senha são obrigatórios.",
    TOKEN_TIPO_INVALIDO: "Token de redefinição inválido.",
  },

  // Mensagens de ERRO e VALIDAÇÃO no fluxo de MEMBROS/CRUD
  USERS: {
    ID_INVALIDO: "ID inválido.",
    USER_NAO_ENCONTRADO: "Membro não encontrado.",
    PERMISSAO_CRIAR: "Você não tem permissão para criar membros.",
    CAMPOS_OBRIGATORIOS: "Campos obrigatórios: nome, cpf, email1.",
    CPF_DUPLICADO: "CPF já cadastrado na base de dados.",
  },

  // Mensagens de ERRO internas (Erro 500)
  ERROS_INTERNOS: {
    LOGIN: "Erro interno ao realizar login.",
    CARREGAR_DADOS: "Erro interno ao carregar seus dados.",
    LISTAR_USERS: "Erro interno ao listar membros.",
    ATUALIZAR_DADOS: "Erro interno ao atualizar dados.",
    CRIAR_USER: "Erro interno ao criar membro.",
    RESET_SENHA: "Erro interno ao redefinir a senha.",
  },

  ASSEMBLEIA: {
    NAO_ENCONTRADA: "Assembleia não encontrada.",
    TRANSICAO_INVALIDA: "Transição de estado inválida.",
    MESA_NAO_DEFINIDA: "A mesa (Presidente e Secretário) deve estar definida e presente para iniciar a execução.",
    TOKEN_INVALIDO: "Token inválido, expirado ou recontagem em curso.",
    NAO_ELEGIVEL: "Você não possui check-in no quórum deste item e não pode votar.",
    TEMPO_EXPIRADO: "O tempo para votação expirou.",
    VOTACAO_ENCERRADA: "Votação não está ativa ou já foi encerrada.",
    APENAS_PRESIDENTE: "Apenas os membros da Mesa Diretora podem realizar esta ação.",
    DATA_EVENTO_INVALIDA: "Data da assembleia inválida.",
    DATA_EVENTO_PASSADA: "A data da assembleia não pode ser no passado.",
    DATA_EVENTO_MUITO_DISTANTE: "A data da assembleia não pode ser superior a 1 ano no futuro.",
    HORA_INVALIDA: "Formato de hora inválido (HH:mm).",
    HORA_ORDEM_INVALIDA: "A hora da segunda chamada não pode ser anterior à primeira chamada.",
    PRESIDENTE_PRESENTE: "Seu presidente já está participando do quórum.",
    DELEGADO_PRESENTE: "Seu delegado representante já está participando do quórum.",
  }
};