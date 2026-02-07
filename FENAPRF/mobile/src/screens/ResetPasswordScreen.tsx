// src/screens/ResetPasswordScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SafeScreen from '../components/SafeScreen';
import { useNavigation, useRoute } from '@react-navigation/native';
import { resetarSenha } from '../services/authService';
import { logger } from '../infra/logger';

export default function ResetPasswordScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const [token, setToken] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (route.params?.token) {
      logger.info('RESET_PASSWORD_TOKEN_RECEIVED', { token: '********' });
      setToken(route.params.token);
    }
  }, [route.params?.token]);

  const handleResetPassword = async () => {
    if (!token || !novaSenha || !confirmarSenha) {
      Alert.alert('Atenção', 'Preencha todos os campos.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      Alert.alert('Atenção', 'As senhas não coincidem.');
      return;
    }
    if (novaSenha.length < 6) {
      Alert.alert('Atenção', 'A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    try {
      setLoading(true);
      logger.info('RESET_PASSWORD_ATTEMPT', { hasToken: !!token });
      const response = await resetarSenha(token, novaSenha);
      logger.info('RESET_PASSWORD_SUCCESS');
      Alert.alert('Sucesso', response.message);
      navigation.navigate('Login' as any);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Não foi possível redefinir sua senha.';
      logger.error('RESET_PASSWORD_FAIL', { message: errorMsg });
      Alert.alert('Erro', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeScreen style={styles.container}>
    <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent} enableOnAndroid>
      <View style={styles.card}>
        <Text style={styles.instructions}>
          {route.params?.token
            ? 'Defina sua nova senha abaixo com no mínimo 6 caracteres.'
            : 'Copie o código (token) recebido em seu e-mail e defina sua nova senha.'}
        </Text>

        {!route.params?.token && (
          <TextInput
            style={styles.input}
            placeholder="Código (Token) do E-mail"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            accessibilityLabel="Código Token"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            returnKeyType="next"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Nova Senha"
          value={novaSenha}
          onChangeText={setNovaSenha}
          secureTextEntry
          accessibilityLabel="Nova Senha"
          textContentType="newPassword"
          autoComplete="password-new"
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          placeholder="Confirmar Nova Senha"
          value={confirmarSenha}
          onChangeText={setConfirmarSenha}
          secureTextEntry
          accessibilityLabel="Confirmar Nova Senha"
          textContentType="newPassword"
          autoComplete="password-new"
          returnKeyType="done"
          onSubmitEditing={handleResetPassword}
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
