import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Canon from '../utils/canon';
import { normalizeText, maskCPF } from '../utils/masks';
import { useAuth } from '../hooks/useAuth';
import api from '../services/apiService';
import { logger } from '../infra/logger';
import SafeScreen from '../components/SafeScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Campaign {
  id: string;
  title: string | null;
  body: string;
  created_at: string;
  status: string;
  target_type: string;
  target_value: string | null;
  autor_nome: string | null;
  result: {
    sent: number;
    failed: number;
    noTokenOrDenied?: number;
  };
}

export default function NotificacoesPushScreen() {
  const { usuario } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState('ALL');
  const [targetValue, setTargetValue] = useState<any>('');
  const [filiadosBusca, setFiliadosBusca] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isShowingArchived, setIsShowingArchived] = useState(false);

  const fetchHistory = useCallback(async (isRefresh = false, showArchived = false) => {
    try {
      logger.info('Push.FetchHistoryStart', { isRefresh, showArchived });
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);
      const url = showArchived ? '/api/push/campaigns?includeArchived=1' : '/api/push/campaigns';
      const response = await api.get(url);
      if (response.data.success) {
        setCampaigns(response.data.campaigns);
      }
    } catch (error: any) {
      logger.error('Push.FetchHistoryErro', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.length >= 2) {
        performSearch(searchQuery);
      } else {
        setFiliadosBusca([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const performSearch = async (q: string) => {
    try {
        setIsSearching(true);
        const response = await api.get(`/api/filiados?q=${encodeURIComponent(q)}`);
        const results = response.data.filiados || [];

        const normalizedQuery = normalizeText(q);
        const queryOnlyDigits = q.replace(/\D/g, '');

        const filtered = results.filter((f: any) => {
          const nNome = normalizeText(f.nome || '');
          const nCpf = (f.cpf || '').replace(/\D/g, '');

          const matchNome = nNome.includes(normalizedQuery);
          const matchCpf = nCpf.includes(normalizedQuery) || (queryOnlyDigits && nCpf.includes(queryOnlyDigits));

          return matchNome || matchCpf;
        });

        setFiliadosBusca(filtered.slice(0, 50));
        logger.info('NOTIF_FILIADO_SEARCH_QUERY', { queryLength: q.length, resultsCount: filtered.length });
    } catch (e) {
        console.error(e);
    } finally {
        setIsSearching(false);
    }
  };

  const handleSend = () => {
    if (!body.trim()) {
      Alert.alert('Erro', 'O corpo da mensagem é obrigatório.');
      return;
    }

    if (targetType === 'FILIADO' && !targetValue) {
        Alert.alert('Erro', 'Selecione um filiado para o destino específico.');
        return;
    }

    let targetLabel = targetType;
    if (targetType === 'FILIADO' && targetValue?.nome) {
      targetLabel = `Filiado — ${targetValue.nome} (${maskCPF(targetValue.cpf)})`;
    } else if (targetValue) {
      targetLabel = `${targetType} (${targetValue})`;
    }

    Alert.alert(
      'Confirmar Envio',
      `Deseja realmente enviar esta notificação?\n\nDestino: ${targetLabel}\n\n"${body}"`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar Agora', onPress: sendNotification },
      ]
    );
  };

  const sendNotification = async () => {
    // Garantir que title/body sejam strings (evitar booleans acidentais)
    const sanitizedTitle = title ? String(title).trim() : '';
    const sanitizedBody = body ? String(body).trim() : '';

    const payload = {
      title: sanitizedTitle || null,
      body: sanitizedBody,
      targetType: targetType,
      targetValue: targetValue || null
    };

    logger.info('Push.SendStart', {
      endpoint: '/api/push/campaigns/send',
      titleLength: sanitizedTitle.length,
      bodyLength: sanitizedBody.length,
      types: {
        title: typeof payload.title,
        body: typeof payload.body
      }
    });

    setLoading(true);
    try {
      const response = await api.post('/api/push/campaigns/send', payload);

      logger.info('Push.SendResponse', {
        status: response.status,
        success: response.data.success,
        requestId: response.data.requestId,
        sent: response.data.sent,
        failed: response.data.failed
      });

      if (response.data.success) {
        Alert.alert(
            'Sucesso',
            `Notificação enviada!\n🚀 Sucesso: ${response.data.sent}\n❌ Falhas: ${response.data.failed}\n🚫 Sem Token/Negado: ${response.data.noTokenOrDenied || 0}`
        );
        setTitle('');
        setBody('');
        fetchHistory(true, isShowingArchived);
      } else {
        const errorMsg = response.data.message || response.data.error || 'Erro ao enviar notificação.';
        Alert.alert('Erro', errorMsg);
      }
    } catch (error: any) {
      const status = error.response?.status;
      const responseData = error.response?.data;
      const requestId = responseData?.requestId;
      const serverMessage = responseData?.message || responseData?.error;

      logger.error('Push.SendErro', error, {
        endpoint: '/api/push/campaigns/send',
        status,
        requestId,
        serverMessage,
        payload: { ...payload, title: !!payload.title, body: !!payload.body } // Log existence only for privacy
      });

      if (status === 429) {
        Alert.alert('Limite Atingido', 'Muitas tentativas. Tente novamente em 1 minuto.');
      } else if (serverMessage) {
        Alert.alert('Erro no Servidor', serverMessage);
      } else {
        Alert.alert('Erro', `Não foi possível enviar a notificação no momento (Status: ${status || 'Unknown'}).`);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderCampaign = ({ item }: { item: Campaign }) => {
    const date = new Date(item.created_at).toLocaleString('pt-BR');
    const statusColor = item.status === 'SENT' ? '#2ecc71' : '#e74c3c';

    const statusMap: { [key: string]: string } = {
      SENT: 'ENVIADO',
      FAILED: 'FALHOU',
      QUEUED: 'EM FILA'
    };

    let displayTargetValue: any = item.target_value;
    if (item.target_type === 'FILIADO' && item.target_value) {
      let obj: any = null;
      if (typeof item.target_value === 'object') {
        obj = item.target_value;
      } else {
        try {
          obj = JSON.parse(item.target_value);
        } catch (e) {
          obj = null;
        }
      }

      if (obj && typeof obj === 'object') {
        displayTargetValue = `${obj.nome || ''} (${maskCPF(obj.cpf || '')})`.trim();
        if (displayTargetValue === '()') displayTargetValue = obj.id || item.target_value;
      }
    }

    const targetLabel = item.target_type + (displayTargetValue ? `: ${displayTargetValue}` : '');

    return (
      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyDate}>{date}</Text>
          <Text style={[styles.historyStatus, { color: statusColor }]}>{statusMap[item.status] || item.status}</Text>
        </View>
        <Text style={styles.historyAuthor}>Por: {item.autor_nome || 'Sistema'} | Destino: {targetLabel}</Text>
        {item.title && <Text style={styles.historyTitle}>{item.title}</Text>}
        <Text style={styles.historyBody} numberOfLines={3} ellipsizeMode="tail">{item.body}</Text>
        <View style={styles.historyResult}>
          <Text style={styles.resultText}>🚀 {item.result?.sent || 0}</Text>
          <Text style={styles.resultText}>❌ {item.result?.failed || 0}</Text>
          <Text style={styles.resultText}>🚫 {item.result?.noTokenOrDenied || 0}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeScreen style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
      <Modal
        visible={isPickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPickerVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Buscar Filiado</Text>
                <TouchableOpacity onPress={() => setIsPickerVisible(false)}>
                  <MaterialCommunityIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.modalSearchInput}
                placeholder="Nome ou CPF..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />

              {isSearching ? (
                <ActivityIndicator size="large" color="#003366" style={{ marginTop: 20 }} />
              ) : (
                <FlatList
                  data={filiadosBusca}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.modalItem}
                      onPress={() => {
                        setTargetValue({ id: item.id, nome: item.nome, cpf: item.cpf });
                        setIsPickerVisible(false);
                        setSearchQuery('');
                        setFiliadosBusca([]);
                      }}
                    >
                      <View>
                        <Text style={styles.modalItemName} numberOfLines={1} ellipsizeMode="tail">
                          {item.nome}
                        </Text>
                        <Text style={styles.modalItemCpf}>{maskCPF(item.cpf)}</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color="#ccc" />
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={() => (
                    <Text style={styles.modalEmptyText}>
                      {searchQuery.length < 2
                        ? "Digite pelo menos 2 caracteres para buscar..."
                        : "Nenhum filiado encontrado."}
                    </Text>
                  )}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                />
              )}

              {filiadosBusca.length >= 50 && (
                <Text style={styles.infoLabel}>Muitos resultados. Refine sua busca se não encontrar quem deseja.</Text>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchHistory(true, isShowingArchived)} />}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📢 Nova Notificação</Text>

          <Text style={styles.label}>Público de Destino</Text>
          <View style={styles.pickerContainer}>
            <Picker
                selectedValue={targetType}
                onValueChange={(v) => {
                  setTargetType(v);
                  setTargetValue(v === 'LOTACAO' ? Canon.LOTACOES[0] : '');
                }}
                style={styles.picker}
            >
                <Picker.Item label="Todos com app" value="ALL" />
                <Picker.Item label="Apenas ATIVOS" value="ATIVOS" />
                <Picker.Item label="Veteranos / Pensionistas" value="VETERANOS" />
                <Picker.Item label="Por Lotação" value="LOTACAO" />
                <Picker.Item label="Inscritos nos Jogos" value="JOGOS" />
                <Picker.Item label="Especificar Filiado" value="FILIADO" />
            </Picker>
          </View>

          {targetType === 'LOTACAO' && (
             <View style={styles.pickerContainer}>
                <Picker
                    selectedValue={targetValue}
                    onValueChange={setTargetValue}
                    style={styles.picker}
                >
                    {Canon.LOTACOES.map((opt) => (
                      <Picker.Item key={opt} label={opt} value={opt} />
                    ))}
                </Picker>
             </View>
          )}

          {targetType === 'FILIADO' && (
             <View>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setIsPickerVisible(true)}
                >
                  <Text style={styles.pickerButtonText} numberOfLines={1}>
                    {targetValue?.nome ? `${targetValue.nome} (${maskCPF(targetValue.cpf)})` : 'Clique para buscar filiado...'}
                  </Text>
                  <MaterialCommunityIcons name="magnify" size={20} color="#666" />
                </TouchableOpacity>

                {!targetValue?.id && (
                  <Text style={styles.infoLabel}>Selecione um filiado para o envio específico.</Text>
                )}
             </View>
          )}

          <Text style={[styles.label, { marginTop: 12 }]}>Título (opcional)</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Informativo SINPRF-ES"
            maxLength={60}
          />
          <Text style={styles.counter}>{title.length}/60</Text>

          <Text style={styles.label}>Mensagem *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={body}
            onChangeText={setBody}
            placeholder="Digite sua mensagem aqui..."
            multiline
            numberOfLines={4}
            maxLength={240}
          />
          <Text style={styles.counter}>{body.length}/240</Text>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSend}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="send" size={20} color="#fff" />
                <Text style={styles.buttonText}> Enviar Agora</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>📜 Histórico de Envios</Text>
          {campaigns.length === 0 && !loading ? (
            <Text style={styles.emptyText}>Nenhum envio realizado ainda.</Text>
          ) : (
            <>
              {campaigns.map((c) => <View key={c.id}>{renderCampaign({ item: c })}</View>)}

              {!isShowingArchived && campaigns.length >= 5 && (
                  <TouchableOpacity
                    style={styles.archivedButton}
                    onPress={() => { setIsShowingArchived(true); fetchHistory(true, true); }}
                  >
                    <Text style={styles.archivedButtonText}>Visualizar anteriores</Text>
                  </TouchableOpacity>
              )}

              {isShowingArchived && (
                  <TouchableOpacity
                    style={styles.archivedButton}
                    onPress={() => { setIsShowingArchived(false); fetchHistory(true, false); }}
                  >
                    <Text style={styles.archivedButtonText}>Ver apenas recentes</Text>
                  </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    marginBottom: 10,
    // overflow: 'hidden' // Removido para evitar corte no Android em alguns casos
  },
  picker: {
    height: 60, // Aumentado para evitar corte
    width: '100%',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  pickerButtonText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: Dimensions.get('window').height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#003366',
  },
  modalSearchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalItemName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    maxWidth: Dimensions.get('window').width * 0.7,
  },
  modalItemCpf: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  modalEmptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    paddingBottom: 20,
  },
  scrollContent: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366', marginBottom: 16 },
  label: { fontSize: 14, color: '#666', marginBottom: 4, fontWeight: 'bold' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  counter: { fontSize: 12, color: '#999', textAlign: 'right', marginTop: 2, marginBottom: 12 },
  button: {
    backgroundColor: '#003366',
    flexDirection: 'row',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#cccccc' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  historySection: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#003366',
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  historyDate: { fontSize: 12, color: '#999' },
  historyStatus: { fontSize: 12, fontWeight: 'bold' },
  historyAuthor: { fontSize: 12, color: '#666', marginBottom: 4 },
  historyTitle: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  historyBody: { fontSize: 14, color: '#444', marginVertical: 4 },
  historyResult: { flexDirection: 'row', gap: 12, marginTop: 4 },
  resultText: { fontSize: 12, fontWeight: 'bold', color: '#666' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 20 },
  searchResults: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginTop: 5,
    backgroundColor: '#fff',
  },
  searchItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchItemActive: {
    backgroundColor: '#e6f0fa',
  },
  searchItemText: {
    fontSize: 14,
    color: '#333',
  },
  searchItemTextActive: {
    fontWeight: 'bold',
    color: '#003366',
  },
  searchItemSub: {
    fontSize: 11,
    color: '#999',
  },
  selectedLabel: {
    fontSize: 12,
    color: '#2ecc71',
    marginTop: 5,
    fontWeight: 'bold',
  },
  infoLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 5,
    fontStyle: 'italic',
  },
  archivedButton: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#003366',
    borderRadius: 8
  },
  archivedButtonText: {
    color: '#003366',
    fontWeight: 'bold'
  }
});
