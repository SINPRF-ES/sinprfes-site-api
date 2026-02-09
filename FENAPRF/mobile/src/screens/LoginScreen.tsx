// src/screens/LoginScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Image, Pressable } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../hooks/useAuth';
import SafeScreen from '../components/SafeScreen';
import { loginSindicato, buscarUserLogado } from '../services/authService';
import { registrarDispositivoParaPush } from '../services/deviceService';
import { formatCpf, onlyDigits } from '../utils/format';
import { carregarSessao } from '../services/storageService';
import { logger } from '../infra/logger';
import { ENABLE_PUSH } from '../config/features';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { setSessao, ativarBiometriaNesteAparelho, biometriaHabilitada, desbloquearComBiometria } = useAuth();

  const [cpf, setCpf] = useState<string>('');
  const [senha, setSenha] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [temCredencial, setTemCredencial] = useState<boolean>(false);

  // ✅ Corrige o crash do cold start: a variável "etapa" era usada sem existir.
  // Se no futuro você tiver etapas reais (ex.: "cpf" -> "senha"), troque para um union type.
  const etapa = 'credenciais';

  useEffect(() => {
    (async () => {
      const token = await require('../services/storageService').carregarTokenBiometrico();
      setTemCredencial(!!token);
    })();
  }, []);

  // Tenta autenticar com biometria ao carregar a tela
  useEffect(() => {
    (async () => {
      if (biometriaHabilitada) {
        // Um pequeno delay para dar tempo da UI renderizar e o membro ver o prompt
        setTimeout(handleBiometricLogin, 500);
      }
    })();
  }, [biometriaHabilitada]);

  async function handleBiometricLogin() {
    try {
      console.log('[Biometria.tap]');
      // Tenta carregar a sessão normal ou a credencial biométrica persistente
      const sessaoSalva = await carregarSessao();
      const tokenBiometrico = await require('../services/storageService').carregarTokenBiometrico();
      const tokenParaUsar = sessaoSalva?.token || tokenBiometrico;

      if (!tokenParaUsar) {
        console.warn('[Biometria.session.fail] Sem credencial disponível');
        return;
      }

      setLoading(true);
      const sucesso = await desbloquearComBiometria();
      if (sucesso) {
        console.log('[Biometria.session.restore.start]');
        try {
          // Tenta validar o token
          const user = await buscarUserLogado(tokenParaUsar);
          await setSessao(tokenParaUsar, user);
          console.log('[Biometria.session.restore.ok]');
        } catch (restoreError: any) {
          console.error('[Biometria.session.restore.fail]', restoreError);
          if (restoreError?.response?.status === 401) {
            Alert.alert('Sessão Expirada', 'Sua credencial expirou. Por favor, entre com sua senha.');
          } else {
            Alert.alert('Erro', 'Não foi possível validar sua biometria agora. Tente com sua senha.');
          }
        }
      }
    } catch (e: any) {
      console.error('[Biometria.error]', e);
    } finally {
      setLoading(false);
    }
  }

  async function finalizarLoginComToken(token: string) {
    logger.info('LOGIN_SUCCESS_PROCEEDING', { hasToken: !!token });
    const user = await buscarUserLogado(token);
    logger.info('USER_ME_RESULT', { cpf: user.cpf, password_hash: user.password_hash });

    // No FENAPRF, se a senha estiver PENDENTE, redireciona para criar senha
    // Removida a verificação genérica de !user.password_hash pois o /me sanitiza o hash real
    if (user.password_hash === 'PENDENTE') {
      logger.info('NAVIGATING_TO_RESET_PENDENTE');
      navigation.navigate(
        'ResetPassword' as never,
        {
          isFirstAccess: true,
          cpf: user.cpf,
        } as never
      );
      return;
    }

    await setSessao(token, user);

    if (ENABLE_PUSH) {
      try {
        if (__DEV__) console.log('[Login] Tentando registrar dispositivo para push...');
        await registrarDispositivoParaPush();
      } catch (error) {
        if (__DEV__) console.warn('[Login] Falha ao registrar dispositivo para push:', error);
      }
    }

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
  }

  async function handleLoginCredenciais() {
    if (!cpf || !senha) {
      Alert.alert('Atenção', 'Informe CPF e senha.');
      return;
    }

    try {
      setLoading(true);
      const resultado = await loginSindicato({ cpf, senha });

      if (!resultado.token) throw new Error('Token não retornado pelo servidor.');
      await finalizarLoginComToken(resultado.token);
    } catch (e: any) {
      const status = e?.response?.status;
      const errorMsg = e?.response?.data?.error || e?.message || 'Falha ao autenticar.';

      logger.error('LOGIN_FAIL', { status, message: errorMsg });

      if (status === 403 && errorMsg.includes('pendente')) {
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

  const isEtapaCredenciais = true;
  const cpfPlaceholder = '000.000.000-00';

  useEffect(() => {
    logger.info('LOGIN_SCREEN_MOUNT', {
      etapa,
      hasInitialCpf: !!cpf,
      cpfPlaceholder,
      isBiometriaEnabled: biometriaHabilitada,
    });

    if (cpfPlaceholder.includes('_') || (cpfPlaceholder.includes('-') && !cpfPlaceholder.includes('.'))) {
      logger.warn('CPF_PLACEHOLDER_RESIDUE_DETECTED', { placeholder: cpfPlaceholder });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

          {biometriaHabilitada && temCredencial && isEtapaCredenciais && (
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
            editable={isEtapaCredenciais}
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
              editable={isEtapaCredenciais}
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

          <>
            <Button title={loading ? 'Entrando...' : 'Entrar'} onPress={handleLoginCredenciais} disabled={loading} color="#FFC300" />
            <Pressable
              onPress={() => navigation.navigate('ForgotPassword' as any)}
              disabled={loading}
              accessibilityRole="link"
              accessibilityLabel="Esqueci minha senha ou Primeiro acesso"
            >
              <Text style={styles.forgotPasswordText}>Esqueci minha senha / Primeiro acesso</Text>
            </Pressable>
          </>
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
  biometricButtonText: {
    color: '#FFF',
    marginLeft: 10,
    fontSize: 16,
    fontWeight: 'bold',
  },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 16, backgroundColor: '#fff' },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  showPasswordButton: {
    padding: 10,
  },
  forgotPasswordText: {
    textAlign: 'center',
    color: '#003366',
    marginTop: 16,
    padding: 8,
    fontSize: 14,
  },
  info2fa: { textAlign: 'center', marginBottom: 12, fontSize: 14 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  buttonCol: { flex: 1 },
});
