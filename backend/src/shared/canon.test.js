const {
  normalizeSituacaoSindical,
  isSituacaoSindicalValida,
  SITUACAO_SINDICAL,
  SITUACAO_SINDICAL_LABELS
} = require('./canon');

describe('Canon - situacao_sindical', () => {
  test('accepts canonical values', () => {
    expect(isSituacaoSindicalValida(SITUACAO_SINDICAL.NAO_FILIADO)).toBe(true);
  });

  test('normalizes aliases', () => {
    expect(normalizeSituacaoSindical('filiado_es', null)).toBe(SITUACAO_SINDICAL.FILIADO_SINPRF_ES);
    expect(normalizeSituacaoSindical('outro_sindicato', null)).toBe(SITUACAO_SINDICAL.FILIADO_OUTRO_SINDICATO);
    expect(normalizeSituacaoSindical('não filiado', null)).toBe(SITUACAO_SINDICAL.NAO_FILIADO);
    expect(normalizeSituacaoSindical('pendente', null)).toBe(SITUACAO_SINDICAL.DESCONHECIDO);
  });

  test('has display labels', () => {
    expect(SITUACAO_SINDICAL_LABELS[SITUACAO_SINDICAL.FILIADO_SINPRF_ES]).toMatch(/SINPRF/);
  });
});
