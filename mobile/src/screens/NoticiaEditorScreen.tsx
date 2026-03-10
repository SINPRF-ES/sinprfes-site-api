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
  fetchInforme,
  createInforme,
  updateInforme,
  publicarInforme,
  deleteInforme,
  addInformeMidia,
  deleteInformeMidia,
  definirCapaInforme,
  InformeMedia,
} from '../services/informesService';
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
  const [midias, setMidias] = useState<InformeMedia[]>([]);
  const [dataInforme, setDataInforme] = useState('');
  const [isEditable, setIsEditable] = useState(true);

  useEffect(() => {
    if (newsId) {
      loadNoticia();
    }
  }, [newsId]);

  const loadNoticia = async () => {
    setLoading(true);
    try {
      const data = await fetchInforme(newsId);
      setTitulo(data.titulo);
      setConteudo(data.conteudo);
      setCapaUrl(data.capa_url);
      setStatus(data.status);
      setMidias(data.midias || []);
      setDataInforme(data.data_informe || "");
      setIsEditable(Boolean(data.is_editable) && data.status_editorial !== "ARQUIVADA");
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível carregar o informe.');
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
      const payload = { titulo, conteudo, capa_url: capaUrl, status, data_informe: dataInforme || null };
      if (newsId) {
        await updateInforme(newsId, payload);
      } else {
        const created = await createInforme(payload);
        navigation.setParams({ newsId: created.id });
      }
      queryClient.invalidateQueries({ queryKey: ['noticias'] });
      Alert.alert('Sucesso', 'Informe salvo com sucesso.');
    } catch (err) {
      Alert.alert('Erro', 'Erro ao salvar informe.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!newsId) {
      Alert.alert('Aviso', 'Salve o informe como rascunho antes de publicar.');
      return;
    }

    Alert.alert('Confirmar', 'Deseja publicar este informe agora?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Publicar',
        onPress: async () => {
          setSaving(true);
          try {
            await publicarInforme(newsId);
            setStatus('PUBLICADA');
            queryClient.invalidateQueries({ queryKey: ['noticias'] });
            Alert.alert('Sucesso', 'Informe publicado!');
          } catch (err) {
            Alert.alert('Erro', 'Erro ao publicar informe.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleDelete = async () => {
    if (!isEditable) {
      Alert.alert('Bloqueado', 'Informe arquivado não pode ser excluído.');
      return;
    }

    Alert.alert('Confirmar', 'Deseja EXCLUIR permanentemente este informe?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteInforme(newsId);
            queryClient.invalidateQueries({ queryKey: ['noticias'] });
            navigation.goBack();
          } catch (err) {
            Alert.alert('Erro', 'Erro ao excluir informe.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const pickImage = async (isCapa = false) => {
    if (!isEditable) {
      Alert.alert('Bloqueado', 'Informe arquivado não permite alteração de mídia.');
      return;
    }
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
      Alert.alert('Aviso', 'Salve o informe primeiro para poder adicionar mídias.');
      return;
    }

    setSaving(true);
    try {
      const tipo = asset.type === 'video' ? 'VIDEO' : 'IMAGEM';
      const midia = await addInformeMidia(newsId, {
        uri: asset.uri,
        type: asset.mimeType || (tipo === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
        name: asset.fileName || `upload_${Date.now()}`,
      }, tipo);

      setMidias([...midias, midia]);
      if (isCapa) {
        await definirCapaInforme(newsId, midia.id);
        setCapaUrl(midia.url);
      }
    } catch (err) {
      Alert.alert('Erro', 'Erro ao fazer upload da mídia.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMidia = async (midiaId: string) => {
    if (!isEditable) {
      Alert.alert('Bloqueado', 'Informe arquivado não permite alteração de mídia.');
      return;
    }
    try {
      await deleteInformeMidia(midiaId);
      const next = midias.filter((m) => m.id !== midiaId);
      setMidias(next);
      if (capaUrl && !next.some((m) => m.url === capaUrl)) {
        setCapaUrl(null);
      }
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
          <Text style={styles.headerTitle}>{newsId ? 'Editar Informe' : 'Novo Informe'}</Text>
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
            placeholder="Digite o título do informe"
          />

          <Text style={styles.label}>Data do Informe (AAAA-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={dataInforme}
            onChangeText={setDataInforme}
            placeholder="2026-03-10"
          />

          <Text style={styles.label}>Conteúdo (Markdown suportado)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={conteudo}
            onChangeText={setConteudo}
            placeholder="Digite o conteúdo do informe..."
            multiline
            numberOfLines={10}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Capa do Informe</Text>
          {capaUrl ? (
            <View style={styles.capaPreviewContainer}>
              <Image source={{ uri: capaUrl }} style={styles.capaPreview} />
              <TouchableOpacity style={styles.removeCapa} onPress={async () => { setCapaUrl(null); if (newsId) await definirCapaInforme(newsId, null); }}>
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
                {m.tipo === 'IMAGEM' && (
                  <TouchableOpacity style={styles.coverMark} onPress={async () => { if (newsId) { await definirCapaInforme(newsId, m.id); setCapaUrl(m.url); } }}>
                    <FontAwesome name={capaUrl === m.url ? 'check-circle' : 'image'} size={16} color="#003366" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={[styles.midiaThumb, styles.addButton]} onPress={() => pickImage(false)}>
              <FontAwesome name="plus" size={24} color="#003366" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleSave} disabled={saving || !isEditable}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar Rascunho</Text>}
          </TouchableOpacity>

          {status === 'RASCUNHO' && newsId && isEditable && (
            <TouchableOpacity style={[styles.btn, styles.btnPublish]} onPress={handlePublish} disabled={saving}>
              <Text style={styles.btnText}>Publicar Agora</Text>
            </TouchableOpacity>
          )}

          {newsId && isEditable && (
            <TouchableOpacity style={[styles.btn, styles.btnDelete]} onPress={handleDelete} disabled={saving}>
              <Text style={styles.btnText}>Excluir Informe</Text>
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
  coverMark: {
    marginTop: 6,
    alignItems: "center",
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
    backgroundColor: '#d32f2f',
    borderWidth: 1,
    borderColor: '#d32f2f',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
