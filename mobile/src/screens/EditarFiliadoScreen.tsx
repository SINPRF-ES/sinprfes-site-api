// mobile/src/screens/EditarFiliadoScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useNetInfo } from '@react-native-community/netinfo';
import { buildUpdateFiliadoPayload } from '../services/filiadoPayloadMapper';
import { atualizarFiliado, arquivarFiliado, desarquivarFiliado } from '../services/apiService';
import ContatoCard from '../components/ContatoCard';
import EnderecoCard from '../components/EnderecoCard';
import LotacaoCard from '../components/LotacaoCard';
import DependentesCard from '../components/DependentesCard';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Filiado } from '../types/filiado';
import { logDebug } from '../utils/filiadoUtils';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { logger } from '../infra/logger';
import api from '../services/apiService';
import { SafeAreaView, TouchableOpacity } from 'react-native';

export default function EditarFiliadoScreen({ route, navigation }) {
  const { filiado: filiadoData } = route.params;
  const { usuario } = useAuth();
  const netInfo = useNetInfo();
  const [filiado, setFiliado] = useState<Filiado | null>({
    ...filiadoData,
    situacao_funcional: filiadoData.situacao_funcional || '',
  });
  const [loading, setLoading] = useState(false);

  const [isDeleteDependentesOpen, setIsDeleteDependentesOpen] = useState(false);
  const [selectedDependenteIndices, setSelectedDependenteIndices] = useState<number[]>([]);
  const [isDeletingDependentes, setIsDeletingDependentes] = useState(false);

  useEffect(() => {
    if (!filiado) {
      Alert.alert('Erro', 'Dados do filiado não fornecidos.');
      navigation.goBack();
    } else {
      logDebug('EditarFiliado.init', {
        id: filiado.id,
        nome: filiado.nome,
        data_nascimento: filiado.data_nascimento,
        situacao_funcional: filiado.situacao_funcional,
        raw_keys: Object.keys(filiadoData)
      });
    }
  }, [filiado]);

  const handleUpdate = async () => {
    if (!netInfo.isConnected) {
      Alert.alert('Offline', 'A edição de filiados só está disponível online.');
      return;
    }

    if (!filiado.nome || !filiado.cpf || !filiado.email1) {
      Alert.alert('Erro de Validação', 'Nome, CPF e Email 1 são obrigatórios.');
      return;
    }
    if (filiado.cpf.length !== 11) {
      Alert.alert('Erro de Validação', 'O CPF deve conter 11 dígitos.');
      return;
    }

    for (let i = 1; i <= 5; i++) {
      const nome = filiado[`dep${i}_nome`];
      const cpf = filiado[`dep${i}_cpf`];
      const parentesco = filiado[`dep${i}_parentesco`];

      if (nome && !cpf) {
        Alert.alert('Erro de Validação', `O CPF do Dependente ${i} é obrigatório se o nome for preenchido.`);
        return;
      }
      if (cpf && !nome) {
        Alert.alert('Erro de Validação', `O Nome do Dependente ${i} é obrigatório se o CPF for preenchido.`);
        return;
      }
      if (cpf && cpf.length !== 11) {
        Alert.alert('Erro de Validação', `O CPF do Dependente ${i} deve conter 11 dígitos.`);
        return;
      }
      if (nome && parentesco === '') {
          Alert.alert('Erro de Validação', `O campo "Parentesco" do Dependente ${i} é obrigatório.`);
          return;
      }
    }

    try {
      setLoading(true);

      if (filiado.perfil_acesso !== filiadoData.perfil_acesso) {
        logDebug('PerfilAcesso.update.start', {
          targetId: filiado.id,
          from: filiadoData.perfil_acesso,
          to: filiado.perfil_acesso
        });
      }

      const payload = buildUpdateFiliadoPayload(filiado);
      await atualizarFiliado(filiado.id, payload);

      if (filiado.perfil_acesso !== filiadoData.perfil_acesso) {
        logDebug('PerfilAcesso.update.success');
      }

      Alert.alert('Sucesso', 'Filiado atualizado com sucesso.');
      // Navega para a tela de listagem dentro do Drawer para forçar o refresh
      navigation.navigate('Drawer', {
        screen: 'Filiados',
        params: { refresh: true },
      });
    } catch (err: any) {
      if (filiado.perfil_acesso !== filiadoData.perfil_acesso) {
        logDebug('PerfilAcesso.update.error', {
          message: err.message,
          status: err.response?.status,
          responseData: err.response?.data
        });
      }
      Alert.alert('Erro', err.response?.data?.message || 'Não foi possível atualizar o filiado.');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!netInfo.isConnected) {
      Alert.alert('Offline', 'A arquivação de filiados só está disponível online.');
      return;
    }

    Alert.prompt(
      'Confirmar Arquivamento',
      'Informe a justificativa para arquivar este filiado:',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Arquivar',
          style: 'destructive',
          onPress: async (motivo) => {
            if (!motivo || motivo.trim() === "") {
              Alert.alert("Erro", "A justificativa é obrigatória.");
              return;
            }
            logDebug('Filiados.archive.start', { id: filiado.id, currentStatus: 'ATIVO', endpoint: `/api/filiados/${filiado.id}/arquivar`, method: 'POST', bodyKeys: ['motivo'] });
            try {
              setLoading(true);
              const resp = await arquivarFiliado(filiado.id, motivo);
              logDebug('Filiados.archive.response', { status: resp.status, responseDataKeys: Object.keys(resp.data) });
              Alert.alert('Sucesso', 'Filiado arquivado com sucesso.');
              navigation.navigate('Drawer', {
                screen: 'Filiados',
                params: { refresh: true },
              });
            } catch (err: any) {
              logDebug('Filiados.archive.error', { status: err.response?.status, responseData: err.response?.data, stack: err.stack });
              Alert.alert('Erro', err.response?.data?.message || 'Não foi possível arquivar o filiado.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleUnarchive = async () => {
    if (!netInfo.isConnected) {
      Alert.alert('Offline', 'A desarquivação de filiados só está disponível online.');
      return;
    }

    Alert.prompt(
      'Confirmar Desarquivamento',
      'Informe a justificativa para desarquivar este filiado:',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desarquivar',
          onPress: async (motivo) => {
            logDebug('Filiados.unarchive.start', { id: filiado.id, currentStatus: 'ARQUIVADO', endpoint: `/api/filiados/${filiado.id}/desarquivar`, method: 'POST', bodyKeys: ['motivo'] });
            try {
              setLoading(true);
              const resp = await desarquivarFiliado(filiado.id, motivo || "Reativação via Mobile");
              logDebug('Filiados.unarchive.response', { status: resp.status, responseDataKeys: Object.keys(resp.data) });
              Alert.alert('Sucesso', 'Filiado desarquivado com sucesso.');
              navigation.navigate('Drawer', {
                screen: 'Filiados',
                params: { refresh: true },
              });
            } catch (err: any) {
              logDebug('Filiados.unarchive.error', { status: err.response?.status, responseData: err.response?.data, stack: err.stack });
              Alert.alert('Erro', err.response?.data?.message || 'Não foi possível desarquivar o filiado.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  if (!filiado) {
    return <View style={styles.centered}><Text>Filiado não encontrado.</Text></View>;
  }

  if (!usuario || !['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes(usuario.perfil_acesso)) {
    return <View style={styles.centered}><Text>Acesso negado.</Text></View>;
  }

  const isGestao = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes(usuario.perfil_acesso);

  const toggleDependenteSelection = (index: number) => {
    setSelectedDependenteIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const confirmDeleteDependentes = () => {
    if (selectedDependenteIndices.length === 0) {
      Alert.alert('Seleção Vazia', 'Por favor, selecione pelo menos um dependente para excluir.');
      return;
    }

    Alert.alert(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir ${selectedDependenteIndices.length} dependente(s)? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, Excluir',
          style: 'destructive',
          onPress: handleDeleteDependentes
        }
      ]
    );
  };

  const handleDeleteDependentes = async () => {
    if (!filiado) return;

    try {
      setIsDeletingDependentes(true);
      logger.info('[EditarFiliado.deleteDependentes.request]', {
        id: filiado.id,
        indices: selectedDependenteIndices
      });

      const response = await api.delete(`/api/filiados/${filiado.id}/dependentes`, {
        data: { indices: selectedDependenteIndices }
      });

      if (response.status === 200 || response.status === 204) {
        logger.info('[EditarFiliado.deleteDependentes.success]', { count: selectedDependenteIndices.length });
        Alert.alert('Sucesso', 'Dependentes excluídos com sucesso.');
        setIsDeleteDependentesOpen(false);
        setSelectedDependenteIndices([]);

        navigation.navigate('Drawer', {
          screen: 'Filiados',
          params: { refresh: true },
        });
      } else {
        throw new Error('Falha na exclusão.');
      }
    } catch (err: any) {
      logger.error('[EditarFiliado.deleteDependentes.error]', err);
      Alert.alert('Erro', err.response?.data?.message || 'Não foi possível excluir os dependentes.');
    } finally {
      setIsDeletingDependentes(false);
    }
  };

  const renderExcluirDependentes = () => {
    const dependentesAtuais = [];
    if (filiado) {
      for (let i = 1; i <= 5; i++) {
        if (filiado[`dep${i}_nome`]) {
          dependentesAtuais.push({
            nome: filiado[`dep${i}_nome`],
            index: i - 1
          });
        }
      }
    }

    if (dependentesAtuais.length === 0) return null;

    return (
      <View style={{ backgroundColor: '#f7f9fc', paddingHorizontal: 20 }}>
        <TouchableOpacity
          style={styles.toggleDeleteBtn}
          onPress={() => setIsDeleteDependentesOpen(!isDeleteDependentesOpen)}
          disabled={loading || isDeletingDependentes}
        >
          <MaterialCommunityIcons name="delete-outline" size={20} color="#c62828" />
          <Text style={styles.toggleDeleteBtnText}>
            {isDeleteDependentesOpen ? 'Cancelar Exclusão' : 'Excluir dependentes'}
          </Text>
        </TouchableOpacity>

        {isDeleteDependentesOpen && (
          <View style={styles.deletePanel}>
            <Text style={styles.deletePanelTitle}>Selecione para remover:</Text>
            {dependentesAtuais.map((dep) => (
              <TouchableOpacity
                key={dep.index}
                style={styles.dependenteRow}
                onPress={() => toggleDependenteSelection(dep.index)}
                disabled={isDeletingDependentes}
              >
                <MaterialCommunityIcons
                  name={selectedDependenteIndices.includes(dep.index) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={24}
                  color={selectedDependenteIndices.includes(dep.index) ? '#c62828' : '#757575'}
                />
                <Text style={styles.dependenteRowText}>{dep.nome}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[
                styles.confirmDeleteBtn,
                (selectedDependenteIndices.length === 0 || isDeletingDependentes) && styles.confirmDeleteBtnDisabled
              ]}
              onPress={confirmDeleteDependentes}
              disabled={selectedDependenteIndices.length === 0 || isDeletingDependentes}
            >
              <Text style={styles.confirmDeleteBtnText}>
                {isDeletingDependentes ? 'Excluindo...' : 'Confirmar Exclusão'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.stickyHeader}>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton, loading && styles.disabledButton]}
            onPress={handleUpdate}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>{loading ? "..." : "Salvar"}</Text>
          </TouchableOpacity>

          {filiado.arquivado_em ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.unarchiveButton, loading && styles.disabledButton]}
              onPress={handleUnarchive}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Desarquivar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.archiveButton, loading && styles.disabledButton]}
              onPress={handleArchive}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Arquivar</Text>
            </TouchableOpacity>
          )}
        </View>

        {filiado.arquivado_em && (
          <View style={styles.archiveDetails}>
            <Text style={styles.archiveDetailsTitle}>📋 Detalhes do arquivamento</Text>
            <View style={styles.archiveDetailsGrid}>
              <View style={styles.archiveItem}>
                <Text style={styles.archiveLabel}>Arquivado por:</Text>
                <Text style={styles.archiveValue}>{filiado.arquivado_por_nome || `ID ${filiado.arquivado_por}` || "—"}</Text>
              </View>
              <View style={styles.archiveItem}>
                <Text style={styles.archiveLabel}>Arquivado em:</Text>
                <Text style={styles.archiveValue}>{filiado.arquivado_em ? new Date(filiado.arquivado_em).toLocaleString('pt-BR') : "—"}</Text>
              </View>
              <View style={[styles.archiveItem, { width: '100%' }]}>
                <Text style={styles.archiveLabel}>Motivo:</Text>
                <Text style={styles.archiveValue}>{filiado.arquivado_motivo || "—"}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>👤 Informações Pessoais</Text>
        </View>
        <ContatoCard filiado={filiado} setFiliado={setFiliado} isEditing={isGestao} hideTitle={true} />

        <View style={[styles.sectionHeader, { backgroundColor: '#f7f9fc' }]}>
          <Text style={styles.sectionTitle}>🏠 Endereço</Text>
        </View>
        <EnderecoCard filiado={filiado} setFiliado={setFiliado} hideTitle={true} cardStyle={{ backgroundColor: '#f7f9fc' }} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏢 Lotação e Perfil</Text>
        </View>
        <LotacaoCard filiado={filiado} setFiliado={setFiliado} isEditing={isGestao} hideTitle={true} />

        <View style={[styles.sectionHeader, { backgroundColor: '#f7f9fc' }]}>
          <Text style={styles.sectionTitle}>👶 Dependentes</Text>
        </View>

        {isGestao && renderExcluirDependentes()}

        <DependentesCard filiado={filiado} setFiliado={setFiliado} isEditing={isGestao} hideTitle={true} cardStyle={{ backgroundColor: '#f7f9fc' }} />

        <View style={{ height: 40 }} />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  stickyHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    zIndex: 100,
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#007bff',
  },
  archiveButton: {
    backgroundColor: '#dc3545',
  },
  unarchiveButton: {
    backgroundColor: '#28a745',
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#003366',
  },
  archiveDetails: {
    backgroundColor: '#fff8f8',
    borderWidth: 1,
    borderColor: '#e57373',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  archiveDetailsTitle: {
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 8,
    fontSize: 14,
  },
  archiveDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  archiveItem: {
    minWidth: '45%',
  },
  archiveLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  archiveValue: {
    fontSize: 13,
    color: '#333',
  },
  buttonContainer: {
    marginTop: 10,
  },
  deletePanel: {
    backgroundColor: '#fff8f8',
    borderWidth: 1,
    borderColor: '#e57373',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  deletePanelTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#c62828',
    marginBottom: 10,
  },
  dependenteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ffcdd2',
  },
  dependenteRowText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
  },
  confirmDeleteBtn: {
    backgroundColor: '#c62828',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 15,
  },
  confirmDeleteBtnDisabled: {
    backgroundColor: '#ef9a9a',
  },
  confirmDeleteBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  toggleDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#c62828',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  toggleDeleteBtnText: {
    color: '#c62828',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
