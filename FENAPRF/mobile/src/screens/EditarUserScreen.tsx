// mobile/src/screens/EditarUserScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useNetInfo } from '@react-native-community/netinfo';
import { buildUpdateUserPayload } from '../services/userPayloadMapper';
import { atualizarUser, arquivarUser, desarquivarUser } from '../services/apiService';
import { getMe, getUserById } from '../services/userService';
import ContatoCard from '../components/ContatoCard';
import EnderecoCard from '../components/EnderecoCard';
import VinculoCard from '../components/VinculoCard';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { User } from '../types/user';
import { logDebug, getCanonicalUserId, parseCanonicalUserId, isGestao as checkIsGestao, ROLES } from '../utils/user';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { logger } from '../infra/logger';
import api from '../services/apiService';
import { TouchableOpacity } from 'react-native';
import SafeScreen from '../components/SafeScreen';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';

const PERFIL_RANK: Record<string, number> = {
  ADMIN: 100,
  DIRETORIA: 50,
  COLABORADOR: 30,
  CONSELHEIRO: 10
};

const canEditorEditTargetCore = (editorPerfil: string, targetPerfil: string) => {
  const e = (editorPerfil || "").toUpperCase();
  const t = (targetPerfil || "").toUpperCase();
  if (e === 'ADMIN') return true;
  return (PERFIL_RANK[e] || 0) > (PERFIL_RANK[t] || 0);
};

