// mobile/src/services/filiadoPayloadMapper.ts
import { onlyDigits } from '../shared/format/formatters';
import { toIsoDateYYYYMMDD } from '../utils/dateNormalize';
import type { Filiado } from '../types/filiado';
import { normalizeNome, ME_EDITABLE_FIELDS_FILIADO, ME_EDITABLE_FIELDS_GESTAO } from '../utils/canon';

/**
 * Constrói o payload para a atualização de um filiado, garantindo que os dados
 * estejam limpos, normalizados e contenham apenas os campos permitidos para edição.
 *
 * @param formState O estado atual do formulário de edição.
 * @param perfilAtor O perfil de quem está editando (opcional, defaults a FILIADO).
 * @returns Um objeto contendo apenas os dados permitidos para a atualização.
 */
export const buildUpdateFiliadoPayload = (
  formState: Partial<Filiado>,
  perfilAtor: string = 'FILIADO'
): Partial<Filiado> => {
  const payload: Partial<Filiado> = {};

  // Whitelist baseada no perfil
  const isGestao = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes(perfilAtor.toUpperCase());
  const whitelist = isGestao ? ME_EDITABLE_FIELDS_GESTAO : ME_EDITABLE_FIELDS_FILIADO;

  // Campos permitidos e sua normalização
  if (formState.telefone1) payload.telefone1 = onlyDigits(formState.telefone1);
  if (formState.telefone2) payload.telefone2 = onlyDigits(formState.telefone2);
  if (formState.cep) payload.cep = onlyDigits(formState.cep);
  if (formState.email1) payload.email1 = formState.email1;
  if (formState.email2) payload.email2 = formState.email2;
  if (formState.data_nascimento) payload.data_nascimento = toIsoDateYYYYMMDD(formState.data_nascimento) || formState.data_nascimento;
  if (formState.nome) payload.nome = normalizeNome(formState.nome);
  if (formState.sexo !== undefined) payload.sexo = formState.sexo || null;
  if (formState.cpf) payload.cpf = onlyDigits(formState.cpf);
  if (formState.siape !== undefined) payload.siape = onlyDigits(formState.siape || '').slice(0, 7) || null;
  if (formState.lotacao) payload.lotacao = formState.lotacao;
  if (formState.situacao_funcional) payload.situacao = formState.situacao_funcional;
  if (formState.perfil_acesso) payload.perfil_acesso = formState.perfil_acesso;
  if (formState.situacao_sindical) payload.situacao_sindical = formState.situacao_sindical;

  // Endereço (somente se permitido na whitelist e enviado)
  if (formState.logradouro_bairro) payload.logradouro_bairro = formState.logradouro_bairro;
  if (formState.numero) payload.numero = formState.numero;
  if (formState.complemento) payload.complemento = formState.complemento;
  if (formState.cidade) payload.cidade = formState.cidade;
  if (formState.uf) payload.uf = formState.uf;

  // Dependentes: Normaliza o CPF de cada dependente
  for (let i = 1; i <= 5; i++) {
    const depKeyNome = `dep${i}_nome` as keyof Filiado;
    const depKeyCpf = `dep${i}_cpf` as keyof Filiado;
    const depKeyNascimento = `dep${i}_data_nascimento` as keyof Filiado;
    const depKeyParentesco = `dep${i}_parentesco` as keyof Filiado;
    const depKeyParentescoOutro = `dep${i}_parentesco_outro` as keyof Filiado;

    if (formState[depKeyNome] || formState[depKeyCpf] || formState[depKeyNascimento] || formState[depKeyParentesco] || formState[depKeyParentescoOutro]) {
      payload[depKeyNome] = normalizeNome(formState[depKeyNome] as string) || null;
      payload[depKeyParentesco] = formState[depKeyParentesco] || null;
      payload[depKeyParentescoOutro] = (formState[depKeyParentesco] === 'OUTRO') ? (formState[depKeyParentescoOutro] || null) : null;
      payload[depKeyNascimento] = toIsoDateYYYYMMDD(formState[depKeyNascimento] as string) || formState[depKeyNascimento] || null;
      if (formState[depKeyCpf]) {
        payload[depKeyCpf] = onlyDigits(formState[depKeyCpf] as string);
      } else {
        payload[depKeyCpf] = null;
      }
    }
  }

  // Aplica o Pick baseado na whitelist
  const finalPayload: Partial<Filiado> = {};
  Object.keys(payload).forEach(key => {
    if (whitelist.includes(key)) {
      (finalPayload as any)[key] = (payload as any)[key];
    }
  });

  // Garante que campos proibidos extras sejam removidos (segurança adicional)
  const forbiddenGlobal: string[] = ['id', 'matricula_sinprf', 'estado_cadastro', 'avatar_url', 'criado_em', 'atualizado_em'];
  forbiddenGlobal.forEach(key => delete (finalPayload as any)[key]);

  if (isGestao && payload.situacao_sindical) {
    (finalPayload as any).situacao_sindical = payload.situacao_sindical;
  }

  if (__DEV__) {
    console.log('--- [DEV] Payload Mapeado (Perfil: ' + perfilAtor + ') ---');
    console.log(JSON.stringify(finalPayload, null, 2));
    console.log('-------------------------------------------');
  }

  return finalPayload;
};
