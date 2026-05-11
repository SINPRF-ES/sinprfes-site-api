// src/components/DependentesCard.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { PickerSafe } from './PickerSafe';
import { Filiado } from '../types/filiado';
import { formatCpf, onlyDigits } from '../shared/format/formatters';
import { formatDateToDdMmYyyy, toBrazilianDate, calculateAgeBreakdown } from '../utils/date';
import { PARENTESCO_OPTIONS } from '../shared/parentesco';
import type { Dispatch, SetStateAction } from 'react';

type DependenteIndex = 1 | 2 | 3 | 4 | 5;

type DependenteItemProps = {
  filiado: Filiado | null;
  setFiliado: Dispatch<SetStateAction<Filiado | null>>;
  index: DependenteIndex;
  isEditing?: boolean;
};

// Subcomponente para cada item de dependente
const DependenteItem = ({ filiado, setFiliado, index, isEditing = false }: DependenteItemProps) => {
  const handleDateChange = (text: string) => {
    const formatted = formatDateToDdMmYyyy(text);
    setFiliado((f: Filiado | null) => {
      if (!f) return null;
      return { ...f, [`dep${index}_data_nascimento`]: formatted };
    });
  };

  const handleDependentChange = (field: string, value: string, isDigitOnly = false) => {
    let finalValue = isDigitOnly ? onlyDigits(value) : value;
    if (field === 'cpf') {
      finalValue = finalValue.slice(0, 11);
    }
    setFiliado((f: Filiado | null) => {
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

  const handleParentescoChange = (mode: string) => {
    setFiliado((f: Filiado | null) => {
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

type DependentesCardProps = {
  filiado: Filiado | null;
  setFiliado: Dispatch<SetStateAction<Filiado | null>>;
  hideTitle?: boolean;
  cardStyle?: StyleProp<ViewStyle>;
  isEditing?: boolean;
};

const DependentesCard: React.FC<DependentesCardProps> = ({ filiado, setFiliado, hideTitle = false, cardStyle, isEditing = false }) => {
  return (
    <View style={[styles.card, cardStyle]}>
      {!hideTitle && <Text style={styles.cardTitle}>Dependentes</Text>}
      {([1, 2, 3, 4, 5] as const).map(i => (
        <DependenteItem key={i} index={i} filiado={filiado} setFiliado={setFiliado} isEditing={isEditing} />
      ))}
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
  dependenteBox: {
    borderColor: '#eee',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    backgroundColor: '#fafafa',
  },
  dependenteTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#003366',
    marginBottom: 12,
    textTransform: 'uppercase',
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
});

export default DependentesCard;
