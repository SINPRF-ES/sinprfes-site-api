// mobile/src/screens/SegurancaScreen.tsx
import React from 'react';
import { View, Text, Switch, StyleSheet, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../hooks/useAuth';
import SafeScreen from '../components/SafeScreen';

export default function SegurancaScreen() {
  const { biometriaHabilitada, ativarBiometriaNesteAparelho } = useAuth();

  const handleToggleBiometria = async (value: boolean) => {
    if (value) {
      // Ao tentar ativar, verificar se o hardware está disponível e configurado
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'Biometria não disponível',
          'Não foi possível ativar a biometria. Verifique se seu aparelho possui o hardware necessário e se você já configurou uma digital ou Face ID.'
        );
        return;
      }
    }
    // A função no hook já lida com o armazenamento da preferência
    ativarBiometriaNesteAparelho(value);
  };

  return (
    <SafeScreen style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Segurança</Text>

        <View style={styles.optionContainer}>
          <Text style={styles.optionText}>Ativar login com biometria</Text>
          <Switch
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={biometriaHabilitada ? "#003366" : "#f4f3f4"}
            onValueChange={handleToggleBiometria}
            value={biometriaHabilitada}
          />
        </View>
        <Text style={styles.description}>
          Ative para usar sua digital ou reconhecimento facial para entrar no aplicativo de forma mais rápida e segura.
        </Text>
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#003366',
  },
  optionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionText: {
    fontSize: 16,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
});
