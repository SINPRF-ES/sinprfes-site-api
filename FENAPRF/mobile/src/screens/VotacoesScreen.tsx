import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../hooks/useAuth';
import type { RootStackParamList } from '../navigation';
import { listarVotacoes } from '../services/votacaoService';
import type { VotacaoResumo } from '../types/votacao';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function VotacoesScreen() {
  const { token } = useAuth();
  const navigation = useNavigation<Nav>();

  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState<VotacaoResumo[]>([]);

  async function carregar() {
    if (!token) return;
    try {
      setLoading(true);
      const data = await listarVotacoes(token);
      setLista(data);
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao carregar votações.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Votações</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator accessibilityLabel="Carregando lista de votações..." />
          <Text style={styles.muted}>Carregando…</Text>
        </View>
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('VotacaoDetalhe', { id: item.id })}
            >
              <Text style={styles.cardTitle}>{item.titulo}</Text>
              <Text style={styles.cardMeta}>Status: {item.status}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.muted}>Nenhuma votação disponível.</Text>}
          refreshing={loading}
          onRefresh={carregar}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f2f4f8' },
  title: { fontSize: 18, fontWeight: '800', color: '#003366', marginBottom: 12 },
  center: { alignItems: 'center', gap: 10, marginTop: 24 },
  muted: { color: '#666' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e4e6ea', marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 4 },
  cardMeta: { fontSize: 13, color: '#555' },
});
