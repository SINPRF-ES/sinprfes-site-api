// src/screens/NoticiasScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function NoticiasScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notícias e Comunicados</Text>
      <Text style={styles.subtitle}>
        Esta seção está em desenvolvimento. Em breve, você verá as últimas
        notícias e comunicados do sindicato aqui.
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
