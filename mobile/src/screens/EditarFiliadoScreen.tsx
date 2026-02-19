// mobile/src/screens/EditarFiliadoScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useNetInfo } from '@react-native-community/netinfo';
import { buildUpdateFiliadoPayload } from '../services/filiadoPayloadMapper';
import { atualizarFiliado, arquivarFiliado, desarquivarFiliado } from '../services/apiService';
import { getMe, getFiliadoById } from '../services/filiadoService';
import ContatoCard from '../components/ContatoCard';
import EnderecoCard from '../components/EnderecoCard';
import LotacaoCard from '../components/LotacaoCard';
import DependentesCard from '../components/DependentesCard';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Filiado } from '../types/filiado';
import { logDebug, getCanonicalFiliadoId, parseCanonicalFiliadoId, isGestao as checkIsGestao, ROLES } from '../utils/filiadoUtils';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { logger } from '../infra/logger';
import api from '../services/apiService';
import { TouchableOpacity } from 'react-native';
import SafeScreen from '../components/SafeScreen';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';

export default function EditarFiliadoScreen({ route, navigation }: any) {
  const filiadoId = parseCanonicalFiliadoId(route.params?.filiadoId);
  const { usuario } = useAuth();
  const netInfo = useNetInfo();

  const [filiado, setFiliado] = useState<Filiado | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [motivoAcao, setMotivoAcao] = useState('');
  const [showMotivoInput, setShowMotivoInput] = useState<'ARQUIVAR' | 'DESARQUIVAR' | null>(null);

  const [isDeleteDependentesOpen, setIsDeleteDependentesOpen] = useState(false);
  const [selectedDependenteIndices, setSelectedDependenteIndices] = useState<number[]>([]);
  const [isDeletingDependentes, setIsDeletingDependentes] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (filiadoId) {
        data = await getFiliadoById(filiadoId);
      } else {
        data = await getMe();
      }

      setFiliado({
        ...data,
        situacao_funcional: data.situacao_funcional || '',
      });

      logger.info('EDIT_FILIADO_DATA_READY', {
        id: data.id,
        keys: Object.keys(data),
        hasSituacao: !!data.situacao,
        hasSituacaoFuncional: !!data.situacao_funcional
      });

      logDebug('EditarFiliado.fetch', { id: data.id, nome: data.nome });
    } catch (err) {
      logger.error('[EditarFiliado.fetch.error]', err);
      Alert.alert('Erro', 'Não foi possível carregar os dados do filiado.');
    } finally {
      setLoading(false);
    }
  }, [filiadoId]);

  useEffect(() => {
    logger.info('EDIT_FILIADO_MOUNT', {
      filiadoIdParam: route.params?.filiadoId,
      hasRouteParams: !!route.params,
      profile: usuario?.perfil_acesso
    });
    fetchData();
  }, [fetchData]);

  const handleUpdate = useCallback(async () => {
    if (!filiado) return;
    if (!netInfo.isConnected) {
      Alert.alert('Offline', 'A edição de filiados só está disponível online.');
      return;
    }

    if (!filiado.nome || !filiado.cpf || !filiado.email1) {
      Alert.alert('Erro de Validação', 'Nome, CPF e Email 1 são obrigatórios.');
      return;
    }

    try {
      setSaving(true);
      // Passamos o perfil do ator para garantir que a whitelist correta seja aplicada (ex: FILIADO vs GESTÃO)
      const payload = buildUpdateFiliadoPayload(filiado, usuario?.perfil_acesso || 'FILIADO');

      // Instrumentação de logs para depuração de datas (Step A)
      logger.info('FILIADO_SAVE_PAYLOAD_DATES', {
        filiado_id: filiado.id,
        data_nascimento: { value: payload.data_nascimento, type: typeof payload.data_nascimento },
        dep1_data_nascimento: { value: payload.dep1_data_nascimento, type: typeof payload.dep1_data_nascimento },
        dep2_data_nascimento: { value: payload.dep2_data_nascimento, type: typeof payload.dep2_data_nascimento },
        dep3_data_nascimento: { value: payload.dep3_data_nascimento, type: typeof payload.dep3_data_nascimento },
        dep4_data_nascimento: { value: payload.dep4_data_nascimento, type: typeof payload.dep4_data_nascimento },
        dep5_data_nascimento: { value: payload.dep5_data_nascimento, type: typeof payload.dep5_data_nascimento },
      });

      const canonicalId = getCanonicalFiliadoId(filiado);

      if (filiadoId) {
        await atualizarFiliado(canonicalId, payload);
      } else {
        await api.put('/api/filiados/me', payload);
      }

      Alert.alert('Sucesso', 'Filiado atualizado com sucesso.');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Não foi possível atualizar o filiado.');
    } finally {
      setSaving(false);
    }
  }, [filiado, netInfo.isConnected, filiadoId, navigation]);

  const handleConfirmarAcao = useCallback(async () => {
    if (!filiado || !motivoAcao) {
        Alert.alert('Aviso', 'Informe o motivo da ação.');
        return;
    }

    try {
        setSaving(true);
        const canonicalId = getCanonicalFiliadoId(filiado);

        if (showMotivoInput === 'ARQUIVAR') {
            await arquivarFiliado(canonicalId, motivoAcao);
            Alert.alert('Sucesso', 'Filiado arquivado com sucesso.');
        } else {
            await desarquivarFiliado(canonicalId, motivoAcao);
            Alert.alert('Sucesso', 'Cadastro reativado com sucesso.');
        }

        setShowMotivoInput(null);
        setMotivoAcao('');
        fetchData();
    } catch (err: any) {
        Alert.alert('Erro', 'Não foi possível completar a ação.');
    } finally {
        setSaving(false);
    }
  }, [filiado, motivoAcao, showMotivoInput, fetchData]);

  useEffect(() => {
    const ehGestao = checkIsGestao(usuario?.perfil_acesso);
    const actions: MenuAction[] = [
      { label: 'Salvar Alterações', icon: 'content-save', onPress: handleUpdate }
    ];

    if (ehGestao && filiadoId && filiado) {
      if (filiado.arquivado_em) {
        actions.push({ label: 'Desarquivar', icon: 'archive-arrow-up', onPress: () => setShowMotivoInput('DESARQUIVAR') });
      } else {
        actions.push({ label: 'Arquivar Cadastro', icon: 'archive-arrow-down', onPress: () => setShowMotivoInput('ARQUIVAR'), isDestructive: true });
      }
    }

    navigation.setOptions({
      headerRight: () => <HeaderMenu actions={actions} />,
      headerStyle: { backgroundColor: '#003366' },
      headerTintColor: '#fff',
      headerTitleAlign: 'center',
    });
  }, [navigation, filiado, usuario, handleUpdate, filiadoId]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;
  }

  if (!filiado) {
    return (
      <View style={styles.centered}>
        <Text>Dados indisponíveis.</Text>
        <Button title="Tentar novamente" onPress={fetchData} />
      </View>
    );
  }

  const ehGestao = checkIsGestao(usuario?.perfil_acesso);

  return (
    <SafeScreen style={styles.container}>
      {showMotivoInput && (
        <View style={styles.stickyHeader}>
            <View style={styles.motivoContainer}>
                <TextInput
                    style={styles.motivoInput}
                    placeholder={showMotivoInput === 'ARQUIVAR' ? "Justificativa de arquivamento..." : "Motivo de reativação..."}
                    value={motivoAcao}
                    onChangeText={setMotivoAcao}
                    autoFocus
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={[styles.btnMotivo, styles.btnCancel]} onPress={() => { setShowMotivoInput(null); setMotivoAcao(''); }}>
                        <Text style={styles.btnMotivoText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnMotivo, styles.btnConfirm]} onPress={handleConfirmarAcao}>
                        <Text style={styles.btnMotivoText}>Confirmar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      )}

      <KeyboardAwareScrollView contentContainerStyle={styles.contentContainer} enableOnAndroid extraScrollHeight={50} keyboardOpeningTime={0}>
        {filiado.arquivado_em && (
          <View style={styles.archiveBadge}>
            <MaterialCommunityIcons name="archive-alert" size={24} color="#721c24" />
            <View style={{ flex: 1 }}>
              <Text style={styles.archiveBadgeTitle}>Cadastro Arquivado</Text>
              <Text style={styles.archiveBadgeInfo}>
                Por: {filiado.arquivado_por_nome || 'N/A'} em {new Date(filiado.arquivado_em).toLocaleDateString('pt-BR')}
              </Text>
              <Text style={styles.archiveBadgeMotivo}>Motivo: {filiado.arquivado_motivo}</Text>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>👤 Informações Pessoais</Text></View>
        <ContatoCard
          filiado={filiado}
          setFiliado={setFiliado}
          isEditing={true}
          isManagement={ehGestao}
          hideTitle={true}
        />

        <View style={[styles.sectionHeader, { backgroundColor: '#f7f9fc' }]}><Text style={styles.sectionTitle}>🏠 Endereço</Text></View>
        <EnderecoCard filiado={filiado} setFiliado={setFiliado} hideTitle={true} cardStyle={{ backgroundColor: '#f7f9fc' }} />

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>🏢 Lotação e Perfil</Text></View>
        <LotacaoCard filiado={filiado} setFiliado={setFiliado} isEditing={ehGestao} hideTitle={true} />

        <View style={[styles.sectionHeader, { backgroundColor: '#f7f9fc' }]}><Text style={styles.sectionTitle}>👶 Dependentes</Text></View>
        <DependentesCard filiado={filiado} setFiliado={setFiliado} isEditing={true} hideTitle={true} cardStyle={{ backgroundColor: '#f7f9fc' }} />
      </KeyboardAwareScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stickyHeader: { backgroundColor: '#fff', padding: 10, borderBottomWidth: 1, borderBottomColor: '#ddd', zIndex: 100 },
  headerButtons: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  actionButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, minWidth: 100, alignItems: 'center' },
  saveButton: { backgroundColor: '#007bff' },
  archiveButton: { backgroundColor: '#dc3545' },
  unarchiveButton: { backgroundColor: '#28a745' },
  disabledButton: { opacity: 0.5 },
  actionButtonText: { color: '#fff', fontWeight: 'bold' },
  contentContainer: { paddingBottom: 40 },
  archiveBadge: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    margin: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  archiveBadgeTitle: { color: '#721c24', fontWeight: 'bold', fontSize: 16 },
  archiveBadgeInfo: { color: '#721c24', fontSize: 12, marginTop: 2 },
  archiveBadgeMotivo: { color: '#721c24', fontSize: 13, marginTop: 4, fontStyle: 'italic' },
  sectionHeader: { padding: 15, alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366' },
  motivoContainer: { marginTop: 15, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  motivoInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 10 },
  btnMotivo: { flex: 1, padding: 10, borderRadius: 5, alignItems: 'center' },
  btnCancel: { backgroundColor: '#6c757d' },
  btnConfirm: { backgroundColor: '#007bff' },
  btnMotivoText: { color: '#fff', fontWeight: 'bold' },
});
