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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Canon from '../utils/canon';
import { maskCPF } from '../utils/masks';
import { useAuth } from '../hooks/useAuth';
import reportsService from '../services/reportsService';
import api from '../services/apiService';
import { logger } from '../infra/logger';
import SafeScreen from '../components/SafeScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ReportJob {
  id: string;
  report_type: string;
  params: any;
  requester_name: string;
  created_at: string;
  status: string;
}

export default function RelatoriosScreen() {
  const { usuario } = useAuth();
  const [reportType, setReportType] = useState('INDIVIDUAL');
  const [targetValue, setTargetValue] = useState<any>(null);
  const [filiadosBusca, setFiliadosBusca] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [history, setHistory] = useState<ReportJob[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);
      const data = await reportsService.getHistory();
      setHistory(data || []);
    } catch (error: any) {
      logger.error('Reports.FetchHistoryErro', error);
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
        setFiliadosBusca(results.slice(0, 20));
    } catch (e) {
        console.error(e);
    } finally {
        setIsSearching(false);
    }
  };

  const handleGenerate = async () => {
    let params: any = {};

    if (reportType === 'INDIVIDUAL') {
      if (!targetValue?.id) {
        Alert.alert('Erro', 'Selecione um filiado.');
        return;
      }
      params.filiadoId = targetValue.id;
    } else {
      if (!targetValue) {
        Alert.alert('Erro', 'Selecione um valor para o filtro.');
        return;
      }
      params.value = targetValue;
    }

    Alert.alert(
      'Gerar Relatório',
      `O PDF será gerado e enviado para seu e-mail (${usuario?.email1 || 'cadastrado'}). Deseja continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Gerar', onPress: () => processGeneration(params) },
      ]
    );
  };

  const processGeneration = async (params: any) => {
    setLoading(true);
    try {
      const res = await reportsService.generateReport(reportType, params);
      Alert.alert('Sucesso', res.message || 'Relatório enviado com sucesso.');
      fetchHistory(true);
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Erro ao gerar relatório.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  const renderHistoryItem = ({ item }: { item: ReportJob }) => {
    const date = new Date(item.created_at).toLocaleString('pt-BR');
    const typeLabels: any = {
      INDIVIDUAL: "👤 Dossiê Individual",
      LOTACAO: "📍 Por Lotação",
      SITUACAO: "📑 Por Situação"
    };

    const params = typeof item.params === 'string' ? JSON.parse(item.params) : item.params;
    const value = params.value || params.filiadoId || "-";

    return (
      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyType}>{typeLabels[item.report_type] || item.report_type}</Text>
          <Text style={styles.historyDate}>{date}</Text>
        </View>
        <Text style={styles.historyInfo}>Parâmetro: {value}</Text>
        <Text style={styles.historyInfo}>Solicitante: {item.requester_name}</Text>
      </View>
    );
  };

  return (
    <SafeScreen style={styles.container}>
      <Modal
        visible={isPickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPickerVisible(false)}
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
                    }}
                  >
                    <View>
                      <Text style={styles.modalItemName}>{item.nome}</Text>
                      <Text style={styles.modalItemCpf}>{maskCPF(item.cpf)}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                  <Text style={styles.modalEmptyText}>Nenhum filiado encontrado.</Text>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchHistory(true)} />}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Gerar Novo Relatório</Text>

          <Text style={styles.label}>Tipo de Relatório</Text>
          <View style={styles.pickerContainer}>
            <Picker
                selectedValue={reportType}
                onValueChange={(v) => {
                  setReportType(v);
                  if (v === 'LOTACAO') setTargetValue(Canon.LOTACOES[0]);
                  else if (v === 'SITUACAO') setTargetValue('ATIVO');
                  else setTargetValue(null);
                }}
                style={styles.picker}
            >
                <Picker.Item label="Dossiê do Filiado (Individual)" value="INDIVIDUAL" />
                <Picker.Item label="Por Lotação" value="LOTACAO" />
                <Picker.Item label="Por Situação Funcional" value="SITUACAO" />
            </Picker>
          </View>

          {reportType === 'INDIVIDUAL' && (
             <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setIsPickerVisible(true)}
             >
                <Text style={styles.pickerButtonText}>
                  {targetValue?.nome ? `${targetValue.nome} (${maskCPF(targetValue.cpf)})` : 'Clique para buscar filiado...'}
                </Text>
                <MaterialCommunityIcons name="magnify" size={20} color="#666" />
             </TouchableOpacity>
          )}

          {reportType === 'LOTACAO' && (
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

          {reportType === 'SITUACAO' && (
             <View style={styles.pickerContainer}>
                <Picker
                    selectedValue={targetValue}
                    onValueChange={setTargetValue}
                    style={styles.picker}
                >
                    <Picker.Item label="ATIVO" value="ATIVO" />
                    <Picker.Item label="VETERANO" value="VETERANO" />
                    <Picker.Item label="PENSIONISTA" value="PENSIONISTA" />
                </Picker>
             </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>📄 Gerar e Enviar por E-mail</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>📜 Histórico de Solicitações</Text>
          {history.length === 0 && !loading ? (
            <Text style={styles.emptyText}>Nenhuma solicitação realizada ainda.</Text>
          ) : (
            history.map((h) => <View key={h.id}>{renderHistoryItem({ item: h })}</View>)
          )}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366', marginBottom: 16 },
  label: { fontSize: 14, color: '#666', marginBottom: 8, fontWeight: 'bold' },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    marginBottom: 16,
  },
  picker: { height: 50 },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fafafa',
    marginBottom: 16,
  },
  pickerButtonText: { fontSize: 14, color: '#333' },
  button: {
    backgroundColor: '#003366',
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
  historyType: { fontSize: 14, fontWeight: 'bold', color: '#003366' },
  historyDate: { fontSize: 11, color: '#999' },
  historyInfo: { fontSize: 12, color: '#666' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 20 },
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
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalSearchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginBottom: 15,
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalItemName: { fontSize: 16, color: '#333' },
  modalItemCpf: { fontSize: 12, color: '#999' },
  modalEmptyText: { textAlign: 'center', color: '#999', marginTop: 20 },
});
