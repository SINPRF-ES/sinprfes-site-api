// src/components/VinculoCard.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { User } from '../types/user';
import { formatData, onlyDigits } from '../utils/format';
import { toISODate, toBrazilianDate } from '../utils/date';
import { ROLES, UFS, CARGOS_CONSELHO, CARGOS_DIRETORIA } from '../utils/user';
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

  const perfil = (user?.perfil_acesso as string) || '';
  const isConselheiro = perfil === ROLES.CONSELHEIRO;
  const isDiretoria = perfil === ROLES.DIRETORIA;
  const isColaborador = perfil === ROLES.COLABORADOR;
  const isAdmin = perfil === ROLES.ADMIN;

  const showCargo = isConselheiro || isDiretoria;
  const showUF = isConselheiro;
  const showMandato = isConselheiro || isDiretoria;
  const showSegundoVinculo = isConselheiro || isDiretoria;

  // Regra FENAPRF: ADMIN e COLABORADOR não mostram UF de Atuação
  const showUFSection = isConselheiro || isDiretoria;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Vínculo e Mandato</Text>

      <Text style={styles.label}>Perfil de Acesso</Text>
      <PickerWrapper style={styles.pickerWrapper}>
        <Picker
          enabled={!isSelf && (canChangeAdmin || !targetIsAdmin)}
          selectedValue={user?.perfil_acesso || ''}
          onValueChange={(val) => {
              setUser(f => {
                  if (!f) return null;
                  const newProfile = val as any;
                  const newState = { ...f, perfil_acesso: newProfile };

                  // Limpeza e regras automáticas de UF por perfil
                  if (newProfile === ROLES.ADMIN || newProfile === ROLES.COLABORADOR || newProfile === ROLES.DIRETORIA) {
                      newState.uf = 'BR';
                  } else if (newProfile === ROLES.CONSELHEIRO && f.uf === 'BR') {
                      newState.uf = '';
                  }

                  // Limpeza de campos não aplicáveis
                  if (newProfile === ROLES.ADMIN || newProfile === ROLES.COLABORADOR) {
                      newState.cargo = newProfile === ROLES.ADMIN ? 'Administrador' : 'Colaborador';
                      newState.cargo_mandato_inicio = '';
                      newState.cargo_mandato_fim = '';
                      newState.perfil_acesso2 = '';
                      newState.cargo2 = '';
                      newState.uf2 = '';
                  } else if (newProfile === ROLES.CONSELHEIRO || newProfile === ROLES.DIRETORIA) {
                      newState.cargo = '';
                  } else {
                      // Sem Perfil
                      newState.cargo = '';
                      newState.cargo_mandato_inicio = '';
                      newState.cargo_mandato_fim = '';
                      newState.perfil_acesso2 = '';
                      newState.cargo2 = '';
                      newState.uf2 = '';
                      newState.uf = '';
                  }

                  return newState;
              });
          }}
          style={styles.picker}
        >
          <Picker.Item label="Sem acesso" value="" />
          <Picker.Item label="Conselheiro" value={ROLES.CONSELHEIRO} />
          <Picker.Item label="Colaborador" value={ROLES.COLABORADOR} />
          <Picker.Item label="Diretoria" value={ROLES.DIRETORIA} />
          {canChangeAdmin && <Picker.Item label="Administrador" value={ROLES.ADMIN} />}
        </Picker>
      </PickerWrapper>

      {showCargo && (
        <>
          <Text style={styles.label}>Cargo</Text>
          <PickerWrapper style={styles.pickerWrapper}>
            <Picker
              enabled={isGestao}
              selectedValue={user?.cargo || ''}
              onValueChange={(val) => setUser(f => (f ? { ...f, cargo: val === '' ? null : (val as any) } : null))}
              style={styles.picker}
            >
              <Picker.Item label="Sem cargo" value="" />
              {isConselheiro && (
                CARGOS_CONSELHO.map(c => <Picker.Item key={c} label={c} value={c} />)
              )}
              {isDiretoria && (
                CARGOS_DIRETORIA.map(c => <Picker.Item key={c} label={c} value={c} />)
              )}
            </Picker>
          </PickerWrapper>
        </>
      )}

      {showUFSection && (
        showUF ? (
            <>
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
            </>
        ) : (
            <View style={{ marginBottom: 15 }}>
                <Text style={styles.label}>UF de Atuação</Text>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>{user?.uf || 'BR'}</Text>
            </View>
        )
      )}

      {showMandato && (
        <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Início Mandato</Text>
          <TextInput
            editable={isGestao}
            style={isGestao ? styles.input : styles.inputDisabled}
            value={user?.cargo_mandato_inicio?.includes('-') ? toBrazilianDate(user.cargo_mandato_inicio) : formatData(user?.cargo_mandato_inicio)}
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
            value={user?.cargo_mandato_fim?.includes('-') ? toBrazilianDate(user.cargo_mandato_fim) : formatData(user?.cargo_mandato_fim)}
            onChangeText={(t) => handleDateChange('cargo_mandato_fim', t)}
            onBlur={() => handleDateBlur('cargo_mandato_fim')}
            placeholder="DD/MM/AAAA"
            keyboardType="numeric"
            maxLength={10}
          />
        </View>
      </View>
      )}

      {/* SEGUNDO VÍNCULO */}
      {showSegundoVinculo && (
        <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#eee' }}>
            <Text style={[styles.cardTitle, { fontSize: 16 }]}>Segundo Vínculo (Opcional)</Text>

            <Text style={styles.label}>Perfil de Acesso (2º)</Text>
            <PickerWrapper style={styles.pickerWrapper}>
                <Picker
                    enabled={!isSelf}
                    selectedValue={user?.perfil_acesso2 || ''}
                    onValueChange={(val) => {
                        setUser(f => {
                            if (!f) return null;
                            const newP2 = val as any;
                            const newState = { ...f, perfil_acesso2: newP2, cargo2: '' };
                            if (newP2 === ROLES.DIRETORIA) {
                                newState.uf2 = 'BR';
                            } else if (newP2 === ROLES.CONSELHEIRO) {
                                newState.uf2 = f.uf2 === 'BR' ? '' : f.uf2;
                            } else {
                                newState.uf2 = '';
                                newState.cargo2 = '';
                            }
                            return newState;
                        });
                    }}
                    style={styles.picker}
                >
                    <Picker.Item label="Nenhum" value="" />
                    <Picker.Item label="Conselheiro" value={ROLES.CONSELHEIRO} />
                    <Picker.Item label="Diretoria" value={ROLES.DIRETORIA} />
                </Picker>
            </PickerWrapper>

            {user?.perfil_acesso2 ? (
                <>
                    <Text style={styles.label}>Cargo (2º)</Text>
                    <PickerWrapper style={styles.pickerWrapper}>
                        <Picker
                            enabled={isGestao && !!user?.perfil_acesso2}
                            selectedValue={user?.cargo2 || ''}
                            onValueChange={(val) => setUser(f => (f ? { ...f, cargo2: val === '' ? null : (val as any) } : null))}
                            style={styles.picker}
                        >
                            <Picker.Item label="Sem cargo" value="" />
                            {user.perfil_acesso2 === ROLES.CONSELHEIRO && (
                                CARGOS_CONSELHO.map(c => <Picker.Item key={c} label={c} value={c} />)
                            )}
                            {user.perfil_acesso2 === ROLES.DIRETORIA && (
                                CARGOS_DIRETORIA.map(c => <Picker.Item key={c} label={c} value={c} />)
                            )}
                        </Picker>
                    </PickerWrapper>

                    {user.perfil_acesso2 === ROLES.CONSELHEIRO ? (
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
                        </>
                    ) : (
                        <View style={{ marginBottom: 15 }}>
                            <Text style={styles.label}>UF (2º)</Text>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>{user?.uf2 || 'BR'}</Text>
                        </View>
                    )}
                </>
            ) : null}
        </View>
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
