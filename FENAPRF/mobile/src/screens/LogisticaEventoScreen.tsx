// mobile/src/screens/LogisticaEventoScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import {
  obterEventoLogistica,
  listarInscricoesLogistica,
  inscreverProprioLogistica,
  atualizarInscricaoLogistica,
  cancelarInscricaoLogistica,
  cancelarEventoLogistica,
  LogisticaEvento,
  LogisticaInscricao,
} from '../services/logisticaService';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../infra/logger';
import { checkConflict } from '../constants/logistica';
import { isGestao, getCanonicalUserId } from '../utils/userUtils';
import { formatCpf, formatTelefone } from '../shared/format/formatters';
import { formatISOToBRDateTime } from '../utils/date';
import { Linking } from 'react-native';
import { API_BASE_URL } from '../config/env';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';

const parseBRDateTimeToISO = (brStr: string): string | null => {
  if (!brStr) return null;
  const match = brStr.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  try {
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
};

const LogisticaEventoScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { eventoId } = route.params;
  const { user, token } = useAuth();
  const currentUserId = getCanonicalUserId(user);

  const [evento, setEvento] = useState<LogisticaEvento | null>(null);
  const [inscricoes, setInscricoes] = useState<LogisticaInscricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    data_chegada: '',
    data_saida: '',
    observacoes: '',
  });

  // Modal State for Management
  const [mgmtModalVisible, setMgmtModalVisible] = useState(false);
  const [selectedInsc, setSelectedInsc] = useState<LogisticaInscricao | null>(null);
  const [mgmtForm, setMgmtForm] = useState({
    data_chegada: '',
    data_saida: '',
    observacoes: '',
    justificativa: '',
  });

  const [cancelEventoModalVisible, setCancelEventoModalVisible] = useState(false);
  const [justificativaCancelamento, setJustificativaCancelamento] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [evData, insData] = await Promise.all([
        obterEventoLogistica(eventoId),
        listarInscricoesLogistica(eventoId),
      ]);
      setEvento(evData);
      setInscricoes(insData);

      const minha = insData.find((i) => String(i.user_id) === currentUserId);
      if (minha) {
        setForm({
          data_chegada: formatISOToBRDateTime(minha.data_chegada),
          data_saida: formatISOToBRDateTime(minha.data_saida),
          observacoes: minha.observacoes || '',
        });
      }
    } catch (err) {
      logger.error('LogisticaEventoScreen.fetchData', err);
      Alert.alert('Erro', 'Não foi possível carregar os dados do evento.');
    } finally {
      setLoading(false);
    }
  }, [eventoId, currentUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (ehGestao && evento) {
        const actions: MenuAction[] = [
            {
                label: 'Editar Evento',
                icon: 'pencil',
                onPress: () => navigation.navigate('LogisticaEventoEditor', { eventoId: evento.id })
            }
        ];

        if (evento.status !== 'cancelado') {
            actions.push({
                label: 'Cancelar Evento',
                icon: 'delete',
                onPress: () => setCancelEventoModalVisible(true),
                isDestructive: true
            });
        }

        navigation.setOptions({
            headerRight: () => <HeaderMenu actions={actions} />
        });
    }
  }, [ehGestao, evento, navigation]);

  const handleSalvarMinha = async () => {
    const isoChegada = parseBRDateTimeToISO(form.data_chegada);
    const isoSaida = parseBRDateTimeToISO(form.data_saida);

    if (!isoChegada || !isoSaida) {
      Alert.alert('Erro de Formato', 'Use o formato DD/MM/AAAA HH:MM para as datas.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = { ...form, data_chegada: isoChegada, data_saida: isoSaida };
      const minha = inscricoes.find((i) => String(i.user_id) === currentUserId);
      if (minha) {
        await atualizarInscricaoLogistica(minha.id, payload);
      } else {
        await inscreverProprioLogistica(eventoId, payload);
      }
      Alert.alert('Sucesso', 'Sua inscrição foi salva.');
      fetchData();
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível salvar a inscrição.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelarMinha = async () => {
    const minha = inscricoes.find((i) => String(i.user_id) === currentUserId);
    if (!minha) return;
    Alert.alert('Cancelar Inscrição', 'Deseja realmente cancelar sua inscrição?', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelarInscricaoLogistica(minha.id);
            Alert.alert('Sucesso', 'Inscrição cancelada.');
            fetchData();
          } catch (err) {
            Alert.alert('Erro', 'Erro ao cancelar.');
          }
        },
      },
    ]);
  };

  const openMgmtModal = (insc: LogisticaInscricao) => {
    setSelectedInsc(insc);
    setMgmtForm({
      data_chegada: formatISOToBRDateTime(insc.data_chegada),
      data_saida: formatISOToBRDateTime(insc.data_saida),
      observacoes: insc.observacoes || '',
      justificativa: '',
    });
    setMgmtModalVisible(true);
  };

  const handleMgmtSave = async () => {
    if (!selectedInsc || !mgmtForm.justificativa) {
      Alert.alert('Erro', 'Justificativa é obrigatória.');
      return;
    }

    const isoChegada = parseBRDateTimeToISO(mgmtForm.data_chegada);
    const isoSaida = parseBRDateTimeToISO(mgmtForm.data_saida);

    if (!isoChegada || !isoSaida) {
      Alert.alert('Erro de Formato', 'Use o formato DD/MM/AAAA HH:MM para as datas.');
      return;
    }

    try {
      const payload = { ...mgmtForm, data_chegada: isoChegada, data_saida: isoSaida };
      await atualizarInscricaoLogistica(selectedInsc.id, payload);
      setMgmtModalVisible(false);
      fetchData();
    } catch (err) {
      Alert.alert('Erro', 'Erro ao salvar.');
    }
  };

  const handleMgmtCancel = async () => {
    if (!selectedInsc || !mgmtForm.justificativa) {
      Alert.alert('Erro', 'Justificativa é obrigatória para cancelar.');
      return;
    }
    try {
      await cancelarInscricaoLogistica(selectedInsc.id, mgmtForm.justificativa);
      setMgmtModalVisible(false);
      fetchData();
    } catch (err) {
      Alert.alert('Erro', 'Erro ao cancelar.');
    }
  };

  const handleCancelarEvento = async () => {
    if (!justificativaCancelamento.trim()) {
        Alert.alert('Erro', 'Justificativa é obrigatória para cancelar o evento.');
        return;
    }

    try {
        setSubmitting(true);
        await cancelarEventoLogistica(eventoId, justificativaCancelamento);
        Alert.alert('Sucesso', 'Evento cancelado.');
        setCancelEventoModalVisible(false);
        fetchData();
    } catch (err) {
        Alert.alert('Erro', 'Erro ao cancelar evento.');
    } finally {
        setSubmitting(false);
    }
  };

  if (loading || !evento) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#003366" />
      </View>
    );
  }

  const minha = inscricoes.find((i) => String(i.user_id) === currentUserId);
  const ehGestor = isGestao(user?.perfil_acesso);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>{evento.titulo}</Text>
          <Text style={styles.description}>{evento.descricao}</Text>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="calendar-range" size={20} color="#003366" />
            <Text style={styles.infoText}>
              {new Date(evento.data_inicio).toLocaleDateString()} a {new Date(evento.data_fim).toLocaleDateString()}
            </Text>
          </View>
          {evento.documento_link && (
            <TouchableOpacity
              style={styles.docButton}
              onPress={() => navigation.navigate('FileViewer', {
                fileId: evento.documento_link,
                title: 'Documento Oficial',
                context: 'publicacoes'
              })}
            >
              <MaterialCommunityIcons name="file-document-outline" size={20} color="#003366" />
              <Text style={styles.docButtonText}>Ver Documento Oficial</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{minha ? '✅ Minha Inscrição' : '📝 Realizar Inscrição'}</Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Data/Hora de Chegada</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/AAAA HH:MM"
              value={form.data_chegada}
              onChangeText={(text) => setForm({ ...form, data_chegada: text })}
              editable={evento.status !== 'encerrado'}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Data/Hora de Saída</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/AAAA HH:MM"
              value={form.data_saida}
              onChangeText={(text) => setForm({ ...form, data_saida: text })}
              editable={evento.status !== 'encerrado'}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Observações</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Informações de voo, hotel..."
              multiline
              value={form.observacoes}
              onChangeText={(text) => setForm({ ...form, observacoes: text })}
              editable={evento.status !== 'encerrado'}
            />
          </View>
          {evento.status !== 'encerrado' && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.btnPrimary, submitting && styles.btnDisabled, { flex: 1 }]}
                onPress={handleSalvarMinha}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{minha ? 'Atualizar' : 'Inscrever-se'}</Text>}
              </TouchableOpacity>
              {minha && (
                <TouchableOpacity style={styles.btnDanger} onPress={handleCancelarMinha}>
                  <Text style={styles.btnText}>Cancelar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {evento.status === 'encerrado' && (
            <Text style={styles.closedMessage}>Este evento está encerrado.</Text>
          )}
        </View>

        <View style={styles.tableCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>📊 Quadro de Inscritos</Text>
            {ehGestao && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    const url = `${API_BASE_URL}/api/logistica/eventos/${eventoId}/exportar?format=pdf&token=${token || ''}`;
                    Linking.openURL(url);
                  }}
                  style={[styles.btnExport, { backgroundColor: '#d32f2f' }]}
                >
                  <Text style={styles.btnExportText}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const url = `${API_BASE_URL}/api/logistica/eventos/${eventoId}/exportar?format=xls&token=${token || ''}`;
                    Linking.openURL(url);
                  }}
                  style={[styles.btnExport, { backgroundColor: '#2e7d32' }]}
                >
                  <Text style={styles.btnExportText}>XLS</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <ScrollView horizontal>
            <View>
              <View style={styles.tableHeader}>
                <View style={[styles.cell, { width: 150 }]}><Text style={styles.headerText}>Nome</Text></View>
                <View style={[styles.cell, { width: 100 }]}><Text style={styles.headerText}>Cargo/UF</Text></View>
                <View style={[styles.cell, { width: 110 }]}><Text style={styles.headerText}>CPF</Text></View>
                <View style={[styles.cell, { width: 120 }]}><Text style={styles.headerText}>Chegada</Text></View>
                <View style={[styles.cell, { width: 120 }]}><Text style={styles.headerText}>Saída</Text></View>
                {ehGestao && <View style={[styles.cell, { width: 60 }]}><Text style={styles.headerText}>Ação</Text></View>}
              </View>
              {inscricoes.map((item, index) => {
                const hasConflict = inscricoes.some(other => item.id !== other.id && checkConflict(item.cargo, item.uf, other.cargo, other.uf));
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.tableRow,
                      index % 2 === 0 ? styles.rowEven : styles.rowOdd,
                      hasConflict && styles.rowConflict,
                    ]}
                  >
                    <View style={[styles.cell, { width: 150 }]}><Text style={styles.cellText}>{item.name}</Text></View>
                    <View style={[styles.cell, { width: 100 }]}><Text style={styles.cellText}>{item.cargo}/{item.uf}</Text></View>
                    <View style={[styles.cell, { width: 110 }]}><Text style={styles.cellText}>{formatCpf(item.cpf)}</Text></View>
                    <View style={[styles.cell, { width: 120 }]}><Text style={styles.cellText}>{formatISOToBRDateTime(item.data_chegada)}</Text></View>
                    <View style={[styles.cell, { width: 120 }]}><Text style={styles.cellText}>{formatISOToBRDateTime(item.data_saida)}</Text></View>
                    {ehGestao && (
                      <TouchableOpacity style={[styles.cell, { width: 60 }]} onPress={() => openMgmtModal(item)}>
                        <MaterialCommunityIcons name="pencil" size={20} color="#003366" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </KeyboardAwareScrollView>

      {/* Management Modal */}
      <Modal visible={mgmtModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gestão: {selectedInsc?.name}</Text>
              <TouchableOpacity onPress={() => setMgmtModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Chegada</Text>
              <TextInput style={styles.input} value={mgmtForm.data_chegada} onChangeText={(t) => setMgmtForm({ ...mgmtForm, data_chegada: t })} />
              <Text style={styles.label}>Saída</Text>
              <TextInput style={styles.input} value={mgmtForm.data_saida} onChangeText={(t) => setMgmtForm({ ...mgmtForm, data_saida: t })} />
              <Text style={styles.label}>Observações</Text>
              <TextInput style={styles.input} value={mgmtForm.observacoes} onChangeText={(t) => setMgmtForm({ ...mgmtForm, observacoes: t })} />
              <View style={styles.justificationBox}>
                <Text style={[styles.label, { color: '#d32f2f' }]}>Justificativa (Obrigatória) *</Text>
                <TextInput
                  style={[styles.input, { borderColor: '#d32f2f' }]}
                  placeholder="Por que está alterando?"
                  value={mgmtForm.justificativa}
                  onChangeText={(t) => setMgmtForm({ ...mgmtForm, justificativa: t })}
                />
              </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.btnDanger} onPress={handleMgmtCancel}>
                  <Text style={styles.btnText}>Cancelar Inscrição</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleMgmtSave}>
                  <Text style={styles.btnText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cancel Event Modal */}
      <Modal visible={cancelEventoModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cancelar Evento: {evento?.titulo}</Text>
              <TouchableOpacity onPress={() => setCancelEventoModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.justificationBox}>
                <Text style={[styles.label, { color: '#d32f2f' }]}>Justificativa de Cancelamento *</Text>
                <TextInput
                  style={[styles.input, { borderColor: '#d32f2f' }]}
                  placeholder="Por que está cancelando este evento?"
                  value={justificativaCancelamento}
                  onChangeText={setJustificativaCancelamento}
                  multiline
                  numberOfLines={3}
                  autoFocus
                />
              </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.btnCancel} onPress={() => setCancelEventoModalVisible(false)}>
                  <Text style={[styles.btnText, { color: '#666' }]}>Voltar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnDanger} onPress={handleCancelarEvento}>
                  <Text style={styles.btnText}>Confirmar Cancelamento</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 15 },
  headerCard: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 2 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#003366', marginBottom: 8 },
  description: { fontSize: 14, color: '#666', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 14, color: '#333' },
  docButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15, padding: 10, borderWidth: 1, borderColor: '#003366', borderRadius: 8 },
  docButtonText: { color: '#003366', fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366', marginBottom: 15 },
  formGroup: { marginBottom: 12 },
  label: { fontSize: 14, color: '#333', marginBottom: 4, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 16, backgroundColor: '#fff' },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btnPrimary: { backgroundColor: '#003366', padding: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnDanger: { backgroundColor: '#d32f2f', padding: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  btnDisabled: { opacity: 0.5 },
  closedMessage: { textAlign: 'center', color: '#d32f2f', fontWeight: 'bold', marginTop: 10 },
  tableCard: { backgroundColor: '#fff', borderRadius: 12, padding: 15, elevation: 2, marginBottom: 30 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#e6f0fa', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  headerText: { fontWeight: 'bold', color: '#003366', fontSize: 12 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee' },
  rowEven: { backgroundColor: '#fff' },
  rowOdd: { backgroundColor: '#f9f9f9' },
  rowConflict: { backgroundColor: '#fff4e5' },
  cell: { padding: 10, justifyContent: 'center' },
  cellText: { fontSize: 12, color: '#333' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366' },
  modalBody: { marginBottom: 20 },
  justificationBox: { backgroundColor: '#ffebee', padding: 15, borderRadius: 8, marginTop: 15, marginBottom: 15 },
  btnExport: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  btnExportText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});

export default LogisticaEventoScreen;
