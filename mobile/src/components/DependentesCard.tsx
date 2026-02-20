// src/components/DependentesCard.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { PickerSafe } from './PickerSafe';
import { Filiado } from '../types/filiado';
import { formatCpf, onlyDigits } from '../shared/format/formatters';
import { formatISOToBR, parseBRToISO, formatDateToDdMmYyyy, toBrazilianDate, calculateAgeBreakdown } from '../utils/date';
import { PARENTESCO_OPTIONS, normalizeParentesco } from '../shared/parentesco';

// Subcomponente para cada item de dependente
const DependenteItem = ({ filiado, setFiliado, index, isEditing = false }) => {
  const handleDateChange = (text: string) => {
    const formatted = formatDateToDdMmYyyy(text);
    setFiliado(f => {
      if (!f) return null;
      return { ...f, [`dep${index}_data_nascimento`]: formatted };
    });
  };

  const handleDependentChange = (field: string, value: string, isDigitOnly = false) => {
    let finalValue = isDigitOnly ? onlyDigits(value) : value;
    if (field === 'cpf') {
      finalValue = finalValue.slice(0, 11);
    }
    setFiliado(f => {
      if (!f) return null;
      return { ...f, [`dep${index}_${field}`]: finalValue };
    });
  };

  const parentescoOptions = [
    { label: 'Selecione...', value: '' },
    ...PARENTESCO_OPTIONS.map(opt => ({ label: opt.label, value: opt.value }))
  ];

  const parentescoValue = filiado?.[`dep${index}_parentesco`] || '';
  const parentescoOutroValue = filiado?.[`dep${index}_parentesco_outro`] || '';

  const handleParentescoChange = (mode) => {
    setFiliado(f => {
      if (!f) return null;
      return {
        ...f,
        [`dep${index}_parentesco`]: mode,
        [`dep${index}_parentesco_outro`]: mode === 'OUTRO' ? f[`dep${index}_parentesco_outro`] : null
      };
    });
  };

  return (
    <View style={styles.dependenteBox}>
      <Text style={styles.dependenteTitle}>Dependente {index}</Text>

      <Text style={styles.label}>Nome</Text>
      <TextInput
        style={isEditing ? styles.input : styles.inputDisabled}
        placeholder="Nome completo"
        value={filiado?.[`dep${index}_nome`] || ''}
        onChangeText={(text) => handleDependentChange('nome', text)}
        editable={isEditing}
        accessibilityLabel={`Nome do Dependente ${index}`}
      />

      <Text style={styles.label}>CPF</Text>
      <TextInput
        style={isEditing ? styles.input : styles.inputDisabled}
        placeholder="apenas números"
        value={formatCpf(filiado?.[`dep${index}_cpf`] || '')}
        onChangeText={(text) => handleDependentChange('cpf', text, true)}
        keyboardType="numeric"
        maxLength={14}
        editable={isEditing}
        accessibilityLabel={`CPF do Dependente ${index}`}
      />

      <Text style={styles.label}>Data de Nascimento</Text>
      <TextInput
        style={isEditing ? styles.input : styles.inputDisabled}
        placeholder="DD/MM/AAAA"
        value={toBrazilianDate(filiado?.[`dep${index}_data_nascimento`] || '')}
        onChangeText={handleDateChange}
        keyboardType="numeric"
        maxLength={10}
        editable={isEditing}
        accessibilityLabel={`Data de Nascimento do Dependente ${index}`}
      />

      <Text style={styles.label}>Idade</Text>
      <TextInput
        style={styles.inputDisabled}
        value={calculateAgeBreakdown(filiado?.[`dep${index}_data_nascimento`] || null)}
        editable={false}
        accessibilityLabel={`Idade do Dependente ${index}`}
      />

      <PickerSafe
        label="Parentesco"
        selectedValue={parentescoValue}
        onValueChange={handleParentescoChange}
        enabled={isEditing}
        items={parentescoOptions}
        pickerBoxStyle={!isEditing ? { backgroundColor: '#f0f0f0' } : undefined}
      />

      {parentescoValue === 'OUTRO' && (
        <>
          <Text style={styles.label}>Informe o parentesco</Text>
          <TextInput
            style={isEditing ? styles.input : styles.inputDisabled}
            placeholder="Informe o parentesco"
            value={parentescoOutroValue}
            onChangeText={(text) => handleDependentChange('parentesco_outro', text)}
            editable={isEditing}
            accessibilityLabel={`Outro parentesco do Dependente ${index}`}
          />
        </>
      )}
    </View>
  );
};

const DependentesCard: React.FC<{filiado: Filiado | null, setFiliado: any, hideTitle?: boolean, cardStyle?: any, isEditing?: boolean}> = ({ filiado, setFiliado, hideTitle = false, cardStyle = {}, isEditing = false }) => {
  return (
    <View style={[styles.card, cardStyle]}>
      {!hideTitle && <Text style={styles.cardTitle}>Dependentes</Text>}
      {[1, 2, 3, 4, 5].map(i => (
        <DependenteItem key={i} index={i} filiado={filiado} setFiliado={setFiliado} isEditing={isEditing} />
      ))}
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
  dependenteBox: {
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  dependenteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
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

export default DependentesCard;
