const DEFAULT_TEST_USER = {
  id: 1,
  perfil_acesso: 'FILIADO',
  situacao_sindical: 'FILIADO_SINPRF_ES',
  cpf: '00000000191',
  ativo: true,
  arquivado_em: null,
};

function createTestUser(overrides = {}) {
  return {
    ...DEFAULT_TEST_USER,
    ...overrides,
  };
}

module.exports = {
  DEFAULT_TEST_USER,
  createTestUser,
};
