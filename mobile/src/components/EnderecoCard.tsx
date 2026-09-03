// src/components/EnderecoCard.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Button, Alert, ActivityIndicator } from 'react-native';
import { Filiado } from '../types/filiado';
import { formatCep, onlyDigits } from '../shared/format/formatters';
import { buscarCep } from '../services/cepService';

interface Props {
  filiado: Filiado | null;
  setFiliado: React.Dispatch<React.SetStateAction<Filiado | null>>;
  hideTitle?: boolean;
  cardStyle?: any;
}

const EnderecoCard: React.FC<Props> = ({ filiado, setFiliado, hideTitle = false, cardStyle = {} }) => {
  const [isBuscando, setIsBuscando] = useState(false);
  const [isEnderecoEditable, setIsEnderecoEditable] = useState(false);

  const handleCepChange = (value: string) => {
    const digits = onlyDigits(value);
    setIsEnderecoEditable(false);
    setFiliado(f => (f ? { ...f, cep: digits, logradouro_bairro: '', cidade: '', uf: '' } : null));
  };

  const handleBuscarCep = async () => {
    const cep = filiado?.cep;
    if (!cep || cep.length !== 8) {
      Alert.alert('CEP Inválido', 'Por favor, insira um CEP com 8 dígitos.');
      return;
    }

    setIsBuscando(true);
    try {
      const endereco = await buscarCep(cep);
      if (endereco) {
        setIsEnderecoEditable(Boolean(endereco.isEnderecoEditable));
        const { isEnderecoEditable: _, ...dadosEndereco } = endereco;
        setFiliado(f => f ? { ...f, ...dadosEndereco } : null);
        Alert.alert('Sucesso', 'Endereço encontrado e preenchido.');
      } else {
        Alert.alert('CEP não encontrado', 'O CEP informado não foi localizado.');
      }
    } catch (error: any) {
      Alert.alert('Erro na Busca', error.message);
    } finally {
      setIsBuscando(false);
    }
  };

  return (
    <View style={[styles.card, cardStyle]}>
      {!hideTitle && <Text style={styles.cardTitle}>Endereço</Text>}
      <View style={styles.cepContainer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>CEP</Text>
          <TextInput
            style={styles.input}
            value={formatCep(filiado?.cep || '')}
            onChangeText={handleCepChange}
            placeholder="00000-000"
            keyboardType="numeric"
            maxLength={9} // 00000-000
            accessibilityLabel="CEP"
            textContentType="postalCode"
            autoComplete="postal-code"
          />
        </View>
        {isBuscando ? (
          <ActivityIndicator />
        ) : (
          <Button title="Buscar" onPress={handleBuscarCep} />
        )}
      </View>
      <Text style={styles.label}>Logradouro e Bairro</Text>
      <TextInput
        style={isEnderecoEditable ? styles.input : styles.inputDisabled}
        value={filiado?.logradouro_bairro || ''}
        onChangeText={(text) => setFiliado(f => f ? { ...f, logradouro_bairro: text } : null)}
        placeholder="Preenchido pela busca de CEP"
        editable={isEnderecoEditable}
        accessibilityLabel="Logradouro e Bairro"
        textContentType="streetAddressLine1"
      />
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Número</Text>
          <TextInput
            style={styles.input}
            value={filiado?.numero || ''}
            onChangeText={(text) => setFiliado(f => f ? { ...f, numero: text } : null)}
            placeholder="Nº"
            accessibilityLabel="Número"
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Complemento</Text>
          <TextInput
            style={styles.input}
            value={filiado?.complemento || ''}
            onChangeText={(text) => setFiliado(f => f ? { ...f, complemento: text } : null)}
            placeholder="Opcional"
            accessibilityLabel="Complemento"
            textContentType="streetAddressLine2"
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Cidade</Text>
          <TextInput
            style={styles.inputDisabled}
            value={filiado?.cidade || ''}
            placeholder="Cidade"
            editable={false}
            accessibilityLabel="Cidade"
            textContentType="addressCity"
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>UF</Text>
          <TextInput
            style={styles.inputDisabled}
            value={filiado?.uf || ''}
            placeholder="UF"
            maxLength={2}
            editable={false}
            accessibilityLabel="UF"
            textContentType="addressState"
          />
        </View>
      </View>
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
