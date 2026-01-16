// src/screens/MeusDadosScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../hooks/useAuth';
import api from '../services/apiService';
import { uploadAvatar, removerAvatar } from '../services/filiadosService';
import type { Filiado } from '../types/filiado';

// Importando os novos componentes
import HeaderInfo from '../components/HeaderInfo';
import ContatoCard from '../components/ContatoCard';
import EnderecoCard from '../components/EnderecoCard';
import LotacaoCard from '../components/LotacaoCard';
import DependentesCard from '../components/DependentesCard';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { toISODate } from '../utils/date';

export default function MeusDadosScreen() {
  const { usuario, setSessao, token } = useAuth();
  const [filiado, setFiliado] = useState<Filiado | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  // Efeito para buscar os dados completos do filiado
  useEffect(() => {
    const fetchFiliadoData = async () => {
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
    };

    fetchFiliadoData();
  }, []);

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
      for (let i = 1; i <= 5; i++) {
        const fieldName = `dep${i}_data_nascimento`;
        if (payload[fieldName]) {
          payload[fieldName] = toISODate(payload[fieldName]);
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
      
      <ContatoCard filiado={filiado} setFiliado={setFiliado} />
      <EnderecoCard filiado={filiado} setFiliado={setFiliado} />
      <LotacaoCard filiado={filiado} setFiliado={setFiliado} />
      <DependentesCard filiado={filiado} setFiliado={setFiliado} />

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
    padding: 20,
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
    marginTop: 10,
    marginBottom: 40, // Espaço extra na parte inferior
  },
});
