// mobile/src/screens/EditarFiliadoScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
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
import { SafeAreaView, TouchableOpacity } from 'react-native';

export default function EditarFiliadoScreen({ route, navigation }: any) {
  const filiadoId = parseCanonicalFiliadoId(route.params?.filiadoId);
  const { usuario } = useAuth();
  const netInfo = useNetInfo();

  const [filiado, setFiliado] = useState<Filiado | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const handleUpdate = async () => {
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
      const payload = buildUpdateFiliadoPayload(filiado);
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
  };

  const handleArchive = async () => {
    if (!filiado) return;
    Alert.prompt(
      'Confirmar Arquivamento',
      'Informe a justificativa:',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Arquivar',
          style: 'destructive',
          onPress: async (motivo) => {
            if (!motivo) return;
            try {
              setSaving(true);
              await arquivarFiliado(getCanonicalFiliadoId(filiado), motivo);
              Alert.alert('Sucesso', 'Arquivado.');
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Erro', 'Falha ao arquivar.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

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
    <SafeAreaView style={styles.container}>
      <View style={styles.stickyHeader}>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton, saving && styles.disabledButton]}
            onPress={handleUpdate}
            disabled={saving}
          >
            <Text style={styles.actionButtonText}>{saving ? "..." : "Salvar"}</Text>
          </TouchableOpacity>

          {ehGestao && filiadoId && (
             filiado.arquivado_em ? (
                <TouchableOpacity style={[styles.actionButton, styles.unarchiveButton]} onPress={() => {}}>
                    <Text style={styles.actionButtonText}>Arquivado</Text>
                </TouchableOpacity>
             ) : (
                <TouchableOpacity style={[styles.actionButton, styles.archiveButton]} onPress={handleArchive}>
                    <Text style={styles.actionButtonText}>Arquivar</Text>
                </TouchableOpacity>
             )
          )}
        </View>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.contentContainer} enableOnAndroid extraScrollHeight={50} keyboardOpeningTime={0}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>👤 Informações Pessoais</Text></View>
        <ContatoCard filiado={filiado} setFiliado={setFiliado} isEditing={true} hideTitle={true} />

        <View style={[styles.sectionHeader, { backgroundColor: '#f7f9fc' }]}><Text style={styles.sectionTitle}>🏠 Endereço</Text></View>
        <EnderecoCard filiado={filiado} setFiliado={setFiliado} hideTitle={true} cardStyle={{ backgroundColor: '#f7f9fc' }} />

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>🏢 Lotação e Perfil</Text></View>
        <LotacaoCard filiado={filiado} setFiliado={setFiliado} isEditing={ehGestao} hideTitle={true} />

        <View style={[styles.sectionHeader, { backgroundColor: '#f7f9fc' }]}><Text style={styles.sectionTitle}>👶 Dependentes</Text></View>
        <DependentesCard filiado={filiado} setFiliado={setFiliado} isEditing={true} hideTitle={true} cardStyle={{ backgroundColor: '#f7f9fc' }} />
      </KeyboardAwareScrollView>
    </SafeAreaView>
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
  sectionHeader: { padding: 15, alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366' },
});
