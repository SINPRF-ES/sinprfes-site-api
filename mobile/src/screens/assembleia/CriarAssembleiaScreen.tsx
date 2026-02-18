import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { PickerSafe } from '../../components/PickerSafe';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeScreen from '../../components/SafeScreen';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { criarAssembleia, uploadEdital } from '../../services/assembleiaService';
import { logger } from '../../infra/logger';
import { formatDateToDdMmYyyy } from '../../utils/date';
import HeaderMenu, { MenuAction } from '../../components/HeaderMenu';

export default function CriarAssembleiaScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'AGE' | 'AGO'>('AGE');
  const [pauta, setPauta] = useState('');
  const [data, setData] = useState('');
  const [hora1, setHora1] = useState('');
  const [hora2, setHora2] = useState('');
  const [editalFile, setEditalFile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const formatHora = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  };

  const handlePickFile = async () => {
    navigation.navigate('PublicacoesPicker', {
        mode: 'picker',
        onSelectFile: (file: any) => {
            setEditalFile(file);
        }
    });
  };

  const handleSalvar = useCallback(async () => {
    if (!titulo || !pauta || !data || !hora1 || !hora2) {
      Alert.alert('Aviso', 'Preencha todos os campos obrigatórios (Título, Pauta, Data, 1ª e 2ª Chamada).');
      return;
    }

    if (!editalFile) {
        Alert.alert('Aviso', 'O edital (PDF da Biblioteca Digital) é obrigatório.');
        return;
    }

    try {
      setLoading(true);

      const [d, m, y] = data.split('/');
      const data_evento = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

      // Validação local adicional antes do envio
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      if (dateObj < hoje) {
        Alert.alert('Aviso', 'A data da assembleia não pode ser no passado.');
        setLoading(false);
        return;
      }

      await criarAssembleia({
        titulo,
        tipo,
        pauta,
        data_evento,
        hora_primeira_chamada: hora1,
        hora_segunda_chamada: hora2,
        edital_drive_file_id: editalFile.id,
        edital_format: 'pdf'
      });

      Alert.alert('Sucesso', 'Assembleia criada com sucesso!');
      navigation.goBack();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Falha ao criar assembleia.';
      Alert.alert('Erro', errorMsg);
    } finally {
      setLoading(false);
    }
  }, [titulo, tipo, pauta, data, hora1, hora2, editalFile]);

  useEffect(() => {
    const actions: MenuAction[] = [
      { label: 'Criar Assembleia', icon: 'check-circle-outline', onPress: handleSalvar }
    ];
    navigation.setOptions({
      headerRight: () => <HeaderMenu actions={actions} />,
      title: 'Nova Assembleia'
    });
  }, [navigation, titulo, tipo, pauta, data, hora1, hora2, editalFile, loading, handleSalvar]);

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
        <PickerSafe
          label="Tipo *"
          selectedValue={tipo}
          onValueChange={(itemValue) => setTipo(itemValue as any)}
          dropdownIconColor="#003366"
          items={[
            { label: "Selecione...", value: "" },
            { label: "Assembleia Geral Extraordinária", value: "AGE" },
            { label: "Assembleia Geral Ordinária", value: "AGO" },
          ]}
        />
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
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>1ª Chamada *</Text>
          <TextInput
            style={styles.input}
            value={hora1}
            onChangeText={(v) => setHora1(formatHora(v))}
            placeholder="HH:MM"
            keyboardType="numeric"
            maxLength={5}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.label}>2ª Chamada *</Text>
          <TextInput
            style={styles.input}
            value={hora2}
            onChangeText={(v) => setHora2(formatHora(v))}
            placeholder="HH:MM"
            keyboardType="numeric"
            maxLength={5}
          />
        </View>
      </View>

      <Text style={styles.label}>Pauta Detalhada *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={pauta}
        onChangeText={setPauta}
        placeholder="Descreva os itens da pauta..."
        multiline
        numberOfLines={6}
      />

      <Text style={styles.label}>Edital de Convocação (Obrigatório PDF do Drive) *</Text>
      <TouchableOpacity style={styles.btnUpload} onPress={handlePickFile}>
        <MaterialCommunityIcons name="google-drive" size={24} color="#003366" />
        <Text style={styles.btnUploadText}>Selecionar da Biblioteca Digital</Text>
      </TouchableOpacity>

      {editalFile && (
        <View style={styles.previewContainer}>
          <Text style={styles.previewLabel}>Edital Selecionado:</Text>
          <View style={styles.pdfPreview}>
            <MaterialCommunityIcons name="file-pdf-box" size={40} color="#e74c3c" />
            <Text style={styles.pdfName}>{editalFile.name || 'documento.pdf'}</Text>
          </View>
          <TouchableOpacity onPress={() => { setEditalFile(null); }} style={styles.btnRemove}>
            <Text style={styles.btnRemoveText}>Remover</Text>
          </TouchableOpacity>
        </View>
      )}

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
