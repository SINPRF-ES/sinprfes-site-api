// src/components/VinculoCard.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { User } from '../types/user';
import { formatData, onlyDigits } from '../shared/format/formatters';
import { toISODate, toBrazilianDate } from '../utils/date';
import { ROLES, UFS, CARGOS_CONSELHO, CARGOS_DIRETORIA } from '../utils/userUtils';
import PickerWrapper from './PickerWrapper';

interface Props {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  isGestao?: boolean;
  isSelf?: boolean;
  currentUserProfile?: string;
}

const VinculoCard: React.FC<Props> = ({
  user,
  setUser,
  isGestao = false,
  isSelf = false,
  currentUserProfile = ''
}) => {
  if (!isGestao) return null;

  const canChangeAdmin = currentUserProfile === ROLES.ADMIN;
  const targetIsAdmin = user?.perfil_acesso === ROLES.ADMIN;

  const handleDateChange = (field: 'cargo_mandato_inicio' | 'cargo_mandato_fim', text: string) => {
    const digits = onlyDigits(text);
    if (digits.length <= 8) {
      setUser(f => (f ? { ...f, [field]: digits } : null));
    }
  };

  const handleDateBlur = (field: 'cargo_mandato_inicio' | 'cargo_mandato_fim') => {
    const val = (user as any)?.[field];
    if (val && val.length === 8) {
      const isoDate = toISODate(formatData(val));
      setUser(f => (f ? { ...f, [field]: isoDate || val } : null));
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Vínculo e Mandato</Text>

      <Text style={styles.label}>Perfil de Acesso</Text>
      <PickerWrapper style={styles.pickerWrapper}>
        <Picker
          enabled={!isSelf && (canChangeAdmin || !targetIsAdmin)}
          selectedValue={user?.perfil_acesso || ''}
          onValueChange={(val) => setUser(f => (f ? { ...f, perfil_acesso: val as any } : null))}
          style={styles.picker}
        >
          <Picker.Item label="Conselheiro" value={ROLES.CONSELHEIRO} />
          <Picker.Item label="Colaborador" value={ROLES.COLABORADOR} />
          <Picker.Item label="Diretoria" value={ROLES.DIRETORIA} />
          {canChangeAdmin && <Picker.Item label="Administrador" value={ROLES.ADMIN} />}
        </Picker>
      </PickerWrapper>

      <Text style={styles.label}>UF de Atuação</Text>
      <PickerWrapper style={styles.pickerWrapper}>
        <Picker
          enabled={isGestao}
          selectedValue={user?.uf || ''}
          onValueChange={(val) => setUser(f => (f ? { ...f, uf: val as any } : null))}
          style={styles.picker}
        >
          <Picker.Item label="Selecione..." value="" />
          {UFS.map(uf => (
            <Picker.Item key={uf} label={uf} value={uf} />
          ))}
        </Picker>
      </PickerWrapper>

      <Text style={styles.label}>Cargo</Text>
      <PickerWrapper style={styles.pickerWrapper}>
        <Picker
          enabled={isGestao}
          selectedValue={user?.cargo || ''}
          onValueChange={(val) => setUser(f => (f ? { ...f, cargo: val as any } : null))}
          style={styles.picker}
        >
          <Picker.Item label="Selecione um cargo..." value="" />
          <Picker.Item label="-- CONSELHO --" value="" enabled={false} />
          {CARGOS_CONSELHO.map(c => <Picker.Item key={c} label={c} value={c} />)}
          <Picker.Item label="-- DIRETORIA --" value="" enabled={false} />
          {CARGOS_DIRETORIA.map(c => <Picker.Item key={c} label={c} value={c} />)}
        </Picker>
      </PickerWrapper>

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Início Mandato</Text>
          <TextInput
            editable={isGestao}
            style={isGestao ? styles.input : styles.inputDisabled}
            value={formatData(user?.cargo_mandato_inicio)}
            onChangeText={(t) => handleDateChange('cargo_mandato_inicio', t)}
            onBlur={() => handleDateBlur('cargo_mandato_inicio')}
            placeholder="DD/MM/AAAA"
            keyboardType="numeric"
            maxLength={10}
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Fim Mandato</Text>
          <TextInput
            editable={isGestao}
            style={isGestao ? styles.input : styles.inputDisabled}
            value={formatData(user?.cargo_mandato_fim)}
            onChangeText={(t) => handleDateChange('cargo_mandato_fim', t)}
            onBlur={() => handleDateBlur('cargo_mandato_fim')}
            placeholder="DD/MM/AAAA"
            keyboardType="numeric"
            maxLength={10}
          />
        </View>
      </View>

      {/* SEGUNDO VÍNCULO */}
      <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#eee' }}>
        <Text style={[styles.cardTitle, { fontSize: 16 }]}>Segundo Vínculo (Opcional)</Text>

        <Text style={styles.label}>Perfil de Acesso (2º)</Text>
        <PickerWrapper style={styles.pickerWrapper}>
            <Picker
                enabled={!isSelf}
                selectedValue={user?.perfil_acesso2 || ''}
                onValueChange={(val) => setUser(f => (f ? { ...f, perfil_acesso2: val as any } : null))}
                style={styles.picker}
            >
                <Picker.Item label="Nenhum" value="" />
                <Picker.Item label="Conselheiro" value={ROLES.CONSELHEIRO} />
                <Picker.Item label="Diretoria" value={ROLES.DIRETORIA} />
            </Picker>
        </PickerWrapper>

        {user?.perfil_acesso2 ? (
            <>
                <Text style={styles.label}>UF (2º)</Text>
                <PickerWrapper style={styles.pickerWrapper}>
                    <Picker
                        enabled={isGestao}
                        selectedValue={user?.uf2 || ''}
                        onValueChange={(val) => setUser(f => (f ? { ...f, uf2: val as any } : null))}
                        style={styles.picker}
                    >
                        <Picker.Item label="Selecione..." value="" />
                        {UFS.map(uf => (
                            <Picker.Item key={uf} label={uf} value={uf} />
                        ))}
                    </Picker>
                </PickerWrapper>

                <Text style={styles.label}>Cargo (2º)</Text>
                <PickerWrapper style={styles.pickerWrapper}>
                    <Picker
                        enabled={isGestao}
                        selectedValue={user?.cargo2 || ''}
                        onValueChange={(val) => setUser(f => (f ? { ...f, cargo2: val as any } : null))}
                        style={styles.picker}
                    >
                        <Picker.Item label="Selecione um cargo..." value="" />
                        {user.perfil_acesso2 === ROLES.CONSELHEIRO ?
                            CARGOS_CONSELHO.map(c => <Picker.Item key={c} label={c} value={c} />) :
                            CARGOS_DIRETORIA.map(c => <Picker.Item key={c} label={c} value={c} />)
                        }
                    </Picker>
                </PickerWrapper>
            </>
        ) : null}
      </View>
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
    color: '#003366',
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
    backgroundColor: '#fff',
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
  pickerWrapper: {
    marginBottom: 15,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
});

export default VinculoCard;
