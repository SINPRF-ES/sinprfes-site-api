// src/components/DependentesCard.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Filiado } from '../types/filiado';

interface Props {
  filiado: Filiado | null;
  setFiliado: React.Dispatch<React.SetStateAction<Filiado | null>>;
}

const DependentesCard: React.FC<Props> = ({ filiado, setFiliado }) => {
  const handleDependentChange = (index: number, field: string, value: string) => {
    setFiliado(f => {
      if (!f) return null;
      const newFiliado = { ...f };
      newFiliado[`dep${index}_${field}`] = value;
      return newFiliado;
    });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Dependentes</Text>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={styles.dependenteBox}>
          <Text style={styles.dependenteTitle}>Dependente {i}</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome Completo do Dependente"
            value={filiado?.[`dep${i}_nome`] || ''}
            onChangeText={(text) => handleDependentChange(i, 'nome', text)}
          />
          <TextInput
            style={styles.input}
            placeholder="CPF do Dependente"
            value={filiado?.[`dep${i}_cpf`] || ''}
            onChangeText={(text) => handleDependentChange(i, 'cpf', text)}
            keyboardType="numeric"
          />
          {/* TODO: Substituir por um DatePicker para melhor UX */}
          <TextInput
            style={styles.input}
            placeholder="Data de Nascimento (AAAA-MM-DD)"
            value={filiado?.[`dep${i}_data_nascimento`] || ''}
            onChangeText={(text) => handleDependentChange(i, 'data_nascimento', text)}
          />
          <TextInput
            style={styles.input}
            placeholder="Parentesco"
            value={filiado?.[`dep${i}_parentesco`] || ''}
            onChangeText={(text) => handleDependentChange(i, 'parentesco', text)}
          />
        </View>
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
