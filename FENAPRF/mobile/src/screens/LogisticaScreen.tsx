// mobile/src/screens/LogisticaScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { listarEventosLogistica, LogisticaEvento } from '../services/logisticaService';
import { logger } from '../infra/logger';
import { useAuth } from '../hooks/useAuth';
import { isGestao } from '../utils/userUtils';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';

const LogisticaScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const ehGestao = isGestao(user?.perfil_acesso);
  const [eventos, setEventos] = useState<LogisticaEvento[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEventos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listarEventosLogistica();
      setEventos(data);
    } catch (err) {
      logger.error('LogisticaScreen.fetchEventos', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

  useEffect(() => {
    if (ehGestao) {
      const actions: MenuAction[] = [
        {
          label: 'Criar Evento',
          icon: 'plus',
          onPress: () => navigation.navigate('LogisticaEventoEditor', { eventoId: null })
        }
      ];
      navigation.setOptions({
        headerRight: () => <HeaderMenu actions={actions} />
      });
    }
  }, [ehGestao, navigation]);

  const renderItem = ({ item }: { item: LogisticaEvento }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('LogisticaEvento', { eventoId: item.id })}
    >
      <View style={styles.cardIcon}>
        <MaterialCommunityIcons name="truck-delivery" size={32} color="#003366" />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.titulo}</Text>
        <Text style={styles.cardDates}>
          {new Date(item.data_inicio).toLocaleDateString()} - {new Date(item.data_fim).toLocaleDateString()}
        </Text>
        <View style={[styles.statusBadge, item.status === 'encerrado' ? styles.statusEncerrado : styles.statusAtivo]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#003366" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={eventos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="calendar-blank" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum evento logístico encontrado.</Text>
          </View>
        }
        onRefresh={fetchEventos}
        refreshing={loading}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 15 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e6f0fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  cardDates: { fontSize: 14, color: '#666', marginBottom: 8 },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusAtivo: { backgroundColor: '#e8f5e9' },
  statusEncerrado: { backgroundColor: '#ffebee' },
  statusText: { fontSize: 10, fontWeight: 'bold', color: '#333' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 15, fontSize: 16, color: '#999' },
});

export default LogisticaScreen;
