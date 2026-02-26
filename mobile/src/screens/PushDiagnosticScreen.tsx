import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Clipboard,
} from 'react-native';
import SafeScreen from '../components/SafeScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { obterExpoPushToken, registrarDispositivoParaPush } from '../services/deviceService';
import api from '../services/apiService';
import { logger } from '../infra/logger';
import { APP_SCOPE } from '../config/env';

interface BackendToken {
  expo_push_token: string;
  project_id: string | null;
  expo_project_id: string | null;
  app_scope: string | null;
  platform: string | null;
  last_seen: string;
  disabled_at: string | null;
  disabled_reason: string | null;
  revoked_at: string | null;
  permission_status: string | null;
}

export default function PushDiagnosticScreen() {
  const [localInfo, setLocalInfo] = useState<{ token: string | null; platform: string; permission: string; projectId?: string; expoProjectId?: string } | null>(null);
  const [backendTokens, setBackendTokens] = useState<BackendToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Info local
      const local = await obterExpoPushToken();
      setLocalInfo(local);

      // Info backend
      const response = await api.get('/api/push/diagnostics/me');
      if (response.data.success) {
        setBackendTokens(response.data.tokens || []);
      }
    } catch (error: any) {
      logger.error('PushDiagnostic.FetchErro', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados de diagnóstico.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReRegister = async () => {
    setActionLoading(true);
    try {
      const result = await registrarDispositivoParaPush({ force: true });

      if (result && result.success && result.ok !== false) {
        Alert.alert('Sucesso', 'Token registrado no backend com sucesso.');
      } else if (result && result.ok === false) {
        Alert.alert(
          'Atenção: Registro Parcial',
          `O token foi enviado, mas o backend retornou um aviso:

Motivo: ${result.reason}
Mensagem: ${result.message}
RequestId: ${result.requestId || 'N/A'}

Dica: ${result.hint || 'Verifique as configurações do projeto.'}`
        );
      } else {
        const errorMsg = result?.data?.error || result?.error || result?.message || 'Erro desconhecido';
        const backendRequestId = result?.data?.requestId || result?.requestId || 'N/A';
        Alert.alert('Falha no Registro', `Ocorreu um erro ao registrar o token:

${errorMsg}
RequestId: ${backendRequestId}`);
      }

      fetchData(true);
    } catch (error: any) {
      logger.error('PushDiagnostic.handleReRegisterErro', error);
      Alert.alert('Erro', 'Falha ao processar re-registro do token.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestPush = async () => {
    setActionLoading(true);
    try {
      const response = await api.post('/api/push/campaigns/send', {
        title: 'Teste de Diagnóstico',
        body: `Teste enviado em ${new Date().toLocaleTimeString()}`,
        targetType: 'FILIADO',
        targetValue: 'self' // Backend deve tratar 'self' ou o app deve enviar o ID.
        // Nota: O endpoint espera ID. Vou usar o ID do usuário se disponível ou 'FILIADO' para o próprio user_id.
      });

      if (response.data.success) {
        Alert.alert(
          'Push Enviado',
          `Resultado:\n🚀 Sucesso: ${response.data.sent}\n❌ Falhas: ${response.data.failed}\nID: ${response.data.requestId}`
        );
      } else {
        Alert.alert('Erro', response.data.message || 'Falha ao enviar push de teste.');
      }
    } catch (error: any) {
        const msg = error.response?.data?.message || error.response?.data?.error || error.message;
      const requestId = error.response?.data?.requestId || error.response?.headers?.['x-request-id'] || 'N/A';
        Alert.alert('Erro', `Falha na requisição: ${msg}
RequestId: ${requestId}`);
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Copiado', 'Conteúdo copiado para a área de transferência.');
  };

  const renderTokenItem = (item: BackendToken, index: number) => {
    const isRevoked = !!item.revoked_at;
    const isDisabled = !!item.disabled_at;
    const isActive = !isRevoked && !isDisabled;

    return (
      <View key={index} style={[styles.tokenCard, !isActive && styles.inactiveToken]}>
        <View style={styles.tokenHeader}>
          <Text style={styles.tokenTitle}>Token {index + 1}</Text>
          <View style={[styles.statusBadge, { backgroundColor: isActive ? '#2ecc71' : '#e74c3c' }]}>
            <Text style={styles.statusBadgeText}>{isActive ? 'ATIVO' : (isRevoked ? 'REVOGADO' : 'DESATIVADO')}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => copyToClipboard(item.expo_push_token)}>
          <Text style={styles.tokenText} numberOfLines={1}>{item.expo_push_token}</Text>
        </TouchableOpacity>

        <View style={styles.tokenRow}>
          <Text style={styles.tokenLabel}>Scope:</Text>
          <Text style={styles.tokenValue}>{item.app_scope || 'N/A'}</Text>
        </View>

        <View style={styles.tokenRow}>
          <Text style={styles.tokenLabel}>Projeto:</Text>
          <Text style={styles.tokenValue}>{item.expo_project_id || item.project_id || 'N/A'}</Text>
        </View>

        <View style={styles.tokenRow}>
          <Text style={styles.tokenLabel}>Plataforma:</Text>
          <Text style={styles.tokenValue}>{item.platform || 'N/A'}</Text>
        </View>

        {isDisabled && (
          <View style={styles.tokenRow}>
            <Text style={styles.tokenLabel}>Motivo:</Text>
            <Text style={[styles.tokenValue, { color: '#e74c3c' }]}>{item.disabled_reason || 'Desconhecido'}</Text>
          </View>
        )}

        <Text style={styles.tokenDate}>Visto em: {new Date(item.last_seen).toLocaleString('pt-BR')}</Text>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeScreen style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003366" />
        <Text style={{ marginTop: 10 }}>Carregando diagnóstico...</Text>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} />}
      >
        <Text style={styles.sectionTitle}>Status Local (App)</Text>
        <View style={styles.card}>
          <View style={styles.tokenRow}>
            <Text style={styles.tokenLabel}>Token:</Text>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => copyToClipboard(localInfo?.token || '')}>
              <Text style={styles.tokenValue} numberOfLines={1}>{localInfo?.token || 'Não obtido'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tokenRow}>
            <Text style={styles.tokenLabel}>Scope:</Text>
            <Text style={styles.tokenValue}>{APP_SCOPE}</Text>
          </View>
          <View style={styles.tokenRow}>
            <Text style={styles.tokenLabel}>Projeto ID:</Text>
            <Text style={styles.tokenValue}>{localInfo?.expoProjectId || localInfo?.projectId || 'Não configurado'}</Text>
          </View>
          <View style={styles.tokenRow}>
            <Text style={styles.tokenLabel}>Permissão:</Text>
            <Text style={[styles.tokenValue, { color: localInfo?.permission === 'granted' ? '#2ecc71' : '#e74c3c' }]}>
              {localInfo?.permission || 'N/A'}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, actionLoading && styles.disabledButton]}
            onPress={handleReRegister}
            disabled={actionLoading}
          >
            <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
            <Text style={styles.actionButtonText}> Re-registrar token agora</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#2ecc71' }, actionLoading && styles.disabledButton]}
            onPress={handleTestPush}
            disabled={actionLoading}
          >
            <MaterialCommunityIcons name="send" size={20} color="#fff" />
            <Text style={styles.actionButtonText}> Testar Push</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Tokens no Backend</Text>
        {backendTokens.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum token encontrado no servidor para este usuário.</Text>
        ) : (
          backendTokens.map((item, index) => renderTokenItem(item, index))
        )}

        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="information-outline" size={20} color="#666" />
          <Text style={styles.infoText}>
            Se você não estiver recebendo notificações, certifique-se de que o "Projeto ID" local coincide com o "Projeto" do token Ativo no backend.
          </Text>
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366', marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  tokenCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#003366',
    elevation: 1,
  },
  inactiveToken: {
    opacity: 0.6,
    borderLeftColor: '#999',
  },
  tokenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tokenTitle: { fontWeight: 'bold', color: '#333' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  tokenText: { fontSize: 12, color: '#666', marginBottom: 8, fontStyle: 'italic' },
  tokenRow: { flexDirection: 'row', marginBottom: 4 },
  tokenLabel: { width: 80, fontSize: 13, color: '#888' },
  tokenValue: { flex: 1, fontSize: 13, color: '#333', fontWeight: '500' },
  tokenDate: { fontSize: 11, color: '#aaa', marginTop: 4, textAlign: 'right' },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionButton: {
    flex: 1,
    backgroundColor: '#003366',
    height: 48,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: { opacity: 0.5 },
  actionButtonText: { color: '#fff', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 20 },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
    gap: 8,
  },
  infoText: { flex: 1, fontSize: 12, color: '#666', lineHeight: 18 },
});
