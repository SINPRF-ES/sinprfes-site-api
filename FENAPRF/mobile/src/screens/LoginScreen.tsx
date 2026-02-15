// src/screens/LoginScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Image, Pressable } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../hooks/useAuth';
import SafeScreen from '../components/SafeScreen';
import { login } from '../services/authService';
import { formatCpf, onlyDigits } from '../utils/format';
import { logger } from '../infra/logger';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { setSessao, refreshUser, ativarBiometriaNesteAparelho, biometriaHabilitada, desbloquearComBiometria } = useAuth();

  const [cpf, setCpf] = useState<string>('');
  const [senha, setSenha] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    // FENAPRF: Tenta biometria automática se habilitada ao abrir a tela de login
    // (Útil se o usuário caiu aqui por timeout ou erro de token mas manteve a RT)
    if (biometriaHabilitada) {
      setTimeout(handleBiometricLogin, 500);
    }
  }, [biometriaHabilitada]);

  async function handleBiometricLogin() {
    if (loading) return;
    setLoading(true);
    try {
      // Delegar toda a lógica de biometria + refresh + session para o useAuth
      const sucesso = await desbloquearComBiometria();
      if (!sucesso) {
        logger.info('[LoginScreen] Biometria não concluída ou cancelada.');
      }
    } catch (e: any) {
      logger.error('[LoginScreen.handleBiometricLogin]', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginCredenciais() {
    if (!cpf || !senha) {
      Alert.alert('Atenção', 'Informe CPF e senha.');
      return;
    }

    try {
      setLoading(true);
      const sessao = await login({ cpf, senha });

      if (sessao.user.password_hash === 'PENDENTE') {
          navigation.navigate('ResetPassword' as any, { isFirstAccess: true, cpf: sessao.user.cpf } as any);
          return;
      }

      await setSessao(sessao.token, sessao.refreshToken, sessao.user);

      // FENAPRF: Garantir que o usuário esteja totalmente hidratado no boot do login
      // (Embora o backend agora retorne mais campos, o refreshUser garante a paridade total com o /me)
      await refreshUser();

      if (!biometriaHabilitada) {
        Alert.alert(
          'Login com biometria',
          'Deseja ativar o acesso com biometria neste aparelho?',
          [
            { text: 'Não agora', style: 'cancel', onPress: () => ativarBiometriaNesteAparelho(false) },
            { text: 'Sim, ativar', onPress: () => ativarBiometriaNesteAparelho(true) },
          ]
        );
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const errorMsg = e?.response?.data?.error || e?.message || 'Falha ao autenticar.';
      logger.error('LOGIN_FAIL', { status, message: errorMsg });

      if (status === 403 && errorMsg.toLowerCase().includes('senha')) {
        Alert.alert('Primeiro Acesso', errorMsg, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Definir Senha', onPress: () => navigation.navigate('ForgotPassword' as any) },
        ]);
      } else {
        Alert.alert('Erro no login', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeScreen style={{ backgroundColor: '#001A33' }}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        enableOnAndroid
        extraScrollHeight={50}
        keyboardOpeningTime={0}
      >
        <View style={styles.card}>
          <View style={styles.logoContainer}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          </View>

          <Text style={styles.title}>FENAPRF</Text>
          <Text style={styles.subtitle}>Conselho de Representantes</Text>

          {biometriaHabilitada && (
            <Pressable
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              disabled={loading}
              accessibilityLabel="Entrar com Biometria"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="fingerprint" size={24} color="#FFF" />
              <Text style={styles.biometricButtonText}>Entrar com Biometria</Text>
            </Pressable>
          )}

          <TextInput
            style={styles.input}
            placeholder="000.000.000-00"
            accessibilityLabel="CPF"
            value={formatCpf(cpf)}
            onChangeText={(text) => {
              const digits = onlyDigits(text);
              if (digits.length <= 11) {
                setCpf(digits);
              }
            }}
            keyboardType="numeric"
            maxLength={14}
            textContentType="username"
            autoComplete="username"
            returnKeyType="next"
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Senha"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry={!showPassword}
              accessibilityLabel="Senha"
              textContentType="password"
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleLoginCredenciais}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              style={styles.showPasswordButton}
              accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name={showPassword ? 'eye-off' : 'eye'} size={24} color="#666" />
            </Pressable>
          </View>

          <Button
            title={loading ? 'Entrando...' : 'Entrar'}
            onPress={handleLoginCredenciais}
            disabled={loading}
            color="#FFC300"
          />
          <Pressable
            onPress={() => navigation.navigate('ForgotPassword' as any)}
            disabled={loading}
            accessibilityRole="link"
          >
            <Text style={styles.forgotPasswordText}>
              {loading ? 'Aguarde...' : 'Esqueci minha senha / Primeiro acesso'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#001A33' },
  card: { backgroundColor: '#ffffff', padding: 24, borderRadius: 16, elevation: 4 },
  logoContainer: { alignItems: 'center', marginBottom: 12 },
  logo: { width: 180, height: 150 },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 4, color: '#003366' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 24, color: '#555' },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#003366',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  biometricButtonText: { color: '#FFF', marginLeft: 10, fontSize: 16, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 16, backgroundColor: '#fff' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 10, marginBottom: 16, backgroundColor: '#fff' },
  passwordInput: { flex: 1, padding: 12, fontSize: 16 },
  showPasswordButton: { padding: 10 },
  forgotPasswordText: { textAlign: 'center', color: '#003366', marginTop: 16, padding: 8, fontSize: 14 },
});
