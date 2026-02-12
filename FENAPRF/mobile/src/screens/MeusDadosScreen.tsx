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
import ErrorBoundary from '../components/ErrorBoundary';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SafeScreen from '../components/SafeScreen';
import { toISODate, toBrazilianDate } from '../utils/date';
import { onlyDigits } from '../utils/format';
import { logger } from '../infra/logger';
import { getCanonicalUserId } from '../utils/user';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';
import { useNavigation } from '@react-navigation/native';
import { normalizeNome } from '../utils/user';
import { tituloCargoUf } from '../utils/user';

export default function MeusDadosScreen() {
  const navigation = useNavigation<any>();
  const { user: authUser, setSessao, token } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  // Efeito para buscar os dados completos do membro
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
    if (!user || isSaving) return;

    try {
      setIsSaving(true);

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

      // Atualiza o membro no contexto de autenticação, se necessário
      if (authUser) {
        const authUserAtualizado = { ...authUser, name: refreshedData.name, email: refreshedData.email, avatar_url: refreshedData.avatar_url };
        await setSessao(token!, authUserAtualizado);
      }

      Alert.alert('Sucesso', 'Seus dados foram atualizados.');
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Não foi possível atualizar os dados.');
    } finally {
      setIsSaving(false);
    }
  }, [user, authUser, token, setSessao, isSaving]);

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
      {
        label: isSaving ? 'Salvando...' : 'Salvar Alterações',
        icon: isSaving ? 'clock-outline' : 'content-save',
        onPress: handleUpdate,
        disabled: isSaving
      },
      { label: 'Alterar Foto', icon: 'camera', onPress: handleAvatarUpload, disabled: isSaving || isUploading }
    ];

    if (user?.avatar_url) {
      actions.push({
        label: 'Remover Foto',
        icon: 'camera-off',
        onPress: handleAvatarRemove,
        isDestructive: true,
        disabled: isSaving || isUploading
      });
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
      <MemberCard member={user} variant="profile" />

      <ErrorBoundary>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>👤 Informações Pessoais</Text>
        </View>
        <ContatoCard
          user={user}
          setUser={setUser}
          isEditing={!isSaving && !isUploading}
          isManagement={!isSaving && !isUploading && ['ADMIN', 'DIRETORIA', 'COLABORADOR'].includes((authUser?.perfil_acesso || '').toUpperCase())}
          hideTitle={true}
        />
      </ErrorBoundary>

      <ErrorBoundary>
        <View style={[styles.sectionHeader, { backgroundColor: '#f7f9fc' }]}>
          <Text style={styles.sectionTitle}>🏠 Endereço</Text>
        </View>
        <EnderecoCard
          user={user}
          setUser={setUser}
          hideTitle={true}
          cardStyle={{ backgroundColor: '#f7f9fc', opacity: (isSaving || isUploading) ? 0.6 : 1 }}
          disabled={isSaving || isUploading}
        />
      </ErrorBoundary>

      {user?.perfil_acesso2 && (
        <ErrorBoundary>
          <View style={[styles.sectionHeader, { backgroundColor: '#fff' }]}>
            <Text style={styles.sectionTitle}>🔗 Segundo Vínculo</Text>
          </View>
          <View style={styles.secondVinculoContainer}>
            <Text style={styles.secondVinculoText}>
              {tituloCargoUf({
                perfil_acesso: user.perfil_acesso2,
                cargo: user.cargo2,
                uf: user.uf2
              })}
            </Text>
          </View>
        </ErrorBoundary>
      )}

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
  secondVinculoContainer: {
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  secondVinculoText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});
