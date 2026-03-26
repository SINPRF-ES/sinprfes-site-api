import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import SafeScreen from '../components/SafeScreen';
import analyticsService from '../services/analyticsService';
import { EMOJI } from '../constants/emojis';
import { logger } from '../infra/logger';

interface AnalyticsData {
  metricas: {
    diario: number;
    mensal: number;
    total: number;
  };
  origens: Array<{ origem_tipo: string; origem_valor: string; acessos: number }>;
  paginas: Array<{ path: string; acessos: number }>;
  cloudflare: {
    metricas: {
      diario: number;
      mensal: number;
      total: number;
      cache_hit_ratio: number;
      ameacas_total: number;
    };
    recorte?: {
      inicio: string;
      fim: string;
    };
  };
  timezone: string;
}

export default function EstatisticasScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await analyticsService.getResumo();
      setData(res);
    } catch (error: any) {
      logger.error('Analytics.FetchErro', error);
      Alert.alert('Erro', 'Não foi possível carregar as estatísticas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(false);
  };

  const handleSyncCloudflare = async () => {
    setSyncing(true);
    try {
      await analyticsService.syncCloudflare();
      Alert.alert('Sucesso', 'Sincronização com Cloudflare concluída.');
      fetchData(false);
    } catch (error: any) {
      logger.error('Analytics.SyncErro', error);
      Alert.alert('Erro', 'Falha na sincronização: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSyncing(false);
    }
  };

  const renderCard = (titulo: string, valor: number | string, emoji: string, hint?: string) => (
    <View style={styles.cardNumero}>
      <Text style={styles.cardEmojiTitulo}>{emoji} {titulo}</Text>
      <Text style={styles.cardValor}>{Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</Text>
      {hint && <Text style={styles.cardHint}>{hint}</Text>}
    </View>
  );

  const renderTabela = (lista: any[], col1: string, col2: string) => {
    if (!lista || lista.length === 0) {
      return <Text style={styles.emptyText}>Sem dados para exibir.</Text>;
    }

    return (
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 3 }]}>{col1}</Text>
          <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>{col2}</Text>
        </View>
        {lista.map((item, idx) => (
          <View key={idx} style={[styles.tableRow, idx === lista.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={[styles.tableCellText, { flex: 3 }]}>{item.nome}</Text>
            <Text style={[styles.tableCellText, { flex: 1, textAlign: 'right', fontWeight: 'bold' }]}>
              {Number(item.total || 0).toLocaleString('pt-BR')}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeScreen style={styles.centered}>
        <ActivityIndicator size="large" color="#003366" />
        <Text style={{ marginTop: 12, color: '#666' }}>Carregando estatísticas...</Text>
      </SafeScreen>
    );
  }

  const cfRecorte = data?.cloudflare?.recorte;
  const periodoCf = cfRecorte?.inicio && cfRecorte?.fim
    ? `${cfRecorte.inicio} até ${cfRecorte.fim}`
    : 'Aguardando sincronização';

  return (
    <SafeScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Painel consolidado</Text>
            <Text style={styles.headerSubtitle}>
              Fuso: <Text style={{ fontWeight: 'bold' }}>{data?.timezone || 'America/Sao_Paulo'}</Text>
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.syncButton, syncing && { opacity: 0.7 }]}
            onPress={handleSyncCloudflare}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#003366" />
            ) : (
              <Text style={styles.syncButtonText}>Sincronizar Cloudflare</Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.syncFeedback}>Último recorte Cloudflare: {periodoCf}</Text>

        <Text style={styles.sectionTitle}>Acessos registrados pelo site</Text>
        <View style={styles.grid}>
          {renderCard('Acessos hoje', data?.metricas?.diario || 0, '📅')}
          {renderCard('Acessos no mês', data?.metricas?.mensal || 0, '🗓️')}
          {renderCard('Acessos totais', data?.metricas?.total || 0, '🌐')}
        </View>

        <Text style={styles.sectionTitle}>Tráfego de borda (Cloudflare)</Text>
        <View style={styles.grid}>
          {renderCard('Requests hoje', data?.cloudflare?.metricas?.diario || 0, '☁️')}
          {renderCard('Requests no mês', data?.cloudflare?.metricas?.mensal || 0, '📆')}
          {renderCard('Requests totais', data?.cloudflare?.metricas?.total || 0, '🛰️')}
          {renderCard('Cache hit ratio', data?.cloudflare?.metricas?.cache_hit_ratio || 0, '⚡', '% de requests servidos do cache')}
          {renderCard('Ameaças bloqueadas', data?.cloudflare?.metricas?.ameacas_total || 0, '🛡️')}
        </View>

        <View style={styles.uiCard}>
          <Text style={styles.uiCardTitle}>Origem dos acessos (todos os dados)</Text>
          {renderTabela(
            (data?.origens || []).map((o) => ({ nome: `${o.origem_tipo}: ${o.origem_valor}`, total: o.acessos })),
            'Origem',
            'Acessos'
          )}
        </View>

        <View style={styles.uiCard}>
          <Text style={styles.uiCardTitle}>Páginas mais acessadas (todos os dados)</Text>
          {renderTabela(
            (data?.paginas || []).map((p) => ({ nome: p.path, total: p.acessos })),
            'Página',
            'Acessos'
          )}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16 },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#101828' },
  headerSubtitle: { fontSize: 13, color: '#667085', marginTop: 2 },
  syncButton: {
    borderWidth: 1,
    borderColor: '#003366',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  syncButtonText: { color: '#003366', fontSize: 13, fontWeight: '600' },
  syncFeedback: { fontSize: 11, color: '#667085', marginTop: 6, marginBottom: 16, textAlign: 'right' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#344054', marginBottom: 12, marginTop: 8 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  cardNumero: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    minHeight: 100,
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardEmojiTitulo: { fontSize: 13, color: '#475467', marginBottom: 4 },
  cardValor: { fontSize: 22, fontWeight: 'bold', color: '#003366' },
  cardHint: { fontSize: 11, color: '#667085', marginTop: 4 },
  uiCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  uiCardTitle: { fontSize: 16, fontWeight: 'bold', color: '#101828', marginBottom: 12 },
  emptyText: { color: '#667085', fontSize: 14, fontStyle: 'italic' },
  table: { width: '100%' },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e7ec',
  },
  tableHeaderText: { fontSize: 13, fontWeight: 'bold', color: '#475467' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f7',
  },
  tableCellText: { fontSize: 13, color: '#344054' },
});
