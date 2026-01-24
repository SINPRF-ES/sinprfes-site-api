import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getAssembleias } from '../../services/assembleiaService';
import { Assembleia } from '../../types/assembleia';
import { useAuth } from '../../hooks/useAuth';
import { isDiretoria } from '../../utils/filiadoUtils';
import { logger } from '../../infra/logger';

import HeaderMenu, { MenuAction } from '../../components/HeaderMenu';

export default function AssembleiasScreen({ navigation }: any) {
  const { usuario } = useAuth();
  const [assembleias, setAssembleias] = useState<Assembleia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const ehDiretoria = isDiretoria(usuario?.perfil_acesso);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getAssembleias();
      setAssembleias(data);
    } catch (err) {
      console.error('[Assembleias.fetch]', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={{ marginLeft: 10 }}>
            <MaterialCommunityIcons name="menu" size={24} color="#fff" />
          </TouchableOpacity>
        ),
        headerRight: () => {
          const actions: MenuAction[] = [];
          if (ehDiretoria) {
            actions.push({
              label: 'Nova Assembleia',
              icon: 'plus',
              onPress: () => navigation.navigate('CriarAssembleia')
            });
          }
          return <HeaderMenu actions={actions} />;
        }
      });
      fetchData();
    }, [ehDiretoria])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Assembleia }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        logger.info('NAVIGATE_TO_ASSEMBLEIA_DETALHE', { id: item.id, titulo: item.titulo });
        navigation.navigate('AssembleiaDetalhe', { id: item.id });
      }}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.badge, styles[`badge${item.estado}`]]}>
          <Text style={styles.badgeText}>{item.estado}</Text>
        </View>
        <Text style={styles.tipoText}>{item.tipo}</Text>
      </View>
      <Text style={styles.tituloText}>{item.titulo}</Text>
      <Text style={styles.dataText}>Criada em: {new Date(item.criado_em).toLocaleDateString()}</Text>

      <View style={styles.cardFooter}>
        <Text style={styles.verMais}>Ver detalhes</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#003366" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>
      ) : (
        <FlatList
          data={assembleias}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhuma assembleia encontrada.</Text>
            </View>
          }
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeCRIADA: { backgroundColor: '#cfe2ff' },
  badgeABERTA: { backgroundColor: '#d1e7dd' },
  badgeENCERRADA: { backgroundColor: '#f8d7da' },
  badgeText: { fontSize: 10, fontWeight: 'bold', color: '#333' },
  tipoText: { fontWeight: 'bold', color: '#666' },
  tituloText: { fontSize: 18, fontWeight: 'bold', color: '#003366', marginBottom: 4 },
  dataText: { fontSize: 12, color: '#888', marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 },
  verMais: { fontSize: 14, color: '#003366', fontWeight: 'bold' },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#003366', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  empty: { flex: 1, alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#666' },
});
