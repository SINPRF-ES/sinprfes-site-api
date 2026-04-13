import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchInforme, fetchInformeByRef } from '../services/informesService';
import { fetchAniversario, fetchAniversarioByRef } from '../services/aniversariosService';
import { useAuth } from '../hooks/useAuth';
import { FontAwesome } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import SafeScreen from '../components/SafeScreen';

const { width } = Dimensions.get('window');

type BirthdayPerson = {
  nome: string;
  subline?: string;
};

const BIRTHDAY_EMOJI_PREFIX_REGEX = /^[\s\-–—•*·]*[🎉🎂🎈✨🥳🎊🎁🍰🎆]+\s*/u;
const BIRTHDAY_BR_PREFIX_REGEX = /^\s*BR\s*[:\-|]?\s*/i;

const normalizeBirthdayLine = (line: string): string => {
  return String(line || '')
    .replace(BIRTHDAY_BR_PREFIX_REGEX, '')
    .replace(BIRTHDAY_EMOJI_PREFIX_REGEX, '')
    .trim();
};

const sanitizeBirthdayHeading = (value?: string | null): string => {
  const cleaned = normalizeBirthdayLine(String(value || '').replace(/[🎉🎂🎈✨🥳🎊🎁🍰🎆]/gu, '').trim());
  return cleaned || 'Aniversariantes do dia';
};

const parseBirthdayContent = (conteudo?: string | null): { pessoas: BirthdayPerson[]; footer: string } => {
  const lines = String(conteudo || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => normalizeBirthdayLine(line))
    .filter(Boolean);

  const pessoas: BirthdayPerson[] = [];
  let footer = '';

  const skipHeading = (line: string) => /^(lista de aniversariantes|aniversariantes|feliz anivers[aá]rio!?|anivers[aá]rio)$/i.test(line);

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i].replace(/^[•\-*]\s*/, '').trim();
    if (!rawLine || skipHeading(rawLine)) continue;

    const splitWithDependent = rawLine.split(/\s*[·|-]\s*(?=Dependente de\s+)/i);
    if (splitWithDependent.length > 1) {
      pessoas.push({ nome: splitWithDependent[0].trim(), subline: splitWithDependent[1].trim() });
      continue;
    }

    if (/^Dependente de\s+/i.test(rawLine) && pessoas.length > 0) {
      if (!pessoas[pessoas.length - 1].subline) pessoas[pessoas.length - 1].subline = rawLine;
      continue;
    }

    const nextLine = lines[i + 1] ? lines[i + 1].replace(/^[•\-*]\s*/, '').trim() : '';
    if (/^Dependente de\s+/i.test(nextLine)) {
      pessoas.push({ nome: rawLine, subline: nextLine });
      i += 1;
      continue;
    }

    if (!/anivers[aá]ri/i.test(rawLine) && rawLine.length <= 110 && pessoas.length > 0) {
      footer = rawLine;
      continue;
    }

    pessoas.push({ nome: rawLine });
  }

  return { pessoas, footer };
};

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
              <View style={styles.birthdayHeader}>
                <Text style={styles.birthdayHeaderIcon}>🎉</Text>
                <Text style={styles.birthdayTitle}>{birthdayTitle}</Text>
              </View>

              <View style={styles.birthdayHighlight}>
                <Text style={styles.birthdayHighlightTitle}>🎂 Feliz aniversário!</Text>
                <Text style={styles.birthdayHighlightText}>SINPRF/ES celebra com alegria este dia especial.</Text>
              </View>

              <View style={styles.birthdayListSection}>
                <Text style={styles.birthdaySectionTitle}>Lista de aniversariantes</Text>
                {birthdayData?.pessoas?.map((pessoa, index) => (
                  <View key={`${pessoa.nome}-${index}`} style={styles.birthdayListItem}>
                    <Text style={styles.birthdayPersonName}>{pessoa.nome}</Text>
                    {!!pessoa.subline && <Text style={styles.birthdayPersonSubline}>{pessoa.subline}</Text>}
                  </View>
                ))}
              </View>

              {!!birthdayData?.footer && <Text style={styles.birthdayFooter}>{birthdayData.footer}</Text>}
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 24,
  },
  birthdayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  birthdayHeaderIcon: {
    fontSize: 16,
  },
  birthdayTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    lineHeight: 30,
  },
  birthdayHighlight: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 16,
  },
  birthdayHighlightTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  birthdayHighlightText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  birthdayListSection: {
    marginBottom: 10,
  },
  birthdaySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 10,
  },
  birthdayListItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  birthdayPersonName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  birthdayPersonSubline: {
    marginTop: 2,
    fontSize: 14,
    color: '#64748b',
  },
  birthdayFooter: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
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
