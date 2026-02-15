import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, SafeAreaView, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import assembleiaService from '../services/assembleiaService';
import { Assembleia } from '../types';
import { formatISOToBRDateTime } from '../../../utils/date';
import { ASSEMBLEIA_ESTADOS } from '../../../utils/user';

export default function ListaAssembleiasScreen() {
  const [assembleias, setAssembleias] = useState<Assembleia[]>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<any>();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await assembleiaService.listar();
      setAssembleias(data);
    } catch (error) {
      console.error('Erro ao listar assembleias:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case ASSEMBLEIA_ESTADOS.EM_CREDENCIAMENTO:
      case ASSEMBLEIA_ESTADOS.INICIADO:
      case 'ABERTA': // Fallback para estados legados se existirem
        return { color: '#28a745', label: 'Em Curso' };
      case ASSEMBLEIA_ESTADOS.SUSPENSA:
        return { color: '#6c757d', label: 'Suspensa' };
      case ASSEMBLEIA_ESTADOS.ENCERRADO:
      case 'ENCERRADA':
        return { color: '#6c757d', label: 'Encerrada' };
      default:
        return { color: '#ffc107', label: 'Agendada' };
    }
  };

  const renderItem = ({ item }: { item: Assembleia }) => {
    const status = getStatusBadge(item.estado);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('SessaoAssembleia', { id: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.tipoText}>{item.tipo}</Text>
          <View style={[styles.badge, { backgroundColor: status.color }]}>
            <Text style={styles.badgeText}>{status.label}</Text>
          </View>
        </View>

        <Text style={styles.tituloText}>{item.titulo}</Text>

        <View style={styles.cardFooter}>
          <MaterialCommunityIcons name="calendar-clock" size={16} color="#666" />
          <Text style={styles.dateText}>
            {item.aberta_em ? formatISOToBRDateTime(item.aberta_em) : formatISOToBRDateTime(item.criado_em)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={assembleias}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="vote-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Nenhuma assembleia encontrada.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#003366',
    backgroundColor: '#e6f0ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tituloText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
});
