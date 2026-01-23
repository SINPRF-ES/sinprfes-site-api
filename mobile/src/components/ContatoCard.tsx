// src/components/ContatoCard.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Filiado } from '../types/filiado';
import { formatTelefone, onlyDigits, formatCpf } from '../shared/format/formatters';
import { toBrazilianDate, formatDateToDdMmYyyy, toISODate, calculateAgeBreakdown } from '../utils/date';

interface Props {
  filiado: Filiado | null;
  setFiliado: React.Dispatch<React.SetStateAction<Filiado | null>>;
  isEditing?: boolean;
  hideTitle?: boolean;
}

const ContatoCard: React.FC<Props> = ({ filiado, setFiliado, isEditing = false, hideTitle = false }) => {
  const handlePhoneChange = (field: 'telefone1' | 'telefone2', value: string) => {
    const digits = onlyDigits(value);
    setFiliado(f => (f ? { ...f, [field]: digits } : null));
  };

  return (
    <View style={styles.card}>
      {!hideTitle && <Text style={styles.cardTitle}>Dados Pessoais</Text>}

      <Text style={styles.label}>Nome Completo</Text>
      <TextInput
        style={isEditing ? styles.input : styles.inputDisabled}
        value={filiado?.nome || ''}
        onChangeText={(text) => setFiliado(f => f ? { ...f, nome: text } : null)}
        placeholder="Nome completo"
        editable={isEditing}
      />

      <Text style={styles.label}>CPF</Text>
      <TextInput
        style={isEditing ? styles.input : styles.inputDisabled}
        value={formatCpf(filiado?.cpf || '')}
        onChangeText={(text) => setFiliado(f => f ? { ...f, cpf: onlyDigits(text).slice(0, 11) } : null)}
        placeholder="000.000.000-00"
        keyboardType="numeric"
        maxLength={14}
        editable={isEditing}
      />
      <Text style={styles.label}>Data de Nascimento</Text>
      <TextInput
        style={isEditing ? styles.input : styles.inputDisabled}
        value={filiado?.data_nascimento ? toBrazilianDate(filiado.data_nascimento) : ''}
        onChangeText={(text) => {
          const formatted = formatDateToDdMmYyyy(text);
          const isoDate = toISODate(formatted);
          setFiliado(f => f ? { ...f, data_nascimento: isoDate || formatted } : null);
        }}
        placeholder="DD/MM/AAAA"
        keyboardType="numeric"
        maxLength={10}
        editable={isEditing}
      />

      <Text style={styles.label}>Idade</Text>
      <TextInput
        style={styles.inputDisabled}
        value={calculateAgeBreakdown(filiado?.data_nascimento || null)}
        editable={false}
      />

      <Text style={styles.label}>Telefone 1</Text>
      <TextInput
        style={styles.input}
        value={formatTelefone(filiado?.telefone1 || '')}
        onChangeText={(text) => handlePhoneChange('telefone1', text)}
        placeholder="(00) 00000-0000"
        keyboardType="phone-pad"
        maxLength={15} // (xx) xxxxx-xxxx
      />
      <Text style={styles.label}>Telefone 2</Text>
      <TextInput
        style={styles.input}
        value={formatTelefone(filiado?.telefone2 || '')}
        onChangeText={(text) => handlePhoneChange('telefone2', text)}
        placeholder="Opcional"
        keyboardType="phone-pad"
        maxLength={15}
      />
      <Text style={styles.label}>Email 1</Text>
      <TextInput
        style={styles.input}
        value={filiado?.email1 || ''}
        onChangeText={(text) => setFiliado(f => f ? { ...f, email1: text } : null)}
        placeholder="seu@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Text style={styles.label}>Email 2</Text>
      <TextInput
        style={styles.input}
        value={filiado?.email2 || ''}
        onChangeText={(text) => setFiliado(f => f ? { ...f, email2: text } : null)}
        placeholder="Opcional"
        keyboardType="email-address"
        autoCapitalize="none"
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
});

export default ContatoCard;
