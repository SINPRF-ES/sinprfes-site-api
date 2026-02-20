import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PickerSafe } from '../components/PickerSafe';
import { useAuth } from '../hooks/useAuth';
import { useNetInfo } from '@react-native-community/netinfo';
import { formatAgencia, formatConta, onlyDigits, formatCpf, formatTelefone } from '../shared/format/formatters';
import { formatDateToDdMmYyyy } from '../utils/date';
import { criarRessarcimento } from '../services/ressarcimentoService';
import { logger } from '../infra/logger';
import { getCanonicalFiliadoId } from '../utils/filiadoUtils';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SafeScreen from '../components/SafeScreen';
import api from '../services/apiService';

const parsePtNumber = (input: string): number => {
  if (!input) return 0;
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  const num = Number(normalized);
  return isNaN(num) ? 0 : num;
};

const BANCOS_LISTA = [
  { code: "001", name: "Banco do Brasil" },
  { code: "104", name: "Caixa Econômica" },
  { code: "033", name: "Santander" },
  { code: "237", name: "Bradesco" },
  { code: "341", name: "Itaú" },
  { code: "260", name: "Nubank" },
  { code: "077", name: "Inter" },
  { code: "422", name: "Safra" },
  { code: "041", name: "Banrisul" },
  { code: "021", name: "Banestes" }
];

