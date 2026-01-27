// src/screens/ResetPasswordScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SafeScreen from '../components/SafeScreen';
import { useNavigation } from '@react-navigation/native';
import { resetarSenha } from '../services/authService';

export default function ResetPasswordScreen() {
  const navigation = useNavigation();
  const [token, setToken] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!token || !novaSenha) {
      Alert.alert('Atenção', 'Preencha o token e a nova senha.');
      return;
    }
    if (novaSenha.length < 6) {
      Alert.alert('Atenção', 'A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    try {
      setLoading(true);
      const response = await resetarSenha(token, novaSenha);
      Alert.alert('Sucesso', response.message);
      navigation.navigate('Login');
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.error || 'Não foi possível redefinir sua senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeScreen style={styles.container}>
    <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent} enableOnAndroid>
      <View style={styles.card}>
        <Text style={styles.instructions}>
          Copie o código (token) recebido em seu e-mail e crie uma nova senha com no mínimo 6 caracteres.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Código (Token) do E-mail"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Nova Senha"
          value={novaSenha}
          onChangeText={setNovaSenha}
          secureTextEntry
        />
        <Button
          title={loading ? 'Redefinindo...' : 'Redefinir Senha'}
          onPress={handleResetPassword}
          disabled={loading}
          color="#FFC300"
        />
         <Button
          title="Voltar ao Login"
          onPress={() => navigation.navigate('Login')}
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
  },
});
