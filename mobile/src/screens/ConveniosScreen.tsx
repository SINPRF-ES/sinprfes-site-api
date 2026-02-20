// src/screens/ConveniosScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SafeScreen from '../components/SafeScreen';

export default function ConveniosScreen() {
  return (
    <SafeScreen style={styles.container}>
      <Text style={styles.title}>Convênios</Text>
      <Text style={styles.subtitle}>
        Esta seção está em desenvolvimento. Em breve, você poderá consultar
        a lista de convênios e parceiros aqui.
      </Text>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f2f4f8',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#003366',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#555',
  },
});
