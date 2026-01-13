import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Image } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import { useAuth } from '../hooks/useAuth';
import { loginSindicato, loginCom2FA, buscarUsuarioLogado } from '../services/authService';
import { registrarDispositivoParaPush } from '../services/deviceService';

export default function LoginScreen() {
  const { setSessao, ativarBiometriaNesteAparelho, biometriaHabilitada } = useAuth();

  const [cpf, setCpf] = useState<string>('');
  const [senha, setSenha] = useState<string>('');
  const [codigo2FA, setCodigo2FA] = useState<string>('');
  const [etapa, setEtapa] = useState<'credenciais' | '2fa'>('credenciais');
  const [loading, setLoading] = useState<boolean>(false);

  async function finalizarLoginComToken(token: string) {
    const usuario = await buscarUsuarioLogado(token);
    await setSessao(token, usuario);

    // Registra o dispositivo para push notifications em segundo plano.
    // O try/catch garante que o fluxo de login não seja interrompido se isso falhar.
    try {
      if (__DEV__) console.log('[Login] Tentando registrar dispositivo para push...');
      await registrarDispositivoParaPush();
    } catch (error) {
      if (__DEV__) console.warn('[Login] Falha ao registrar dispositivo para push:', error);
      // Não bloqueia o usuário, apenas loga o erro em dev.
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
    // ... (restante do código permanece o mesmo)
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

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container} enableOnAndroid extraScrollHeight={50} keyboardOpeningTime={0}>
      <View style={styles.card}>
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <Text style={styles.title}>SINPRF/ES</Text>
        <Text style={styles.subtitle}>Área do Filiado</Text>

        <TextInput style={styles.input} placeholder="CPF" value={cpf} onChangeText={setCpf} keyboardType="numeric" editable={isEtapaCredenciais} />
        <TextInput style={styles.input} placeholder="Senha" value={senha} onChangeText={setSenha} secureTextEntry editable={isEtapaCredenciais} />

        {isEtapaCredenciais ? (
          <Button title={loading ? 'Entrando...' : 'Entrar'} onPress={handleLoginCredenciais} disabled={loading} color="#FFC300" />
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
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#001A33' },
  card: { backgroundColor: '#ffffff', padding: 24, borderRadius: 16, elevation: 4 },
  logoContainer: { alignItems: 'center', marginBottom: 12 },
  logo: { width: 90, height: 90 },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 4, color: '#003366' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 24, color: '#555' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 16, backgroundColor: '#fff' },
  info2fa: { textAlign: 'center', marginBottom: 12, fontSize: 14 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  buttonCol: { flex: 1 },
});
