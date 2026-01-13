// src/screens/ForgotPasswordScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { solicitarResetSenha } from '../services/authService';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async () => {
    if (!cpf) {
      Alert.alert('Atenção', 'Por favor, informe seu CPF.');
      return;
    }
    try {
      setLoading(true);
      const response = await solicitarResetSenha(cpf);
      Alert.alert('Solicitação Enviada', response.message, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.error || 'Não foi possível processar sua solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Recuperar Senha</Text>
        <Text style={styles.instructions}>
          Digite seu CPF abaixo. Enviaremos um link de redefinição para o e-mail cadastrado.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="CPF"
          value={cpf}
          onChangeText={setCpf}
          keyboardType="numeric"
        />
        <Button
          title={loading ? 'Enviando...' : 'Enviar Solicitação'}
          onPress={handleRequestReset}
          disabled={loading}
          color="#FFC300"
        />
        <Button
          title="Voltar ao Login"
          onPress={() => navigation.goBack()}
          disabled={loading}
          color="#666"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#001A33',
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: '#003366',
  },
  instructions: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
});
