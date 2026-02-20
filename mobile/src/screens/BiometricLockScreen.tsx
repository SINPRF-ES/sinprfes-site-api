// src/screens/BiometricLockScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import SafeScreen from '../components/SafeScreen';
import { useAuth } from '../hooks/useAuth';

export default function BiometricLockScreen() {
  const { desbloquearComBiometria, logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    setLoading(true);
    try {
      const success = await desbloquearComBiometria();
      if (!success) {
        // O usuário cancelou ou a biometria falhou.
        // O estado `bloqueadoPorBiometria` permanece `true`.
        Alert.alert('Falha', 'A autenticação biométrica falhou. Por favor, tente novamente.');
      }
      // Se for sucesso, o `useAuth` hook já vai atualizar o estado e a navegação cuidará do resto.
    } catch (error) {
      console.error('[BiometricLockScreen] Erro ao desbloquear:', error);
      Alert.alert('Erro', 'Ocorreu um erro inesperado durante a autenticação biométrica.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Tem certeza de que deseja sair e limpar sua sessão?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => logout() },
      ]
    );
  };

  return (
    <SafeScreen style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.brandText}>SINPRF/ES</Text>
      </View>

      <Text style={styles.title}>Sessão Bloqueada</Text>
      <Text style={styles.subtitle}>
        Para sua segurança, confirme sua identidade para continuar.
      </Text>
      
      {loading ? (
        <ActivityIndicator size="large" color="#FFC300" />
      ) : (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleUnlock}
            activeOpacity={0.8}
          >
            <Text style={styles.btnPrimaryText}>Desbloquear com Biometria</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={handleLogout}
            activeOpacity={0.6}
          >
            <Text style={styles.btnSecondaryText}>Sair da Conta (Logout)</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f2f4f8',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 10,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#003366',
    letterSpacing: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#003366',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 48,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20,
    gap: 16,
  },
  btnPrimary: {
    backgroundColor: '#FFC300',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',

    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  btnPrimaryText: {
    color: '#003366',
    fontSize: 16,
    fontWeight: '800',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ccc',
  },
  btnSecondaryText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
});
