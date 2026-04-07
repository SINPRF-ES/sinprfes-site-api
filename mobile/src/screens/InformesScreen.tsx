import React, { useLayoutEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchInformes, InformePost } from '../services/informesService';
import { useAuth } from '../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome } from '@expo/vector-icons';
import { logger } from '../infra/logger';
import SafeScreen from '../components/SafeScreen';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';

export default function InformesScreen() {
  const navigation = useNavigation<any>();
  const { usuario } = useAuth();

  const { data: informes, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['informes'],
    queryFn: () => fetchInformes(),
  });

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '';
    const raw = String(dateString);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return raw;
  };

  const formatFriendlyRef = (ref?: string | null) => {
    if (!ref) return '';
    const match = String(ref).match(/^(\d{4})(\d{2})(\d{2})-informe-(\d+)$/i);
    if (!match) return 'Informe interno';
    return `Informe #${match[4]} de ${match[3]}/${match[2]}/${match[1]}`;
  };

  const renderItem = ({ item }: { item: InformePost }) => {
    try {
      const coverUrl = item.capa_url;
      const isRascunho = item.status === 'RASCUNHO';

      return (
        <TouchableOpacity
          style={[styles.card, isRascunho && styles.draftCard]}
          onPress={() => navigation.navigate('InformeDetalhe', item.public_ref ? { publicRef: item.public_ref } : { newsId: item.id })}
        >
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl.replace('/upload/', '/upload/f_auto,q_auto,w_500/') }}
              style={styles.cover}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.cover, styles.placeholderCover]}>
              <FontAwesome name="newspaper-o" size={40} color="#ccc" />
            </View>
          )}
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.cardMeta}>
                <Text style={styles.date}>{formatDate(item.data_informe || item.published_at || item.created_at)}</Text>
                {!!item.public_ref && <Text style={styles.refText}>{formatFriendlyRef(item.public_ref)}</Text>}
              </View>
              {isRascunho && (
                <View style={styles.draftBadge}>
                  <Text style={styles.draftText}>RASCUNHO</Text>
                </View>
              )}
            </View>
            <Text style={styles.title} numberOfLines={2}>{item.titulo}</Text>
            <Text style={styles.summary} numberOfLines={3}>{item.conteudo}</Text>
          </View>
        </TouchableOpacity>
      );
    } catch (err) {
      logger.error('Error rendering Informe item', err, { newsId: item?.id });
      return null;
    }
  };

  let ehGestaoInformes = false;
  try {
    ehGestaoInformes = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO', 'COMUNICADOR'].includes((usuario?.perfil_acesso || '').toUpperCase());
  } catch (err) {
    logger.error('Error checking management permission in InformesScreen', err);
  }

  useLayoutEffect(() => {
    const actions: MenuAction[] = [];

    if (ehGestaoInformes) {
      actions.push({
        label: 'Criar informe',
        onPress: () => navigation.navigate('InformeEditor', { newsId: null }),
        icon: 'plus'
      });
    }

    actions.push({
      label: 'Atualizar',
      onPress: () => refetch(),
      icon: 'refresh'
    });

    navigation.setOptions({
      headerRight: () => <HeaderMenu actions={actions} />,
    });
  }, [navigation, ehGestaoInformes, refetch]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#003366" />
        <Text style={styles.loadingText}>Carregando informes...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <FontAwesome name="exclamation-circle" size={50} color="#d32f2f" />
        <Text style={styles.errorText}>Erro ao carregar informes.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeScreen style={styles.container}>
      <FlatList
        data={informes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} color="#003366" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum informe encontrado.</Text>
          </View>
        }
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f4f8',
  },
  listContainer: {
    padding: 15,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#003366',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  draftCard: {
    borderWidth: 1,
    borderColor: '#ffc107',
    opacity: 0.9,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    gap: 8,
  },
  cardMeta: {
    flex: 1,
  },
  draftBadge: {
    backgroundColor: '#ffc107',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  draftText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  cover: {
    width: '100%',
    height: 180,
  },
  placeholderCover: {
    backgroundColor: '#e1e4e8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 15,
  },
  date: {
    fontSize: 12,
    color: '#888',
    marginBottom: 5,
  },
  refText: {
    fontSize: 11,
    color: '#003366',
    fontWeight: '600',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  summary: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  }
});
