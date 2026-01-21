import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import assembleiaService from '../services/assembleiaService';

interface Props {
  assembleiaId: string;
  onSuccess: () => void;
}

export default function CheckinAssembleia({ assembleiaId, onSuccess }: Props) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCheckin = async () => {
    if (token.length !== 6) {
      Alert.alert('Erro', 'O token deve ter 6 dígitos.');
      return;
    }

    setLoading(true);
    try {
      await assembleiaService.checkin(assembleiaId, token);
      Alert.alert('Sucesso', 'Presença confirmada com sucesso!');
      onSuccess();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Não foi possível realizar o check-in. Verifique o token.';
      Alert.alert('Falha', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="ticket-confirmation-outline" size={64} color="#003366" />
      <Text style={styles.title}>Check-in de Presença</Text>
      <Text style={styles.subtitle}>Insira o token de 6 dígitos gerado pela diretoria para confirmar sua participação.</Text>

      <TextInput
        style={styles.input}
        placeholder="000000"
        value={token}
        onChangeText={setToken}
        keyboardType="number-pad"
        maxLength={6}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleCheckin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Registrar Presença</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginVertical: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#003366',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  input: {
    width: '100%',
    height: 60,
    backgroundColor: '#f2f4f8',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 8,
    color: '#003366',
    marginBottom: 24,
  },
  button: {
    width: '100%',
    height: 54,
    backgroundColor: '#003366',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
