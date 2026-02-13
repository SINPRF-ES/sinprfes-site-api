// mobile/src/services/userPayloadMapper.ts
import { onlyDigits } from '../utils/format';
import { toIsoDateYYYYMMDD } from '../utils/date';
import type { User } from '../types/user';
import { normalizeNome } from '../utils/user';

/**
 * Constrói o payload para a atualização de um membro, garantindo que os dados
 * estejam limpos, normalizados e contenham apenas os campos permitidos para edição.
 *
 * @param formState O estado atual do formulário de edição.
 * @returns Um objeto contendo apenas os dados permitidos para a atualização.
 */
export const buildUpdateUserPayload = (formState: Partial<User>): Partial<User> => {
  const payload: Partial<User> = {};

  // Campos permitidos e sua normalização
  if (formState.telefone1) payload.telefone1 = onlyDigits(formState.telefone1);
  if (formState.telefone2) payload.telefone2 = onlyDigits(formState.telefone2);
  if (formState.cep) payload.cep = onlyDigits(formState.cep);
  if (formState.logradouro) payload.logradouro = formState.logradouro;
  if (formState.bairro) payload.bairro = formState.bairro;
  if (formState.cidade) payload.cidade = formState.cidade;
  if (formState.numero) payload.numero = formState.numero;
  if (formState.complemento) payload.complemento = formState.complemento;
  if (formState.uf_endereco !== undefined) payload.uf_endereco = formState.uf_endereco;
  if (formState.uf !== undefined) payload.uf = formState.uf;
  if (formState.uf2 !== undefined) payload.uf2 = formState.uf2;

  // Alinhamento com Backend FENAPRF: usar 'nome' e 'email1'
  if (formState.email || (formState as any).email1) {
    (payload as any).email1 = (formState as any).email1 || formState.email;
    payload.email = (formState as any).email1 || formState.email; // mantém ambos por segurança
  }

  if (formState.data_nascimento) payload.data_nascimento = toIsoDateYYYYMMDD(formState.data_nascimento) || null as any;

  if (formState.name || (formState as any).nome) {
    const nomeNormalizado = normalizeNome((formState as any).nome || formState.name) || undefined;
    (payload as any).nome = nomeNormalizado;
    payload.name = nomeNormalizado;
  }

  if (formState.sexo !== undefined) payload.sexo = (formState.sexo as any) || undefined;
  if (formState.cpf) payload.cpf = onlyDigits(formState.cpf);

  const perfil = formState.perfil_acesso;
  if (perfil !== undefined) payload.perfil_acesso = perfil;

  // Novos campos FENAPRF com sanitização por perfil
  const isCouncil = perfil === 'CONSELHEIRO' || perfil === 'DIRETORIA';
  const isAdminOrColab = perfil === 'ADMIN' || perfil === 'COLABORADOR';

  payload.uf = (perfil === 'CONSELHEIRO') ? (formState.uf || '') : (isAdminOrColab || perfil === 'DIRETORIA' ? 'BR' : null as any);

  if (isCouncil) {
    payload.cargo = formState.cargo || '';
  } else if (perfil === 'ADMIN') {
    payload.cargo = 'Administrador';
  } else if (perfil === 'COLABORADOR') {
    payload.cargo = 'Colaborador';
  } else {
    payload.cargo = '';
  }

  if (isCouncil) {
    if (formState.cargo_mandato_inicio) payload.cargo_mandato_inicio = toIsoDateYYYYMMDD(formState.cargo_mandato_inicio) || null as any;
    if (formState.cargo_mandato_fim) payload.cargo_mandato_fim = toIsoDateYYYYMMDD(formState.cargo_mandato_fim) || null as any;
    if (formState.perfil_acesso2) {
      payload.perfil_acesso2 = formState.perfil_acesso2;
      payload.cargo2 = formState.cargo2 || '';
      payload.uf2 = formState.uf2 || '';
    } else {
      payload.perfil_acesso2 = null as any;
      payload.cargo2 = null as any;
      payload.uf2 = null as any;
    }
  } else {
    // Para ADMIN/COLABORADOR, removemos campos do conselho para evitar "lixo" no payload
    payload.cargo_mandato_inicio = null as any;
    payload.cargo_mandato_fim = null as any;
    payload.perfil_acesso2 = null as any;
    payload.cargo2 = null as any;
    payload.uf2 = null as any;
  }

  // Endereço: Enviamos todos os campos para persistência (Buscacep logic)

  // Campos que NUNCA devem ser enviados no payload de atualização
  const forbiddenFields: (keyof User)[] = [
    'id',
    'avatar_url',
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
