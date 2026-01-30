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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
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
  const [targetValue, setTargetValue] = useState('');
  const [filiadosBusca, setFiliadosBusca] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
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

  const handleFiliadoSearch = async (q: string) => {
    if (q.length < 3) return;
    try {
        const response = await api.get(`/api/filiados?q=${q}`);
        setFiliadosBusca(response.data.filiados || []);
    } catch (e) {
        console.error(e);
    }
  };

  const handleSend = () => {
    if (!body.trim()) {
      Alert.alert('Erro', 'O corpo da mensagem é obrigatório.');
      return;
    }

    if (targetType === 'FILIADO' && !targetValue) {
        Alert.alert('Erro', 'Selecione um filiado para o alvo específico.');
        return;
    }

    Alert.alert(
      'Confirmar Envio',
      `Deseja realmente enviar esta notificação?\n\nPúblico: ${targetType}${targetValue ? ' ('+targetValue+')' : ''}\n\n"${body}"`,
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
    const targetLabel = item.target_type + (item.target_value ? `: ${item.target_value}` : '');

    return (
      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyDate}>{date}</Text>
          <Text style={[styles.historyStatus, { color: statusColor }]}>{item.status}</Text>
        </View>
        <Text style={styles.historyAuthor}>Por: {item.autor_nome || 'Sistema'} | Alvo: {targetLabel}</Text>
        {item.title && <Text style={styles.historyTitle}>{item.title}</Text>}
        <Text style={styles.historyBody}>{item.body}</Text>
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchHistory(true, isShowingArchived)} />}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📢 Nova Notificação</Text>

          <Text style={styles.label}>Público Alvo</Text>
          <View style={styles.pickerContainer}>
            <Picker
                selectedValue={targetType}
                onValueChange={(v) => { setTargetType(v); setTargetValue(''); }}
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
                    <Picker.Item label="SEDE" value="SEDE" />
                    <Picker.Item label="DEL1 (Serra)" value="DEL1" />
                    <Picker.Item label="DEL2 (Viana)" value="DEL2" />
                    <Picker.Item label="DEL3 (Linhares)" value="DEL3" />
                    <Picker.Item label="DEL4 (Cachoeiro)" value="DEL4" />
                </Picker>
             </View>
          )}

          {targetType === 'FILIADO' && (
             <View>
                <TextInput
                    style={styles.input}
                    placeholder="Buscar filiado (nome/cpf)..."
                    onChangeText={handleFiliadoSearch}
                />
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={targetValue}
                        onValueChange={setTargetValue}
                        style={styles.picker}
                    >
                        <Picker.Item label="Selecione um filiado..." value="" />
                        {filiadosBusca.map(f => (
                            <Picker.Item key={f.id} label={`${f.nome} (CPF: ${f.cpf})`} value={f.id} />
                        ))}
                    </Picker>
                </View>
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
    overflow: 'hidden'
  },
  picker: {
    height: 50,
    width: '100%',
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
