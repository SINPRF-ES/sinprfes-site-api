// src/screens/FiliadosScreen.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Button, StyleSheet, FlatList, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { initDb, buscarFiliadosOffline, salvarFiliadosOffline } from '../database/db';
import api from '../services/apiService';
import type { Filiado } from '../types/filiado';
import type { RootStackParamList } from '../navigation';

// Função debounce
const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
};

type Props = NativeStackScreenProps<RootStackParamList, 'Filiados'>;

export default function FiliadosScreen({ navigation }: Props) {
  const { usuario } = useAuth();
  const [query, setQuery] = useState('');
  const [lista, setLista] = useState<Filiado[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isGestao = usuario?.roles?.includes('ADMIN') || usuario?.roles?.includes('DIRETORIA');

  // Busca na API com fallback
  const buscarFiliadosAPI = async (termo: string) => {
    if (termo.trim().length < 2) {
      setLista([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<Filiado[]>('/api/filiados', { params: { q: termo } });
      setLista(data);
      if (data.length > 0) {
        await initDb();
        await salvarFiliadosOffline(data);
      }
    } catch (e: any) {
      setError('Falha na busca online. Tentando cache local...');
      try {
        const localResults = await buscarFiliadosOffline(termo);
        setLista(localResults);
      } catch (dbError: any) {
        setError('Falha ao buscar no cache local: ' + dbError.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useCallback(debounce(buscarFiliadosAPI, 500), []);

  const onBuscar = (texto: string) => {
    setQuery(texto);
    debouncedSearch(texto);
  };
  
  const handleSelectFiliado = (filiado: Filiado) => {
    if (!isGestao) return;
    navigation.navigate('EditarFiliado', { filiadoId: filiado.id });
  };

  return (
    <View style={styles.container}>
      {isGestao && (
        <View style={styles.adminActions}>
          <Button
            title="Criar Novo Filiado"
            onPress={() => navigation.navigate('CriarFiliado')}
          />
        </View>
      )}
      <TextInput
        style={styles.input}
        placeholder="Buscar por nome, CPF ou telefone..."
        value={query}
        onChangeText={onBuscar}
      />

      {loading && <ActivityIndicator size="large" color="#003366" />}
      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={lista}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleSelectFiliado(item)} disabled={!isGestao}>
            <View style={styles.card}>
              <Text style={styles.nome}>{item.nome}</Text>
              {isGestao ? (
                <>
                  <Text style={styles.meta}>CPF: {item.cpf ?? '-'}</Text>
                  <Text style={styles.meta}>Email: {item.email ?? '-'}</Text>
                  <Text style={styles.meta}>Telefone: {item.telefone ?? '-'}</Text>
                  <Text style={styles.meta}>Situação: {item.situacao ?? '-'}</Text>
                </>
              ) : (
                <Text style={styles.meta}>Telefone: {item.telefone ?? '-'}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading && query.length > 1 ? (
            <Text style={styles.empty}>Nenhum resultado encontrado para "{query}".</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f2f4f8' },
  input: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 10 },
  adminActions: { marginBottom: 16 },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e2e2', marginBottom: 10 },
  nome: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  meta: { fontSize: 13, color: '#444' },
  empty: { textAlign: 'center', marginTop: 24, color: '#666' },
  error: { textAlign: 'center', color: 'red', marginVertical: 10 },
});
