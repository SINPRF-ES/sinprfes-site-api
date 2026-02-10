// src/screens/ForgotPasswordScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SafeScreen from '../components/SafeScreen';
import { useNavigation } from '@react-navigation/native';
import { solicitarResetSenha } from '../services/authService';
import { formatCpf, onlyDigits } from '../utils/format';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async () => {
    const cpfLimpo = onlyDigits(cpf);
    if (!cpfLimpo || cpfLimpo.length !== 11) {
      Alert.alert('Atenção', 'Por favor, informe um CPF válido (11 dígitos).');
      return;
    }
    try {
      setLoading(true);
      const response = await solicitarResetSenha(cpfLimpo);
      Alert.alert('E-mail Enviado', response.message || 'Enviamos um link para seu e-mail.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.error || 'Não foi possível processar sua solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeScreen style={styles.container}>
    <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent} enableOnAndroid>
      <View style={styles.card}>
        <Text style={styles.instructions}>
          Digite seu CPF abaixo. Enviaremos um e-mail com um link para você redefinir sua senha com segurança.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="000.000.000-00"
          value={formatCpf(cpf)}
          onChangeText={(text) => {
            const digits = onlyDigits(text);
            if (digits.length <= 11) {
              setCpf(digits);
            }
          }}
          keyboardType="numeric"
          maxLength={14}
          accessibilityLabel="CPF"
          textContentType="username"
          autoComplete="username"
          returnKeyType="send"
          onSubmitEditing={handleRequestReset}
        />
        <Button
          title={loading ? 'Enviando...' : 'Enviar Solicitação'}
          onPress={handleRequestReset}
          disabled={loading}
          color="#FFC300"
        />
        <View style={{ height: 10 }} />
        <Button
          title="Voltar ao Login"
          onPress={() => navigation.goBack()}
          disabled={loading}
          color="#666"
        />
      </View>
    </KeyboardAwareScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#001A33',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
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
    color: '#333',
    backgroundColor: '#fff',
  },
});
