// src/components/DependentesCard.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Filiado } from '../types/filiado';
import { formatCPF, sanitizeDigits, formatISOToBR, parseBRToISO, formatDate } from '../utils/masks';

// Subcomponente para cada item de dependente
const DependenteItem = ({ filiado, setFiliado, index }) => {
  const [dataNascimento, setDataNascimento] = useState('');

  // Sincroniza o estado local da data com o estado global do filiado
  useEffect(() => {
    const isoDate = filiado?.[`dep${index}_data_nascimento`];
    setDataNascimento(formatISOToBR(isoDate));
  }, [filiado?.[`dep${index}_data_nascimento`]]);

  const handleDateChange = (text: string) => {
    const formatted = formatDate(text);
    setDataNascimento(formatted);

    // Atualiza o estado global com o formato ISO
    const isoDate = parseBRToISO(formatted);
    setFiliado(f => {
      if (!f) return null;
      // Só atualiza se a data for válida ou nula, para não enviar lixo
      if (isoDate || formatted === '') {
        return { ...f, [`dep${index}_data_nascimento`]: isoDate };
      }
      return f;
    });
  };

  const handleDependentChange = (field: string, value: string, isDigitOnly = false) => {
    const finalValue = isDigitOnly ? sanitizeDigits(value) : value;
    setFiliado(f => {
      if (!f) return null;
      return { ...f, [`dep${index}_${field}`]: finalValue };
    });
  };

  return (
    <View style={styles.dependenteBox}>
      <Text style={styles.dependenteTitle}>Dependente {index}</Text>
      <TextInput
        style={styles.input}
        placeholder="Nome Completo do Dependente"
        value={filiado?.[`dep${index}_nome`] || ''}
        onChangeText={(text) => handleDependentChange('nome', text)}
      />
      <TextInput
        style={styles.input}
        placeholder="CPF do Dependente"
        value={formatCPF(filiado?.[`dep${index}_cpf`] || '')}
        onChangeText={(text) => handleDependentChange('cpf', text, true)}
        keyboardType="numeric"
        maxLength={14}
      />
      {/* TODO: Substituir por um DatePicker para melhor UX */}
      <TextInput
        style={styles.input}
        placeholder="Data de Nascimento (dd/MM/yyyy)"
        value={dataNascimento}
        onChangeText={handleDateChange}
        keyboardType="numeric"
        maxLength={10} // dd/MM/yyyy
      />
      <TextInput
        style={styles.input}
        placeholder="Parentesco"
        value={filiado?.[`dep${index}_parentesco`] || ''}
        onChangeText={(text) => handleDependentChange('parentesco', text)}
      />
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
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
});

export default DependentesCard;
