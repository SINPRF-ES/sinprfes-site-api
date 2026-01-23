// src/components/LotacaoCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Filiado } from '../types/filiado';
import LotacaoPicker from './LotacaoPicker'; // Importando o novo componente
import { normalizeSituacaoFuncional, getCanonicalFiliadoId } from '../utils/filiadoUtils';
import { useAuth } from '../hooks/useAuth';

import { Picker } from '@react-native-picker/picker';
import { TextInput } from 'react-native';

interface Props {
  filiado: Filiado | null;
  setFiliado: React.Dispatch<React.SetStateAction<Filiado | null>>;
  isEditing?: boolean;
  hideTitle?: boolean;
}

const LotacaoCard: React.FC<Props> = ({ filiado, setFiliado, isEditing = false, hideTitle = false }) => {
  const { usuario } = useAuth();
  const perfilUsuario = usuario?.perfil_acesso || '';
  const isAdmin = perfilUsuario === 'ADMIN';
  const isGestao = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes(perfilUsuario);

  const isTargetAdmin = filiado?.perfil_acesso === 'ADMIN';
  const isSelf = filiado && getCanonicalFiliadoId(filiado) === getCanonicalFiliadoId(usuario);

  // Regra de UI:
  // ADMIN muda qualquer um (menos a si mesmo por segurança).
  // DIRETORIA/FUNCIONARIO mudam quem não é ADMIN.
  const canChangeProfile = (isAdmin && !isSelf) || (isGestao && !isAdmin && !isTargetAdmin);

  const profileOptions = [
    { label: 'Filiado', value: 'FILIADO' },
    { label: 'Organizador', value: 'ORGANIZADOR' },
    { label: 'Funcionário', value: 'FUNCIONARIO' },
    { label: 'Diretoria', value: 'DIRETORIA' },
    ...(isAdmin ? [{ label: 'Admin', value: 'ADMIN' }] : [])
  ];

  return (
    <View style={styles.card}>
      {!hideTitle && <Text style={styles.cardTitle}>Lotação, Situação e Perfil</Text>}

      <Text style={styles.label}>Unidade de Lotação</Text>
      <View style={isEditing ? styles.pickerContainer : styles.pickerContainerDisabled}>
        <LotacaoPicker
          selectedValue={filiado?.lotacao || 'SEDE'}
          onValueChange={(itemValue) => setFiliado(f => f ? { ...f, lotacao: itemValue } : null)}
          enabled={isEditing}
        />
      </View>

      <Text style={styles.label}>Situação Funcional</Text>
      <View style={isEditing ? styles.pickerContainer : styles.pickerContainerDisabled}>
        <Picker
          selectedValue={normalizeSituacaoFuncional(filiado?.situacao_funcional || filiado?.situacao)}
          onValueChange={(itemValue) => setFiliado(f => f ? { ...f, situacao_funcional: itemValue } : null)}
          enabled={isEditing}
          style={!isEditing ? { color: '#999' } : undefined}
        >
          <Picker.Item label="Ativo" value="ATIVO" />
          <Picker.Item label="Veterano" value="VETERANO" />
          <Picker.Item label="Pensionista" value="PENSIONISTA" />
        </Picker>
      </View>

      <Text style={styles.label}>Perfil de Acesso</Text>
      {isGestao ? (
        <View style={canChangeProfile ? styles.pickerContainer : styles.pickerContainerDisabled}>
          <Picker
            selectedValue={filiado?.perfil_acesso}
            onValueChange={(val) => setFiliado(f => f ? { ...f, perfil_acesso: val } : null)}
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
          value={filiado?.perfil_acesso || ''}
          editable={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
});

export default LotacaoCard;
