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
import * as Canon from '../utils/user';
import { normalizeText, maskCPF } from '../utils/format';
import { useAuth } from '../hooks/useAuth';
import api from '../services/apiService';
import { logger } from '../infra/logger';
import { UFS } from '../utils/user';
import SafeScreen from '../components/SafeScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CanonicalPicker from '../components/CanonicalPicker';

interface Campaign {
  id: string;
  title: string | null;
  body: string;
  created_at: string;
  status: string;
  target_type: string;
  target_value: string | null;
  target_label?: string;
  autor_nome: string | null;
  result: {
    sent: number;
    failed: number;
    noTokenOrDenied?: number;
  };
}

export default function NotificacoesPushScreen() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState('ALL');
  const [targetValue, setTargetValue] = useState<any>('');
  const [usersBusca, setUsersBusca] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isShowingAll, setIsShowingAll] = useState(false);

  const fetchHistory = useCallback(async (isRefresh = false, showAll = false) => {
    try {
      logger.info('Push.FetchHistoryStart', { isRefresh, showAll });
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);
      const url = showAll ? '/api/push/campaigns?includeArchived=1' : '/api/push/campaigns';
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
        setUsersBusca([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const performSearch = async (q: string) => {
    try {
        setIsSearching(true);
        // FENAPRF: Busca solta (accent-insensitive) exige trazer a lista e filtrar localmente
        // conforme padrão usado em UsersScreen.tsx
        const response = await api.get('/api/users');
        const results = response.data.users || response.data || [];

        const normalizedQuery = normalizeText(q);
        const queryOnlyDigits = q.replace(/\D/g, '');

        const filtered = results.filter((f: any) => {
          if (f.arquivado_em) return false; // Ignorar arquivados para push

          const nNome = normalizeText(f.name || f.nome || '');
          const nCpf = (f.cpf || '').replace(/\D/g, '');

          const matchNome = nNome.includes(normalizedQuery);
          const matchCpf = (queryOnlyDigits !== '' && nCpf.includes(queryOnlyDigits));

          return matchNome || matchCpf;
        });

        setUsersBusca(filtered.slice(0, 50));
        logger.info('NOTIF_USER_SEARCH_QUERY', { queryLength: q.length, resultsCount: filtered.length });
    } catch (e) {
        console.error(e);
    } finally {
        setIsSearching(false);
    }
  };

  const formatTargetLabelPT = (type: string, value: any) => {
    switch (type) {
      case 'ALL': return 'Todos';
      case 'UF': return `UF: ${value}`;
      case 'DIRETORIA': return 'Apenas Diretoria';
      case 'PRESIDENTES': return 'Apenas Presidentes';
      case 'VICES': return 'Apenas Vices';
      case 'DR': return 'Delegados Representantes (DR)';
      case 'DS': return 'Delegados Substitutos (DS)';
      case 'USER':
        if (Array.isArray(value)) {
          return value.length === 1
            ? `Membro — ${value[0].name || value[0].nome} (${maskCPF(value[0].cpf)})`
            : `${value.length} membros selecionados`;
        }
        if (value && typeof value === 'object') {
          return `Membro — ${value.name || value.nome} (${maskCPF(value.cpf)})`;
        }
        return 'Membros selecionados';
      default: {
        const filter = Canon.FILTROS_MEMBROS.find(f => f.value === type);
        return filter ? filter.label : type;
      }
    }
  };

  const handleSend = () => {
    if (!title.trim()) {
      Alert.alert('Aviso', 'O título é obrigatório.');
      return;
    }

    if (!body.trim()) {
      Alert.alert('Aviso', 'O corpo da mensagem é obrigatório.');
      return;
    }

    if (targetType === 'USER' && (!targetValue || targetValue.length === 0)) {
        Alert.alert('Aviso', 'Selecione pelo menos um membro para o destino específico.');
        return;
    }

    const targetLabel = formatTargetLabelPT(targetType, targetValue);

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
    const sanitizedTitle = String(title || '').trim();
    const sanitizedBody = String(body || '').trim();

    // Normalização defensiva do targetValue conforme o targetType
    let normalizedTargetValue = targetValue;
    if (targetType === 'USER') {
      // FENAPRF: Mantemos o objeto completo para que o histórico mostre o nome corretamente.
      // O backend extrai o .id automaticamente via service.resolvePushTargets.
      if (Array.isArray(targetValue)) {
        normalizedTargetValue = targetValue.filter((u: any) => !!u.id);
      } else if (targetValue && typeof targetValue === 'object' && targetValue.id) {
        normalizedTargetValue = [targetValue];
      } else {
        normalizedTargetValue = [];
      }
    } else if (targetType === 'ALL') {
      normalizedTargetValue = null;
    }

    const payload = {
      title: sanitizedTitle,
      body: sanitizedBody,
      targetType: targetType,
      targetValue: normalizedTargetValue
    };

    logger.info('Push.SendStart', {
      endpoint: '/api/push/campaigns/send',
      titleLength: sanitizedTitle.length,
      bodyLength: sanitizedBody.length,
      targetType: payload.targetType
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
        fetchHistory(true, isShowingAll);
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
    if (item.target_value && typeof item.target_value === 'string') {
      try {
        displayTargetValue = JSON.parse(item.target_value);
      } catch (e) {
        displayTargetValue = item.target_value;
      }
    }

    const targetLabel = item.target_label || formatTargetLabelPT(item.target_type, displayTargetValue);

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
                <Text style={styles.modalTitle}>Buscar Membro</Text>
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
                  data={usersBusca}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.modalItem}
                      onPress={() => {
                        const newUser = { id: item.id, name: item.name || item.nome, cpf: item.cpf };
                        setTargetValue((prev: any[]) => {
                          if (prev.find(u => u.id === newUser.id)) return prev;
                          return [...prev, newUser];
                        });
                        setIsPickerVisible(false);
                        setSearchQuery('');
                        setUsersBusca([]);
                      }}
                    >
                      <View>
                        <Text style={styles.modalItemName} numberOfLines={1} ellipsizeMode="tail">
                          {item.name || item.nome}
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
                        : "Nenhum membro encontrado."}
                    </Text>
                  )}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                />
              )}

              {usersBusca.length >= 50 && (
                <Text style={styles.infoLabel}>Muitos resultados. Refine sua busca se não encontrar quem deseja.</Text>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchHistory(true, isShowingAll)} />}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📢 Nova Notificação</Text>

          <Text style={styles.label}>Público de Destino</Text>
          <CanonicalPicker
            selectedValue={targetType}
            onValueChange={(v) => {
              setTargetType(v);
              setTargetValue(v === 'UF' ? UFS[0] : (v === 'USER' ? [] : ''));
            }}
            wrapperStyle={styles.pickerWrapper}
            items={[
              { label: 'Todos com app', value: 'ALL' },
              ...Canon.FILTROS_MEMBROS
                .filter(f => !['ADMIN_COLAB', 'ADMIN', 'COLABORADOR', 'JOGOS'].includes(f.value))
                .map((f) => ({ label: f.label, value: f.value })),
              { label: 'Individual (Pesquisar)', value: 'USER' }
            ]}
          />

          {targetType === 'UF' && (
             <CanonicalPicker
                selectedValue={targetValue}
                onValueChange={setTargetValue}
                wrapperStyle={styles.pickerWrapper}
                items={UFS.map(opt => ({ label: opt, value: opt }))}
             />
          )}

          {targetType === 'USER' && (
             <View>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setIsPickerVisible(true)}
                >
                  <Text style={styles.pickerButtonText} numberOfLines={1}>
                    {targetValue.length > 0 ? `${targetValue.length} selecionado(s). Clique para adicionar...` : 'Clique para buscar membros...'}
                  </Text>
                  <MaterialCommunityIcons name="magnify" size={20} color="#666" />
                </TouchableOpacity>

                {targetValue.length > 0 && (
                  <View style={styles.selectedUsersList}>
                    {targetValue.map((u: any) => (
                      <View key={u.id} style={styles.selectedUserChip}>
                        <Text style={styles.selectedUserText} numberOfLines={1}>{u.name || u.nome}</Text>
                        <TouchableOpacity onPress={() => setTargetValue(targetValue.filter((x: any) => x.id !== u.id))}>
                          <MaterialCommunityIcons name="close-circle" size={18} color="#c53030" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {targetValue.length === 0 && (
                  <Text style={styles.infoLabel}>Selecione um ou mais membros para o envio específico.</Text>
                )}
             </View>
          )}

          <Text style={[styles.label, { marginTop: 12 }]}>Título *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Informativo FENAPRF"
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

              {!isShowingAll && campaigns.length >= 5 && (
                  <TouchableOpacity
                    style={styles.archivedButton}
                    onPress={() => { setIsShowingAll(true); fetchHistory(true, true); }}
                  >
                    <Text style={styles.archivedButtonText}>Visualizar anteriores</Text>
                  </TouchableOpacity>
              )}

              {isShowingAll && (
                  <TouchableOpacity
                    style={styles.archivedButton}
                    onPress={() => { setIsShowingAll(false); fetchHistory(true, false); }}
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
  pickerWrapper: {
    marginBottom: 10,
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
  selectedUsersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  selectedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2f7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#00336633',
    gap: 5,
  },
  selectedUserText: {
    fontSize: 12,
    color: '#003366',
    maxWidth: 120,
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
