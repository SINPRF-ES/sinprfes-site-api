// src/screens/BiometricLockScreen.tsx
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';

export default function BiometricLockScreen() {
  const { desbloquearComBiometria, logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    setLoading(true);
    try {
      const success = await desbloquearComBiometria();
      if (!success) {
        // O membro cancelou ou a biometria falhou.
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
    <View style={styles.container}>
      <Text style={styles.title}>Sessão Bloqueada</Text>
      <Text style={styles.subtitle}>
        Para sua segurança, confirme sua identidade para continuar.
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#FFC300" accessibilityLabel="Processando biometria..." />
      ) : (
        <View style={styles.buttonContainer}>
          <Button
            title="Desbloquear com Biometria"
            onPress={handleUnlock}
            color="#FFC300"
          />
          <View style={{ marginTop: 16 }}>
            <Button
              title="Sair (Logout)"
              onPress={handleLogout}
              color="#666"
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#001A33',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#DDDDDD',
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 32,
  },
});
