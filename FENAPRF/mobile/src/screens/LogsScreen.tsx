// mobile/src/screens/LogsScreen.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';
import { LogEntry, getLogs, clearLogs, getLogsAsText, LogLevel } from '../infra/logger';
import { useAuth } from '../hooks/useAuth';
import { ROLES, isDiretoria } from '../utils/userUtils';
import api from '../services/apiService';

/**
 * Módulo de Diagnóstico / Logs do Sistema
 *
 * Este módulo gerencia a visualização, filtragem e exportação de logs técnicos
 * coletados durante a execução do aplicativo.
 *
 * Recursos:
 * - Filtro por Nível (ERROR, WARN, INFO, DEBUG)
 * - Filtro por Período (1h, 6h, 24h, 7d)
 * - Busca textual (mensagem, meta, stack trace)
 * - Exportação para JSON com metadados do dispositivo
 *
 * Formato do Export (JSON):
 * {
 *   "metadata": { "appVersion", "deviceModel", "osVersion", "filtersApplied"... },
 *   "logs": [ { "timestamp", "level", "message", "meta", "stack", "sessionId"... } ]
 * }
 */

type PeriodFilter = '1h' | '6h' | '24h' | '7d' | 'all';

const LogsScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados dos Filtros
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = user?.perfil_acesso === ROLES.ADMIN;
  const ehDiretoria = isDiretoria(user?.perfil_acesso);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const storedLogs = await getLogs();
    setLogs(storedLogs);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs])
  );

  // Lógica de Filtragem
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Filtro de Nível
      if (levelFilter !== 'ALL' && log.level !== levelFilter) return false;

      // 2. Filtro de Período
      if (periodFilter !== 'all') {
        const logDate = new Date(log.timestamp).getTime();
        const now = Date.now();
        const diffMs = now - logDate;
        const hours = diffMs / (1000 * 60 * 60);

        if (periodFilter === '1h' && hours > 1) return false;
        if (periodFilter === '6h' && hours > 6) return false;
        if (periodFilter === '24h' && hours > 24) return false;
        if (periodFilter === '7d' && hours > 24 * 7) return false;
      }

      // 3. Busca Textual
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const message = (log.message || '').toLowerCase();
        let meta = '';
        try {
          meta = JSON.stringify(log.meta || {}).toLowerCase();
        } catch (e) {
          meta = '[Complex Metadata]';
        }
        const stack = (log.stack || '').toLowerCase();

        if (!message.includes(query) && !meta.includes(query) && !stack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [logs, levelFilter, periodFilter, searchQuery]);

  // Contadores para o Resumo
  const stats = useMemo(() => {
    return {
      total: logs.length,
      filtered: filteredLogs.length,
      errors: logs.filter(l => l.level === 'ERROR').length,
      warnings: logs.filter(l => l.level === 'WARN').length,
    };
  }, [logs, filteredLogs]);

  const handleCopyLogs = async () => {
    const logsText = await getLogsAsText();
    await Clipboard.setStringAsync(logsText);
    Alert.alert('Sucesso', 'Logs copiados para a área de transferência.');
  };

  const handleExportLogs = async () => {
    try {
      setLoading(true);

      const deviceMetadata = {
        appVersion: Application.nativeApplicationVersion,
        buildVersion: Application.nativeBuildVersion,
        runtimeVersion: Updates.runtimeVersion,
        updateChannel: Updates.channel,
        deviceBrand: Device.brand,
        deviceModel: Device.modelName,
        osVersion: Device.osVersion,
        isDevice: Device.isDevice,
        exportedAt: new Date().toISOString(),
        filtersApplied: {
          level: levelFilter,
          period: periodFilter,
          search: searchQuery || '(none)'
        }
      };

      const exportData = {
        metadata: deviceMetadata,
        logs: filteredLogs
      };

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `diagnostico-fenaprf-${timestamp}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Exportar Diagnóstico FENAPRF',
          UTI: 'public.json'
        });
      } else {
        Alert.alert('Erro', 'O compartilhamento não está disponível neste dispositivo.');
      }
    } catch (err: any) {
      logger.error('EXPORT_LOGS_FAIL', err);
      Alert.alert('Erro na Exportação', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = () => {
    Alert.alert(
      'Confirmar',
      'Tem certeza de que deseja limpar todos os logs?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            const count = logs.length;
            await clearLogs();
            loadLogs();
            try {
              await api.post('/api/diagnostico/limpar-logs', { recordsDeleted: count });
              Alert.alert('Sucesso', 'Logs limpos e ação registrada.');
            } catch (err) {
              // Falha na auditoria é registrada pelo interceptor, não bloqueamos o fluxo local
              Alert.alert('Sucesso', 'Logs limpos localmente.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: LogEntry }) => (
    <View style={styles.logItem}>
      <Text style={styles.logTimestamp}>{new Date(item.timestamp || 0).toLocaleString()}</Text>
      <Text style={[styles.logLevel, { color: item.level === 'ERROR' ? 'red' : 'gray' }]}>
        [{String(item.level || 'UNKNOWN')}]
      </Text>
      <Text style={styles.logMessage}>{String(item.message || '—')}</Text>
      {item.stack && <Text style={styles.logStack}>{String(item.stack)}</Text>}
    </View>
  );

  if (loading) {
    return <ActivityIndicator style={styles.centered} size="large" />;
  }

  return (
    <View style={styles.container}>
      {/* Resumo e Filtros */}
      <View style={styles.header}>
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>Total: {stats.total}</Text>
          <Text style={styles.statsText}>Filtrados: {stats.filtered}</Text>
          <Text style={[styles.statsText, { color: 'red' }]}>Erros: {stats.errors}</Text>
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder="Buscar nos logs..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
           <TouchableOpacity
             style={[styles.chip, levelFilter === 'ALL' && styles.chipActive]}
             onPress={() => setLevelFilter('ALL')}
           >
             <Text style={[styles.chipText, levelFilter === 'ALL' && styles.chipTextActive]}>Todos</Text>
           </TouchableOpacity>
           {(['ERROR', 'WARN', 'INFO', 'DEBUG'] as const).map(lvl => (
             <TouchableOpacity
               key={lvl}
               style={[styles.chip, levelFilter === lvl && styles.chipActive]}
               onPress={() => setLevelFilter(lvl)}
             >
               <Text style={[styles.chipText, levelFilter === lvl && styles.chipTextActive]}>{lvl}</Text>
             </TouchableOpacity>
           ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
           {(['all', '1h', '6h', '24h', '7d'] as const).map(p => (
             <TouchableOpacity
               key={p}
               style={[styles.chip, periodFilter === p && styles.chipActive]}
               onPress={() => setPeriodFilter(p)}
             >
               <Text style={[styles.chipText, periodFilter === p && styles.chipTextActive]}>
                 {p === 'all' ? 'Tudo' : p}
               </Text>
             </TouchableOpacity>
           ))}
           {(levelFilter !== 'ALL' || periodFilter !== 'all' || searchQuery !== '') && (
             <TouchableOpacity
               style={[styles.chip, { backgroundColor: '#f0f0f0' }]}
               onPress={() => {
                 setLevelFilter('ALL');
                 setPeriodFilter('all');
                 setSearchQuery('');
               }}
             >
               <Text style={{ color: '#666', fontSize: 12 }}>Limpar</Text>
             </TouchableOpacity>
           )}
        </ScrollView>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionButton} onPress={handleCopyLogs}>
          <Ionicons name="copy-outline" size={18} color="#003366" />
          <Text style={styles.actionButtonText}>Copiar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleExportLogs}>
          <Ionicons name="share-outline" size={18} color="#003366" />
          <Text style={styles.actionButtonText}>Exportar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, { borderColor: 'red' }]} onPress={handleClearLogs}>
          <Ionicons name="trash-outline" size={18} color="red" />
          <Text style={[styles.actionButtonText, { color: 'red' }]}>Limpar Tudo</Text>
        </TouchableOpacity>
      </View>

      {filteredLogs.length === 0 ? (
        <View style={styles.centered}>
            <Text>Nenhum log corresponde aos filtros.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLogs}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.timestamp}-${index}`}
          contentContainerStyle={styles.list}
          initialNumToRender={10}
          windowSize={5}
          removeClippedSubviews={true}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statsText: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  searchInput: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#eee',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipActive: {
    backgroundColor: '#003366',
    borderColor: '#003366',
  },
  chipText: {
    fontSize: 11,
    color: '#666',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#003366',
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#003366',
    fontWeight: 'bold',
  },
  list: {
    padding: 10,
  },
  logItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  logTimestamp: {
    fontSize: 12,
    color: '#666',
  },
  logLevel: {
    fontWeight: 'bold',
  },
  logMessage: {},
  logStack: {
    fontSize: 12,
    color: '#333',
    marginTop: 5,
    fontFamily: 'monospace',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default LogsScreen;
