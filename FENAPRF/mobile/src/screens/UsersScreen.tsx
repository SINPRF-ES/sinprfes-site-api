import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../hooks/useAuth';
import api, { getUsers } from '../services/apiService';
import MemberCard from '../components/MemberCard';
import { User } from '../types/user';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { normalizeText } from '../utils/masks';
import { onlyDigits } from '../shared/format/formatters';
import { getCanonicalUserId, isGestao, ROLES, CARGO_RANK } from '../utils/userUtils';
import * as Canon from '../utils/canon';
import { logger } from '../infra/logger';
import SafeScreen from '../components/SafeScreen';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';
import { Modal, ScrollView, Button as RNButton } from 'react-native';

export default function UsersScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCadastro, setFiltroCadastro] = useState('CADASTRO_ATIVO');
  const [filtroFuncional, setFiltroFuncional] = useState('TODOS');
  const [mostrarGestaoInterna, setMostrarGestaoInterna] = useState(false);
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
        headerTitle: 'Membros',
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

    let result = users.filter(f => {
      // Filtro por Nome/CPF usando campos pré-calculados (Bolt ⚡)
      const nomeMatch = f._normalizedNome?.includes(term);
      const cpfMatch = ehGestao && digits !== '' && f._onlyDigitsCpf?.includes(digits);
      if (!nomeMatch && !cpfMatch) return false;

      // Filtro Situação Funcional
      if (filtroFuncional !== 'TODOS') {
        const situacao = Canon.normalizeSituacaoFuncional(f.situacao_funcional || f.situacao || 'ATIVO');
        if (situacao !== filtroFuncional) return false;
      }

      // Filtro Estado do Cadastro (local filter additionally)
      if (ehGestao) {
        if (filtroCadastro === 'ARQUIVADOS' && !f.arquivado_em) return false;
        if (filtroCadastro === 'CADASTRO_ATIVO' && f.arquivado_em) return false;
      }

      // Filtro de perfis ocultos (ADMIN/COLABORADOR)
      const perfil = (f.perfil_acesso || '').toUpperCase();
      const isInternal = perfil === ROLES.ADMIN || perfil === ROLES.COLABORADOR;
      if (isInternal && !mostrarGestaoInterna) return false;

      return true;
    });

    // Ordenação Avançada: Diretoria (Rank) -> Conselheiros (UF)
    return result.sort((a, b) => {
        const pA = (a.perfil_acesso || '').toUpperCase();
        const pB = (b.perfil_acesso || '').toUpperCase();

        const isDirA = pA === ROLES.DIRETORIA;
        const isDirB = pB === ROLES.DIRETORIA;

        if (isDirA && !isDirB) return -1;
        if (!isDirA && isDirB) return 1;

        if (isDirA && isDirB) {
            const rankA = CARGO_RANK[a.cargo || ''] || 99;
            const rankB = CARGO_RANK[b.cargo || ''] || 99;
            if (rankA !== rankB) return rankA - rankB;
            return a.name.localeCompare(b.name);
        }

        // Conselheiros e outros: por UF, depois por nome
        const ufA = a.uf || 'ZZ';
        const ufB = b.uf || 'ZZ';
        if (ufA !== ufB) return ufA.localeCompare(ufB);

        return a.name.localeCompare(b.name);
    });
  }, [users, searchTerm, ehGestao, filtroCadastro, filtroFuncional, mostrarGestaoInterna]);

  const handleEdit = useCallback((user: User) => {
    const userId = getCanonicalUserId(user);
    logger.info('NAVIGATE_TO_EDITAR_USER', { userId });
    navigation.navigate('EditarUser', { userId });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: User }) => (
    <MemberCard
      member={item as any}
      onPress={() => setSelectedMember(item)}
    />
  ), []);

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
            <Text style={styles.filterLabel}>Visão:</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={mostrarGestaoInterna ? 'INTERNA' : 'PADRAO'}
                onValueChange={(v) => setMostrarGestaoInterna(v === 'INTERNA')}
                style={styles.picker}
                mode="dropdown"
                dropdownIconColor="#003366"
              >
                <Picker.Item label="Membros" value="PADRAO" />
                <Picker.Item label="Gestão Interna" value="INTERNA" />
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

      {/* Modal de Detalhes do Membro */}
      <Modal
        visible={!!selectedMember}
        animationType="slide"
        transparent={true}
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

            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              <MemberCard member={selectedMember} />

              {selectedMember && (
                <View style={styles.memberDetails}>
                  <Text style={styles.detailText}><Text style={styles.detailLabel}>Email:</Text> {selectedMember.email || selectedMember.email1 || '—'}</Text>
                  <Text style={styles.detailText}><Text style={styles.detailLabel}>Telefone:</Text> {selectedMember.telefone1 || '—'}</Text>
                  {ehGestao && (
                    <>
                      <Text style={styles.detailText}><Text style={styles.detailLabel}>CPF:</Text> {selectedMember.cpf || '—'}</Text>
                      <Text style={styles.detailText}><Text style={styles.detailLabel}>Situação:</Text> {selectedMember.situacao || '—'}</Text>
                    </>
                  )}
                </View>
              )}

              {ehGestao && selectedMember && (
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => {
                      const memberToEdit = selectedMember;
                      setSelectedMember(null);
                      handleEdit(memberToEdit);
                    }}
                  >
                    <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
                    <Text style={styles.editButtonText}>Editar Membro</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#f0f0f0',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#003366',
  },
  memberDetails: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  detailText: {
    fontSize: 15,
    color: '#333',
  },
  detailLabel: {
    fontWeight: 'bold',
    color: '#666',
  },
  modalActions: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  editButton: {
    backgroundColor: '#003366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    gap: 10,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
