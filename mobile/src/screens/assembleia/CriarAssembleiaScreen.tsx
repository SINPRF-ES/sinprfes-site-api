import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeScreen from '../../components/SafeScreen';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { criarAssembleia, uploadEdital } from '../../services/assembleiaService';
import { logger } from '../../infra/logger';
import { formatDateToDdMmYyyy } from '../../utils/date';

export default function CriarAssembleiaScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'AGE' | 'AGO'>('AGE');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [editalFile, setEditalFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const formatHora = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  };

  const handlePickFile = async () => {
    Alert.alert(
      'Anexar Edital',
      'Escolha o tipo de arquivo',
      [
        { text: 'Imagem (Galeria)', onPress: pickImage },
        { text: 'Documento (PDF)', onPress: pickDocument },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à sua galeria.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      setEditalFile(result.assets[0]);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
    });
    if (!result.canceled) {
      setEditalFile(result.assets[0]);
    }
  };

  const handleSalvar = async () => {
    if (!titulo || !descricao || !data || !hora) {
      Alert.alert('Aviso', 'Preencha todos os campos obrigatórios (Título, Pauta, Data e Hora).');
      return;
    }

    try {
      setLoading(true);

      let editalUrl = '';
      if (editalFile) {
        setUploading(true);
        const formData = new FormData();
        const fileUri = editalFile.uri;
        const fileName = editalFile.name || fileUri.split('/').pop();
        let fileType = editalFile.mimeType || editalFile.type;

        if (!fileType || fileType === 'success') {
          const ext = fileName.split('.').pop().toLowerCase();
          if (ext === 'pdf') fileType = 'application/pdf';
          else if (ext === 'jpg' || ext === 'jpeg') fileType = 'image/jpeg';
          else if (ext === 'png') fileType = 'image/png';
          else fileType = 'application/octet-stream';
        }

        formData.append('edital', {
          uri: fileUri,
          name: fileName,
          type: fileType,
        } as any);

        const res = await uploadEdital(formData);
        editalUrl = res.url;
        setUploading(false);
      }

      const [d, m, y] = data.split('/');
      const data_hora_inicio = `${y}-${m}-${d}T${hora}:00`;

      await criarAssembleia({
        titulo,
        tipo,
        descricao,
        data_hora_inicio,
        edital_url: editalUrl
      });

      Alert.alert('Sucesso', 'Assembleia criada com sucesso!');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao criar assembleia.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeScreen style={styles.container}>
    <KeyboardAwareScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 40 }} enableOnAndroid extraScrollHeight={50} keyboardOpeningTime={0} showsVerticalScrollIndicator={false}>
      <Text style={styles.label}>Título *</Text>
      <TextInput
        style={styles.input}
        value={titulo}
        onChangeText={setTitulo}
        placeholder="Ex: Assembleia Geral Extraordinária 01/2026"
      />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Tipo *</Text>
          <View style={styles.pickerBox}>
            <Picker
              selectedValue={tipo}
              onValueChange={(itemValue) => setTipo(itemValue as any)}
              style={styles.picker}
              dropdownIconColor="#003366"
            >
              <Picker.Item label="AGE" value="AGE" />
              <Picker.Item label="AGO" value="AGO" />
            </Picker>
          </View>
        </View>
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Data *</Text>
          <TextInput
            style={styles.input}
            value={data}
            onChangeText={(v) => setData(formatDateToDdMmYyyy(v))}
            placeholder="DD/MM/AAAA"
            keyboardType="numeric"
            maxLength={10}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.label}>Hora *</Text>
          <TextInput
            style={styles.input}
            value={hora}
            onChangeText={(v) => setHora(formatHora(v))}
            placeholder="HH:MM"
            keyboardType="numeric"
            maxLength={5}
          />
        </View>
      </View>

      <Text style={styles.label}>Pauta / Descrição *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={descricao}
        onChangeText={setDescricao}
        placeholder="Descreva os itens da pauta..."
        multiline
        numberOfLines={6}
      />

      <Text style={styles.label}>Edital de Convocação (Opcional)</Text>
      <TouchableOpacity style={styles.btnUpload} onPress={handlePickFile}>
        <MaterialCommunityIcons name="paperclip" size={24} color="#003366" />
        <Text style={styles.btnUploadText}>Selecionar PDF ou Imagem</Text>
      </TouchableOpacity>

      {editalFile && (
        <View style={styles.previewContainer}>
          <Text style={styles.previewLabel}>Preview do Edital:</Text>
          {editalFile.mimeType?.startsWith('image/') || editalFile.type?.startsWith('image/') ? (
            <Image source={{ uri: editalFile.uri }} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <View style={styles.pdfPreview}>
              <MaterialCommunityIcons name="file-pdf-box" size={40} color="#e74c3c" />
              <Text style={styles.pdfName}>{editalFile.name || 'documento.pdf'}</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => setEditalFile(null)} style={styles.btnRemove}>
            <Text style={styles.btnRemoveText}>Remover</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.btnSalvar} onPress={handleSalvar} disabled={loading || uploading}>
        {loading || uploading ? <ActivityIndicator color="#003366" /> : <Text style={styles.btnText}>Criar Assembleia</Text>}
      </TouchableOpacity>
    </KeyboardAwareScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f8', padding: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16, color: '#333' },
  pickerBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 20, height: 50, justifyContent: 'center' },
  picker: { color: '#333', height: 50 },
  textArea: { height: 120, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  btnUpload: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, borderWidth: 1, borderColor: '#003366', borderStyle: 'dashed', borderRadius: 8, marginBottom: 20, backgroundColor: '#fff' },
  btnUploadText: { color: '#003366', fontWeight: 'bold' },
  previewContainer: { marginBottom: 20, padding: 10, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  previewLabel: { fontSize: 12, color: '#666', marginBottom: 10 },
  previewImage: { width: '100%', height: 200, borderRadius: 8 },
  pdfPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  pdfName: { fontSize: 14, color: '#333', flex: 1 },
  btnRemove: { marginTop: 10, padding: 5, alignSelf: 'flex-end' },
  btnRemoveText: { color: '#e74c3c', fontWeight: 'bold' },
  btnSalvar: { backgroundColor: '#f1c40f', padding: 18, borderRadius: 30, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#003366', fontWeight: 'bold', fontSize: 16 },
});
