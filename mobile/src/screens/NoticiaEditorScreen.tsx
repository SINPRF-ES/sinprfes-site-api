import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  fetchNoticia,
  createNoticia,
  updateNoticia,
  publicarNoticia,
  deleteNoticia,
  addNoticiaMidia,
  deleteNoticiaMidia,
  NewsMedia,
} from '../services/newsService';
import SafeScreen from '../components/SafeScreen';
import { useQueryClient } from '@tanstack/react-query';

export default function NoticiaEditorScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const { newsId } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [capaUrl, setCapaUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'RASCUNHO' | 'PUBLICADA'>('RASCUNHO');
  const [midias, setMidias] = useState<NewsMedia[]>([]);

  useEffect(() => {
    if (newsId) {
      loadNoticia();
    }
  }, [newsId]);

  const loadNoticia = async () => {
    setLoading(true);
    try {
      const data = await fetchNoticia(newsId);
      setTitulo(data.titulo);
      setConteudo(data.conteudo);
      setCapaUrl(data.capa_url);
      setStatus(data.status);
      setMidias(data.midias || []);
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível carregar a notícia.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!titulo.trim() || !conteudo.trim()) {
      Alert.alert('Erro', 'Título e conteúdo são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      const payload = { titulo, conteudo, capa_url: capaUrl, status };
      if (newsId) {
        await updateNoticia(newsId, payload);
      } else {
        const created = await createNoticia(payload);
        navigation.setParams({ newsId: created.id });
      }
      queryClient.invalidateQueries({ queryKey: ['noticias'] });
      Alert.alert('Sucesso', 'Notícia salva com sucesso.');
    } catch (err) {
      Alert.alert('Erro', 'Erro ao salvar notícia.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!newsId) {
      Alert.alert('Aviso', 'Salve a notícia como rascunho antes de publicar.');
      return;
    }

    Alert.alert('Confirmar', 'Deseja publicar esta notícia agora?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Publicar',
        onPress: async () => {
          setSaving(true);
          try {
            await publicarNoticia(newsId);
            setStatus('PUBLICADA');
            queryClient.invalidateQueries({ queryKey: ['noticias'] });
            Alert.alert('Sucesso', 'Notícia publicada!');
          } catch (err) {
            Alert.alert('Erro', 'Erro ao publicar notícia.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleDelete = async () => {
    Alert.alert('Confirmar', 'Deseja EXCLUIR permanentemente esta notícia?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteNoticia(newsId);
            queryClient.invalidateQueries({ queryKey: ['noticias'] });
            navigation.goBack();
          } catch (err) {
            Alert.alert('Erro', 'Erro ao excluir notícia.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const pickImage = async (isCapa = false) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      videoMaxDuration: 30, // Limite de 30s no picker se suportado
    });

    if (!result.canceled) {
      const asset = result.assets[0];

      // Validações Mobile-side
      if (asset.type === 'video') {
        if (asset.duration && asset.duration > 30) {
          Alert.alert('Vídeo muito longo', 'A duração máxima permitida é de 30 segundos.');
          return;
        }
        // fileSize em bytes. 50MB = 50 * 1024 * 1024
        if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
          Alert.alert('Vídeo muito grande', 'O tamanho máximo permitido é de 50MB.');
          return;
        }
      }

      uploadMidia(asset, isCapa);
    }
  };

  const uploadMidia = async (asset: any, isCapa: boolean) => {
    if (!newsId) {
      Alert.alert('Aviso', 'Salve a notícia primeiro para poder adicionar mídias.');
      return;
    }

    setSaving(true);
    try {
      const tipo = asset.type === 'video' ? 'VIDEO' : 'IMAGEM';
      const midia = await addNoticiaMidia(newsId, {
        uri: asset.uri,
        type: asset.mimeType || (tipo === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
        name: asset.fileName || `upload_${Date.now()}`,
      }, tipo);

      if (isCapa) {
        setCapaUrl(midia.url);
        await updateNoticia(newsId, { capa_url: midia.url });
      } else {
        setMidias([...midias, midia]);
      }
    } catch (err) {
      Alert.alert('Erro', 'Erro ao fazer upload da mídia.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMidia = async (midiaId: string) => {
    try {
      await deleteNoticiaMidia(midiaId);
      setMidias(midias.filter((m) => m.id !== midiaId));
    } catch (err) {
      Alert.alert('Erro', 'Erro ao remover mídia.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#003366" />
      </View>
    );
  }

  return (
    <SafeScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{newsId ? 'Editar Notícia' : 'Nova Notícia'}</Text>
          {status === 'PUBLICADA' && (
            <View style={styles.publishedBadge}>
              <Text style={styles.publishedText}>PUBLICADA</Text>
            </View>
          )}
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Título</Text>
          <TextInput
            style={styles.input}
            value={titulo}
            onChangeText={setTitulo}
            placeholder="Digite o título da notícia"
          />

          <Text style={styles.label}>Conteúdo (Markdown suportado)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={conteudo}
            onChangeText={setConteudo}
            placeholder="Digite o conteúdo da notícia..."
            multiline
            numberOfLines={10}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Capa da Notícia</Text>
          {capaUrl ? (
            <View style={styles.capaPreviewContainer}>
              <Image source={{ uri: capaUrl }} style={styles.capaPreview} />
              <TouchableOpacity style={styles.removeCapa} onPress={() => setCapaUrl(null)}>
                <FontAwesome name="times-circle" size={24} color="#d32f2f" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.pickButton} onPress={() => pickImage(true)}>
              <FontAwesome name="image" size={20} color="#003366" />
              <Text style={styles.pickButtonText}>Selecionar Capa</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Mídias Adicionais (Galeria)</Text>
          <View style={styles.midiaList}>
            {midias.map((m) => (
              <View key={m.id} style={styles.midiaItem}>
                {m.tipo === 'IMAGEM' ? (
                  <Image source={{ uri: m.url }} style={styles.midiaThumb} />
                ) : (
                  <View style={[styles.midiaThumb, styles.videoThumb]}>
                    <FontAwesome name="play" size={20} color="#666" />
                  </View>
                )}
                <TouchableOpacity style={styles.removeMidia} onPress={() => handleRemoveMidia(m.id)}>
                  <FontAwesome name="trash" size={18} color="#d32f2f" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={[styles.midiaThumb, styles.addButton]} onPress={() => pickImage(false)}>
              <FontAwesome name="plus" size={24} color="#003366" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar Rascunho</Text>}
          </TouchableOpacity>

          {status === 'RASCUNHO' && newsId && (
            <TouchableOpacity style={[styles.btn, styles.btnPublish]} onPress={handlePublish} disabled={saving}>
              <Text style={styles.btnText}>Publicar Agora</Text>
            </TouchableOpacity>
          )}

          {newsId && (
            <TouchableOpacity style={[styles.btn, styles.btnDelete]} onPress={handleDelete} disabled={saving}>
              <Text style={styles.btnText}>Excluir Notícia</Text>
            </TouchableOpacity>
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
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  publishedBadge: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  publishedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  form: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#444',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 150,
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#003366',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    backgroundColor: '#f9f9f9',
  },
  pickButtonText: {
    marginLeft: 10,
    color: '#003366',
    fontWeight: 'bold',
  },
  capaPreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
  },
  capaPreview: {
    width: '100%',
    height: '100%',
  },
  removeCapa: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  midiaList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  midiaItem: {
    position: 'relative',
  },
  midiaThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  videoThumb: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  addButton: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#003366',
    borderStyle: 'dashed',
  },
  removeMidia: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 2,
    elevation: 2,
  },
  actions: {
    gap: 15,
  },
  btn: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSave: {
    backgroundColor: '#003366',
  },
  btnPublish: {
    backgroundColor: '#4caf50',
  },
  btnDelete: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d32f2f',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
