import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { getUsers } from '../services/apiService';
import MemberCard from '../components/MemberCard';
import { User } from '../types/user';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { normalizeText } from '../utils/format';
import { onlyDigits, maskCPF, maskPhone } from '../utils/format';
import { getCanonicalUserId, isGestao, ROLES, ordenarMembrosTodos, tituloCargoUf } from '../utils/user';
import * as Canon from '../utils/user';
import { logger } from '../infra/logger';
import SafeScreen from '../components/SafeScreen';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';
import CanonicalPicker from '../components/CanonicalPicker';
import { Modal, ScrollView } from 'react-native';

export default function UsersScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroVisualizacao, setFiltroVisualizacao] = useState('PADRAO');
  const [filtroUf, setFiltroUf] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);

  const ehGestao = isGestao(user?.perfil_acesso);
  const cacheKey = `users_cache_${user?.id}`;

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);

      const params: any = { incluirArquivados: '1' }; // Sempre busca para poder filtrar localmente se necessário, mas oculta por padrão no switch

      const data = await getUsers(params);
      if (!Array.isArray(data)) {
        setUsers([]);
        return;
      }

      // Otimização: Pre-calcula campos de busca para evitar normalização repetida no filter
      const processedData = data
        .filter(f => !!f && f.id)
        .map((f: User) => {
          const item = ehGestao ? f : {
            id: f.id,
            name: f.name,
            nome: f.nome,
            telefone1: f.telefone1,
            avatar_url: f.avatar_url,
            situacao: f.situacao,
            uf: f.uf,
            cargo: f.cargo,
            perfil_acesso: f.perfil_acesso,
            cargo_mandato_inicio: f.cargo_mandato_inicio,
            cargo_mandato_fim: f.cargo_mandato_fim,
            arquivado_em: f.arquivado_em,
            perfil_acesso2: f.perfil_acesso2,
            cargo2: f.cargo2,
            uf2: f.uf2
          };

          return {
            ...item,
            _normalizedNome: normalizeText(f.name || f.nome || ''),
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
  }, [ehGestao, cacheKey]);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerTitle: 'Membros',
        headerRight: () => {
          const actions: MenuAction[] = [];
          if (ehGestao) {
            actions.push({
              label: 'Novo membro',
              icon: 'account-plus',
              onPress: () => navigation.navigate('CriarUser')
            });
          }
          return <HeaderMenu actions={actions} />;
        }
      });
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
      if (!f) return false;

      // 0. Sempre oculta arquivados na listagem principal (Requisito 5)
      if (f.arquivado_em) return false;

      // 1. Filtro por Nome/CPF
      const nomeMatch = f._normalizedNome?.includes(term);
      const cpfMatch = ehGestao && digits !== '' && f._onlyDigitsCpf?.includes(digits);
      if (!nomeMatch && !cpfMatch) return false;

      // 2. Filtro de Visualização Avançado
      const perfil = (f.perfil_acesso || '').toUpperCase();
      const cargo = Canon.normalizeCargo(f.cargo);
      const uf = (f.uf || '').toUpperCase();

      const isInternal = perfil === ROLES.ADMIN || perfil === ROLES.COLABORADOR;

      switch (filtroVisualizacao) {
        case 'PADRAO':
          // Diretoria + Conselheiros (oculta Admin/Colab)
          if (isInternal) return false;
          break;
        case 'DIRETORIA':
          if (perfil !== ROLES.DIRETORIA) return false;
          break;
        case 'PRESIDENTES':
          if (cargo !== 'Presidente') return false;
          break;
        case 'VICES':
          if (cargo !== 'Vice-Presidente') return false;
          break;
        case 'DR':
          if (cargo !== 'Delegado Representante') return false;
          break;
        case 'DS':
          if (cargo !== 'Delegado Substituto') return false;
          break;
        case 'UF':
          if (filtroUf && uf !== filtroUf) return false;
          // Se for filtro por UF, geralmente queremos ver os conselheiros daquela UF
          if (perfil !== ROLES.CONSELHEIRO) return false;
          break;
        case 'ADMIN_COLAB':
          if (!isInternal) return false;
          break;
        default:
          break;
      }

      return true;
    });

    return ordenarMembrosTodos(result);
  }, [users, searchTerm, ehGestao, filtroVisualizacao, filtroUf]);

  const handleEdit = useCallback((u: User) => {
    const userId = getCanonicalUserId(u);
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
          placeholder="Buscar membros..."
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
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Visualização:</Text>
            <CanonicalPicker
              selectedValue={filtroVisualizacao}
              onValueChange={(v) => {
                  setFiltroVisualizacao(v);
                  if (v !== 'UF') setFiltroUf('');
              }}
              wrapperStyle={styles.pickerWrapper}
              items={Canon.FILTROS_MEMBROS.map(f => ({ label: f.label, value: f.value }))}
            />
          </View>

          {filtroVisualizacao === 'UF' && (
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>UF:</Text>
              <CanonicalPicker
                selectedValue={filtroUf}
                onValueChange={(v) => setFiltroUf(v)}
                wrapperStyle={styles.pickerWrapper}
                placeholder="Todas"
                items={Canon.UFS_DETALHADAS.filter(u => u.sigla !== 'BR').map(u => ({ label: u.sigla, value: u.sigla }))}
              />
            </View>
          )}
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.id}
        renderItem={renderItem}
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
                  <Text style={styles.detailText}><Text style={styles.detailLabel}>Telefone:</Text> {maskPhone(selectedMember.telefone1) || '—'}</Text>
                  {ehGestao && (
                    <>
                      <Text style={styles.detailText}><Text style={styles.detailLabel}>CPF:</Text> {maskCPF(selectedMember.cpf) || '—'}</Text>
                    </>
                  )}
                  {selectedMember.perfil_acesso2 && (
                    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee' }}>
                        <Text style={[styles.detailLabel, { marginBottom: 4 }]}>Segundo Vínculo:</Text>
                        <Text style={styles.detailText}>
                            {tituloCargoUf({
                                perfil_acesso: selectedMember.perfil_acesso2,
                                cargo: selectedMember.cargo2,
                                uf: selectedMember.uf2
                            })}
                        </Text>
                    </View>
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
                    <Text style={styles.editButtonText}>Editar membro</Text>
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
