import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Image, Pressable } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../hooks/useAuth';
import SafeScreen from '../components/SafeScreen';
import { loginSindicato, loginCom2FA, buscarUsuarioLogado } from '../services/authService';
import { registrarDispositivoParaPush } from '../services/deviceService';
import { formatCpf, onlyDigits } from '../shared/format/formatters';
import { carregarSessao } from '../services/storageService';
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
      const sessaoSalva = await carregarSessao();

      if (!sessaoSalva) {
        console.warn('[Biometria.session.fail] Sem sessão salva');
        return;
      }

      setLoading(true);
      const sucesso = await desbloquearComBiometria();
      if (sucesso) {
        console.log('[Biometria.session.restore.start]');
        try {
           // Tenta validar o token salvo
           const usuario = await buscarUsuarioLogado(sessaoSalva.token);
           await setSessao(sessaoSalva.token, usuario);
           console.log('[Biometria.session.restore.ok]');
        } catch (restoreError) {
           console.error('[Biometria.session.restore.fail]', restoreError);
           Alert.alert('Sessão Expirada', 'Sua sessão anterior expirou. Por favor, entre com sua senha.');
        }
      }
    } catch (e: any) {
      console.error('[Biometria.error]', e);
    } finally {
      setLoading(false);
    }
  }

  async function finalizarLoginComToken(token: string) {
    const usuario = await buscarUsuarioLogado(token);
    await setSessao(token, usuario);

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
      await finalizarLoginComToken(resultado.token);
    } catch (e: any) {
      Alert.alert('Erro no login', e?.message || 'Falha ao autenticar.');
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
      await finalizarLoginComToken(resultado.token);
    } catch (e: any) {
      Alert.alert('Erro no 2FA', e?.message || 'Código inválido.');
    } finally {
      setLoading(false);
    }
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
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <Text style={styles.title}>SINPRF/ES</Text>
        <Text style={styles.subtitle}>Área do Filiado</Text>

        {biometriaHabilitada && isEtapaCredenciais && (
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
            <TextInput style={styles.input} placeholder="Código 2FA" value={codigo2FA} onChangeText={setCodigo2FA} keyboardType="numeric" />

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
      </View>
    </KeyboardAwareScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#001A33' },
  card: { backgroundColor: '#ffffff', padding: 24, borderRadius: 16, elevation: 4 },
  logoContainer: { alignItems: 'center', marginBottom: 12 },
  logo: { width: 90, height: 90 },
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
