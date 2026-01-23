// src/screens/MeusDadosScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/apiService';
import { uploadAvatar, removerAvatar } from '../services/filiadosService';
import type { Filiado } from '../types/filiado';

// Importando os novos componentes
import HeaderInfo from '../components/HeaderInfo';
import ContatoCard from '../components/ContatoCard';
import EnderecoCard from '../components/EnderecoCard';
import LotacaoCard from '../components/LotacaoCard';
import DependentesCard from '../components/DependentesCard';
import ErrorBoundary from '../components/ErrorBoundary';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { toISODate, toBrazilianDate } from '../utils/date';
import { onlyDigits } from '../shared/format/formatters';
import { logger } from '../infra/logger';
import { getCanonicalFiliadoId } from '../utils/filiadoUtils';

export default function MeusDadosScreen() {
  const { usuario, setSessao, token } = useAuth();
  const [filiado, setFiliado] = useState<Filiado | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const [isDeleteDependentesOpen, setIsDeleteDependentesOpen] = useState(false);
  const [selectedDependenteIndices, setSelectedDependenteIndices] = useState<number[]>([]);
  const [isDeletingDependentes, setIsDeletingDependentes] = useState(false);

  // Efeito para buscar os dados completos do filiado
  const fetchFiliadoData = useCallback(async () => {
    try {
      setLoading(true);
      // O `apiService` já injeta o token
      const { data } = await api.get<Filiado>('/api/filiados/me');

      // Formata as datas dos dependentes para o padrão brasileiro antes de popular o estado
      for (let i = 1; i <= 5; i++) {
        const fieldName = `dep${i}_data_nascimento`;
        if (data[fieldName]) {
          data[fieldName] = toBrazilianDate(data[fieldName]);
        }
      }

      setFiliado(data);
    } catch (err: any) {
      setError(err.message || 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiliadoData();
  }, [fetchFiliadoData]);

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
      const canonicalId = getCanonicalFiliadoId(filiado);
      logger.info('[MeusDados.deleteDependentes.confirm]', { id: canonicalId, selected: selectedDependenteIndices });

      logger.info('[MeusDados.deleteDependentes.request]', {
        id: canonicalId,
        indices: selectedDependenteIndices
      });

      const response = await api.delete(`/api/filiados/${canonicalId}/dependentes`, {
        data: { indices: selectedDependenteIndices }
      });

      if (response.status === 200 || response.status === 204) {
        logger.info('[MeusDados.deleteDependentes.success]', { count: selectedDependenteIndices.length });
        Alert.alert('Sucesso', 'Dependentes excluídos com sucesso.');
        setIsDeleteDependentesOpen(false);
        setSelectedDependenteIndices([]);
        await fetchFiliadoData();
      } else {
        throw new Error('Falha na exclusão.');
      }
    } catch (err: any) {
      logger.error('[MeusDados.deleteDependentes.error]', err, {
        message: err.message,
        responseData: err.response?.data
      });
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
      <View>
        <TouchableOpacity
          style={styles.toggleDeleteBtn}
          onPress={() => {
            setIsDeleteDependentesOpen(!isDeleteDependentesOpen);
            if (!isDeleteDependentesOpen) logger.info('[MeusDados.deleteDependentes.open]');
          }}
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

  const handleUpdate = async () => {
    if (!filiado) return;

    // Validação de Dependentes
    for (let i = 1; i <= 5; i++) {
      const nome = filiado[`dep${i}_nome`];
      const cpf = filiado[`dep${i}_cpf`];

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
    }

    try {
      setLoading(true);

      const payload = { ...filiado };

      // Normalização de campos antes de enviar ao backend
      payload.cpf = onlyDigits(payload.cpf);
      payload.telefone1 = onlyDigits(payload.telefone1);
      payload.telefone2 = onlyDigits(payload.telefone2);
      payload.cep = onlyDigits(payload.cep);

      if (payload.data_nascimento) {
          payload.data_nascimento = toISODate(payload.data_nascimento) || payload.data_nascimento;
      }

      for (let i = 1; i <= 5; i++) {
        const depCpf = `dep${i}_cpf`;
        if (payload[depCpf]) payload[depCpf] = onlyDigits(payload[depCpf]);

        const fieldName = `dep${i}_data_nascimento`;
        if (payload[fieldName]) {
          payload[fieldName] = toISODate(payload[fieldName]) || payload[fieldName];
        }
      }

      await api.put<Filiado>('/api/filiados/me', payload);

      // Re-fetch dos dados completos para re-hidratar o estado
      const { data: refreshedData } = await api.get<Filiado>('/api/filiados/me');
      setFiliado(refreshedData);

      // Atualiza o usuário no contexto de autenticação, se necessário
      if (usuario) {
        const usuarioAtualizado = { ...usuario, nome: refreshedData.nome, email: refreshedData.email1, avatar_url: refreshedData.avatar_url };
        await setSessao(token!, usuarioAtualizado);
      }

      Alert.alert('Sucesso', 'Seus dados foram atualizados.');
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Não foi possível atualizar os dados.');
    } finally {
      setLoading(false);
    }
  };

  const processAndUploadImage = async (uri: string) => {
    try {
      setIsUploading(true);
      const filiadoAtualizado = await uploadAvatar(uri);
      setFiliado(filiadoAtualizado);

      if (usuario) {
        const usuarioAtualizado = { ...usuario, avatar_url: filiadoAtualizado.avatar_url };
        await setSessao(token!, usuarioAtualizado);
      }

      Alert.alert('Sucesso', 'Sua foto de perfil foi atualizada.');
    } catch (err: any) {
      console.error('[Upload Avatar Error]', err);
      Alert.alert('Erro no Upload', err.response?.data?.message || 'Não foi possível enviar sua foto.');
    } finally {
      setIsUploading(false);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à sua câmera para tirar uma foto.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    await processAndUploadImage(result.assets[0].uri);
  };

  const chooseFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à sua galeria para escolher uma foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    await processAndUploadImage(result.assets[0].uri);
  };
  
  const handleAvatarUpload = () => {
    Alert.alert(
      "Alterar Foto de Perfil",
      "Escolha uma opção",
      [
        {
          text: "Tirar Foto",
          onPress: takePhoto,
        },
        {
          text: "Escolher da Galeria",
          onPress: chooseFromLibrary,
        },
        {
          text: "Cancelar",
          style: "cancel",
        },
      ]
    );
  };

  const handleAvatarRemove = async () => {
    Alert.alert(
      "Confirmar Remoção",
      "Tem certeza de que deseja remover sua foto de perfil?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              setIsUploading(true); // Reutiliza o estado de loading
              const filiadoAtualizado = await removerAvatar();
              setFiliado(filiadoAtualizado);

              if (usuario) {
                const usuarioAtualizado = { ...usuario, avatar_url: null };
                await setSessao(token!, usuarioAtualizado);
              }

              Alert.alert('Sucesso', 'Sua foto foi removida.');
            } catch (err: any) {
              console.error('[Remove Avatar Error]', err);
              Alert.alert('Erro', err.response?.data?.message || 'Não foi possível remover sua foto.');
            } finally {
              setIsUploading(false);
            }
          }
        }
      ]
    );
  };

  if (loading && !filiado) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  if (error) {
    return <View style={styles.centered}><Text style={{ color: 'red' }}>{error}</Text></View>;
  }

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <HeaderInfo filiado={filiado} />

      <View style={styles.actionsContainer}>
        <Button title={isUploading ? "Enviando..." : "Alterar Foto"} onPress={handleAvatarUpload} disabled={isUploading || loading} />
        {filiado?.avatar_url && <View style={styles.buttonSpacer} />}
        {filiado?.avatar_url && (
          <Button title="Remover Foto" onPress={handleAvatarRemove} color="#c00" disabled={isUploading || loading} />
        )}
      </View>
      
      <ErrorBoundary>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>👤 Informações Pessoais</Text>
        </View>
        <ContatoCard filiado={filiado} setFiliado={setFiliado} hideTitle={true} />
      </ErrorBoundary>

      <ErrorBoundary>
        <View style={[styles.sectionHeader, { backgroundColor: '#f7f9fc' }]}>
          <Text style={styles.sectionTitle}>🏠 Endereço</Text>
        </View>
        <EnderecoCard filiado={filiado} setFiliado={setFiliado} hideTitle={true} cardStyle={{ backgroundColor: '#f7f9fc' }} />
      </ErrorBoundary>

      <ErrorBoundary>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏢 Lotação e Perfil</Text>
        </View>
        <LotacaoCard filiado={filiado} setFiliado={setFiliado} hideTitle={true} />
      </ErrorBoundary>

      <ErrorBoundary>
        <View style={[styles.sectionHeader, { backgroundColor: '#f7f9fc' }]}>
          <Text style={styles.sectionTitle}>👶 Dependentes</Text>
        </View>
        <DependentesCard filiado={filiado} setFiliado={setFiliado} hideTitle={true} cardStyle={{ backgroundColor: '#f7f9fc' }} />
      </ErrorBoundary>

      {renderExcluirDependentes()}

      <View style={styles.saveButtonContainer}>
        <Button title={loading ? "Salvando..." : "Salvar Alterações"} onPress={handleUpdate} disabled={loading} />
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20, // Puxa para cima, perto do header
    marginBottom: 20,
  },
  buttonSpacer: {
    width: 10,
  },
  saveButtonContainer: {
    padding: 20,
    marginBottom: 40,
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
  // Estilos para Excluir Dependentes
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
  },
  toggleDeleteBtnText: {
    color: '#c62828',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
