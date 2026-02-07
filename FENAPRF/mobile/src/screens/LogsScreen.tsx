// mobile/src/screens/LogsScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, FlatList, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { LogEntry, getLogs, clearLogs, getLogsAsText } from '../infra/logger';
import { useAuth } from '../hooks/useAuth';
import { ROLES, isDiretoria } from '../utils/userUtils';
import api from '../services/apiService';

const LogsScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.perfil_acesso === ROLES.ADMIN;
  const ehDiretoria = isDiretoria(user?.perfil_acesso);

  useEffect(() => {
    if (!ehDiretoria) {
      Alert.alert('Acesso Negado', 'Esta área é restrita a administradores ou diretoria.');
      navigation.goBack();
    }
  }, [user, navigation, ehDiretoria]);

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

  const handleCopyLogs = async () => {
    const logsText = await getLogsAsText();
    await Clipboard.setStringAsync(logsText);
    Alert.alert('Sucesso', 'Logs copiados para a área de transferência.');
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
      <Text style={styles.logTimestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
      <Text style={[styles.logLevel, { color: item.level === 'ERROR' ? 'red' : 'gray' }]}>
        [{item.level}]
      </Text>
      <Text style={styles.logMessage}>{item.message}</Text>
      {item.stack && <Text style={styles.logStack}>{item.stack}</Text>}
    </View>
  );

  if (loading) {
    return <ActivityIndicator style={styles.centered} size="large" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        <Button title="Copiar Logs" onPress={handleCopyLogs} />
        {(isAdmin || ehDiretoria) && <Button title="Limpar Logs" onPress={handleClearLogs} color="red" />}
      </View>
      {logs.length === 0 ? (
        <View style={styles.centered}>
            <Text>Nenhum log encontrado.</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.timestamp}-${index}`}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
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
