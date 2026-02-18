import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Image, Pressable, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { useAuth } from '../hooks/useAuth';
import SafeScreen from '../components/SafeScreen';
import { API_BASE_URL } from '../config/env';
import api from '../services/apiService';
import { loginSindicato, loginCom2FA, buscarUsuarioLogado, refreshSessao } from '../services/authService';
import { registrarDispositivoParaPush } from '../services/deviceService';
import { formatCpf, onlyDigits } from '../shared/format/formatters';
import { carregarSessao, carregarRefreshToken, temRefreshTokenGravado } from '../services/storageService';
import { logger } from '../infra/logger';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { setSessao, ativarBiometriaNesteAparelho, biometriaHabilitada, desbloquearComBiometria } = useAuth();

  const [cpf, setCpf] = useState<string>('');
  const [senha, setSenha] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [codigo2FA, setCodigo2FA] = useState<string>('');
  const [etapa, setEtapa] = useState<'credenciais' | '2fa'>('credenciais');
  const [loading, setLoading] = useState<boolean>(false);
  const [temCredencial, setTemCredencial] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      // Usa flag não-protegida para evitar prompt biométrico ao montar a tela
      const hasToken = await temRefreshTokenGravado();
      setTemCredencial(hasToken);
    })();
  }, []);

  // Tenta autenticar com biometria ao carregar a tela
  useEffect(() => {
    (async () => {
      if (biometriaHabilitada) {
        // Um pequeno delay para dar tempo da UI renderizar e o usuário ver o prompt
        setTimeout(handleBiometricLogin, 500);
      }
    })();
  }, [biometriaHabilitada]);

  async function handleBiometricLogin() {
    try {
      console.log('[Biometria.tap]');

      setLoading(true);

      // Ao ler o refreshToken, o SecureStore solicita biometria (se configurado com requireAuthentication)
      // Isso substitui a necessidade de chamar desbloquearComBiometria() explicitamente aqui
      const refreshToken = await carregarRefreshToken();

      if (!refreshToken) {
        console.warn('[Biometria.session.fail] Sem refresh token disponível');
        setLoading(false);
        return;
      }

      console.log('[Biometria.session.refresh.start]');
      try {
          // Usa o refresh token para renovar a sessão
          const resultado = await refreshSessao(refreshToken);
          await finalizarLoginComToken(resultado.token, resultado.refreshToken);
          console.log('[Biometria.session.refresh.ok]');
      } catch (refreshError: any) {
          console.error('[Biometria.session.refresh.fail]', refreshError);
          const status = refreshError?.response?.status;
          if (status === 401 || status === 403) {
            Alert.alert('Sessão Expirada', 'Sua sessão expirou ou o token foi revogado. Por favor, entre com sua senha.');
          } else {
            Alert.alert('Erro', 'Não foi possível renovar sua sessão agora. Tente novamente mais tarde ou use sua senha.');
          }
      }
    } catch (e: any) {
      console.error('[Biometria.error]', e);
      // Se o SecureStore falhar (ex: usuário cancelou biometria no nível de sistema)
      if (e.message?.includes('User canceled') || e.message?.includes('Canceled by user')) {
         console.log('[Biometria.cancel]');
      } else {
         Alert.alert('Erro', 'Falha na autenticação biométrica.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function finalizarLoginComToken(token: string, refreshToken?: string) {
    const usuario = await buscarUsuarioLogado(token);
    await setSessao(token, usuario, refreshToken);

    try {
      if (__DEV__) console.log('[Login] Tentando registrar dispositivo para push...');
      await registrarDispositivoParaPush();
    } catch (error) {
      if (__DEV__) console.warn('[Login] Falha ao registrar dispositivo para push:', error);
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

      if (resultado.requer2fa) {
        setEtapa('2fa');
        Alert.alert('2FA necessário', 'Informe o código do seu aplicativo autenticador.');
        return;
      }

      if (!resultado.token) throw new Error('Token não retornado pelo servidor.');
      await finalizarLoginComToken(resultado.token, resultado.refreshToken);
    } catch (e: any) {
      const errorMsg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Falha ao autenticar.';
      const errorCode = e?.code || 'UNKNOWN';
      const status = e?.response?.status;
      const baseURL = api.defaults.baseURL || '';

      if (!__DEV__ && (baseURL.includes('10.0.2.2') || baseURL.includes('localhost'))) {
        Alert.alert('Configuração Inválida', `O aplicativo está usando uma URL de desenvolvimento em produção.\nURL: ${baseURL}\nConfig: ${API_BASE_URL}`);
      } else if (errorCode === 'ECONNABORTED') {
        Alert.alert('Erro de Conexão', `Tempo esgotado (Timeout). Verifique sua internet.\nURL: ${baseURL}`);
      } else if (errorCode === 'ERR_NETWORK') {
        Alert.alert('Erro de Rede', `Não foi possível conectar ao servidor.\nURL Efetiva: ${baseURL}\nConfig: ${API_BASE_URL}\n\nVerifique sua conexão.`);
      } else {
        Alert.alert('Erro no login', `${errorMsg}\n\n[Status: ${status || 'N/A'}] [Code: ${errorCode}]\nURL: ${baseURL}`);
      }
      logger.error('LOGIN_FAIL', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin2FA() {
    if (!codigo2FA) {
      Alert.alert('Atenção', 'Informe o código 2FA.');
      return;
    }

    try {
      setLoading(true);
      const resultado = await loginCom2FA({ cpf, senha, codigo: codigo2FA });
      await finalizarLoginComToken(resultado.token, resultado.refreshToken);
    } catch (e: any) {
      const errorMsg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Código inválido.';
      const errorCode = e?.code || 'UNKNOWN';
      Alert.alert('Erro no 2FA', `${errorMsg}\n\n[Code: ${errorCode}]`);
    } finally {
      setLoading(false);
    }
  }

  async function copyDebugInfo() {
    const info = `API_BASE_URL: ${API_BASE_URL}\nAxios baseURL: ${api.defaults.baseURL}\nPlatform: ${Platform.OS}\n__DEV__: ${__DEV__}`;
    await Clipboard.setStringAsync(info);
    Alert.alert('Copiado', 'Informações de diagnóstico copiadas.');
  }

  const isEtapaCredenciais = etapa === 'credenciais';

  const cpfPlaceholder = "000.000.000-00";

  useEffect(() => {
    logger.info('LOGIN_SCREEN_MOUNT', {
      etapa,
      hasInitialCpf: !!cpf,
      cpfPlaceholder,
      isBiometriaEnabled: biometriaHabilitada
    });

    if (cpfPlaceholder.includes('_') || cpfPlaceholder.includes('-') && !cpfPlaceholder.includes('.')) {
      logger.warn('CPF_PLACEHOLDER_RESIDUE_DETECTED', { placeholder: cpfPlaceholder });
    }
  }, []);

  return (
    <SafeScreen style={{ backgroundColor: '#001A33' }}>
    <KeyboardAwareScrollView contentContainerStyle={styles.container} enableOnAndroid extraScrollHeight={50} keyboardOpeningTime={0}>
      <View style={styles.card}>
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <Text style={styles.title}>SINPRF/ES</Text>
        <Text style={styles.subtitle}>Página Inicial</Text>

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
            accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name={showPassword ? "eye-off" : "eye"}
              size={24}
              color="#666"
            />
          </Pressable>
        </View>

        {isEtapaCredenciais ? (
          <>
            <Button title={loading ? 'Entrando...' : 'Entrar'} onPress={handleLoginCredenciais} disabled={loading} color="#FFC300" />
            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={loading}
              accessibilityRole="link"
              accessibilityLabel="Esqueci minha senha ou Primeiro acesso"
            >
              <Text style={styles.forgotPasswordText}>Esqueci minha senha / Primeiro acesso</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.info2fa}>Digite o código gerado pelo seu aplicativo autenticador (2FA).</Text>
            <TextInput
              style={styles.input}
              placeholder="Código 2FA"
              value={codigo2FA}
              onChangeText={setCodigo2FA}
              keyboardType="numeric"
              accessibilityLabel="Código 2FA"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              returnKeyType="done"
              onSubmitEditing={handleLogin2FA}
            />

            <View style={styles.buttonRow}>
              <View style={styles.buttonCol}>
                <Button title={loading ? 'Confirmando...' : 'Confirmar'} onPress={handleLogin2FA} disabled={loading} color="#FFC300" />
              </View>
              <View style={styles.buttonCol}>
                <Button title="Voltar" onPress={() => { setEtapa('credenciais'); setCodigo2FA(''); }} color="#666" disabled={loading} />
              </View>
            </View>
          </>
        )}

        <View style={styles.debugFooter}>
          <Text style={styles.debugText}>API: {API_BASE_URL}</Text>
          <Text style={styles.debugText}>Axios: {api.defaults.baseURL}</Text>
          <Pressable onPress={copyDebugInfo} style={styles.copyButton}>
            <Text style={styles.copyButtonText}>Copiar Debug</Text>
          </Pressable>
        </View>
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
  debugFooter: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  debugText: {
    fontSize: 10,
    color: '#999',
    marginBottom: 4,
  },
  copyButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  copyButtonText: {
    fontSize: 10,
    color: '#666',
    fontWeight: 'bold',
  },
});
