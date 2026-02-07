// src/components/LotacaoCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { User } from '../types/user';
import LotacaoPicker from './LotacaoPicker'; // Importando o novo componente
import { normalizeSituacaoFuncional, getCanonicalUserId, ROLES, isGestao as checkIsGestao } from '../utils/userUtils';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../infra/logger';

import { Picker } from '@react-native-picker/picker';
import { TextInput } from 'react-native';

interface Props {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  isEditing?: boolean;
  hideTitle?: boolean;
}

const LotacaoCard: React.FC<Props> = ({ user, setUser, isEditing = false, hideTitle = false }) => {
  if (!user) {
    logger.error('LOTACAO_CARD_MISSING_DATA', new Error('User data is null in LotacaoCard'));
    return (
      <View style={styles.card}>
        <Text style={styles.textError}>⚠️ Seção de Lotação indisponível (dados ausentes).</Text>
      </View>
    );
  }

  const { user: authUser } = useAuth();
  const perfilUser = authUser?.perfil_acesso || '';
  const isAdmin = perfilUser === ROLES.ADMIN;
  const isGestao = checkIsGestao(perfilUser);

  const isTargetAdmin = user?.perfil_acesso === ROLES.ADMIN;
  const isSelf = user && authUser && getCanonicalUserId(user) === getCanonicalUserId(authUser);

  // Regra de UI:
  // ADMIN muda qualquer um (menos a si mesmo por segurança).
  // DIRETORIA/FUNCIONARIO mudam quem não é ADMIN.
  const canChangeProfile = (isAdmin && !isSelf) || (isGestao && !isAdmin && !isTargetAdmin);

  const profileOptions = [
    { label: 'Conselheiro', value: ROLES.CONSELHEIRO },
    { label: 'Colaborador', value: ROLES.COLABORADOR },
    { label: 'Diretoria', value: ROLES.DIRETORIA },
    ...(isAdmin ? [{ label: 'Admin', value: ROLES.ADMIN }] : [])
  ];

  return (
    <View style={styles.card}>
      {!hideTitle && <Text style={styles.cardTitle}>Lotação, Situação e Perfil</Text>}

      <Text style={styles.label}>Unidade de Lotação</Text>
      <View style={(isEditing || isSelf) ? styles.pickerContainer : styles.pickerContainerDisabled}>
        <LotacaoPicker
          selectedValue={user?.lotacao || 'SEDE'}
          onValueChange={(itemValue) => setUser(f => f ? { ...f, lotacao: itemValue } : null)}
          enabled={(isEditing || isSelf) ?? false}
        />
      </View>

      <Text style={styles.label}>Situação</Text>
      <View style={isEditing ? styles.pickerContainer : styles.pickerContainerDisabled}>
        <Picker
          selectedValue={user?.situacao || 'ATIVO'}
          onValueChange={(itemValue) => setUser(f => f ? { ...f, situacao: itemValue } : null)}
          enabled={isEditing}
          style={!isEditing ? { color: '#999' } : undefined}
        >
          <Picker.Item label="Ativo" value="ATIVO" />
          <Picker.Item label="Inativo" value="INATIVO" />
        </Picker>
      </View>

      <Text style={styles.label}>Perfil de Acesso</Text>
      {isGestao ? (
        <View style={canChangeProfile ? styles.pickerContainer : styles.pickerContainerDisabled}>
          <Picker
            selectedValue={user?.perfil_acesso}
            onValueChange={(val) => setUser(f => f ? { ...f, perfil_acesso: val } : null)}
            enabled={canChangeProfile}
            style={!canChangeProfile ? { color: '#999' } : undefined}
          >
            {profileOptions.map(opt => (
              <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
            ))}
          </Picker>
        </View>
      ) : (
        <TextInput
          style={styles.inputDisabled}
          value={user?.perfil_acesso || ''}
          editable={false}
          accessibilityLabel="Perfil de Acesso"
        />
      )}

      <Text style={styles.label}>Cargo</Text>
      <TextInput
        style={isEditing ? styles.input : styles.inputDisabled}
        value={user?.cargo || ''}
        onChangeText={(text) => setUser(f => f ? { ...f, cargo: text } : null)}
        placeholder="Cargo"
        editable={isEditing}
      />

      <Text style={styles.label}>Início do Mandato</Text>
      <TextInput
        style={isEditing ? styles.input : styles.inputDisabled}
        value={user?.cargo_mandato_inicio || ''}
        onChangeText={(text) => setUser(f => f ? { ...f, cargo_mandato_inicio: text } : null)}
        placeholder="AAAA-MM-DD"
        editable={isEditing}
      />

      <Text style={styles.label}>Fim do Mandato</Text>
      <TextInput
        style={isEditing ? styles.input : styles.inputDisabled}
        value={user?.cargo_mandato_fim || ''}
        onChangeText={(text) => setUser(f => f ? { ...f, cargo_mandato_fim: text } : null)}
        placeholder="AAAA-MM-DD"
        editable={isEditing}
      />

      <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 20 }}>
        <Text style={[styles.label, { fontWeight: 'bold' }]}>Campos Adicionais (Design)</Text>

        <Text style={styles.label}>Perfil de Acesso 2</Text>
        <TextInput
          style={isEditing ? styles.input : styles.inputDisabled}
          value={user?.perfil_acesso2 || ''}
          onChangeText={(text) => setUser(f => f ? { ...f, perfil_acesso2: text } : null)}
          placeholder="Perfil secundário"
          editable={isEditing}
        />

        <Text style={styles.label}>Cargo 2</Text>
        <TextInput
          style={isEditing ? styles.input : styles.inputDisabled}
          value={user?.cargo2 || ''}
          onChangeText={(text) => setUser(f => f ? { ...f, cargo2: text } : null)}
          placeholder="Cargo secundário"
          editable={isEditing}
        />

        <Text style={styles.label}>UF 2</Text>
        <TextInput
          style={isEditing ? styles.input : styles.inputDisabled}
          value={user?.uf2 || ''}
          onChangeText={(text) => setUser(f => f ? { ...f, uf2: text } : null)}
          placeholder="UF secundária"
          editable={isEditing}
        />
      </View>
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
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  pickerContainerDisabled: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 15,
    backgroundColor: '#f0f0f0',
  },
  inputDisabled: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#f0f0f0',
    color: '#999',
  },
});

export default LotacaoCard;
