import React, { useLayoutEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchInformes, InformePost } from '../services/informesService';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config/env';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome } from '@expo/vector-icons';
import { logger } from '../infra/logger';
import SafeScreen from '../components/SafeScreen';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';

export default function NoticiasScreen() {
  const navigation = useNavigation<any>();
  const { token, usuario } = useAuth();

  const { data: noticias, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['noticias'],
    queryFn: () => fetchInformes(),
  });

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (e) {
      return dateString;
    }
  };

  const renderItem = ({ item }: { item: InformePost }) => {
    try {
      const coverUrl = item.capa_url;
      const isRascunho = item.status === 'RASCUNHO';

      return (
        <TouchableOpacity
          style={[styles.card, isRascunho && styles.draftCard]}
          onPress={() => navigation.navigate('NoticiaDetalhe', { newsId: item.id })}
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
              <Text style={styles.date}>{formatDate(item.published_at || item.created_at)}</Text>
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
      logger.error('Error rendering News item', err, { newsId: item?.id });
      return null;
    }
  };

  let ehGestaoNoticias = false;
  try {
    ehGestaoNoticias = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO', 'COMUNICADOR'].includes((usuario?.perfil_acesso || '').toUpperCase());
  } catch (err) {
    logger.error('Error checking management permission in NoticiasScreen', err);
  }

  useLayoutEffect(() => {
    const actions: MenuAction[] = [];

    if (ehGestaoNoticias) {
      actions.push({
        label: 'Criar informe',
        onPress: () => navigation.navigate('NoticiaEditor', { newsId: null }),
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
  }, [navigation, ehGestaoNoticias, refetch]);

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
        data={noticias}
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
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: '#eef2f7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 11,
    color: '#003366',
    fontWeight: '600',
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
