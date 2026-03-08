import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import SafeScreen from '../components/SafeScreen';
import { COLORS } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { isDiretoria } from '../utils/filiadoUtils';
import { consultarProcessosDoUsuarioLogado, type ConsultaProcessualItem } from '../services/consultaProcessualService';

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
}

export default function ConsultaProcessualScreen() {
  const navigation = useNavigation();
  const { usuario } = useAuth();
  const podeAcessar = isDiretoria(usuario?.perfil_acesso);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [items, setItems] = useState<ConsultaProcessualItem[]>([]);
  const [cpfMasked, setCpfMasked] = useState('***.***.***-**');
  const [queriedAt, setQueriedAt] = useState<string | null>(null);
  const [mode, setMode] = useState<'personal' | 'institutional'>('personal');
  const [statusMessage, setStatusMessage] = useState('Selecione o modo e clique em “Consultar processos” para iniciar a busca automática.');

  useFocusEffect(
    useCallback(() => {
      if (!podeAcessar) {
        Alert.alert('Acesso negado', 'A Consulta Processual está restrita para ADMIN e DIRETORIA.');
        navigation.goBack();
      }
    }, [navigation, podeAcessar])
  );

  const executeConsulta = useCallback(async (isPullToRefresh = false, modeOverride?: 'personal' | 'institutional') => {
    const selectedMode = modeOverride || mode;
    if (isPullToRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
      setStatusMessage('Consultando fontes públicas...');
    }

    try {
      const payload = await consultarProcessosDoUsuarioLogado(selectedMode);
      if (!payload.ok) {
        const msg = payload.message || payload.error || 'Portal indisponível no momento.';
        setItems([]);
        setStatusMessage(msg);
        return;
      }

      const normalizedItems = Array.isArray(payload.items)
        ? payload.items.filter((item) => item && item.processNumber)
        : [];

      const totalItems = Number.isFinite(Number(payload.totalItems))
        ? Number(payload.totalItems)
        : normalizedItems.length;

      setItems(normalizedItems);
      setCpfMasked(payload.cpfMasked || '***.***.***-**');
      setQueriedAt(payload.queriedAt || null);

      const providerErrors = (payload.sources || []).filter((source) => source.status === 'error');
      if (providerErrors.length > 0 && normalizedItems.length === 0) {
        setStatusMessage('Falha temporária em todas as fontes consultadas.');
      } else if (totalItems === 0) {
        setStatusMessage('Nenhum processo encontrado.');
      } else {
        const docLabel = selectedMode === 'institutional' ? 'CNPJ' : 'CPF';
        setStatusMessage(`Consulta concluída: ${totalItems} processo(s). ${docLabel}: ${payload.cpfMasked || '***'}`);
      }
    } catch (_error) {
      setItems([]);
      setStatusMessage('Erro ao consultar processos. Tente novamente em instantes.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [mode]);

  const onOpenDetails = useCallback(async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Link indisponível', 'Não foi possível abrir o link de origem deste processo.');
        return;
      }
      await Linking.openURL(url);
    } catch (_error) {
      Alert.alert('Falha ao abrir origem', 'Não foi possível abrir o link externo no momento.');
    }
  }, []);

  const queriedAtLabel = useMemo(() => {
    if (!queriedAt) return 'Última atualização: -';
    return `Última atualização: ${formatDateTime(queriedAt)}`;
  }, [queriedAt]);

  const handleModeChange = (newMode: 'personal' | 'institutional') => {
    setMode(newMode);
    setItems([]);
    setStatusMessage('Modo alterado. Clique em “Consultar processos” para buscar.');
  };

  return (
    <SafeScreen style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => executeConsulta(true)} />}
      >
        <View style={styles.headerCard}>
          <Text style={styles.title}>Consulta Processual</Text>

          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'personal' && styles.modeButtonActive]}
              onPress={() => handleModeChange('personal')}
            >
              <Text style={[styles.modeButtonText, mode === 'personal' && styles.modeButtonTextActive]}>Meus Processos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'institutional' && styles.modeButtonActive]}
              onPress={() => handleModeChange('institutional')}
            >
              <Text style={[styles.modeButtonText, mode === 'institutional' && styles.modeButtonTextActive]}>Sindicato</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.status}>{statusMessage}</Text>
          <Text style={styles.meta}>{queriedAtLabel}</Text>
          <Text style={styles.meta}>{mode === 'institutional' ? 'CNPJ' : 'CPF'} consultado: {cpfMasked}</Text>

          <TouchableOpacity style={styles.actionButton} onPress={() => executeConsulta(false)} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.actionLabel}>Consultar processos</Text>}
          </TouchableOpacity>
        </View>

        {items.map((item, index) => {
          const movementText = item.listLastMovementText || item.lastMovement || '-';
          const movementAt = item.listLastMovementAt || item.lastMovementAt;
          return (
            <View key={`${item.processNumber || 'proc'}-${index}`} style={styles.processCard}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>{item.sourceLabel || item.source || '-'}</Text>
                </View>
                {item.isSindicato && (
                  <View style={[styles.badgeWrap, { backgroundColor: '#555' }]}>
                    <Text style={[styles.badgeText, { color: COLORS.white }]}>SINDICATO</Text>
                  </View>
                )}
              </View>
              <Text style={styles.processNumber}>{item.processNumber || '-'}</Text>
              <Text style={styles.processClass}>Classe: {item.processClass || '-'}</Text>
              <Text style={styles.textBlock}>Partes: {item.parties || '-'}</Text>
              <Text style={styles.textBlock}>Última movimentação: {movementText}</Text>
              <Text style={styles.meta}>Data/Hora: {formatDateTime(movementAt)}</Text>

              {item.detailsUrl ? (
                <TouchableOpacity style={styles.linkButton} onPress={() => onOpenDetails(item.detailsUrl as string)}>
                  <Text style={styles.linkButtonText}>Abrir origem</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.meta}>Origem sem link de detalhe.</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, gap: 12 },
  headerCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.prfBlue, marginBottom: 4 },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 4,
    marginBottom: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeButtonActive: {
    backgroundColor: COLORS.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  modeButtonText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  modeButtonTextActive: { color: COLORS.prfBlue, fontWeight: '700' },
  status: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  meta: { fontSize: 12, color: COLORS.textMuted },
  actionButton: {
    marginTop: 6,
    backgroundColor: COLORS.prfBlue,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionLabel: { color: COLORS.white, fontWeight: '700' },
  processCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  badgeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: '#edf5ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: COLORS.prfBlue, fontWeight: '700', fontSize: 12 },
  processNumber: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  processClass: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  textBlock: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  linkButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.prfBlue,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  linkButtonText: { color: COLORS.prfBlue, fontWeight: '700' },
});