export default function EditarUserScreen({ route, navigation }: any) {
  const userId = parseCanonicalUserId(route.params?.userId);
  const { user: authUser } = useAuth();
  const netInfo = useNetInfo();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [motivoAcao, setMotivoAcao] = useState('');
  const [showMotivoInput, setShowMotivoInput] = useState<'ARQUIVAR' | 'DESARQUIVAR' | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      let data;
      if (userId) {
        data = await getUserById(userId);
      } else {
        data = await getMe();
      }

      setUser(data);

      logger.info('EDIT_USER_DATA_READY', {
        id: data.id,
        keys: Object.keys(data),
        hasSituacao: !!data.situacao,
      });

      logDebug('EditarUser.fetch', { id: data.id, name: data.name });
    } catch (err) {
      logger.error('[EditarUser.fetch.error]', err);
      Alert.alert('Erro', 'Não foi possível carregar os dados do membro.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    logger.info('EDIT_USER_MOUNT', {
      userIdParam: route.params?.userId,
      hasRouteParams: !!route.params,
      profile: user?.perfil_acesso
    });
    fetchData();
  }, [fetchData]);

  const handleUpdate = useCallback(async (ignoreWarnings = false) => {
    if (!user) return;
    if (!netInfo.isConnected) {
      Alert.alert('Offline', 'A edição de membros só está disponível online.');
      return;
    }

    const nomeEfetivo = user.nome || user.name;
    const emailEfetivo = (user as any).email1 || user.email;

    const perfil = user.perfil_acesso as string;
    const isCouncil = perfil === ROLES.CONSELHEIRO || perfil === ROLES.DIRETORIA;

    if (!nomeEfetivo || !user.cpf || !emailEfetivo) {
      Alert.alert('Erro de Validação', 'Nome, CPF e Email são obrigatórios.');
      return;
    }

    if (perfil === ROLES.CONSELHEIRO && (!user.uf || user.uf === 'BR')) {
      Alert.alert('Erro de Validação', 'UF é obrigatória para Conselheiros.');
      return;
    }

    if (isCouncil && !user.cargo) {
      Alert.alert('Erro de Validação', 'O cargo é obrigatório para este perfil.');
      return;
    }

    try {
      setSaving(true);
      const payload = { ...buildUpdateUserPayload(user), ignoreWarnings };

      // Instrumentação de logs para depuração de datas (Step A)
      logger.info('USER_SAVE_PAYLOAD_DATES', {
        user_id: user.id,
        data_nascimento: { value: (payload as any).data_nascimento, type: typeof (payload as any).data_nascimento },
      });

      const canonicalId = getCanonicalUserId(user);

      if (userId) {
        await atualizarUser(canonicalId, payload);
      } else {
        await api.put('/api/users/me', payload);
      }

      Alert.alert('Sucesso', 'Membro atualizado com sucesso.');
      navigation.goBack();
    } catch (err: any) {
      if (err.response?.data?.code === 'DATA_DUPLICATED_WARNING') {
        Alert.alert(
          'Aviso de Duplicidade',
          err.response.data.message,
          [
            { text: 'Voltar e corrigir', style: 'cancel' },
            { text: 'Continuar mesmo assim', onPress: () => handleUpdate(true) }
          ]
        );
      } else {
        Alert.alert('Erro', err.response?.data?.message || 'Não foi possível atualizar o membro.');
      }
    } finally {
      setSaving(false);
    }
  }, [user, netInfo.isConnected, userId, navigation]);

  const handleConfirmarAcao = useCallback(async () => {
    if (!user || !motivoAcao) {
        Alert.alert('Aviso', 'Informe o motivo da ação.');
        return;
    }

    try {
        setSaving(true);
        const canonicalId = getCanonicalUserId(user);

        if (showMotivoInput === 'ARQUIVAR') {
            await arquivarUser(canonicalId, motivoAcao);
            Alert.alert('Sucesso', 'Membro arquivado com sucesso.');
        } else {
            await desarquivarUser(canonicalId, motivoAcao);
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
  }, [user, motivoAcao, showMotivoInput, fetchData]);

  useEffect(() => {
    const actions: MenuAction[] = [
      { label: 'Salvar Alterações', icon: 'content-save', onPress: handleUpdate }
    ];

    // Se houver um editor logado e um alvo (userId), e o editor tiver rank superior ou for Admin
    const canArchive = authUser && user && userId && (
      authUser.perfil_acesso === ROLES.ADMIN ||
      (checkIsGestao(authUser.perfil_acesso) && canEditorEditTargetCore(authUser.perfil_acesso, user.perfil_acesso || ''))
    );

    if (canArchive && user) {
      if (user.arquivado_em) {
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
  }, [navigation, user, user, handleUpdate, userId]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;
  }


  if (!user) {
    return (
      <View style={styles.centered}>
        <Text>Dados indisponíveis.</Text>
        <Button title="Tentar novamente" onPress={fetchData} />
      </View>
    );
  }

  const canEditCore = canEditorEditTargetCore(authUser?.perfil_acesso || '', user?.perfil_acesso || '');

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
        {user.arquivado_em ? (
          <View style={styles.archiveBadge}>
            <MaterialCommunityIcons name="archive-alert" size={24} color="#721c24" />
            <View style={{ flex: 1 }}>
              <Text style={styles.archiveBadgeTitle}>Cadastro Arquivado</Text>
              <Text style={styles.archiveBadgeInfo}>
                Por: {user.arquivado_por_nome || '(usuário não encontrado)'} em {new Date(user.arquivado_em).toLocaleDateString('pt-BR')}
              </Text>
              <Text style={styles.archiveBadgeMotivo}>Motivo: {user.arquivado_motivo}</Text>
            </View>
          </View>
        ) : user.desarquivado_em ? (
          <View style={[styles.archiveBadge, { backgroundColor: '#f0fff4', borderColor: '#9ae6b4' }]}>
            <MaterialCommunityIcons name="check-circle" size={24} color="#2f855a" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.archiveBadgeTitle, { color: '#2f855a' }]}>Cadastro Reativado</Text>
              <Text style={[styles.archiveBadgeInfo, { color: '#276749' }]}>
                Por: {user.desarquivado_por_nome || '(usuário não encontrado)'} em {new Date(user.desarquivado_em).toLocaleDateString('pt-BR')}
              </Text>
              <Text style={[styles.archiveBadgeMotivo, { color: '#276749' }]}>Motivo: {user.desarquivado_motivo}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>👤 Informações Pessoais</Text></View>
        <ContatoCard
          user={user}
          setUser={setUser}
          isEditing={true}
          isManagement={canEditCore}
          hideTitle={true}
        />

        <View style={[styles.sectionHeader, { backgroundColor: '#f7f9fc' }]}><Text style={styles.sectionTitle}>🏠 Endereço</Text></View>
        <EnderecoCard user={user} setUser={setUser} hideTitle={true} cardStyle={{ backgroundColor: '#f7f9fc' }} />

        {checkIsGestao(authUser?.perfil_acesso) && (
          <>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>⛓️ Vínculo e Mandato</Text></View>
            <VinculoCard
              user={user}
              setUser={setUser}
              isGestao={canEditCore}
              isSelf={String(user.id) === String(authUser?.id)}
              currentUserProfile={authUser?.perfil_acesso}
            />
          </>
        )}
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
