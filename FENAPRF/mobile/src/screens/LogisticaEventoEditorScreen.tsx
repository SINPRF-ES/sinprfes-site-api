// mobile/src/screens/LogisticaEventoEditorScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  obterEventoLogistica,
  criarEventoLogistica,
  atualizarEventoLogistica,
} from '../services/logisticaService';
import SafeScreen from '../components/SafeScreen';
import { formatData, onlyDigits } from '../shared/format/formatters';
import { toISODate, toBrazilianDate } from '../utils/date';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Picker } from '@react-native-picker/picker';

export default function LogisticaEventoEditorScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { eventoId } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    data_inicio: '',
    data_fim: '',
    status: 'ativo',
    documento_link: '',
  });

  useEffect(() => {
    if (eventoId) {
      loadEvento();
    }
  }, [eventoId]);

  const loadEvento = async () => {
    setLoading(true);
    try {
      const data = await obterEventoLogistica(eventoId);
      setForm({
        titulo: data.titulo || '',
        descricao: data.descricao || '',
        data_inicio: data.data_inicio || '',
        data_fim: data.data_fim || '',
        status: data.status || 'ativo',
        documento_link: data.documento_link || '',
      });
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível carregar o evento.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.titulo.trim() || !form.data_inicio || !form.data_fim) {
      Alert.alert('Erro', 'Título, data de início e fim são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        data_inicio: form.data_inicio.includes('/') ? toISODate(form.data_inicio) : form.data_inicio,
        data_fim: form.data_fim.includes('/') ? toISODate(form.data_fim) : form.data_fim,
      };

      if (eventoId) {
        await atualizarEventoLogistica(eventoId, payload);
      } else {
        await criarEventoLogistica(payload);
      }
      Alert.alert('Sucesso', 'Evento salvo com sucesso.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Erro', 'Erro ao salvar evento.');
    } finally {
      setSaving(false);
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
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{eventoId ? 'Editar Evento' : 'Novo Evento'}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Título *</Text>
          <TextInput
            style={styles.input}
            value={form.titulo}
            onChangeText={(t) => setForm({ ...form, titulo: t })}
            placeholder="Título do evento"
          />

          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.descricao}
            onChangeText={(t) => setForm({ ...form, descricao: t })}
            placeholder="Descrição detalhada..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Data Início *</Text>
              <TextInput
                style={styles.input}
                value={formatData(form.data_inicio)}
                onChangeText={(t) => setForm({ ...form, data_inicio: onlyDigits(t).slice(0, 8) })}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <View style={[styles.flex1, { marginLeft: 10 }]}>
              <Text style={styles.label}>Data Fim *</Text>
              <TextInput
                style={styles.input}
                value={formatData(form.data_fim)}
                onChangeText={(t) => setForm({ ...form, data_fim: onlyDigits(t).slice(0, 8) })}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>

          <Text style={styles.label}>Status</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={form.status}
              onValueChange={(v) => setForm({ ...form, status: v })}
            >
              <Picker.Item label="Ativo" value="ativo" />
              <Picker.Item label="Encerrado" value="encerrado" />
            </Picker>
          </View>

          <Text style={styles.label}>ID Documento (Google Drive)</Text>
          <TextInput
            style={styles.input}
            value={form.documento_link}
            onChangeText={(t) => setForm({ ...form, documento_link: t })}
            placeholder="ID do arquivo no Drive"
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Salvar Evento</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => navigation.goBack()}>
            <Text style={[styles.btnText, { color: '#666' }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  form: { marginBottom: 30 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#444', marginBottom: 8, marginTop: 15 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, color: '#333', backgroundColor: '#f9f9f9' },
  textArea: { height: 100 },
  row: { flexDirection: 'row' },
  flex1: { flex: 1 },
  pickerContainer: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, backgroundColor: '#f9f9f9' },
  actions: { gap: 15 },
  btn: { height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btnSave: { backgroundColor: '#003366' },
  btnCancel: { backgroundColor: '#eee' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
