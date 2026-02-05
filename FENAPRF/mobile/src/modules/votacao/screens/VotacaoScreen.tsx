// src/modules/votacao/screens/VotacaoScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function VotacaoScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Assembleias e Votações</Text>
      <Text style={styles.subtitle}>
        Este módulo está em desenvolvimento e será disponibilizado em breve.
      </Text>
    </View>
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
