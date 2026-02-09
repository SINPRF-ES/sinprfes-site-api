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

export default function ArquivadosScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
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
        return;
      }

      const processedData = data
        .filter(f => !!f && f.id)
        .map((f: User) => ({
          ...f,
          _normalizedNome: normalizeText(f.name || f.nome || ''),
          _onlyDigitsCpf: onlyDigits(f.cpf || '')
        }));

      setUsers(processedData);
    } catch (err) {
      console.error('[Arquivados.fetch]', err);
      Alert.alert('Erro', 'Não foi possível carregar a lista de arquivados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerTitle: 'Membros Arquivados',
      });
      fetchData(true);
    }, [fetchData])
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

  return (
    <SafeScreen style={styles.container}>
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