const RessarcimentoScreen = () => {
  const { usuario } = useAuth();
  const netInfo = useNetInfo();
  const [loading, setLoading] = useState(false);
  const [fetchingUser, setFetchingUser] = useState(false);

  const [form, setForm] = useState({
    nome_solicitante: usuario?.nome || '',
    cpf: usuario?.cpf || '',
    email_destino: usuario?.email1 || usuario?.email2 || '',
    telefone_contato: usuario?.telefone1 || usuario?.telefone2 || '',
    data_inicio: '',
    data_fim: '',
    local: '',
    descricao: '',
    diarias: '0',
    valor_diarias: '0.00',
    km_total: '',
    valor_km: '0.00',
    valor_outros: '',
    valor_total: '0.00',
    banco_select: '',
    banco_outro: '',
    banco: '',
    agencia: '',
    conta: '',
    pix: '',
  });

  const [anexos, setAnexos] = useState<any[]>([]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setFetchingUser(true);
        const { data } = await api.get('/api/filiados/me');
        if (data) {
          setForm(prev => ({
            ...prev,
            nome_solicitante: data.nome || prev.nome_solicitante,
            cpf: data.cpf || prev.cpf,
            email_destino: data.email1 || data.email2 || prev.email_destino,
            telefone_contato: data.telefone1 || data.telefone2 || prev.telefone_contato,
          }));
        }
      } catch (err) {
        logger.error('[Ressarcimento.fetchUser.error]', err);
      } finally {
        setFetchingUser(false);
      }
    };
    fetchUserData();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setForm((prev) => {
      let finalValue = value;
      if (field === 'telefone_contato') {
        finalValue = formatTelefone(value);
      } else if (field === 'data_inicio' || field === 'data_fim') {
        finalValue = formatDateToDdMmYyyy(value);
      }

      const newForm = { ...prev, [field]: finalValue };

      if (field === 'banco_select') {
        newForm.banco = value === 'OUTRO' ? prev.banco_outro : value;
      } else if (field === 'banco_outro') {
        if (prev.banco_select === 'OUTRO') {
          newForm.banco = value;
        }
      }

      return newForm;
    });
  };

  const atualizarCalculos = useCallback(() => {
    setForm(prev => {
      const ini = prev.data_inicio;
      const fim = prev.data_fim;
      const km = parsePtNumber(prev.km_total);
      const outros = parsePtNumber(prev.valor_outros);

      let dias = 0;
      if (ini && fim && ini.length === 10 && fim.length === 10) {
        // Converte DD/MM/YYYY para Date object (YYYY, MM-1, DD)
        const parts1 = ini.split('/');
        const parts2 = fim.split('/');
        const d1 = new Date(parseInt(parts1[2]), parseInt(parts1[1]) - 1, parseInt(parts1[0]));
        const d2 = new Date(parseInt(parts2[2]), parseInt(parts2[1]) - 1, parseInt(parts2[0]));

        if (d2 >= d1) {
          dias = ((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }
      }
      const calcDiarias = Math.max(0, dias - 1 + 0.7);
      const vDiarias = calcDiarias * 500;
      const vKm = km * 1.5;
      const total = vDiarias + vKm + outros;

      return {
        ...prev,
        diarias: calcDiarias.toFixed(1),
        valor_diarias: vDiarias.toFixed(2),
        valor_km: vKm.toFixed(2),
        valor_total: total.toFixed(2),
      };
    });
  }, []);

  useEffect(() => {
    atualizarCalculos();
  }, [form.data_inicio, form.data_fim, form.km_total, form.valor_outros, atualizarCalculos]);

  const handlePickAnexos = async () => {
    Alert.alert(
      'Adicionar Anexo',
      'Escolha o tipo de arquivo',
      [
        { text: 'Imagens (Galeria)', onPress: pickImages },
        { text: 'Documentos (PDF)', onPress: pickDocument },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const pickImages = async () => {
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

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: true,
      });

      if (!result.canceled) {
        setAnexos((prev) => [...prev, ...result.assets]);
      }
    } catch (err) {
      logger.error('[Ressarcimento.pickDocument.error]', err);
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

    if (!form.descricao.trim()) {
      Alert.alert('Erro', 'O campo "Descrição da Missão / Motivo" é obrigatório.');
      return;
    }

    try {
      setLoading(true);
      const filiadoId = getCanonicalFiliadoId(usuario);
      logger.info('[Ressarcimento.submit.start]', { filiadoId });

      const formData = new FormData();

      const toISO = (brDate: string) => {
        if (!brDate || brDate.length !== 10) return '';
        const [d, m, y] = brDate.split('/');
        return `${y}-${m}-${d}`;
      };

      const payload: any = {
        nome: form.nome_solicitante,
        cpf: onlyDigits(form.cpf),
        email_destino: form.email_destino,
        telefone_contato: onlyDigits(form.telefone_contato),
        data_inicio: toISO(form.data_inicio),
        data_fim: toISO(form.data_fim),
        local: form.local,
        descricao: form.descricao,
        diarias: form.diarias,
        valor_diarias: form.valor_diarias,
        km_total: form.km_total || '0',
        valor_km: form.valor_km,
        valor_outros: form.valor_outros || '0',
        valor_total: form.valor_total,
        banco: form.banco,
        agencia: onlyDigits(form.agencia),
        conta: onlyDigits(form.conta),
        pix: form.pix,
      };

      Object.keys(payload).forEach((key) => {
        formData.append(key, payload[key]);
      });

      anexos.forEach((anexo) => {
        const fileUri = anexo.uri;
        const fileName = anexo.name || fileUri.split('/').pop();
        let fileType = anexo.mimeType || anexo.type;

        if (!fileType || fileType === 'success') {
            const ext = fileName.split('.').pop().toLowerCase();
            if (ext === 'pdf') fileType = 'application/pdf';
            else if (ext === 'jpg' || ext === 'jpeg') fileType = 'image/jpeg';
            else if (ext === 'png') fileType = 'image/png';
            else fileType = 'application/octet-stream';
        }

        formData.append('anexos', {
          uri: fileUri,
          name: fileName,
          type: fileType,
        } as any);
      });

      await criarRessarcimento(formData);

      logger.info('[Ressarcimento.submit.success]');
      Alert.alert('Sucesso', 'Sua solicitação foi enviada com sucesso! O sindicato recebeu o pedido e uma cópia foi enviada para o seu e-mail.');

      setForm(prev => ({
        ...prev,
        data_inicio: '',
        data_fim: '',
        local: '',
        descricao: '',
        diarias: '0',
        valor_diarias: '0.00',
        km_total: '',
        valor_km: '0.00',
        valor_outros: '',
        valor_total: '0.00',
        banco_select: '',
        banco_outro: '',
        banco: '',
        agencia: '',
        conta: '',
        pix: '',
      }));
      setAnexos([]);
    } catch (err: any) {
      logger.error('[Ressarcimento.submit.error]', err);
      Alert.alert('Erro', err.response?.data?.error || 'Não foi possível enviar sua solicitação.');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingUser) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /><Text>Carregando seus dados...</Text></View>;
  }

  return (
    <SafeScreen style={styles.container}>
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.headerSubtitle}>Preencha os dados abaixo e anexe os comprovantes.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Dados do Solicitante</Text>
          <Text style={styles.label}>Nome Completo</Text>
          <TextInput style={styles.inputDisabled} value={form.nome_solicitante} editable={false} />

          <Text style={styles.label}>CPF</Text>
          <TextInput style={styles.inputDisabled} value={formatCpf(form.cpf)} editable={false} />

          <Text style={styles.label}>E-mail</Text>
          <TextInput style={styles.inputDisabled} value={form.email_destino} editable={false} />

          <Text style={styles.label}>Telefone Contato</Text>
          <TextInput
            style={styles.input}
            value={form.telefone_contato}
            onChangeText={(v) => handleInputChange('telefone_contato', v)}
            placeholder="(00) 00000-0000"
            keyboardType="phone-pad"
            maxLength={15}
          />
        </View>

        <View style={[styles.card, { backgroundColor: '#f7f9fc' }]}>
          <Text style={styles.cardTitle}>📅 Detalhes da Atividade</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Data Início</Text>
              <TextInput
                style={styles.input}
                value={form.data_inicio}
                onChangeText={(v) => handleInputChange('data_inicio', v)}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.label}>Data Fim</Text>
              <TextInput
                style={styles.input}
                value={form.data_fim}
                onChangeText={(v) => handleInputChange('data_fim', v)}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>
          <Text style={styles.label}>Local / Destino</Text>
          <TextInput
            style={styles.input}
            value={form.local}
            onChangeText={(v) => handleInputChange('local', v)}
            placeholder="Ex: Brasília - DF"
          />
          <Text style={styles.label}>Descrição da Missão / Motivo *</Text>
          <TextInput
            style={[styles.input, { height: 100 }]}
            value={form.descricao}
            onChangeText={(v) => handleInputChange('descricao', v)}
            multiline
            placeholder="Descreva o motivo da viagem/atividade..."
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧮 Despesas e Cálculos</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Diárias Estimadas</Text>
              <TextInput style={styles.inputDisabled} value={form.diarias} editable={false} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.label}>Valor Diárias (R$)</Text>
              <TextInput style={styles.inputDisabled} value={form.valor_diarias} editable={false} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Km Rodados</Text>
              <TextInput
                style={styles.input}
                value={form.km_total}
                onChangeText={(v) => handleInputChange('km_total', v)}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.label}>Valor Km (R$)</Text>
              <TextInput style={styles.inputDisabled} value={form.valor_km} editable={false} />
            </View>
          </View>
          <Text style={styles.label}>Outras Despesas (R$)</Text>
          <TextInput
            style={styles.input}
            value={form.valor_outros}
            onChangeText={(v) => handleInputChange('valor_outros', v)}
            keyboardType="numeric"
            placeholder="0.00"
          />

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total a Receber</Text>
            <Text style={styles.totalValue}>R$ {parsePtNumber(form.valor_total).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: '#f7f9fc' }]}>
          <Text style={styles.cardTitle}>🏦 Dados Bancários</Text>
          <PickerSafe
            label="Banco"
            selectedValue={form.banco_select}
            onValueChange={(v) => handleInputChange('banco_select', v as string)}
            items={[
              { label: "Selecione um banco...", value: "" },
              ...BANCOS_LISTA.map(b => ({ label: `${b.code} - ${b.name}`, value: `${b.code} - ${b.name}` })),
              { label: "Outro (Informar manual)", value: "OUTRO" },
            ]}
          />

          {form.banco_select === 'OUTRO' && (
            <TextInput
              style={styles.input}
              value={form.banco_outro}
              onChangeText={(v) => handleInputChange('banco_outro', v)}
              placeholder="Informe o nome do banco"
            />
          )}

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
          <Text style={styles.label}>PIX (Opcional)</Text>
          <TextInput
            style={styles.input}
            value={form.pix}
            onChangeText={(v) => handleInputChange('pix', v)}
            placeholder="Sua chave PIX"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📎 Comprovantes</Text>
          <TouchableOpacity style={styles.attachButton} onPress={handlePickAnexos}>
            <MaterialCommunityIcons name="paperclip" size={24} color="#003366" />
            <Text style={styles.attachButtonText}>Anexar Documentos (PDF, JPG, PNG)</Text>
          </TouchableOpacity>

          {anexos.map((anexo, index) => (
            <View key={index} style={styles.anexoRow}>
              <MaterialCommunityIcons
                name={anexo.uri.endsWith('.pdf') ? "file-pdf-box" : "image"}
                size={24}
                color="#003366"
              />
              <Text style={styles.anexoName} numberOfLines={1}>
                {anexo.name || anexo.uri.split('/').pop()}
              </Text>
              <TouchableOpacity onPress={() => handleRemoveAnexo(index)}>
                <MaterialCommunityIcons name="close-circle" size={24} color="#dc3545" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, (loading || !form.descricao) && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading || !form.descricao}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Enviar Solicitação</Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  scrollContent: { paddingBottom: 40 },
  headerSubtitle: { fontSize: 13, color: '#666', textAlign: 'center', fontStyle: 'italic' },
  card: { backgroundColor: '#fff', padding: 20, marginBottom: 15, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#003366', marginBottom: 15, textAlign: 'center', textTransform: 'uppercase' },
  label: { fontSize: 13, color: '#555', marginBottom: 5, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 15, backgroundColor: '#fff', fontSize: 16 },
  inputDisabled: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, marginBottom: 15, backgroundColor: '#f8f9fa', color: '#333', fontSize: 16, fontWeight: 'bold' },
  row: { flexDirection: 'row' },
  pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 10, backgroundColor: '#fff' },
  totalBox: { backgroundColor: '#003366', padding: 20, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  totalLabel: { color: '#fff', fontSize: 12, textTransform: 'uppercase', opacity: 0.8 },
  totalValue: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 5 },
  attachButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, borderWidth: 2, borderColor: '#003366', borderStyle: 'dashed', borderRadius: 8, marginBottom: 15 },
  attachButtonText: { color: '#003366', fontWeight: 'bold' },
  anexoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#ddd' },
  anexoName: { flex: 1, fontSize: 14, color: '#333' },
  submitButton: { backgroundColor: '#003366', margin: 20, padding: 18, borderRadius: 30, alignItems: 'center', elevation: 3 },
  submitButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  disabledButton: { opacity: 0.6 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default RessarcimentoScreen;
