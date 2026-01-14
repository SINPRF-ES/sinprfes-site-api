// src/components/EnderecoCard.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet, Button } from 'react-native';
import { Filiado } from '../types/filiado';

interface Props {
  filiado: Filiado | null;
  setFiliado: React.Dispatch<React.SetStateAction<Filiado | null>>;
}

const EnderecoCard: React.FC<Props> = ({ filiado, setFiliado }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Endereço</Text>
      <View style={styles.cepContainer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>CEP</Text>
          <TextInput
            style={styles.input}
            value={filiado?.cep || ''}
            onChangeText={(text) => setFiliado(f => f ? { ...f, cep: text } : null)}
            placeholder="00000-000"
            keyboardType="numeric"
          />
        </View>
        <Button title="Buscar" onPress={() => { /* TODO: Implementar busca de CEP via API (ex: ViaCEP) */ }} />
      </View>
      <Text style={styles.label}>Logradouro e Bairro</Text>
      <TextInput
        style={styles.input}
        value={filiado?.logradouro_bairro || ''}
        onChangeText={(text) => setFiliado(f => f ? { ...f, logradouro_bairro: text } : null)}
        placeholder="Rua, Bairro"
      />
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Número</Text>
          <TextInput
            style={styles.input}
            value={filiado?.numero || ''}
            onChangeText={(text) => setFiliado(f => f ? { ...f, numero: text } : null)}
            placeholder="Nº"
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Complemento</Text>
          <TextInput
            style={styles.input}
            value={filiado?.complemento || ''}
            onChangeText={(text) => setFiliado(f => f ? { ...f, complemento: text } : null)}
            placeholder="Opcional"
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Cidade</Text>
          <TextInput
            style={styles.input}
            value={filiado?.cidade || ''}
            onChangeText={(text) => setFiliado(f => f ? { ...f, cidade: text } : null)}
            placeholder="Cidade"
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>UF</Text>
          <TextInput
            style={styles.input}
            value={filiado?.uf || ''}
            onChangeText={(text) => setFiliado(f => f ? { ...f, uf: text } : null)}
            placeholder="UF"
            maxLength={2}
            autoCapitalize="characters"
          />
        </View>
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
  cepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
});

export default EnderecoCard;
