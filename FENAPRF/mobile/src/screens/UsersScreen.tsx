import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../hooks/useAuth';
import api, { getUsers } from '../services/apiService';
import UserCard from '../components/UserCard';
import { User } from '../types/user';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { normalizeText } from '../utils/masks';
import { onlyDigits } from '../shared/format/formatters';
import { getCanonicalUserId, isGestao } from '../utils/userUtils';
import * as Canon from '../utils/canon';
import { logger } from '../infra/logger';
import SafeScreen from '../components/SafeScreen';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';

export default function UsersScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCadastro, setFiltroCadastro] = useState('CADASTRO_ATIVO');
  const [filtroFuncional, setFiltroFuncional] = useState('TODOS');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const ehGestao = isGestao(user?.perfil_acesso);
  const cacheKey = `users_cache_${user?.id}`;

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);

      const params: any = {};
      if (filtroCadastro !== 'CADASTRO_ATIVO' && ehGestao) {
        params.incluirArquivados = '1';
      }

      const data = await getUsers(params);

      // Otimização: Pre-calcula campos de busca para evitar normalização repetida no filter (Bolt ⚡)
      const processedData = data.map((f: User) => {
        const item = ehGestao ? f : {
          id: f.id,
          name: f.name,
          telefone1: f.telefone1,
          avatar_url: f.avatar_url,
          lotacao: f.lotacao,
          situacao: f.situacao,
        };

        return {
          ...item,
          _normalizedNome: normalizeText(f.name),
          _onlyDigitsCpf: ehGestao ? onlyDigits(f.cpf || '') : ''
        };
      });

      setUsers(processedData);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(processedData));
    } catch (err) {
      console.error('[Users.fetch]', err);
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) setUsers(JSON.parse(cached));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ehGestao, cacheKey, filtroCadastro]);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerRight: () => {
          const actions: MenuAction[] = [];
          if (ehGestao) {
            actions.push({
              label: 'Novo User',
              icon: 'account-plus',
              onPress: () => navigation.navigate('CriarUser')
            });
          }
          return <HeaderMenu actions={actions} />;
        }
      });
      // Dispara o fetch. Como removemos o useEffect redundante,
      // este é o único gatilho de carga inicial e refresh por foco.
      fetchData(true);
    }, [fetchData, ehGestao])
  );

  useEffect(() => {
    if (route.params?.refresh) {
      fetchData(true);
      navigation.setParams({ refresh: false });
    }
  }, [route.params?.refresh, fetchData, navigation]);

  const filteredUsers = useMemo(() => {
    const term = normalizeText(searchTerm);
    const digits = onlyDigits(searchTerm);

    return users.filter(f => {
      // Filtro por Nome/CPF usando campos pré-calculados (Bolt ⚡)
      const nomeMatch = f._normalizedNome?.includes(term);
      const cpfMatch = ehGestao && digits !== '' && f._onlyDigitsCpf?.includes(digits);
      if (!nomeMatch && !cpfMatch) return false;

      // Filtro Situação Funcional / Lotação
      if (filtroFuncional !== 'TODOS') {
        const situacao = Canon.normalizeSituacaoFuncional(f.situacao_funcional || f.situacao || 'ATIVO');

        if (Canon.LOTACOES.includes(filtroFuncional as any)) {
          if (situacao !== Canon.SITUACAO_FUNCIONAL.ATIVO) return false;
          const lotacaoNorm = Canon.normalizeLotacao(f.lotacao || 'SEDE');
          if (lotacaoNorm !== filtroFuncional) return false;
        } else {
          if (situacao !== filtroFuncional) return false;
        }
      }

      // Filtro Estado do Cadastro (local filter additionally)
      if (ehGestao) {
        if (filtroCadastro === 'ARQUIVADOS' && !f.arquivado_em) return false;
        if (filtroCadastro === 'CADASTRO_ATIVO' && f.arquivado_em) return false;
      }

      return true;
    });
  }, [users, searchTerm, ehGestao, filtroCadastro, filtroFuncional]);

  const handleEdit = useCallback((user: User) => {
    const userId = getCanonicalUserId(user);
    logger.info('NAVIGATE_TO_EDITAR_USER', { userId });
    navigation.navigate('EditarUser', { userId });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: User }) => (
    <UserCard
      user={item as any}
      currentUserProfile={user?.perfil_acesso as any}
      onEdit={handleEdit}
    />
  ), [user?.perfil_acesso, handleEdit]);

  if (loading && users.length === 0) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;
  }

  return (
    <SafeScreen style={styles.container}>
      <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#003366' }}>Total: {filteredUsers.length}</Text>
      </View>
      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={24} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder={ehGestao ? "Buscar por nome ou CPF..." : "Buscar por nome..."}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm !== '' && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <MaterialCommunityIcons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {ehGestao && (
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Cadastro:</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={filtroCadastro}
                onValueChange={(v) => v && setFiltroCadastro(v)}
                style={styles.picker}
                mode="dropdown"
                dropdownIconColor="#003366"
              >
                <Picker.Item label="Selecione..." value="" color="#999" />
                <Picker.Item label="Ativos" value={Canon.ESTADO_CADASTRO.CADASTRO_ATIVO} />
                <Picker.Item label="Arquivados" value={Canon.ESTADO_CADASTRO.ARQUIVADO} />
                <Picker.Item label="Todos" value="TODOS" />
              </Picker>
            </View>
          </View>
        )}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Situação:</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={filtroFuncional}
              onValueChange={(v) => v && setFiltroFuncional(v)}
              style={styles.picker}
              mode="dropdown"
              dropdownIconColor="#003366"
            >
              <Picker.Item label="Todos" value="TODOS" />
              {Object.values(Canon.SITUACAO_FUNCIONAL).map(s => (
                <Picker.Item key={s} label={Canon.LABELS[s]} value={s} />
              ))}
              {Canon.LOTACOES.map(l => (
                <Picker.Item key={l} label={l} value={l} />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        // Otimizações de performance para listas longas (Bolt ⚡)
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        refreshing={refreshing}
        onRefresh={() => fetchData(true)}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text>{searchTerm ? 'Nenhum user encontrado.' : 'Carregando lista...'}</Text>
          </View>
        }
      />

    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginTop: 16, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, borderRadius: 10, elevation: 2 },
  searchInput: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 16 },
  filterRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  filterGroup: { flex: 1 },
  filterLabel: { fontSize: 11, color: '#666', marginBottom: 2, fontWeight: 'bold' },
  pickerWrapper: { backgroundColor: '#fff', borderRadius: 8, height: 50, justifyContent: 'center', elevation: 1 },
  picker: { height: 50, color: '#333' },
  empty: { padding: 40, alignItems: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#003366', justifyContent: 'center', alignItems: 'center', elevation: 4 },
});
