// src/components/LotacaoCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Filiado } from '../types/filiado';
import LotacaoPicker from './LotacaoPicker'; // Importando o novo componente

interface Props {
  filiado: Filiado | null;
  setFiliado: React.Dispatch<React.SetStateAction<Filiado | null>>;
}

const LotacaoCard: React.FC<Props> = ({ filiado, setFiliado }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Lotação</Text>
      <Text style={styles.label}>Unidade de Lotação</Text>
      <LotacaoPicker
        selectedValue={filiado?.lotacao || 'SEDE'}
        onValueChange={(itemValue) => setFiliado(f => f ? { ...f, lotacao: itemValue } : null)}
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
});

export default LotacaoCard;
