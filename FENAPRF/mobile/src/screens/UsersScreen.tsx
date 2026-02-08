import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../hooks/useAuth';
import api, { getUsers } from '../services/apiService';
import MemberListItem from '../components/MemberListItem';
import MemberCard from '../components/MemberCard';
import { User } from '../types/user';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { normalizeText } from '../utils/masks';
import { onlyDigits } from '../shared/format/formatters';
import { getCanonicalUserId, isGestao, podeEditarPerfil } from '../utils/userUtils';
import * as Canon from '../utils/canon';
import { logger } from '../infra/logger';
import SafeScreen from '../components/SafeScreen';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';
import { Modal, Button } from 'react-native';

export default function UsersScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCadastro, setFiltroCadastro] = useState('CADASTRO_ATIVO');
  const [filtroFuncional, setFiltroFuncional] = useState('PADRAO');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);

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
              label: 'Novo Membro',
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

    let list = users.filter(f => {
      // Filtro por Nome/CPF usando campos pré-calculados (Bolt ⚡)
      const nomeMatch = f._normalizedNome?.includes(term);
      const cpfMatch = ehGestao && digits !== '' && f._onlyDigitsCpf?.includes(digits);
      if (!nomeMatch && !cpfMatch) return false;

      // Filtro Estado do Cadastro (local filter additionally)
      if (ehGestao) {
        if (filtroCadastro === 'ARQUIVADOS' && !f.arquivado_em) return false;
        if (filtroCadastro === 'CADASTRO_ATIVO' && f.arquivado_em) return false;
      }

      const situacao = Canon.normalizeSituacaoFuncional(f.situacao_funcional || f.situacao || 'ATIVO');
      const perfil = (f.perfil_acesso || '').toUpperCase();
      const cargoNorm = Canon.normalizeCargo(f.cargo);

      // Filtro por Tipo/Cargo
      if (filtroFuncional === 'DIRETORIA') {
        if (perfil !== Canon.PERFIL_ACESSO.DIRETORIA) return false;
      } else if (filtroFuncional === 'PRESIDENTES') {
        if (!cargoNorm.toLowerCase().includes('presidente')) return false;
      } else if (filtroFuncional === 'VICES') {
        if (!cargoNorm.toLowerCase().includes('vice')) return false;
      } else if (filtroFuncional === 'DR') {
        if (cargoNorm !== 'Delegado Representante') return false;
      } else if (filtroFuncional === 'DS') {
        if (cargoNorm !== 'Delegado Substituto') return false;
      } else if (filtroFuncional === 'ADMIN_COLAB') {
        if (![Canon.PERFIL_ACESSO.ADMIN, Canon.PERFIL_ACESSO.COLABORADOR].includes(perfil)) return false;
      } else if (filtroFuncional === 'ATIVO' || filtroFuncional === 'VETERANO' || filtroFuncional === 'PENSIONISTA') {
          if (situacao !== filtroFuncional) return false;
      }

      // Regra Ouro: Esconder ADMIN/COLABORADOR por padrão
      if (filtroFuncional !== 'ADMIN_COLAB' && [Canon.PERFIL_ACESSO.ADMIN, Canon.PERFIL_ACESSO.COLABORADOR].includes(perfil)) {
          return false;
      }

      return true;
    });

    return Canon.ordenarMembros(list);
  }, [users, searchTerm, ehGestao, filtroCadastro, filtroFuncional]);

  const handleMemberPress = useCallback((member: User) => {
    setSelectedMember(member);
  }, []);

  const handleEdit = useCallback((member: User) => {
    const userId = getCanonicalUserId(member);
    setSelectedMember(null);
    logger.info('NAVIGATE_TO_EDITAR_MEMBER', { userId });
    navigation.navigate('EditarUser', { userId });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: User }) => (
    <MemberListItem
      member={item}
      onPress={handleMemberPress}
    />
  ), [handleMemberPress]);

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
          placeholder={ehGestao ? "Buscar membros por nome ou CPF..." : "Buscar membros por nome..."}
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
          <Text style={styles.filterLabel}>Filtro:</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={filtroFuncional}
              onValueChange={(v) => v && setFiltroFuncional(v)}
              style={styles.picker}
              mode="dropdown"
              dropdownIconColor="#003366"
            >
              {Canon.FILTROS_MEMBROS.map(f => (
                <Picker.Item key={f.value} label={f.label} value={f.value} />
              ))}
              <Picker.Item label="Todos (Sem filtros)" value="TODOS" />
              <Picker.Item label="--- Por Situação ---" value="HEADER_SIT" enabled={false} />
              {Object.values(Canon.SITUACAO_FUNCIONAL).map(s => (
                <Picker.Item key={s} label={Canon.LABELS[s]} value={s} />
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
            <Text>{searchTerm ? 'Nenhum membro encontrado.' : 'Carregando lista...'}</Text>
          </View>
        }
      />

      <Modal
        visible={!!selectedMember}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedMember(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalhes do Membro</Text>
              <TouchableOpacity onPress={() => setSelectedMember(null)}>
                <MaterialCommunityIcons name="close" size={28} color="#003366" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {selectedMember && <MemberCard member={selectedMember} />}

              <View style={styles.modalActions}>
                {podeEditarPerfil(user?.perfil_acesso, selectedMember?.perfil_acesso) && (
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => selectedMember && handleEdit(selectedMember)}
                  >
                    <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
                    <Text style={styles.editButtonText}>Editar Dados</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelectedMember(null)}
                >
                  <Text style={styles.closeButtonText}>Fechar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#003366',
  },
  modalBody: {
    padding: 16,
  },
  modalActions: {
    marginTop: 16,
    gap: 10,
  },
  editButton: {
    backgroundColor: '#003366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeButton: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  closeButtonText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
