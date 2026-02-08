// src/components/MembroPerfilCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { User } from '../types/user';
import { getCanonicalUserId, ROLES, isGestao as checkIsGestao, CARGOS_DIRETORIA, CARGOS_CONSELHO, UFS } from '../utils/userUtils';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../infra/logger';
import { formatData, onlyDigits } from '../shared/format/formatters';
import { toISODate, toBrazilianDate } from '../utils/date';

import { Picker } from '@react-native-picker/picker';
import { TextInput, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  isEditing?: boolean;
  hideTitle?: boolean;
}

const MembroPerfilCard: React.FC<Props> = ({ user, setUser, isEditing = false, hideTitle = false }) => {
  if (!user) {
    logger.error('PERFIL_CARD_MISSING_DATA', new Error('User data is null in MembroPerfilCard'));
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
  // ADMIN muda qualquer um (menos a si mesmo por segurança - bloqueio de auto-demote).
  // DIRETORIA e COLABORADOR podem conceder entre si e para outros (exceto para/de ADMIN).
  const canChangeProfile = (isAdmin && !isSelf) || (isGestao && !isAdmin && !isTargetAdmin);

  const profileOptions = [
    { label: 'Conselheiro', value: ROLES.CONSELHEIRO },
    { label: 'Colaborador', value: ROLES.COLABORADOR },
    { label: 'Diretoria', value: ROLES.DIRETORIA },
    ...(isAdmin ? [{ label: 'Admin', value: ROLES.ADMIN }] : [])
  ];

  const getCargoOptions = (perfil?: string | null) => {
    const p = (perfil || "").toUpperCase();
    if (p === ROLES.DIRETORIA) return CARGOS_DIRETORIA;
    if (p === ROLES.CONSELHEIRO) return CARGOS_CONSELHO;
    if (p === ROLES.ADMIN) return [...CARGOS_DIRETORIA, ...CARGOS_CONSELHO];
    return [];
  };

  const hasSecondRole = !!(user?.perfil_acesso2 || user?.cargo2 || user?.uf2);

  const primaryPerfil = (user?.perfil_acesso || "").toUpperCase();
  const canHaveSecondRole = primaryPerfil === ROLES.DIRETORIA || primaryPerfil === ROLES.CONSELHEIRO;
  const secondPerfilValue = primaryPerfil === ROLES.DIRETORIA ? ROLES.CONSELHEIRO : ROLES.DIRETORIA;

  return (
    <View style={styles.card}>
      {!hideTitle && <Text style={styles.cardTitle}>Situação e Perfil</Text>}

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
            selectedValue={user?.perfil_acesso || ROLES.CONSELHEIRO}
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
      {isEditing && (user?.perfil_acesso === ROLES.DIRETORIA || user?.perfil_acesso === ROLES.CONSELHEIRO) ? (
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={user?.cargo || ''}
            onValueChange={(val) => setUser(f => f ? { ...f, cargo: val } : null)}
          >
            <Picker.Item label="Selecione..." value="" />
            {getCargoOptions(user?.perfil_acesso).map(c => (
              <Picker.Item key={c} label={c} value={c} />
            ))}
          </Picker>
        </View>
      ) : (
        <TextInput
          style={isEditing ? styles.input : styles.inputDisabled}
          value={user?.cargo || ''}
          onChangeText={(text) => setUser(f => f ? { ...f, cargo: text } : null)}
          placeholder="Cargo"
          editable={isEditing}
        />
      )}

      <Text style={styles.label}>UF do Mandato</Text>
      {isEditing ? (
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={user?.uf || ''}
            onValueChange={(val) => setUser(f => f ? { ...f, uf: val } : null)}
          >
            <Picker.Item label="Selecione..." value="" />
            <Picker.Item label="Brasil (BR)" value="BR" />
            {UFS.map(uf => (
              <Picker.Item key={uf} label={uf} value={uf} />
            ))}
          </Picker>
        </View>
      ) : (
        <TextInput
          style={styles.inputDisabled}
          value={user?.uf || ''}
          editable={false}
        />
      )}

      <Text style={styles.label}>Início do Mandato</Text>
      <TextInput
        style={isEditing ? styles.input : styles.inputDisabled}
        value={isEditing ? formatData(user?.cargo_mandato_inicio) : (user?.cargo_mandato_inicio ? toBrazilianDate(user.cargo_mandato_inicio) : '')}
        onChangeText={(text) => {
          const digits = onlyDigits(text);
          if (digits.length <= 8) {
            setUser(f => f ? { ...f, cargo_mandato_inicio: digits } : null);
          }
        }}
        onBlur={() => {
          if (user?.cargo_mandato_inicio && user.cargo_mandato_inicio.length === 8) {
            const isoDate = toISODate(formatData(user.cargo_mandato_inicio));
            setUser(f => f ? { ...f, cargo_mandato_inicio: isoDate || user.cargo_mandato_inicio } : null);
          }
        }}
        placeholder="DD/MM/AAAA"
        keyboardType="numeric"
        maxLength={10}
        editable={isEditing}
      />

      <Text style={styles.label}>Fim do Mandato</Text>
      <TextInput
        style={isEditing ? styles.input : styles.inputDisabled}
        value={isEditing ? formatData(user?.cargo_mandato_fim) : (user?.cargo_mandato_fim ? toBrazilianDate(user.cargo_mandato_fim) : '')}
        onChangeText={(text) => {
          const digits = onlyDigits(text);
          if (digits.length <= 8) {
            setUser(f => f ? { ...f, cargo_mandato_fim: digits } : null);
          }
        }}
        onBlur={() => {
          if (user?.cargo_mandato_fim && user.cargo_mandato_fim.length === 8) {
            const isoDate = toISODate(formatData(user.cargo_mandato_fim));
            setUser(f => f ? { ...f, cargo_mandato_fim: isoDate || user.cargo_mandato_fim } : null);
          }
        }}
        placeholder="DD/MM/AAAA"
        keyboardType="numeric"
        maxLength={10}
        editable={isEditing}
      />

      <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { fontWeight: 'bold' }]}>Segundo Vínculo (Opcional)</Text>
            {!canHaveSecondRole && isEditing && (
                <Text style={{ fontSize: 10, color: '#999' }}>Apenas para Diretoria ou Conselheiro.</Text>
            )}
          </View>
          {isEditing && !hasSecondRole && canHaveSecondRole && (
            <TouchableOpacity onPress={() => setUser(f => f ? { ...f, perfil_acesso2: secondPerfilValue } : null)}>
              <MaterialCommunityIcons name="plus-circle" size={24} color="#003366" />
            </TouchableOpacity>
          )}
          {isEditing && hasSecondRole && (
            <TouchableOpacity onPress={() => setUser(f => f ? { ...f, perfil_acesso2: null, cargo2: null, uf2: null } : null)}>
              <MaterialCommunityIcons name="minus-circle" size={24} color="#c0392b" />
            </TouchableOpacity>
          )}
        </View>

        {hasSecondRole && (
          <>
            <Text style={styles.label}>Perfil de Acesso 2</Text>
            <TextInput
                style={styles.inputDisabled}
                value={user?.perfil_acesso2 || ''}
                editable={false}
            />

            <Text style={styles.label}>Cargo 2</Text>
            {isEditing ? (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={user?.cargo2 || ''}
                  onValueChange={(val) => setUser(f => f ? { ...f, cargo2: val } : null)}
                >
                  <Picker.Item label="Selecione..." value="" />
                  {getCargoOptions(user?.perfil_acesso2).map(c => (
                    <Picker.Item key={c} label={c} value={c} />
                  ))}
                </Picker>
              </View>
            ) : (
              <TextInput
                style={styles.inputDisabled}
                value={user?.cargo2 || ''}
                editable={false}
              />
            )}

            <Text style={styles.label}>UF 2</Text>
            {isEditing ? (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={user?.uf2 || ''}
                  onValueChange={(val) => setUser(f => f ? { ...f, uf2: val } : null)}
                >
                  <Picker.Item label="Selecione..." value="" />
                  <Picker.Item label="Brasil (BR)" value="BR" />
                  {UFS.map(uf => (
                    <Picker.Item key={uf} label={uf} value={uf} />
                  ))}
                </Picker>
              </View>
            ) : (
              <TextInput
                style={styles.inputDisabled}
                value={user?.uf2 || ''}
                editable={false}
              />
            )}
          </>
        )}
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

export default MembroPerfilCard;
