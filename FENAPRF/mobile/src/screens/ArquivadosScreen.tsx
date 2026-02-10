import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import api, { getUsers } from '../services/apiService';
import MemberCard from '../components/MemberCard';
import { User } from '../types/user';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { normalizeText } from '../utils/format';
import { onlyDigits, maskCPF, maskPhone } from '../utils/format';
import { getCanonicalUserId, isGestao, ordenarMembrosTodos, tituloCargoUf } from '../utils/user';
import { logger } from '../infra/logger';
import SafeScreen from '../components/SafeScreen';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';
import { Modal, ScrollView } from 'react-native';
import { toBrazilianDate } from '../utils/date';

export default function ArquivadosScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'LIST' | 'HISTORY'>('LIST');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);

  const ehGestao = isGestao(authUser?.perfil_acesso);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);

      // Busca apenas arquivados
      const data = await getUsers({ apenasArquivados: '1' });

      if (!Array.isArray(data)) {
        setUsers([]);
      } else {
        const processedData = data
          .filter(f => !!f && f.id)
          .map((f: User) => ({
            ...f,
            _normalizedNome: normalizeText(f.name || f.nome || ''),
            _onlyDigitsCpf: onlyDigits(f.cpf || '')
          }));
        setUsers(processedData);
      }
    } catch (err) {
      console.error('[Arquivados.fetch]', err);
      Alert.alert('Erro', 'Não foi possível carregar a lista de arquivados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchHistory = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);

      const response = await api.get('/api/users/arquivados/historico', {
        params: { q: historySearchTerm }
      });

      setHistory(response.data || []);
    } catch (err) {
      console.error('[Arquivados.fetchHistory]', err);
      Alert.alert('Erro', 'Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [historySearchTerm]);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerTitle: 'Membros Arquivados',
      });
      if (activeTab === 'LIST') fetchData(true);
      else fetchHistory(true);
    }, [fetchData, fetchHistory, activeTab])
  );

  useEffect(() => {
    if (route.params?.refresh) {
      if (activeTab === 'LIST') fetchData(true);
      else fetchHistory(true);
      navigation.setParams({ refresh: false });
    }
  }, [route.params?.refresh, fetchData, fetchHistory, navigation, activeTab]);

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchHistory(true);
    }
  }, [historySearchTerm, activeTab, fetchHistory]);

  const filteredUsers = useMemo(() => {
    const term = normalizeText(searchTerm);
    const digits = onlyDigits(searchTerm);

    let result = users.filter(f => {
      const nomeMatch = f._normalizedNome?.includes(term);
      const cpfMatch = digits !== '' && f._onlyDigitsCpf?.includes(digits);
      return nomeMatch || cpfMatch;
    });

    return ordenarMembrosTodos(result);
  }, [users, searchTerm]);

  const handleEdit = useCallback((u: User) => {
    const userId = getCanonicalUserId(u);
    logger.info('NAVIGATE_TO_EDITAR_USER_FROM_ARCHIVE', { userId });
    navigation.navigate('EditarUser', { userId });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: User }) => (
    <MemberCard
      member={item as any}
      onPress={() => setSelectedMember(item)}
    />
  ), []);

  if (!ehGestao) {
    return (
        <SafeScreen style={styles.centered}>
            <Text>Acesso negado.</Text>
        </SafeScreen>
    );
  }

  if (loading && users.length === 0) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;
  }

  const renderHistoryItem = ({ item }: { item: any }) => (
    <View style={styles.historyCard}>
      <View style={styles.historyCardHeader}>
        <View>
          <Text style={styles.historyCardName}>{item.user_nome}</Text>
          <Text style={styles.historyCardCpf}>{maskCPF(item.user_cpf)}</Text>
        </View>
        <View style={[styles.actionBadge, { backgroundColor: item.acao === 'ARQUIVADO' ? '#fff5f5' : '#f0fff4' }]}>
          <Text style={[styles.actionBadgeText, { color: item.acao === 'ARQUIVADO' ? '#c53030' : '#2f855a' }]}>
            {item.acao}
          </Text>
        </View>
      </View>
      <View style={styles.historyCardFooter}>
        <Text style={styles.historyCardText}>
          <Text style={styles.historyCardLabel}>Por:</Text> {item.por_nome}
        </Text>
        <Text style={styles.historyCardText}>
          <Text style={styles.historyCardLabel}>Data:</Text> {toBrazilianDate(item.criado_em)}
        </Text>
        {item.motivo && (
          <Text style={styles.historyCardText}>
            <Text style={styles.historyCardLabel}>Motivo:</Text> {item.motivo}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeScreen style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'LIST' && styles.activeTab]}
          onPress={() => setActiveTab('LIST')}
        >
          <Text style={[styles.tabText, activeTab === 'LIST' && styles.activeTabText]}>Membros Arquivados</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'HISTORY' && styles.activeTab]}
          onPress={() => setActiveTab('HISTORY')}
        >
          <Text style={[styles.tabText, activeTab === 'HISTORY' && styles.activeTabText]}>Histórico</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'LIST' ? (
        <>
          <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#c53030' }}>Membros Arquivados: {filteredUsers.length}</Text>
          </View>
          <View style={styles.searchBar}>
            <MaterialCommunityIcons name="magnify" size={24} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar nos arquivados..."
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {searchTerm !== '' && (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <MaterialCommunityIcons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredUsers}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text>{searchTerm ? 'Nenhum membro arquivado encontrado.' : 'Nenhum membro arquivado no momento.'}</Text>
              </View>
            }
          />
        </>
      ) : (
        <>
          <View style={styles.searchBar}>
            <MaterialCommunityIcons name="magnify" size={24} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar no histórico (nome ou CPF)..."
              value={historySearchTerm}
              onChangeText={setHistorySearchTerm}
            />
            {historySearchTerm !== '' && (
              <TouchableOpacity onPress={() => setHistorySearchTerm('')}>
                <MaterialCommunityIcons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={history}
            keyExtractor={item => item.id}
            renderItem={renderHistoryItem}
            refreshing={refreshing}
            onRefresh={() => fetchHistory(true)}
            contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 16 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text>{historySearchTerm ? 'Nenhuma movimentação encontrada.' : 'Nenhuma movimentação registrada.'}</Text>
              </View>
            }
          />
        </>
      )}

      {/* Modal de Detalhes do Membro Arquivado */}
      <Modal
        visible={!!selectedMember}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedMember(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Membro Arquivado</Text>
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
                  <Text style={styles.detailText}><Text style={styles.detailLabel}>CPF:</Text> {maskCPF(selectedMember.cpf) || '—'}</Text>

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

              {selectedMember && selectedMember.arquivado_em && (
                <View style={styles.historySection}>
                  <Text style={styles.historyTitle}>📜 Dados do Arquivamento Atual</Text>

                  <View style={styles.historyItem}>
                    <MaterialCommunityIcons name="archive-arrow-down" size={20} color="#c53030" />
                    <View style={styles.historyContent}>
                      <Text style={styles.historyLabel}>Arquivado</Text>
                      <Text style={styles.historyText}>Por: {selectedMember.arquivado_por_nome || '(usuário não encontrado)'}</Text>
                      <Text style={styles.historyText}>Em: {toBrazilianDate(selectedMember.arquivado_em)}</Text>
                      <Text style={styles.historyText}>Motivo: {selectedMember.arquivado_motivo || 'Não informado'}</Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    const memberToEdit = selectedMember;
                    setSelectedMember(null);
                    handleEdit(memberToEdit!);
                  }}
                >
                  <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
                  <Text style={styles.editButtonText}>Gerenciar Cadastro</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#003366',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#003366',
    fontWeight: 'bold',
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginTop: 16, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, borderRadius: 10, elevation: 2 },
  searchInput: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 16 },
  empty: { padding: 40, alignItems: 'center' },
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
  historySection: {
    backgroundColor: '#fff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 12,
  },
  historyItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 15,
  },
  historyContent: {
    flex: 1,
  },
  historyLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  historyText: {
    fontSize: 13,
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
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  historyCardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#003366',
  },
  historyCardCpf: {
    fontSize: 12,
    color: '#666',
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  historyCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
    gap: 2,
  },
  historyCardText: {
    fontSize: 13,
    color: '#444',
  },
  historyCardLabel: {
    fontWeight: 'bold',
    color: '#666',
  },
});
