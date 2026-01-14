// src/components/ContatoCard.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Filiado } from '../types/filiado';

interface Props {
  filiado: Filiado | null;
  setFiliado: React.Dispatch<React.SetStateAction<Filiado | null>>;
}

const ContatoCard: React.FC<Props> = ({ filiado, setFiliado }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Contato</Text>
      <Text style={styles.label}>Telefone 1</Text>
      <TextInput
        style={styles.input}
        value={filiado?.telefone1 || ''}
        onChangeText={(text) => setFiliado(f => f ? { ...f, telefone1: text } : null)}
        placeholder="(99) 99999-9999"
        keyboardType="phone-pad"
      />
      <Text style={styles.label}>Telefone 2</Text>
      <TextInput
        style={styles.input}
        value={filiado?.telefone2 || ''}
        onChangeText={(text) => setFiliado(f => f ? { ...f, telefone2: text } : null)}
        placeholder="Opcional"
        keyboardType="phone-pad"
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
});

export default ContatoCard;
