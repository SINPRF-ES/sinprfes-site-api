import { CARGOS_CONSELHO } from '../utils/user';

export const STATUS_EVENTO = {
  ATIVO: 'ativo',
  ENCERRADO: 'encerrado',
  CANCELADO: 'cancelado'
} as const;

export const ACOES_AUDITORIA = {
  CRIAR: 'CRIAR',
  ALTERAR: 'ALTERAR',
  CANCELAR: 'CANCELAR'
} as const;

export const RECURSO_TIPO = {
  EVENTO: 'EVENTO',
  INSCRICAO: 'INSCRICAO'
} as const;

export const GRUPOS_CONFLITO = [
  {
    nome: 'Presidência',
    cargos: [CARGOS_CONSELHO[0], CARGOS_CONSELHO[1]] // Presidente, Vice-Presidente
  },
  {
    nome: 'Delegacia Representante',
    cargos: [CARGOS_CONSELHO[2], CARGOS_CONSELHO[3]] // Delegado Representante, Delegado Substituto
  }
];

export function verificarConflitosUF(inscricoes: any[]) {
  const conflitos: any[] = [];
  const cargosPresentes = inscricoes.map(i => i.cargo);

  // 1. Verificar duplicidade de cargos
  const contagemCargos: Record<string, number> = {};
  cargosPresentes.forEach(c => {
      if (c) {
          contagemCargos[c] = (contagemCargos[c] || 0) + 1;
      }
  });

  Object.keys(contagemCargos).forEach(cargo => {
      if (contagemCargos[cargo] > 1) {
          conflitos.push({
              tipo: 'DUPLICIDADE',
              mensagem: `Mais de um inscrito com o cargo "${cargo}"`,
              cargo
          });
      }
  });

  // 2. Verificar grupos de conflito
  GRUPOS_CONFLITO.forEach(grupo => {
      const cargosNoGrupo = cargosPresentes.filter(c => grupo.cargos.includes(c));
      const cargosUnicosNoGrupo = [...new Set(cargosNoGrupo)];

      if (cargosUnicosNoGrupo.length >= 2) {
          conflitos.push({
              tipo: 'GRUPO',
              mensagem: `Conflito de representação: ${grupo.cargos.join(' + ')}`,
              grupo: grupo.nome,
              cargos: cargosUnicosNoGrupo
          });
      }
  });

  return conflitos;
}
