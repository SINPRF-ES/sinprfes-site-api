// src/screens/MeusDadosScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../hooks/useAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/apiService';
import { uploadAvatar, removerAvatar } from '../services/usersService';
import type { User } from '../types/user';

// Importando os novos componentes
import MemberCard from '../components/MemberCard';
import ContatoCard from '../components/ContatoCard';
import EnderecoCard from '../components/EnderecoCard';
import MembroPerfilCard from '../components/MembroPerfilCard';
import ErrorBoundary from '../components/ErrorBoundary';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SafeScreen from '../components/SafeScreen';
import { toISODate, toBrazilianDate } from '../utils/date';
import { onlyDigits } from '../shared/format/formatters';
import { logger } from '../infra/logger';
import { getCanonicalUserId, isGestao } from '../utils/userUtils';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';
import { useNavigation } from '@react-navigation/native';
import { normalizeNome } from '../utils/canon';

export default function MeusDadosScreen() {
  const navigation = useNavigation<any>();
  const { user: authUser, setSessao, token } = useAuth();
  const [user, setUser] = useState<User | null>(null);

  const ehGestaoAtor = isGestao(authUser?.perfil_acesso);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  // Efeito para buscar os dados completos do usuário
  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true);
      // O `apiService` já injeta o token
      const { data } = await api.get<User>('/api/users/me');

      setUser(data);
      logger.info('MEUS_DADOS_STATE_SNAPSHOT', {
        hasAuthUser: !!authUser,
        hasFetchedData: !!data,
        userKeys: data ? Object.keys(data) : [],
      });
    } catch (err: any) {
      setError(err.message || 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);


  const handleUpdate = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const payload = { ...user };

      // Normalização de campos antes de enviar ao backend
      if (payload.name) payload.name = normalizeNome(payload.name) || '';
      payload.cpf = onlyDigits(payload.cpf);
      if (payload.telefone1) payload.telefone1 = onlyDigits(payload.telefone1);
      if (payload.telefone2) payload.telefone2 = onlyDigits(payload.telefone2);
      if (payload.cep) payload.cep = onlyDigits(payload.cep);

      if (payload.data_nascimento) {
          payload.data_nascimento = toISODate(payload.data_nascimento) || payload.data_nascimento;
      }

      await api.put<User>('/api/users/me', payload);

      // Re-fetch dos dados completos para re-hidratar o estado
      const { data: refreshedData } = await api.get<User>('/api/users/me');
      setUser(refreshedData);

      // Atualiza o usuário no contexto de autenticação, se necessário
      if (authUser) {
        const authUserAtualizado = { ...authUser, name: refreshedData.name, email: refreshedData.email, avatar_url: refreshedData.avatar_url };
        await setSessao(token!, authUserAtualizado);
      }

      Alert.alert('Sucesso', 'Seus dados foram atualizados.');
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Não foi possível atualizar os dados.');
    } finally {
      setLoading(false);
    }
  }, [user, authUser, token, setSessao]);

  const processAndUploadImage = async (uri: string) => {
    try {
      setIsUploading(true);
      const dataAtualizada = await uploadAvatar(uri);
      setUser(dataAtualizada);

      if (authUser) {
        const authUserAtualizado = { ...authUser, avatar_url: dataAtualizada.avatar_url };
        await setSessao(token!, authUserAtualizado);
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

  const handleAvatarUpload = useCallback(() => {
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
  }, [takePhoto, chooseFromLibrary]);

  const handleAvatarRemove = useCallback(async () => {
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
              const dataRemovida = await removerAvatar();
              setUser(dataRemovida);

              if (authUser) {
                const authUserLimpo = { ...authUser, avatar_url: null };
                await setSessao(token!, authUserLimpo);
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
  }, [user, authUser, token, setSessao]);

  useEffect(() => {
    const actions: MenuAction[] = [
      { label: 'Salvar Alterações', icon: 'content-save', onPress: handleUpdate },
      { label: 'Alterar Foto', icon: 'camera', onPress: handleAvatarUpload }
    ];

    if (user?.avatar_url) {
      actions.push({ label: 'Remover Foto', icon: 'camera-off', onPress: handleAvatarRemove, isDestructive: true });
    }

    navigation.setOptions({
      headerRight: () => <HeaderMenu actions={actions} />,
      headerStyle: { backgroundColor: '#003366' },
      headerTintColor: '#fff',
      headerTitleAlign: 'center',
    });
  }, [navigation, user, handleUpdate, handleAvatarUpload, handleAvatarRemove]);

  if (loading && !user) {
    return <View style={styles.centered}><ActivityIndicator size="large" /></View>;
  }

  if (error) {
    return <View style={styles.centered}><Text style={{ color: 'red' }}>{error}</Text></View>;
  }

  return (
    <SafeScreen style={styles.container}>
    <KeyboardAwareScrollView
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      enableOnAndroid
      extraScrollHeight={50}
    >
      {user && <MemberCard member={user} containerStyle={{ marginHorizontal: 20, marginTop: 20 }} />}

      <ErrorBoundary>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>👤 Informações Pessoais</Text>
        </View>
        <ContatoCard
          user={user}
          setUser={setUser}
          isEditing={true}
          isManagement={ehGestaoAtor}
          hideTitle={true}
        />
      </ErrorBoundary>

      <ErrorBoundary>
        <View style={[styles.sectionHeader, { backgroundColor: '#f7f9fc' }]}>
          <Text style={styles.sectionTitle}>🏠 Endereço</Text>
        </View>
        <EnderecoCard user={user} setUser={setUser} hideTitle={true} cardStyle={{ backgroundColor: '#f7f9fc' }} />
      </ErrorBoundary>

      <ErrorBoundary>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏢 Situação e Perfil</Text>
        </View>
        <MembroPerfilCard user={user} setUser={setUser} isEditing={ehGestaoAtor} hideTitle={true} />
      </ErrorBoundary>

    </KeyboardAwareScrollView>
    </SafeScreen>
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
