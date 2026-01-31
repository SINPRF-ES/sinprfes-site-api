import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchNoticia, NewsPost } from '../services/newsService';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config/env';
import { FontAwesome } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import SafeScreen from '../components/SafeScreen';

const { width } = Dimensions.get('window');

export default function NoticiaDetalheScreen({ route }: any) {
  const { newsId } = route.params;
  const { token } = useAuth();

  const { data: noticia, isLoading, isError, refetch } = useQuery({
    queryKey: ['noticia', newsId],
    queryFn: () => fetchNoticia(newsId),
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

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#003366" />
      </View>
    );
  }

  if (isError || !noticia) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Erro ao carregar os detalhes da notícia.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coverUrl = noticia.capa_url;
  const ehGestaoNoticias = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO', 'COMUNICADOR'].includes((usuario?.perfil_acesso || '').toUpperCase());

  return (
    <SafeScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {coverUrl && (
          <Image
            source={{ uri: coverUrl }}
            style={styles.cover}
            resizeMode="cover"
          />
        )}

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.date}>{formatDate(noticia.published_at || noticia.created_at)}</Text>
            {ehGestaoNoticias && (
              <TouchableOpacity
                onPress={() => navigation.navigate('NoticiaEditor', { newsId: noticia.id })}
                style={styles.editButton}
              >
                <FontAwesome name="edit" size={18} color="#003366" />
                <Text style={styles.editText}>Editar</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.title}>{noticia.titulo}</Text>

          <View style={styles.markdownContainer}>
            <Markdown style={markdownStyles}>
              {noticia.conteudo}
            </Markdown>
          </View>

          {noticia.midias && noticia.midias.length > 0 && (
            <View style={styles.gallerySection}>
              <Text style={styles.galleryTitle}>Mídias</Text>
              {noticia.midias.map((item: any) => (
                <View key={item.id} style={styles.mediaItem}>
                  {item.tipo === 'IMAGEM' ? (
                    <Image
                      source={{ uri: item.url }}
                      style={styles.galleryImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.videoPlaceholder}>
                      <FontAwesome name="play-circle" size={50} color="#003366" />
                      <Text style={styles.videoText}>Vídeo disponível</Text>
                      <Text style={styles.videoUrl} numberOfLines={1}>{item.url}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cover: {
    width: '100%',
    height: 250,
  },
  content: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2f7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  editText: {
    marginLeft: 5,
    color: '#003366',
    fontWeight: 'bold',
  },
  date: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    lineHeight: 32,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  tag: {
    backgroundColor: '#eef2f7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    color: '#003366',
    fontWeight: '600',
  },
  markdownContainer: {
    marginBottom: 30,
  },
  gallerySection: {
    marginTop: 20,
  },
  galleryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  galleryList: {
    paddingRight: 20,
  },
  galleryImage: {
    width: '100%',
    height: 250,
    borderRadius: 10,
    marginBottom: 15,
  },
  mediaItem: {
    marginBottom: 20,
  },
  videoPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  videoText: {
    marginTop: 10,
    fontWeight: 'bold',
    color: '#333',
  },
  videoUrl: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#003366',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

const markdownStyles = {
  body: {
    color: '#444',
    fontSize: 16,
    lineHeight: 24,
  },
  heading1: {
    color: '#333',
    marginVertical: 10,
  },
  heading2: {
    color: '#333',
    marginVertical: 10,
  },
  paragraph: {
    marginVertical: 8,
  },
  strong: {
    fontWeight: 'bold',
  },
  em: {
    fontStyle: 'italic',
  },
};
