import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import SafeScreen from '../components/SafeScreen';
import {
  arquivarNoticiaCMS,
  atualizarConvenioCMS,
  atualizarNoticiaCMS,
  ContentBlockCMS,
  criarConvenioCMS,
  criarNoticiaCMS,
  listarConveniosCMS,
  listarNoticiasCMS,
  NoticiaCMS,
  publicarNoticiaCMS,
} from '../services/cmsService';
import { COLORS } from '../theme/colors';

type AbaCMS = 'noticias' | 'convenios';

export default function CmsScreen() {
  const [aba, setAba] = useState<AbaCMS>('noticias');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noticiaAtual, setNoticiaAtual] = useState<NoticiaCMS | null>(null);
  const [arquivadas, setArquivadas] = useState<NoticiaCMS[]>([]);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [convenios, setConvenios] = useState<ContentBlockCMS[]>([]);

  const canPublish = useMemo(
    () => Boolean(noticiaAtual?.id && titulo.trim() && conteudo.trim()),
    [noticiaAtual?.id, titulo, conteudo]
  );

  const carregarNoticias = useCallback(async () => {
    const [atuais, arquivadasItems] = await Promise.all([
      listarNoticiasCMS('ATUAL'),
      listarNoticiasCMS('ARQUIVADA'),
    ]);
    const atual = atuais[0] || null;
    setNoticiaAtual(atual);
    setTitulo(atual?.titulo || '');
    setConteudo(atual?.conteudo || '');
    setArquivadas(arquivadasItems);
  }, []);

  const carregarConvenios = useCallback(async () => {
    const blocks = await listarConveniosCMS();
    const sorted = [...blocks].sort((a, b) => (a.ordenacao || 0) - (b.ordenacao || 0));
    setConvenios(sorted);
  }, []);

  const carregarTudo = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([carregarNoticias(), carregarConvenios()]);
    } catch (e) {
      Alert.alert('Erro', 'Falha ao carregar CMS do site.');
    } finally {
      setLoading(false);
    }
  }, [carregarConvenios, carregarNoticias]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  const handleSalvarNoticia = async () => {
    if (!titulo.trim() || !conteudo.trim()) {
      Alert.alert('Validação', 'Título e conteúdo são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      if (noticiaAtual?.id) {
        await atualizarNoticiaCMS(noticiaAtual.id, { titulo: titulo.trim(), conteudo: conteudo.trim() });
      } else {
        await criarNoticiaCMS({ titulo: titulo.trim(), conteudo: conteudo.trim() });
      }
      await carregarNoticias();
      Alert.alert('Sucesso', 'Notícia salva com sucesso.');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar a notícia.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublicarNoticia = async () => {
    if (!noticiaAtual?.id) return;
    setSaving(true);
    try {
      await publicarNoticiaCMS(noticiaAtual.id);
      await carregarNoticias();
      Alert.alert('Sucesso', 'Notícia publicada.');
    } catch (e) {
      Alert.alert('Erro', 'Falha ao publicar notícia.');
    } finally {
      setSaving(false);
    }
  };

  const handleArquivarNoticia = async () => {
    if (!noticiaAtual?.id) return;
    Alert.alert('Confirmar', 'Arquivar notícia atual?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Arquivar',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await arquivarNoticiaCMS(noticiaAtual.id);
            await carregarNoticias();
            Alert.alert('Sucesso', 'Notícia arquivada.');
          } catch (e) {
            Alert.alert('Erro', 'Falha ao arquivar notícia.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const setConvenioField = (id: string, field: keyof ContentBlockCMS, value: any) => {
    setConvenios((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleSalvarConvenios = async () => {
    setSaving(true);
    try {
      for (const bloco of convenios) {
        await atualizarConvenioCMS(bloco.id, {
          page: 'convenios',
          title: bloco.title,
          body: bloco.body,
          link_url: bloco.link_url || '',
          ordenacao: Number(bloco.ordenacao) || 1,
          is_active: Boolean(bloco.is_active),
          media_url: bloco.media_url || '',
          media_type: bloco.media_type || 'image',
        });
      }
      await carregarConvenios();
      Alert.alert('Sucesso', 'Convênios atualizados.');
    } catch (e) {
      Alert.alert('Erro', 'Falha ao salvar convênios.');
    } finally {
      setSaving(false);
    }
  };

  const handleNovoConvenio = async () => {
    setSaving(true);
    try {
      await criarConvenioCMS();
      await carregarConvenios();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível criar um novo convênio.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeScreen style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.prfBlue} />
      </SafeScreen>
    );
  }

  return (
    <SafeScreen style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, aba === 'noticias' && styles.tabActive]} onPress={() => setAba('noticias')}>
          <Text style={[styles.tabText, aba === 'noticias' && styles.tabTextActive]}>Editar Notícias</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, aba === 'convenios' && styles.tabActive]} onPress={() => setAba('convenios')}>
          <Text style={[styles.tabText, aba === 'convenios' && styles.tabTextActive]}>Editar Convênios</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {aba === 'noticias' ? (
          <View style={styles.card}>
            <Text style={styles.title}>📰 Notícias do site</Text>
            <Text style={styles.subtitle}>Paridade com o CMS do site usando os mesmos endpoints.</Text>

            <Text style={styles.label}>Título</Text>
            <TextInput value={titulo} onChangeText={setTitulo} style={styles.input} placeholder="Título da notícia" />

            <Text style={styles.label}>Conteúdo</Text>
            <TextInput
              value={conteudo}
              onChangeText={setConteudo}
              style={[styles.input, styles.textarea]}
              multiline
              textAlignVertical="top"
              placeholder="Conteúdo da notícia"
            />

            <View style={styles.row}>
              <TouchableOpacity style={[styles.button, styles.primary]} onPress={handleSalvarNoticia} disabled={saving}>
                <Text style={styles.buttonText}>Salvar rascunho</Text>
              </TouchableOpacity>
              {noticiaAtual?.id && (
                <TouchableOpacity style={[styles.button, styles.secondary]} onPress={handleArquivarNoticia} disabled={saving}>
                  <Text style={styles.buttonText}>Arquivar</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, styles.publish, (!canPublish || saving) && styles.buttonDisabled]}
              onPress={handlePublicarNoticia}
              disabled={!canPublish || saving}
            >
              <Text style={styles.buttonText}>Publicar notícia atual</Text>
            </TouchableOpacity>

            <Text style={[styles.label, { marginTop: 20 }]}>Notícias arquivadas ({arquivadas.length})</Text>
            {arquivadas.map((item) => (
              <View key={item.id} style={styles.archiveItem}>
                <Text style={styles.archiveTitle} numberOfLines={2}>{item.titulo || 'Sem título'}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.title}>🤝 Convênios do site</Text>
            <Text style={styles.subtitle}>Edite e salve os blocos com os mesmos endpoints do CMS web.</Text>

            <TouchableOpacity style={[styles.button, styles.primary]} onPress={handleNovoConvenio} disabled={saving}>
              <Text style={styles.buttonText}>+ Incluir outro convênio</Text>
            </TouchableOpacity>

            {convenios.map((bloco) => (
              <View key={bloco.id} style={styles.blockCard}>
                <Text style={styles.blockTitle}>ID: {bloco.id}</Text>

                <Text style={styles.label}>Título</Text>
                <TextInput
                  value={bloco.title || ''}
                  onChangeText={(v) => setConvenioField(bloco.id, 'title', v)}
                  style={styles.input}
                />

                <Text style={styles.label}>Corpo</Text>
                <TextInput
                  value={bloco.body || ''}
                  onChangeText={(v) => setConvenioField(bloco.id, 'body', v)}
                  style={[styles.input, styles.textarea]}
                  multiline
                  textAlignVertical="top"
                />

                <Text style={styles.label}>Link (URL)</Text>
                <TextInput
                  value={bloco.link_url || ''}
                  onChangeText={(v) => setConvenioField(bloco.id, 'link_url', v)}
                  style={styles.input}
                />

                <Text style={styles.label}>Ordem de exibição</Text>
                <TextInput
                  value={String(bloco.ordenacao || 1)}
                  onChangeText={(v) => setConvenioField(bloco.id, 'ordenacao', Number(v.replace(/\D/g, '')) || 1)}
                  keyboardType="numeric"
                  style={styles.input}
                />

                <View style={styles.switchRow}>
                  <Text style={styles.label}>Exibir no site</Text>
                  <Switch value={Boolean(bloco.is_active)} onValueChange={(v) => setConvenioField(bloco.id, 'is_active', v)} />
                </View>
              </View>
            ))}

            <TouchableOpacity style={[styles.button, styles.publish]} onPress={handleSalvarConvenios} disabled={saving}>
              <Text style={styles.buttonText}>Salvar todos os blocos</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: { flex: 1, padding: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: COLORS.prfBlue, backgroundColor: '#eaf3ff' },
  tabText: { fontWeight: '700', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.prfBlue },
  scroll: { padding: 14 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.prfBlue },
  subtitle: { color: COLORS.textMuted, marginBottom: 8 },
  label: { fontWeight: '700', color: COLORS.text, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fff',
  },
  textarea: { minHeight: 90 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  button: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center', marginTop: 10 },
  primary: { backgroundColor: COLORS.prfBlue, flex: 1 },
  secondary: { backgroundColor: '#b45309', flex: 1 },
  publish: { backgroundColor: '#2563eb' },
  buttonText: { color: '#fff', fontWeight: '800' },
  buttonDisabled: { opacity: 0.5 },
  archiveItem: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  archiveTitle: { color: COLORS.text, fontWeight: '600' },
  blockCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fff',
  },
  blockTitle: { color: COLORS.prfBlue, fontWeight: '800' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
});
