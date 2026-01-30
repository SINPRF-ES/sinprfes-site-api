// mobile/src/services/filiadoPayloadMapper.ts
import { onlyDigits } from '../shared/format/formatters';
import { toIsoDateYYYYMMDD } from '../utils/dateNormalize';
import type { Filiado } from '../types/filiado';

/**
 * Constrói o payload para a atualização de um filiado, garantindo que os dados
 * estejam limpos, normalizados e contenham apenas os campos permitidos para edição.
 *
 * @param formState O estado atual do formulário de edição.
 * @returns Um objeto contendo apenas os dados permitidos para a atualização.
 */
export const buildUpdateFiliadoPayload = (formState: Partial<Filiado>): Partial<Filiado> => {
  const payload: Partial<Filiado> = {};

  // Campos permitidos e sua normalização
  if (formState.telefone1) payload.telefone1 = onlyDigits(formState.telefone1);
  if (formState.telefone2) payload.telefone2 = onlyDigits(formState.telefone2);
  if (formState.cep) payload.cep = onlyDigits(formState.cep);
  if (formState.email1) payload.email1 = formState.email1;
  if (formState.email2) payload.email2 = formState.email2;
  if (formState.data_nascimento) payload.data_nascimento = toIsoDateYYYYMMDD(formState.data_nascimento) || formState.data_nascimento;
  if (formState.nome) payload.nome = formState.nome;
  if (formState.cpf) payload.cpf = onlyDigits(formState.cpf);
  if (formState.lotacao) payload.lotacao = formState.lotacao;
  if (formState.situacao_funcional) payload.situacao = formState.situacao_funcional;
  if (formState.perfil_acesso) payload.perfil_acesso = formState.perfil_acesso;

  // Endereço: Apenas o CEP é enviado. Outros campos são preenchidos via buscaCEP no backend.
  // Campos como logradouro, bairro, cidade, uf NÃO devem ser enviados.

  // Dependentes: Normaliza o CPF de cada dependente
  for (let i = 1; i <= 5; i++) {
    const depKeyNome = `dep${i}_nome` as keyof Filiado;
    const depKeyCpf = `dep${i}_cpf` as keyof Filiado;
    const depKeyNascimento = `dep${i}_data_nascimento` as keyof Filiado;
    const depKeyParentesco = `dep${i}_parentesco` as keyof Filiado;

    if (formState[depKeyNome]) {
      payload[depKeyNome] = formState[depKeyNome];
      payload[depKeyParentesco] = formState[depKeyParentesco];
      payload[depKeyNascimento] = toIsoDateYYYYMMDD(formState[depKeyNascimento] as string) || formState[depKeyNascimento];
      if (formState[depKeyCpf]) {
        payload[depKeyCpf] = onlyDigits(formState[depKeyCpf] as string);
      }
    }
  }

  // Campos que NUNCA devem ser enviados no payload de atualização
  const forbiddenFields: (keyof Filiado)[] = [
    'id',
    'matricula_siape',
    'matricula_sinprf',
    'estado_cadastro',
    'avatar_url',
    'logradouro',
    'bairro',
    'cidade',
    'uf',
    'criado_em',
    'atualizado_em',
  ];

  for (const field of forbiddenFields) {
    delete (payload as any)[field];
  }

  if (__DEV__) {
    console.log('--- [DEV] Payload Mapeado e Normalizado ---');
    console.log(JSON.stringify(payload, null, 2));
    console.log('-------------------------------------------');
  }

  return payload;
};
