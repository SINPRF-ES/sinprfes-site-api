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
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as Canon from '../utils/user';
import { normalizeText, maskCPF } from '../utils/format';
import { onlyDigits } from '../utils/format';
import { useAuth } from '../hooks/useAuth';
import reportsService from '../services/reportsService';
import { getUsers } from '../services/apiService';
import { logger } from '../infra/logger';
import SafeScreen from '../components/SafeScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { UFS } from '../utils/user';
import CanonicalPicker from '../components/CanonicalPicker';

interface ReportJob {
  id: string;
  report_type: string;
  params: any;
  requester_name: string;
  created_at: string;
  status: string;
}

export default function RelatoriosScreen() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState('INDIVIDUAL');
  const [targetValue, setTargetValue] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [history, setHistory] = useState<ReportJob[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

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

  const loadUsers = useCallback(async () => {
    try {
      setIsSearching(true);
      const data = await getUsers(); // Busca users ativos
      setAllUsers(data);
    } catch (e) {
      console.error('[Reports.loadUsers]', e);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (isPickerVisible && allUsers.length === 0) {
      loadUsers();
    }
  }, [isPickerVisible, allUsers.length, loadUsers]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const term = normalizeText(searchQuery);
      const digits = onlyDigits(searchQuery);

      const filtered = allUsers.filter(f => {
        const nomeMatch = normalizeText(f.name || '').includes(term);
        const cpfMatch = digits !== '' && onlyDigits(f.cpf || '').includes(digits);
        return nomeMatch || cpfMatch;
      });
      setFilteredUsers(filtered.slice(0, 20));
    } else {
      setFilteredUsers([]);
    }
  }, [searchQuery, allUsers]);

  const handleGenerate = async () => {
    let params: any = {};

    if (reportType === 'INDIVIDUAL') {
      if (!targetValue?.id) {
        Alert.alert('Erro', 'Selecione um user.');
        return;
      }
      params.userId = targetValue.id;
    } else if (reportType === 'GLOBAL') {
      // Sem filtro obrigatório
    } else {
      if (!targetValue) {
        Alert.alert('Erro', 'Selecione um valor para o filtro.');
        return;
      }
      params.value = targetValue;
    }

    // Log temporário para depuração
    console.log('[DEBUG] Gerar Relatório:', { reportType, params });

    Alert.alert(
      'Gerar Relatório',
      `O PDF será gerado e enviado para seu e-mail (${user?.email || 'cadastrado'}). Deseja continuar?`,
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

  const handlePreview = async () => {
    let params: any = {};

    if (reportType === 'INDIVIDUAL') {
      if (!targetValue?.id) {
        Alert.alert('Erro', 'Selecione um user.');
        return;
      }
      params.userId = targetValue.id;
    } else if (reportType === 'GLOBAL') {
      // Sem filtro
    } else {
      if (!targetValue) {
        Alert.alert('Erro', 'Selecione um valor para o filtro.');
        return;
      }
      params.value = targetValue;
    }

    setLoadingPreview(true);
    setPreviewData(null);
    try {
      const res = await reportsService.previewReport(reportType, params);
      setPreviewData(res);
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Erro ao carregar preview.';
      Alert.alert('Erro', msg);
    } finally {
      setLoadingPreview(false);
    }
  };

  const renderHistoryItem = ({ item }: { item: ReportJob }) => {
    const date = new Date(item.created_at).toLocaleString('pt-BR');
    const typeLabels: any = {
      INDIVIDUAL: "👤 Dossiê Individual",
      UF: "📍 Por UF",
      GLOBAL: "🌏 Global (Completo)"
    };

    const params = typeof item.params === 'string' ? JSON.parse(item.params) : item.params;

    // Prioriza o nome resolvido (A1)
    const labelParam = item.report_type === 'INDIVIDUAL' ? 'User' : 'Parâmetro';
    const value = params.userNome || params.paramDisplay || params.value || params.userId || "-";

    const a11yLabel = `Relatório: ${typeLabels[item.report_type] || item.report_type}. Data: ${date}. ${labelParam}: ${value}. Solicitante: ${item.requester_name}.`;

    return (
      <View
        style={styles.historyCard}
        accessible={true}
        accessibilityLabel={a11yLabel}
      >
        <View style={styles.historyHeader} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden={true}>
          <Text style={styles.historyType}>{typeLabels[item.report_type] || item.report_type}</Text>
          <Text style={styles.historyDate}>{date}</Text>
        </View>
        <Text style={styles.historyInfo} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden={true}>{labelParam}: {value}</Text>
        <Text style={styles.historyInfo} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden={true}>Solicitante: {item.requester_name}</Text>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Buscar User</Text>
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
              <ActivityIndicator size="large" color="#003366" style={{ marginTop: 20 }} accessibilityLabel="Buscando membros..." />
            ) : (
              <View style={{ maxHeight: 300 }}>
                <FlatList
                  data={filteredUsers}
                  keyExtractor={(item) => String(item.id)}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 16 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.modalItem}
                      onPress={() => {
                        setTargetValue({ id: item.id, name: item.name, cpf: item.cpf });
                        setIsPickerVisible(false);
                        setSearchQuery('');
                      }}
                    >
                      <View>
                        <Text style={styles.modalItemName}>{item.name}</Text>
                        <Text style={styles.modalItemCpf}>{maskCPF(item.cpf)}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={() => (
                    <Text style={styles.modalEmptyText}>
                      {searchQuery.length < 2
                        ? "Digite pelo menos 2 caracteres para buscar..."
                        : "Nenhum user encontrado."}
                    </Text>
                  )}
                />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchHistory(true)} />}
      >
        <View style={styles.card}>
          <Text
            style={styles.cardTitle}
            accessibilityRole="header"
          >
            📊 Gerar Novo Relatório
          </Text>

          <Text style={styles.label}>Tipo de Relatório</Text>
          <CanonicalPicker
            selectedValue={reportType}
            onValueChange={(v) => {
              setReportType(v);
              if (v === 'UF') setTargetValue(UFS[0]);
              else setTargetValue(null);
            }}
            wrapperStyle={styles.pickerWrapper}
            accessibilityLabel="Selecione o tipo de relatório"
            items={[
              { label: '👤 Dossiê do User (Individual)', value: 'INDIVIDUAL' },
              { label: '📍 Por UF', value: 'UF' },
              { label: '🌏 Global (Completo)', value: 'GLOBAL' }
            ]}
          />

          {reportType === 'INDIVIDUAL' && (
             <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setIsPickerVisible(true)}
                accessibilityLabel={targetValue?.name ? `User selecionado: ${targetValue.name}. Toque para alterar.` : 'Toque para selecionar um user para o relatório individual.'}
                accessibilityRole="button"
             >
                <Text style={styles.pickerButtonText}>
                  {targetValue?.name ? `${targetValue.name} (${maskCPF(targetValue.cpf)})` : 'Clique para buscar user...'}
                </Text>
                <MaterialCommunityIcons name="magnify" size={20} color="#666" />
             </TouchableOpacity>
          )}

          {reportType === 'UF' && (
             <CanonicalPicker
                selectedValue={targetValue}
                onValueChange={setTargetValue}
                wrapperStyle={styles.pickerWrapper}
                accessibilityLabel="Selecione a UF para o relatório"
                items={UFS.map(opt => ({ label: opt, value: opt }))}
             />
          )}


          <TouchableOpacity
            style={[styles.button, (loading || loadingPreview) && styles.buttonDisabled]}
            onPress={handleGenerate}
            disabled={loading || loadingPreview}
            accessibilityLabel={loading ? "Gerando relatório, por favor aguarde..." : "Gerar e enviar relatório por e-mail"}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color="#fff" accessibilityLabel="Gerando relatório..." />
            ) : (
              <Text style={styles.buttonText}>📄 Gerar e Enviar por E-mail</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.buttonSecondary, (loading || loadingPreview) && styles.buttonDisabled]}
            onPress={handlePreview}
            disabled={loading || loadingPreview}
            accessibilityLabel={loadingPreview ? "Carregando visualização, por favor aguarde..." : "Visualizar relatório na tela"}
            accessibilityRole="button"
          >
            {loadingPreview ? (
              <ActivityIndicator color="#003366" accessibilityLabel="Carregando visualização..." />
            ) : (
              <Text style={styles.buttonSecondaryText}>👁️ Visualizar na Tela</Text>
            )}
          </TouchableOpacity>
        </View>

        {previewData && (
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <View>
                <Text style={styles.previewTitle}>👁️ Visualização</Text>
                <Text style={styles.previewSubtitle}>Gerada em: {new Date(previewData.generatedAt).toLocaleString('pt-BR')}</Text>
                {previewData.baseCompetencia && <Text style={styles.previewSubtitle}>Base: {previewData.baseCompetencia}</Text>}
              </View>
              <TouchableOpacity onPress={() => setPreviewData(null)}>
                <MaterialCommunityIcons name="close-circle" size={28} color="#c62828" />
              </TouchableOpacity>
            </View>

            {previewData.sections.map((section: any, idx: number) => (
              <View key={idx} style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>{section.title}</Text>

                {section.kind === 'kv' && (
                  <View style={styles.kvContainer}>
                    {section.items.map((item: any, i: number) => (
                      <View key={i} style={styles.kvItem}>
                        <Text style={styles.kvLabel}>{item.label}</Text>
                        <Text style={styles.kvValue}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {section.kind === 'table' && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View style={styles.tableContainer}>
                      <View style={styles.tableHeader}>
                        {section.columns.map((col: string, i: number) => (
                          <View key={i} style={[styles.tableHeaderCell, { width: i === 0 ? 150 : 100 }]}>
                            <Text style={styles.tableHeaderText}>{col}</Text>
                          </View>
                        ))}
                      </View>
                      {section.rows.map((row: any[], i: number) => (
                        <View key={i} style={[styles.tableRow, i % 2 !== 0 && { backgroundColor: '#f8f9fa' }]}>
                          {row.map((cell: any, j: number) => (
                            <View key={j} style={[styles.tableCell, { width: j === 0 ? 150 : 100 }]}>
                              <Text style={styles.tableCellText}>{cell}</Text>
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </View>
            ))}

            <TouchableOpacity
              style={styles.closePreviewButton}
              onPress={() => {
                setPreviewData(null);
                // Scroll back up maybe?
              }}
            >
              <Text style={styles.closePreviewButtonText}>Ocultar Visualização</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.historySection}>
          <Text
            style={styles.sectionTitle}
            accessibilityRole="header"
          >
            📜 Histórico de Solicitações
          </Text>
          {history.length === 0 && !loading ? (
            <Text style={styles.emptyText}>Nenhuma solicitação realizada ainda.</Text>
          ) : (
            <>
              {(showFullHistory ? history : history.slice(0, 5)).map((h) => (
                <View key={h.id}>{renderHistoryItem({ item: h })}</View>
              ))}

              {!showFullHistory && history.length > 5 && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setShowFullHistory(true)}
                >
                  <Text style={styles.showMoreButtonText}>Exibir anteriores</Text>
                </TouchableOpacity>
              )}

              {showFullHistory && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setShowFullHistory(false)}
                >
                  <Text style={styles.showMoreButtonText}>Ver apenas recentes</Text>
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
  pickerWrapper: {
    marginBottom: 20,
  },
  picker: {
    height: 55,
    width: '100%',
    color: '#333',
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
    marginBottom: 16,
  },
  pickerButtonText: { fontSize: 14, color: '#333' },
  button: {
    backgroundColor: '#003366',
    height: 56, // Larger touch area
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#003366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  buttonDisabled: { backgroundColor: '#a0a0a0' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  buttonSecondary: {
    backgroundColor: '#fff',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#003366',
  },
  buttonSecondaryText: { color: '#003366', fontSize: 15, fontWeight: 'bold' },
  previewContainer: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  previewTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366' },
  previewSubtitle: { fontSize: 11, color: '#666' },
  previewSection: { marginBottom: 25 },
  previewSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#003366',
    borderLeftWidth: 4,
    borderLeftColor: '#f1c40f',
    paddingLeft: 8,
    marginBottom: 12,
  },
  kvContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  kvItem: { width: '45%' },
  kvLabel: { fontSize: 10, color: '#777', textTransform: 'uppercase' },
  kvValue: { fontSize: 13, color: '#333', fontWeight: '500' },
  tableContainer: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f3f5' },
  tableHeaderCell: { padding: 10, borderRightWidth: 1, borderRightColor: '#eee' },
  tableHeaderText: { fontSize: 11, fontWeight: 'bold', color: '#003366', textAlign: 'center' },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#eee' },
  tableCell: { padding: 10, borderRightWidth: 1, borderRightColor: '#eee', justifyContent: 'center' },
  tableCellText: { fontSize: 12, color: '#333', textAlign: 'center' },
  closePreviewButton: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#003366',
    alignItems: 'center',
  },
  closePreviewButtonText: { color: '#003366', fontWeight: 'bold' },
  historySection: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 6,
    borderLeftColor: '#003366',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
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
  showMoreButton: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#003366',
    borderRadius: 8,
    marginBottom: 20,
  },
  showMoreButtonText: {
    color: '#003366',
    fontWeight: 'bold',
  },
});
