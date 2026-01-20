import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useNetInfo } from '@react-native-community/netinfo';
import { formatAgencia, formatConta, onlyDigits } from '../shared/formatters';
import { criarRessarcimento } from '../services/ressarcimentoService';
import { logger } from '../infra/logger';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const RessarcimentoScreen = () => {
  const { usuario } = useAuth();
  const netInfo = useNetInfo();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nome: usuario?.nome || '',
    cpf: usuario?.cpf || '',
    pix_tipo: '',
    pix_chave: '',
    banco: '',
    agencia: '',
    conta: '',
    missao_motivo: '',
    valor_total: '',
  });

  const [anexos, setAnexos] = useState<any[]>([]);

  const handleInputChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à sua galeria.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setAnexos((prev) => [...prev, ...result.assets]);
    }
  };

  const handleRemoveAnexo = (index: number) => {
    setAnexos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!netInfo.isConnected) {
      Alert.alert('Offline', 'Você precisa estar online para enviar.');
      return;
    }

    if (!form.missao_motivo.trim()) {
      Alert.alert('Erro', 'O campo "Descrição da Missão / Motivo" é obrigatório.');
      return;
    }

    try {
      setLoading(true);
      logger.info('[Ressarcimento.submit.start]', { filiadoId: usuario?.id });

      const formData = new FormData();
      Object.keys(form).forEach((key) => {
        let value = form[key];
        if (key === 'agencia') value = onlyDigits(value);
        if (key === 'conta') value = onlyDigits(value);
        if (key === 'valor_total') value = value.replace(',', '.');
        formData.append(key, value);
      });

      anexos.forEach((anexo, index) => {
        const fileUri = anexo.uri;
        const fileName = fileUri.split('/').pop();
        const fileType = 'image/jpeg'; // Fallback

        formData.append('anexos', {
          uri: fileUri,
          name: fileName,
          type: fileType,
        } as any);
      });

      await criarRessarcimento(formData);

      logger.info('[Ressarcimento.submit.success]');
      Alert.alert('Sucesso', 'Sua solicitação foi enviada com sucesso!');

      // Reset form
      setForm({
        ...form,
        pix_tipo: '',
        pix_chave: '',
        banco: '',
        agencia: '',
        conta: '',
        missao_motivo: '',
        valor_total: '',
      });
      setAnexos([]);
    } catch (err: any) {
      logger.error('[Ressarcimento.submit.error]', err);
      Alert.alert('Erro', err.response?.data?.error || 'Não foi possível enviar sua solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>💰 Solicitar Ressarcimento</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Informações Pessoais</Text>
          <Text style={styles.label}>Nome</Text>
          <TextInput style={styles.inputDisabled} value={form.nome} editable={false} />
          <Text style={styles.label}>CPF</Text>
          <TextInput style={styles.inputDisabled} value={form.cpf} editable={false} />
        </View>

        <View style={[styles.card, { backgroundColor: '#f7f9fc' }]}>
          <Text style={styles.cardTitle}>📝 Missão e Valores</Text>
          <Text style={styles.label}>Descrição da Missão / Motivo *</Text>
          <TextInput
            style={[styles.input, { height: 100 }]}
            value={form.missao_motivo}
            onChangeText={(v) => handleInputChange('missao_motivo', v)}
            multiline
            placeholder="Descreva o motivo do ressarcimento..."
          />
          <Text style={styles.label}>Valor Total (R$)</Text>
          <TextInput
            style={styles.input}
            value={form.valor_total}
            onChangeText={(v) => handleInputChange('valor_total', v)}
            keyboardType="numeric"
            placeholder="0,00"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏦 Dados Bancários (Opcional)</Text>
          <Text style={styles.label}>Banco</Text>
          <TextInput
            style={styles.input}
            value={form.banco}
            onChangeText={(v) => handleInputChange('banco', v)}
            placeholder="Ex: Banco do Brasil"
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Agência</Text>
              <TextInput
                style={styles.input}
                value={formatAgencia(form.agencia)}
                onChangeText={(v) => handleInputChange('agencia', v)}
                placeholder="0000-0"
                keyboardType="numeric"
                maxLength={6}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.label}>Conta</Text>
              <TextInput
                style={styles.input}
                value={formatConta(form.conta)}
                onChangeText={(v) => handleInputChange('conta', v)}
                placeholder="00000-0"
                keyboardType="numeric"
                maxLength={7}
              />
            </View>
          </View>
          <Text style={styles.label}>Chave PIX</Text>
          <TextInput
            style={styles.input}
            value={form.pix_chave}
            onChangeText={(v) => handleInputChange('pix_chave', v)}
            placeholder="Sua chave PIX"
          />
        </View>

        <View style={[styles.card, { backgroundColor: '#f7f9fc' }]}>
          <Text style={styles.cardTitle}>📎 Anexos (Comprovantes)</Text>
          <TouchableOpacity style={styles.attachButton} onPress={handlePickImage}>
            <MaterialCommunityIcons name="image-plus" size={24} color="#003366" />
            <Text style={styles.attachButtonText}>Adicionar Imagens</Text>
          </TouchableOpacity>

          {anexos.map((anexo, index) => (
            <View key={index} style={styles.anexoRow}>
              <Text style={styles.anexoName} numberOfLines={1}>
                {anexo.uri.split('/').pop()}
              </Text>
              <TouchableOpacity onPress={() => handleRemoveAnexo(index)}>
                <MaterialCommunityIcons name="close-circle" size={20} color="#dc3545" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Enviar Solicitação</Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  scrollContent: { paddingBottom: 40 },
  header: { padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#003366' },
  card: { backgroundColor: '#fff', padding: 20, marginBottom: 15, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#003366', marginBottom: 15, textAlign: 'center' },
  label: { fontSize: 14, color: '#666', marginBottom: 5, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 15, backgroundColor: '#fff', fontSize: 16 },
  inputDisabled: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, marginBottom: 15, backgroundColor: '#f8f9fa', color: '#999', fontSize: 16 },
  row: { flexDirection: 'row' },
  attachButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 15, borderWidth: 2, borderColor: '#003366', borderStyle: 'dashed', borderRadius: 8, marginBottom: 15 },
  attachButtonText: { color: '#003366', fontWeight: 'bold' },
  anexoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: '#fff', borderRadius: 8, marginBottom: 5, borderWidth: 1, borderColor: '#ddd' },
  anexoName: { flex: 1, fontSize: 12, color: '#333' },
  submitButton: { backgroundColor: '#003366', margin: 20, padding: 18, borderRadius: 30, alignItems: 'center', elevation: 3 },
  submitButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  disabledButton: { opacity: 0.6 },
});

export default RessarcimentoScreen;
