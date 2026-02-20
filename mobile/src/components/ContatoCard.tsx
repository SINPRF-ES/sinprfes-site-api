// src/components/ContatoCard.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { PickerSafe } from './PickerSafe';
import { Filiado } from '../types/filiado';
import { formatTelefone, onlyDigits, formatCpf } from '../shared/format/formatters';
import { toBrazilianDate, formatDateToDdMmYyyy, toISODate, calculateAgeBreakdown } from '../utils/date';

interface Props {
  filiado: Filiado | null;
  setFiliado: React.Dispatch<React.SetStateAction<Filiado | null>>;
  isEditing?: boolean;
  isManagement?: boolean;
  hideTitle?: boolean;
}

const ContatoCard: React.FC<Props> = ({
  filiado,
  setFiliado,
  isEditing = false,
  isManagement = false,
  hideTitle = false
}) => {
  const handlePhoneChange = (field: 'telefone1' | 'telefone2', value: string) => {
    const digits = onlyDigits(value);
    setFiliado(f => (f ? { ...f, [field]: digits } : null));
  };

  return (
    <View style={styles.card}>
      {!hideTitle && <Text style={styles.cardTitle}>Dados Pessoais</Text>}

      <Text style={styles.label}>Nome Completo</Text>
      <TextInput
        style={isManagement ? styles.input : styles.inputDisabled}
        value={filiado?.nome || ''}
        onChangeText={(text) => setFiliado(f => f ? { ...f, nome: text } : null)}
        placeholder="Nome completo"
        editable={isManagement}
        accessibilityLabel="Nome Completo"
        textContentType="name"
        autoComplete="name"
      />

      {isManagement ? (
        <PickerSafe
          label="Sexo"
          selectedValue={filiado?.sexo || ''}
          onValueChange={(val) => setFiliado(f => f ? { ...f, sexo: val as any } : null)}
          items={[
            { label: "-", value: "" },
            { label: "♂️ Masculino", value: "M" },
            { label: "♀️ Feminino", value: "F" },
          ]}
        />
      ) : (
        <Text style={styles.inputDisabled}>
          {filiado?.sexo === 'M' ? '♂️ Masculino' : (filiado?.sexo === 'F' ? '♀️ Feminino' : '—')}
        </Text>
      )}

      <Text style={styles.label}>CPF</Text>
      <TextInput
        style={isManagement ? styles.input : styles.inputDisabled}
        value={formatCpf(filiado?.cpf || '')}
        onChangeText={(text) => setFiliado(f => f ? { ...f, cpf: onlyDigits(text).slice(0, 11) } : null)}
        placeholder="000.000.000-00"
        keyboardType="numeric"
        maxLength={14}
        editable={isManagement}
        accessibilityLabel="CPF"
        textContentType="username"
        autoComplete="username"
      />

      <Text style={styles.label}>Matrícula (SIAPE)</Text>
      <TextInput
        style={isManagement ? styles.input : styles.inputDisabled}
        value={isManagement ? (filiado?.siape || '') : (filiado?.siape || '—')}
        onChangeText={(text) => setFiliado(f => f ? { ...f, siape: onlyDigits(text).slice(0, 7) } : null)}
        placeholder="6 ou 7 dígitos"
        keyboardType="numeric"
        maxLength={7}
        editable={isManagement}
        accessibilityLabel="Matrícula (SIAPE)"
      />
      <Text style={styles.label}>Data de Nascimento</Text>
      <TextInput
        style={isManagement ? styles.input : styles.inputDisabled}
        value={filiado?.data_nascimento ? toBrazilianDate(filiado.data_nascimento) : ''}
        onChangeText={(text) => {
          const formatted = formatDateToDdMmYyyy(text);
          const isoDate = toISODate(formatted);
          setFiliado(f => f ? { ...f, data_nascimento: isoDate || formatted } : null);
        }}
        placeholder="DD/MM/AAAA"
        keyboardType="numeric"
        maxLength={10}
        editable={isManagement}
        accessibilityLabel="Data de Nascimento"
        textContentType="birthdate"
      />

      <Text style={styles.label}>Idade</Text>
      <TextInput
        style={styles.inputDisabled}
        value={calculateAgeBreakdown(filiado?.data_nascimento || null)}
        editable={false}
        accessibilityLabel="Idade"
      />

      <Text style={styles.label}>Telefone 1</Text>
      <TextInput
        style={isEditing ? styles.input : styles.inputDisabled}
        value={isEditing ? formatTelefone(filiado?.telefone1 || '') : (formatTelefone(filiado?.telefone1) || '—')}
        onChangeText={(text) => handlePhoneChange('telefone1', text)}
        placeholder="(00) 00000-0000"
        keyboardType="phone-pad"
        maxLength={15} // (xx) xxxxx-xxxx
        editable={isEditing}
        accessibilityLabel="Telefone 1"
        textContentType="telephoneNumber"
        autoComplete="tel"
      />
      <Text style={styles.label}>Telefone 2</Text>
      <TextInput
        style={isEditing ? styles.input : styles.inputDisabled}
        value={isEditing ? formatTelefone(filiado?.telefone2 || '') : (formatTelefone(filiado?.telefone2) || '—')}
        onChangeText={(text) => handlePhoneChange('telefone2', text)}
        placeholder="Opcional"
        keyboardType="phone-pad"
        maxLength={15}
        editable={isEditing}
        accessibilityLabel="Telefone 2"
        textContentType="telephoneNumber"
        autoComplete="tel"
      />
      <Text style={styles.label}>Email 1</Text>
      <TextInput
        style={styles.input}
        value={filiado?.email1 || ''}
        onChangeText={(text) => setFiliado(f => f ? { ...f, email1: text } : null)}
        placeholder="seu@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        accessibilityLabel="Email 1"
        textContentType="emailAddress"
        autoComplete="email"
      />
      <Text style={styles.label}>Email 2</Text>
      <TextInput
        style={styles.input}
        value={filiado?.email2 || ''}
        onChangeText={(text) => setFiliado(f => f ? { ...f, email2: text } : null)}
        placeholder="Opcional"
        keyboardType="email-address"
        autoCapitalize="none"
        accessibilityLabel="Email 2"
        textContentType="emailAddress"
        autoComplete="email"
      />
    </View>
  );
};

const styles = StyleSheet.create({
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
    width: '100%',
  },
});

export default ContatoCard;
