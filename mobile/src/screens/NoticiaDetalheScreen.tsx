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

  const coverUrl = noticia.coverFileId
    ? `${API_BASE_URL}/api/publicacoes/arquivo/${noticia.coverFileId}`
    : null;

  return (
    <SafeScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {coverUrl && (
          <Image
            source={{ uri: coverUrl, headers: { Authorization: `Bearer ${token}` } }}
            style={styles.cover}
            resizeMode="cover"
          />
        )}

        <View style={styles.content}>
          <Text style={styles.date}>{formatDate(noticia.publishedAt)}</Text>
          <Text style={styles.title}>{noticia.title}</Text>

          {noticia.tags && noticia.tags.length > 0 && (
            <View style={styles.tagContainer}>
              {noticia.tags.map((tag, idx) => (
                <View key={idx} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.markdownContainer}>
            <Markdown style={markdownStyles}>
              {noticia.bodyMarkdown}
            </Markdown>
          </View>

          {noticia.galleryFileIds && noticia.galleryFileIds.length > 0 && (
            <View style={styles.gallerySection}>
              <Text style={styles.galleryTitle}>Galeria de Fotos</Text>
              <FlatList
                data={noticia.galleryFileIds}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Image
                    source={{
                      uri: `${API_BASE_URL}/api/publicacoes/arquivo/${item.id}`,
                      headers: { Authorization: `Bearer ${token}` }
                    }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                )}
                contentContainerStyle={styles.galleryList}
              />
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
    width: width * 0.7,
    height: 200,
    borderRadius: 10,
    marginRight: 15,
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
