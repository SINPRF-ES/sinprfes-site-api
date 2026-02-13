// src/components/EnderecoCard.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Button, Alert, ActivityIndicator } from 'react-native';
import { User } from '../types/user';
import { formatCep, onlyDigits } from '../utils/format';
import { buscarCep } from '../services/cepService';

interface Props {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  hideTitle?: boolean;
  cardStyle?: any;
  disabled?: boolean;
}

const EnderecoCard: React.FC<Props> = ({ user, setUser, hideTitle = false, cardStyle = {}, disabled = false }) => {
  const [isBuscando, setIsBuscando] = useState(false);

  const handleCepChange = (value: string) => {
    const digits = onlyDigits(value);
    setUser(f => (f ? { ...f, cep: digits } : null));
    if (digits.length === 8) {
      handleBuscarCep();
    }
  };

  const handleBuscarCep = async () => {
    const cep = user?.cep;
    if (!cep || cep.length !== 8) {
      Alert.alert('CEP Inválido', 'Por favor, insira um CEP com 8 dígitos.');
      return;
    }

    setIsBuscando(true);
    try {
      const endereco = await buscarCep(cep);
      if (endereco) {
        setUser(f => f ? { ...f, ...endereco } : null);
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
            style={disabled ? styles.inputDisabled : styles.input}
            value={formatCep(user?.cep || '')}
            onChangeText={handleCepChange}
            placeholder="00000-000"
            keyboardType="numeric"
            maxLength={9} // 00000-000
            editable={!disabled}
            accessibilityLabel="CEP"
            textContentType="postalCode"
            autoComplete="postal-code"
            returnKeyType="search"
            onSubmitEditing={handleBuscarCep}
          />
        </View>
        {isBuscando ? (
          <ActivityIndicator accessibilityLabel="Buscando endereço..." />
        ) : (
          <Button title="Buscar" onPress={handleBuscarCep} disabled={disabled} />
        )}
      </View>
      <Text style={styles.label}>Logradouro e Bairro</Text>
      <TextInput
        style={styles.inputDisabled}
        value={user?.logradouro ? `${user.logradouro}${user.bairro ? ', ' + user.bairro : ''}` : (user?.logradouro_bairro || '')}
        placeholder="Preenchido pela busca de CEP"
        editable={false}
        accessibilityLabel="Logradouro e Bairro"
        textContentType="streetAddressLine1"
      />
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Número</Text>
          <TextInput
            style={disabled ? styles.inputDisabled : styles.input}
            value={user?.numero || ''}
            onChangeText={(text) => setUser(f => f ? { ...f, numero: text } : null)}
            placeholder="Nº"
            editable={!disabled}
            accessibilityLabel="Número"
            returnKeyType="next"
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Complemento</Text>
          <TextInput
            style={disabled ? styles.inputDisabled : styles.input}
            value={user?.complemento || ''}
            onChangeText={(text) => setUser(f => f ? { ...f, complemento: text } : null)}
            placeholder="Opcional"
            editable={!disabled}
            accessibilityLabel="Complemento"
            textContentType="streetAddressLine2"
            returnKeyType="done"
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Cidade</Text>
          <TextInput
            style={styles.inputDisabled}
            value={user?.cidade || ''}
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
            value={user?.uf_endereco || ''}
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
