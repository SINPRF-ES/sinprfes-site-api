// mobile/src/services/filiadoPayloadMapper.ts
import { onlyDigits } from '../shared/format/formatters';
import { toIsoDateYYYYMMDD } from '../utils/dateNormalize';
import type { User } from '../types/usuario';
import { normalizeNome } from '../utils/canon';

/**
 * Constrói o payload para a atualização de um usuário, garantindo que os dados
 * estejam limpos, normalizados e contenham apenas os campos permitidos para edição.
 *
 * @param formState O estado atual do formulário de edição.
 * @returns Um objeto contendo apenas os dados permitidos para a atualização.
 */
export const buildUpdateFiliadoPayload = (formState: Partial<User>): Partial<User> => {
  const payload: Partial<User> = {};

  // Campos permitidos e sua normalização
  if (formState.telefone1) payload.telefone1 = onlyDigits(formState.telefone1);
  if (formState.telefone2) payload.telefone2 = onlyDigits(formState.telefone2);
  if (formState.cep) payload.cep = onlyDigits(formState.cep);
  if (formState.email) payload.email = formState.email;
  if (formState.data_nascimento) payload.data_nascimento = toIsoDateYYYYMMDD(formState.data_nascimento) || formState.data_nascimento;
  if (formState.name) payload.name = normalizeNome(formState.name);
  if (formState.sexo !== undefined) payload.sexo = formState.sexo || null;
  if (formState.cpf) payload.cpf = onlyDigits(formState.cpf);
  if (formState.lotacao) payload.lotacao = formState.lotacao;
  if (formState.situacao) payload.situacao = formState.situacao;
  if (formState.perfil_acesso) payload.perfil_acesso = formState.perfil_acesso;

  // Novos campos FENAPRF
  if (formState.cargo) payload.cargo = formState.cargo;
  if (formState.cargo_mandato_inicio) payload.cargo_mandato_inicio = toIsoDateYYYYMMDD(formState.cargo_mandato_inicio) || formState.cargo_mandato_inicio;
  if (formState.cargo_mandato_fim) payload.cargo_mandato_fim = toIsoDateYYYYMMDD(formState.cargo_mandato_fim) || formState.cargo_mandato_fim;
  if (formState.perfil_acesso2) payload.perfil_acesso2 = formState.perfil_acesso2;
  if (formState.cargo2) payload.cargo2 = formState.cargo2;
  if (formState.uf2) payload.uf2 = formState.uf2;

  // Endereço: Apenas o CEP é enviado. Outros campos são preenchidos via buscaCEP no backend.
  // Campos como logradouro, bairro, cidade, uf NÃO devem ser enviados.

  // Campos que NUNCA devem ser enviados no payload de atualização
  const forbiddenFields: (keyof User)[] = [
    'id',
    'avatar_url',
    'logradouro',
    'bairro',
    'cidade',
    'uf',
    'created_at',
    'updated_at',
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
