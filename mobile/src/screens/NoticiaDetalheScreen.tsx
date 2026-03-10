import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchInforme, InformePost } from '../services/informesService';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config/env';
import { FontAwesome } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import SafeScreen from '../components/SafeScreen';

const { width } = Dimensions.get('window');

export default function NoticiaDetalheScreen({ route, navigation }: any) {
  const { newsId } = route.params;
  const { token, usuario } = useAuth();

  const { data: noticia, isLoading, isError, refetch } = useQuery({
    queryKey: ['noticia', newsId],
    queryFn: () => fetchInforme(newsId),
  });

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '';
    const raw = String(dateString);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    return raw;
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
        <Text style={styles.errorText}>Erro ao carregar os detalhes do informe.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coverUrl = noticia.capa_url;
  const ehGestaoNoticias = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO', 'COMUNICADOR'].includes((usuario?.perfil_acesso || '').toUpperCase());
  const canEdit = ehGestaoNoticias && noticia.is_editable && noticia.status_editorial !== 'ARQUIVADA';

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
            <Text style={styles.date}>{formatDate(noticia.data_informe || noticia.published_at || noticia.created_at)}</Text>
            {canEdit && (
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
                      source={{ uri: item.url.replace('/upload/', '/upload/f_auto,q_auto/') }}
                      style={styles.galleryImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.videoItem}>
                      <Image
                        source={{ uri: item.url.replace('/video/upload/', '/video/upload/f_auto,q_auto/').replace('.mp4', '.jpg').replace('.mov', '.jpg') }}
                        style={styles.galleryImage}
                        resizeMode="cover"
                      />
                      <View style={styles.videoOverlay}>
                        <FontAwesome name="play-circle" size={50} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.videoText}>Vídeo disponível</Text>
                      </View>
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
  videoItem: {
    position: 'relative',
    width: '100%',
    height: 250,
    marginBottom: 15,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  videoText: {
    marginTop: 10,
    fontWeight: 'bold',
    color: '#fff',
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
