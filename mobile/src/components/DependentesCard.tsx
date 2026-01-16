// src/components/DependentesCard.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Filiado } from '../types/filiado';
import { formatCPF, sanitizeDigits, formatDate } from '../utils/masks';
import { toBrazilianDate } from '../utils/date';


// Subcomponente para cada item de dependente
const DependenteItem = ({ filiado, setFiliado, index }) => {

  const handleDateChange = (text: string) => {
    const formatted = formatDate(text); // Aplica a máscara DD/MM/YYYY
    // A data no estado é sempre mantida no formato da UI (DD/MM/YYYY)
    // O `toISODate` será aplicado apenas no momento do submit em `MeusDadosScreen`
    setFiliado(prevState => {
        if (!prevState) return null;
        return {
            ...prevState,
            [`dep${index}_data_nascimento`]: formatted,
        };
    });
  };

  const handleDependentChange = (field: string, value: string, isDigitOnly = false) => {
    let finalValue = isDigitOnly ? sanitizeDigits(value) : value;
    if (field === 'cpf') {
      finalValue = finalValue.slice(0, 11);
    }
    setFiliado(prevState => {
        if (!prevState) return null;
        return {
            ...prevState,
            [`dep${index}_${field}`]: finalValue,
        };
    });
  };

  const parentescoOptions = [
    { label: 'Selecione...', value: '' },
    { label: 'Filha(o) / enteada(o)', value: 'FILHO_ENTEADO' },
    { label: 'Cônjuge / companheira(o)', value: 'CONJUGE_COMPANHEIRO' },
    { label: 'Pai / mãe', value: 'PAI_MAE' },
    { label: 'Irmã(o)', value: 'IRMAO' },
    { label: 'Outro', value: 'OUTRO' },
  ];

  const currentParentescoValue = filiado?.[`dep${index}_parentesco`] || '';
  const isStandardOption = parentescoOptions.some(opt => opt.value === currentParentescoValue && opt.value !== '');

  const [parentescoMode, setParentescoMode] = useState(isStandardOption || currentParentescoValue === '' ? currentParentescoValue : 'OUTRO');

  const handleParentescoChange = (mode) => {
    setParentescoMode(mode);
    const newValue = mode === 'OUTRO' ? '' : mode;
    handleDependentChange('parentesco', newValue);
  };

  return (
    <View style={styles.dependenteBox}>
      <Text style={styles.dependenteTitle}>Dependente {index}</Text>

      <Text style={styles.label}>Nome</Text>
      <TextInput
        style={styles.input}
        placeholder="Nome completo"
        value={filiado?.[`dep${index}_nome`] || ''}
        onChangeText={(text) => handleDependentChange('nome', text)}
      />

      <Text style={styles.label}>CPF</Text>
      <TextInput
        style={styles.input}
        placeholder="apenas números"
        value={formatCPF(filiado?.[`dep${index}_cpf`] || '')}
        onChangeText={(text) => handleDependentChange('cpf', text, true)}
        keyboardType="numeric"
        maxLength={14}
      />

      <Text style={styles.label}>Data de Nascimento</Text>
      <TextInput
        style={styles.input}
        placeholder="DD/MM/AAAA"
        value={toBrazilianDate(filiado?.[`dep${index}_data_nascimento`])}
        onChangeText={handleDateChange}
        keyboardType="numeric"
        maxLength={10}
      />

      <Text style={styles.label}>Parentesco</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={parentescoMode}
          onValueChange={handleParentescoChange}
        >
          {parentescoOptions.map(opt => (
            <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
          ))}
        </Picker>
      </View>

      {parentescoMode === 'OUTRO' && (
        <>
          <Text style={styles.label}>Informe o parentesco</Text>
          <TextInput
            style={styles.input}
            placeholder="Informe o parentesco"
            value={currentParentescoValue}
            onChangeText={(text) => handleDependentChange('parentesco', text)}
          />
        </>
      )}
    </View>
  );
};

const DependentesCard: React.FC<{filiado: Filiado | null, setFiliado: any}> = ({ filiado, setFiliado }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Dependentes</Text>
      {[1, 2, 3, 4, 5].map(i => (
        <DependenteItem key={i} index={i} filiado={filiado} setFiliado={setFiliado} />
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
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 15,
  },
});

export default DependentesCard;
