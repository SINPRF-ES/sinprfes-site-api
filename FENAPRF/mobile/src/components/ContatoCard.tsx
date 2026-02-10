// src/components/ContatoCard.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import CanonicalPicker from './CanonicalPicker';
import { User } from '../types/user';
import { formatTelefone, onlyDigits, formatCpf, formatData } from '../utils/format';
import { toBrazilianDate, formatDateToDdMmYyyy, toISODate, calculateAgeBreakdown } from '../utils/date';

interface Props {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  isEditing?: boolean;
  isManagement?: boolean;
  hideTitle?: boolean;
}

const ContatoCard: React.FC<Props> = ({
  user,
  setUser,
  isEditing = false,
  isManagement = false,
  hideTitle = false
}) => {
  const handlePhoneChange = (field: 'telefone1' | 'telefone2', value: string) => {
    const digits = onlyDigits(value);
    setUser(f => (f ? { ...f, [field]: digits } : null));
  };

  return (
    <View style={styles.card}>
      {!hideTitle && <Text style={styles.cardTitle}>Dados Pessoais</Text>}

      <Text style={styles.label}>Nome Completo</Text>
      <TextInput
        style={isManagement ? styles.input : styles.inputDisabled}
        value={user?.name || ''}
        onChangeText={(text) => setUser(f => f ? { ...f, name: text } : null)}
        placeholder="Nome completo"
        editable={isManagement}
        accessibilityLabel="Nome Completo"
        textContentType="name"
        autoComplete="name"
      />

      <Text style={styles.label}>Sexo</Text>
      {isManagement ? (
        <CanonicalPicker
          selectedValue={user?.sexo || ''}
          onValueChange={(val) => setUser(f => f ? { ...f, sexo: val as any } : null)}
          wrapperStyle={styles.pickerWrapper}
          placeholder="-"
          items={[
            { label: '♂️ Masculino', value: 'M' },
            { label: '♀️ Feminino', value: 'F' }
          ]}
        />
      ) : (
        <Text style={styles.inputDisabled}>
          {user?.sexo === 'M' ? '♂️ Masculino' : (user?.sexo === 'F' ? '♀️ Feminino' : '—')}
        </Text>
      )}

      <Text style={styles.label}>CPF</Text>
      <TextInput
        style={isManagement ? styles.input : styles.inputDisabled}
        value={formatCpf(user?.cpf || '')}
        onChangeText={(text) => setUser(f => f ? { ...f, cpf: onlyDigits(text).slice(0, 11) } : null)}
        placeholder="000.000.000-00"
        keyboardType="numeric"
        maxLength={14}
        editable={isManagement}
        accessibilityLabel="CPF"
        textContentType="username"
        autoComplete="username"
      />

      <Text style={styles.label}>Data de Nascimento</Text>
      <TextInput
        style={isManagement ? styles.input : styles.inputDisabled}
        value={user?.data_nascimento?.includes('-') ? toBrazilianDate(user.data_nascimento) : formatData(user?.data_nascimento)}
        onChangeText={(text) => {
          const digits = onlyDigits(text);
          if (digits.length <= 8) {
            setUser(f => f ? { ...f, data_nascimento: digits } : null);
          }
        }}
        onBlur={() => {
          if (user?.data_nascimento && user.data_nascimento.length === 8) {
            const isoDate = toISODate(formatData(user.data_nascimento));
            setUser(f => f ? { ...f, data_nascimento: isoDate || user.data_nascimento } : null);
          }
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
        value={calculateAgeBreakdown(user?.data_nascimento || null)}
        editable={false}
        accessibilityLabel="Idade"
      />

      <Text style={styles.label}>Telefone 1</Text>
      <TextInput
        style={isEditing ? styles.input : styles.inputDisabled}
        value={isEditing ? formatTelefone(user?.telefone1 || '') : (formatTelefone(user?.telefone1) || '—')}
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
        value={isEditing ? formatTelefone(user?.telefone2 || '') : (formatTelefone(user?.telefone2) || '—')}
        onChangeText={(text) => handlePhoneChange('telefone2', text)}
        placeholder="Opcional"
        keyboardType="phone-pad"
        maxLength={15}
        editable={isEditing}
        accessibilityLabel="Telefone 2"
        textContentType="telephoneNumber"
        autoComplete="tel"
      />
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={isEditing ? styles.input : styles.inputDisabled}
        value={user?.email || ''}
        onChangeText={(text) => setUser(f => f ? { ...f, email: text } : null)}
        placeholder="seu@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        editable={isEditing}
        accessibilityLabel="Email"
        textContentType="emailAddress"
        autoComplete="email"
      />
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
});

export default ContatoCard;
