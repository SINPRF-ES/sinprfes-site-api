// src/components/LotacaoCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Filiado } from '../types/filiado';
import LotacaoPicker from './LotacaoPicker'; // Importando o novo componente
import { normalizeSituacaoFuncional, getCanonicalFiliadoId, ROLES, isGestao as checkIsGestao } from '../utils/filiadoUtils';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../infra/logger';

import { PickerSafe } from './PickerSafe';
import { TextInput } from 'react-native';
import { SITUACAO_SINDICAL, SITUACAO_SINDICAL_LABELS } from '../utils/canon';

interface Props {
  filiado: Filiado | null;
  setFiliado: React.Dispatch<React.SetStateAction<Filiado | null>>;
  isEditing?: boolean;
  hideTitle?: boolean;
}

const LotacaoCard: React.FC<Props> = ({ filiado, setFiliado, isEditing = false, hideTitle = false }) => {
  if (!filiado) {
    logger.error('LOTACAO_CARD_MISSING_DATA', new Error('Filiado data is null in LotacaoCard'));
    return (
      <View style={styles.card}>
        <Text style={styles.textError}>⚠️ Seção de Lotação indisponível (dados ausentes).</Text>
      </View>
    );
  }

  const { usuario } = useAuth();
  const perfilUsuario = usuario?.perfil_acesso || '';
  const isAdmin = perfilUsuario === ROLES.ADMIN;
  const isGestao = checkIsGestao(perfilUsuario);

  const isTargetAdmin = filiado?.perfil_acesso === ROLES.ADMIN;
  const isSelf = filiado && getCanonicalFiliadoId(filiado) === getCanonicalFiliadoId(usuario);

  // Regra de UI:
  // ADMIN muda qualquer um (menos a si mesmo por segurança).
  // DIRETORIA/FUNCIONARIO mudam quem não é ADMIN.
  const canChangeProfile = (isAdmin && !isSelf) || (isGestao && !isAdmin && !isTargetAdmin);

  const profileOptions = [
    { label: 'Filiado', value: ROLES.FILIADO },
    { label: 'Organizador', value: ROLES.ORGANIZADOR },
    { label: 'Comunicador', value: ROLES.COMUNICADOR },
    { label: 'Funcionário', value: ROLES.FUNCIONARIO },
    { label: 'Diretoria', value: ROLES.DIRETORIA },
    ...(isAdmin ? [{ label: 'Admin', value: ROLES.ADMIN }] : [])
  ];

  return (
    <View style={styles.card}>
      {!hideTitle && <Text style={styles.cardTitle}>Lotação, Situação e Perfil</Text>}

      <LotacaoPicker
        label="Unidade de Lotação"
        selectedValue={filiado?.lotacao || 'SEDE'}
        onValueChange={(itemValue) => setFiliado(f => f ? { ...f, lotacao: itemValue } : null)}
        enabled={isEditing || isSelf}
      />

      <PickerSafe
        label="Situação Funcional"
        selectedValue={normalizeSituacaoFuncional(filiado?.situacao_funcional || filiado?.situacao)}
        onValueChange={(itemValue) => setFiliado(f => f ? { ...f, situacao_funcional: itemValue as any } : null)}
        enabled={isEditing}
        items={[
          { label: "Ativo", value: "ATIVO" },
          { label: "Veterano", value: "VETERANO" },
          { label: "Pensionista", value: "PENSIONISTA" },
        ]}
        pickerBoxStyle={!isEditing ? { backgroundColor: '#f0f0f0' } : undefined}
      />

      {isGestao && (
        <PickerSafe
          label="Situação Sindical"
          selectedValue={filiado?.situacao_sindical || 'FILIADO_SINPRF_ES'}
          onValueChange={(itemValue) => setFiliado(f => f ? { ...f, situacao_sindical: itemValue as any } : null)}
          enabled={isEditing}
          items={Object.values(SITUACAO_SINDICAL).map((s: string) => ({
            label: SITUACAO_SINDICAL_LABELS[s] || s,
            value: s
          }))}
          pickerBoxStyle={!isEditing ? { backgroundColor: '#f0f0f0' } : undefined}
        />
      )}

      {isGestao || perfilUsuario === ROLES.ORGANIZADOR ? (
        <PickerSafe
          label="Perfil de Acesso"
          selectedValue={filiado?.perfil_acesso}
          onValueChange={(val) => setFiliado(f => f ? { ...f, perfil_acesso: val as any } : null)}
          enabled={canChangeProfile}
          items={profileOptions}
          pickerBoxStyle={!canChangeProfile ? { backgroundColor: '#f0f0f0' } : undefined}
        />
      ) : (
        <TextInput
          style={styles.inputDisabled}
          value={filiado?.perfil_acesso || ''}
          editable={false}
          accessibilityLabel="Perfil de Acesso"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  textError: {
    color: '#c0392b',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',

    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 18,
    color: '#003366',
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    marginBottom: 18,
    backgroundColor: '#fff',
  },
  pickerContainerDisabled: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    marginBottom: 18,
    backgroundColor: '#f8f9fa',
  },
  inputDisabled: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    color: '#666',
  },
});

export default LotacaoCard;
