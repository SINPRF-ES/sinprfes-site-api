import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getAssembleias } from '../../services/assembleiaService';
import { Assembleia } from '../../types/assembleia';
import { useAuth } from '../../hooks/useAuth';
import { isGestao } from '../../utils/user';
import { logger } from '../../infra/logger';
import { getAssembleiaStatusLabel, getAssembleiaStatusEmoji } from '../../utils/format';

import HeaderMenu, { MenuAction } from '../../components/HeaderMenu';
import CanonicalPicker from '../../components/CanonicalPicker';

export default function AssembleiasScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [assembleias, setAssembleias] = useState<Assembleia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'ativas' | 'encerradas' | 'todas'>('ativas');

  const ehGestao = isGestao(user?.perfil_acesso);

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
        headerRight: () => {
          const actions: MenuAction[] = [];
          if (ehGestao) {
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
    }, [ehGestao])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Otimização Bolt: Memoiza filtragem de assembleias
  const filteredAssembleias = useMemo(() => {
    return assembleias.filter(a => {
      if (filter === 'ativas') return a.estado !== 'ENCERRADO';
      if (filter === 'encerradas') return a.estado === 'ENCERRADO';
      return true;
    });
  }, [assembleias, filter]);

  // Otimização Bolt: Memoiza renderItem para evitar re-instanciação e re-renders no FlatList
  const renderItem = useCallback(({ item }: { item: Assembleia }) => {
    const dataBr = item.data_evento ? new Date(item.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '--/--/----';

    return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        logger.info('NAVIGATE_TO_ASSEMBLEIA_DETALHE', { id: item.id, titulo: item.titulo });
        navigation.navigate('AssembleiaDetalhe', { id: item.id });
      }}
    >
      <View style={styles.cardHeaderCenter}>
        <View style={[styles.badgeLarge, (styles[`badge${item.estado}` as keyof typeof styles] as any) || styles.badgeCRIADO]}>
          <Text style={styles.badgeTextLarge}>
            {getAssembleiaStatusLabel(item.estado)}
          </Text>
        </View>
      </View>
      <Text style={styles.tituloText}>{getAssembleiaStatusEmoji(item.estado)} {item.tipo} - {item.titulo}</Text>

      <View style={styles.infoRowCenter}>
          <Text style={styles.dataText}>📅 Data: <Text style={styles.dataValue}>{dataBr}</Text></Text>
          <Text style={styles.dataText}>🕒 Horário: <Text style={styles.dataValue}>{item.hora_primeira_chamada || '--:--'}</Text></Text>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.verMais}>Ver Detalhes e Participar</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#003366" />
      </View>
    </TouchableOpacity>
    );
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Filtrar:</Text>
        <CanonicalPicker
          selectedValue={filter}
          onValueChange={(itemValue) => setFilter(itemValue as any)}
          wrapperStyle={{ flex: 1 }}
          items={[
            { label: 'Ativas', value: 'ativas' },
            { label: 'Encerradas', value: 'encerradas' },
            { label: 'Todas', value: 'todas' }
          ]}
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>
      ) : (
        <FlatList
          data={filteredAssembleias}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhuma assembleia encontrada.</Text>
            </View>
          }
        />
      )}

      {ehGestao && (
        <TouchableOpacity
          style={[styles.fab, { bottom: 20 + insets.bottom }]}
          onPress={() => navigation.navigate('CriarAssembleia')}
          accessibilityLabel="Criar Novo Evento de Assembleia"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="plus" size={32} color="#fff" />
        </TouchableOpacity>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f8' },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 10,
  },
  filterLabel: { fontSize: 14, fontWeight: 'bold', color: '#003366', marginRight: 10 },
  pickerWrapper: {
    flex: 1,
    minWidth: 0,
    height: 52,
    justifyContent: 'center',
    backgroundColor: '#f2f4f8',
    borderRadius: 8,
    overflow: 'hidden'
  },
  picker: {
    height: 52,
    width: '100%',
    ...Platform.select({
      android: {
        marginLeft: -4,
      }
    })
  },
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
  cardHeaderCenter: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12 },
  badgeLarge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, elevation: 1 },
  badgeCRIADO: { backgroundColor: '#cfe2ff' },
  badgeEM_CREDENCIAMENTO: { backgroundColor: '#d1e7dd' },
  badgeINICIADO: { backgroundColor: '#fff3cd' },
  badgeSUSPENSA: { backgroundColor: '#e2e3e5' },
  badgeENCERRADO: { backgroundColor: '#f8d7da' },
  badgeTextLarge: { fontSize: 11, fontWeight: 'bold', color: '#333', textTransform: 'uppercase' },
  tipoText: { fontWeight: 'bold', color: '#666' },
  tituloText: { fontSize: 18, fontWeight: 'bold', color: '#003366', marginBottom: 8, textAlign: 'center' },
  infoRowCenter: { flexDirection: 'row', gap: 20, marginBottom: 12, flexWrap: 'wrap', justifyContent: 'center' },
  dataText: { fontSize: 14, color: '#555', fontWeight: '500' },
  dataValue: { color: '#003366', fontWeight: 'bold' },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12 },
  verMais: { fontSize: 14, color: '#003366', fontWeight: 'bold' },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#003366', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  empty: { flex: 1, alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#666' },
});
