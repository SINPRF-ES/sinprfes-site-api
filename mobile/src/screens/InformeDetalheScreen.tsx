import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchInforme, fetchInformeByRef } from '../services/informesService';
import { fetchAniversario, fetchAniversarioByRef } from '../services/aniversariosService';
import { useAuth } from '../hooks/useAuth';
import { FontAwesome } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import SafeScreen from '../components/SafeScreen';
import { parseBirthdayContent, sanitizeBirthdayHeading } from '../utils/birthdayContent';

const { width } = Dimensions.get('window');

export default function InformeDetalheScreen({ route, navigation }: any) {
  const { newsId, publicRef, module = 'informes' } = route.params || {};
  const isAniversarios = module === 'aniversarios';
  const { usuario } = useAuth();

  const { data: informe, isLoading, isError, refetch } = useQuery<any>({
    queryKey: [isAniversarios ? 'aniversario' : 'informe', newsId || publicRef],
    queryFn: () => {
      if (publicRef) return isAniversarios ? fetchAniversarioByRef(publicRef) : fetchInformeByRef(publicRef);
      return isAniversarios ? fetchAniversario(newsId) : fetchInforme(newsId);
    },
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
    const regex = isAniversarios ? /^(\d{4})(\d{2})(\d{2})-aniversario-(\d+)$/i : /^(\d{4})(\d{2})(\d{2})-informe-(\d+)$/i;
    const match = String(ref).match(regex);
    if (!match) return isAniversarios ? 'Aniversário interno' : 'Informe interno';
    return `${isAniversarios ? 'Aniversário' : 'Informe'} #${match[4]} de ${match[3]}/${match[2]}/${match[1]}`;
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#003366" />
      </View>
    );
  }

  if (isError || !informe) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Erro ao carregar os detalhes do conteúdo.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coverUrl = informe.capa_url;
  const ehGestaoInformes = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO', 'COMUNICADOR'].includes((usuario?.perfil_acesso || '').toUpperCase());
  const canEdit = ehGestaoInformes && informe.is_editable && informe.status_editorial !== 'ARQUIVADA';
  const birthdayData = isAniversarios ? parseBirthdayContent(informe.conteudo) : null;
  const birthdayTitle = isAniversarios ? sanitizeBirthdayHeading(informe.titulo) : '';

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
            <View style={styles.headerMeta}>
              <Text style={styles.date}>{formatDate(informe.data_informe || informe.published_at || informe.created_at)}</Text>
              {!!informe.public_ref && <Text style={styles.refText}>{formatFriendlyRef(informe.public_ref)}</Text>}
            </View>
            {canEdit && (
              <TouchableOpacity
                onPress={() => navigation.navigate('InformeEditor', { newsId: informe.id, module })}
                style={styles.editButton}
              >
                <FontAwesome name="edit" size={18} color="#003366" />
                <Text style={styles.editText}>Editar</Text>
              </TouchableOpacity>
            )}
          </View>

          {isAniversarios ? (
            <View style={styles.birthdayCard}>
              <View style={styles.birthdayGradientHeader}>
                <View style={styles.birthdayLogoContainer}>
                  <Image source={require('../../assets/logo.png')} style={styles.birthdayLogo} resizeMode="contain" />
                </View>
                <View style={styles.birthdayHeaderTextContainer}>
                  <Text style={styles.birthdayTitle}>{birthdayTitle}</Text>
                  <View style={styles.birthdayBadge}>
                    <View style={styles.birthdayBadgeDot} />
                    <Text style={styles.birthdayBadgeText}>CELEBRAÇÃO INSTITUCIONAL</Text>
                  </View>
                </View>
              </View>

              <View style={styles.birthdayBody}>
                <View style={styles.birthdayHighlight}>
                  <Text style={styles.birthdayHighlightTitle}>🎂 Feliz aniversário!</Text>
                  <Text style={styles.birthdayHighlightText}>O SINPRF/ES parabeniza todos os colegas e familiares que celebram mais um ano de vida hoje!</Text>
                </View>

                <View style={styles.birthdayListSection}>
                  <View style={styles.birthdaySectionHeader}>
                    <Text style={styles.birthdaySectionIcon}>🎊</Text>
                    <Text style={styles.birthdaySectionTitle}>LISTA DE ANIVERSARIANTES</Text>
                  </View>
                  {birthdayData?.pessoas?.map((pessoa, index) => (
                    <View key={`${pessoa.nome}-${index}`} style={styles.birthdayListItem}>
                      <Text style={styles.birthdayListItemBullet}>🎈</Text>
                      <View style={styles.birthdayListItemContent}>
                        <Text style={styles.birthdayPersonName}>{pessoa.nome}</Text>
                        {!!pessoa.subline && <Text style={styles.birthdayPersonSubline}>{pessoa.subline}</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.title}>{informe.titulo}</Text>
              <View style={styles.markdownContainer}>
                <Markdown style={markdownStyles as any}>
                  {informe.conteudo}
                </Markdown>
              </View>
            </>
          )}

          {informe.midias && informe.midias.length > 0 && (
            <View style={styles.gallerySection}>
              <Text style={styles.galleryTitle}>Mídias</Text>
              {informe.midias.map((item: any) => (
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
    gap: 12,
  },
  headerMeta: {
    flex: 1,
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
    marginBottom: 4,
  },
  refText: {
    fontSize: 12,
    color: '#003366',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    lineHeight: 32,
  },
  markdownContainer: {
    marginBottom: 30,
  },
  birthdayCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(31, 111, 178, 0.15)',
    marginBottom: 24,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#1f6fb2',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  birthdayGradientHeader: {
    backgroundColor: '#1f6fb2',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  birthdayLogoContainer: {
    backgroundColor: '#fff',
    padding: 6,
    borderRadius: 12,
  },
  birthdayLogo: {
    width: 42,
    height: 42,
  },
  birthdayHeaderTextContainer: {
    flex: 1,
  },
  birthdayTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 24,
  },
  birthdayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  birthdayBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e83e8c',
  },
  birthdayBadgeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  birthdayBody: {
    padding: 20,
  },
  birthdayHighlight: {
    backgroundColor: '#fdf2f8',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#e83e8c',
    padding: 16,
    marginBottom: 20,
  },
  birthdayHighlightTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#be185d',
    marginBottom: 4,
  },
  birthdayHighlightText: {
    fontSize: 15,
    color: '#831843',
    lineHeight: 22,
    fontWeight: '500',
  },
  birthdayListSection: {
    marginBottom: 10,
  },
  birthdaySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  birthdaySectionIcon: {
    fontSize: 18,
  },
  birthdaySectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  birthdayListItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(31, 111, 178, 0.08)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  birthdayListItemBullet: {
    fontSize: 18,
  },
  birthdayListItemContent: {
    flex: 1,
  },
  birthdayPersonName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f6fb2',
  },
  birthdayPersonSubline: {
    marginTop: 2,
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
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
  galleryImage: {
    width: '100%',
    height: 250,
    borderRadius: 10,
    marginBottom: 15,
  },
  mediaItem: {
    marginBottom: 20,
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
