// mobile/src/screens/LogsScreen.tsx
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { PickerSafe } from '../components/PickerSafe';
import SafeScreen from '../components/SafeScreen';
import { Ionicons } from '@expo/vector-icons';

import { LogEntry, getLogs, clearLogs, getLogsAsText, LogLevel } from '../infra/logger';
import { useAuth } from '../hooks/useAuth';
import { ROLES, isDiretoria } from '../utils/filiadoUtils';
import api from '../services/apiService';

const PERIODS = [
  { label: 'Tudo', value: 'all' },
  { label: 'Última 1h', value: '1h' },
  { label: 'Últimas 6h', value: '6h' },
  { label: 'Últimas 24h', value: '24h' },
  { label: 'Últimos 7 dias', value: '7d' },
];

const LEVELS: (LogLevel | 'ALL')[] = ['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'];

const LogsScreen = () => {
  const { usuario } = useAuth();
  const navigation = useNavigation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'ALL'>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  const ehDiretoria = isDiretoria(usuario?.perfil_acesso);

  // Acesso restrito
  useFocusEffect(
    useCallback(() => {
      if (!ehDiretoria) {
        Alert.alert('Acesso Negado', 'Esta área é restrita a administradores ou diretoria.');
        navigation.goBack();
      }
    }, [ehDiretoria, navigation])
  );

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const storedLogs = await getLogs();
      setLogs(storedLogs);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar os logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs])
  );

  const filteredLogs = useMemo(() => {
    let result = logs;

    // Filtro por Nível
    if (selectedLevel !== 'ALL') {
      result = result.filter(log => log.level === selectedLevel);
    }

    // Filtro por Período
    if (selectedPeriod !== 'all') {
      const now = new Date().getTime();
      let ms = 0;
      if (selectedPeriod === '1h') ms = 60 * 60 * 1000;
      else if (selectedPeriod === '6h') ms = 6 * 60 * 60 * 1000;
      else if (selectedPeriod === '24h') ms = 24 * 60 * 60 * 1000;
      else if (selectedPeriod === '7d') ms = 7 * 24 * 60 * 60 * 1000;

      result = result.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return now - logTime <= ms;
      });
    }

    // Pesquisa de Texto
    if (searchText.trim()) {
      const query = searchText.toLowerCase();
      result = result.filter(log =>
        log.message.toLowerCase().includes(query) ||
        (log.stack && log.stack.toLowerCase().includes(query)) ||
        (log.meta && JSON.stringify(log.meta).toLowerCase().includes(query))
      );
    }

    return result;
  }, [logs, selectedLevel, selectedPeriod, searchText]);

  const handleCopyLogs = async () => {
    try {
      const logsText = await getLogsAsText();
      await Clipboard.setStringAsync(logsText);
      Alert.alert('Sucesso', 'Logs copiados para a área de transferência.');
    } catch (error) {
      Alert.alert('Erro', 'Falha ao copiar logs.');
    }
  };

  const handleExportLogs = async () => {
    try {
      const metadata = {
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
          level: selectedLevel,
          period: selectedPeriod,
          search: searchText,
        },
      };

      const exportData = {
        metadata,
        logs: filteredLogs,
      };

      const timestamp = new Date().getTime();
      const filename = `diagnostico-sinprfes-${timestamp}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Erro', 'Compartilhamento não disponível neste dispositivo.');
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Erro', 'Falha ao exportar logs.');
    }
  };

  const handleClearLogs = () => {
    Alert.alert(
      'Confirmar Limpeza',
      'Deseja limpar todos os logs do dispositivo? Esta ação será registrada no servidor.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            const count = logs.length;
            await clearLogs();
            setLogs([]);
            try {
              await api.post('/api/diagnostico/limpar-logs', { recordsDeleted: count });
              Alert.alert('Sucesso', 'Logs limpos e ação registrada.');
            } catch (err) {
              // Não bloqueamos pois os logs já foram limpos localmente
              Alert.alert('Atenção', 'Logs limpos localmente, mas a auditoria falhou.');
            }
          },
        },
      ]
    );
  };

  const renderItem = useCallback(({ item }: { item: LogEntry }) => {
    const levelStyle = styles[`level${item.level}` as keyof typeof styles] || {};
    const borderColor = (levelStyle as any).backgroundColor || '#ccc';

    return (
      <View style={[styles.logItem, { borderLeftColor: borderColor }]}>
        <View style={styles.logHeader}>
          <Text style={styles.logTimestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
          <Text style={[styles.logLevel, levelStyle]}>
            {item.level}
          </Text>
        </View>
      <Text style={styles.logMessage}>{item.message}</Text>
      {item.meta && (
        <Text style={styles.logMeta}>
          Meta: {JSON.stringify(item.meta, null, 1)}
        </Text>
      )}
      {item.stack && <Text style={styles.logStack}>{item.stack.substring(0, 500)}...</Text>}
    </View>
    );
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#003366" />
        <Text style={styles.loadingText}>Carregando logs...</Text>
      </View>
    );
  }

  return (
    <SafeScreen style={styles.container}>
      {/* Filtros */}
      <View style={styles.filterContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar logs..."
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText !== '' && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.pickersRow}>
          <PickerSafe
            label="Nível"
            selectedValue={selectedLevel}
            onValueChange={(val) => setSelectedLevel(val as any)}
            items={LEVELS.map(l => ({ label: l, value: l }))}
          />

          <PickerSafe
            label="Período"
            selectedValue={selectedPeriod}
            onValueChange={(val) => setSelectedPeriod(val as string)}
            items={PERIODS}
          />
        </View>
      </View>

      {/* Ações */}
      <View style={styles.actionsBar}>
        <TouchableOpacity style={styles.actionButton} onPress={handleCopyLogs}>
          <Ionicons name="copy-outline" size={18} color="#003366" />
          <Text style={styles.actionButtonText}>Copiar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleExportLogs}>
          <Ionicons name="share-outline" size={18} color="#003366" />
          <Text style={styles.actionButtonText}>Exportar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={handleClearLogs}>
          <Ionicons name="trash-outline" size={18} color="#cc0000" />
          <Text style={[styles.actionButtonText, { color: '#cc0000' }]}>Limpar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resultsInfo}>
        <Text style={styles.resultsText}>
          Mostrando {filteredLogs.length} de {logs.length} logs
        </Text>
      </View>

      <FlatList
        data={filteredLogs}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.timestamp}-${index}`}
        contentContainerStyle={styles.list}
        initialNumToRender={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum log encontrado para os filtros selecionados.</Text>
          </View>
        }
      />
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  filterContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
  },
  pickersRow: {
    flexDirection: 'column',
  },
  actionsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  actionButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#003366',
    fontWeight: 'bold',
  },
  clearButton: {
    // Opção para destacar botão de limpar
  },
  resultsInfo: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#eee',
  },
  resultsText: {
    fontSize: 11,
    color: '#666',
  },
  list: {
    padding: 8,
  },
  logItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ccc',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logTimestamp: {
    fontSize: 11,
    color: '#888',
  },
  logLevel: {
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  levelERROR: { color: '#fff', backgroundColor: '#cc0000' },
  levelWARN: { color: '#000', backgroundColor: '#ffcc00' },
  levelINFO: { color: '#fff', backgroundColor: '#003366' },
  levelDEBUG: { color: '#000', backgroundColor: '#999' },
  logMessage: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  logMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    backgroundColor: '#f9f9f9',
    padding: 4,
    fontFamily: 'monospace',
  },
  logStack: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    marginTop: 10,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default LogsScreen;
