// src/components/LotacaoCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Filiado } from '../types/filiado';
import LotacaoPicker from './LotacaoPicker'; // Importando o novo componente

import { Picker } from '@react-native-picker/picker';

interface Props {
  filiado: Filiado | null;
  setFiliado: React.Dispatch<React.SetStateAction<Filiado | null>>;
  isEditing?: boolean;
}

const LotacaoCard: React.FC<Props> = ({ filiado, setFiliado, isEditing = false }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Lotação e Situação</Text>

      <Text style={styles.label}>Unidade de Lotação</Text>
      <View style={isEditing ? styles.pickerContainer : styles.pickerContainerDisabled}>
        <LotacaoPicker
          selectedValue={filiado?.lotacao || ''}
          onValueChange={(itemValue) => setFiliado(f => f ? { ...f, lotacao: itemValue } : null)}
          enabled={isEditing}
        />
      </View>

      <Text style={styles.label}>Situação Funcional</Text>
      <View style={isEditing ? styles.pickerContainer : styles.pickerContainerDisabled}>
        <Picker
          selectedValue={filiado?.situacao || ''}
          onValueChange={(itemValue) => setFiliado(f => f ? { ...f, situacao: itemValue } : null)}
          enabled={isEditing}
        >
          <Picker.Item label="Não informado" value="" />
          <Picker.Item label="Ativo" value="ATIVO" />
          <Picker.Item label="Veterano" value="VETERANO" />
          <Picker.Item label="Pensionista" value="PENSIONISTA" />
        </Picker>
      </View>
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

export default LotacaoCard;
