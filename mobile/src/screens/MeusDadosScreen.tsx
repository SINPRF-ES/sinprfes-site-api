// src/screens/MeusDadosScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Image, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../hooks/useAuth';
import api from '../services/apiService';
import { uploadAvatar, removerAvatar } from '../services/filiadosService';
import type { Filiado } from '../types/filiado';

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
    try {
      setLoading(true);
      const { data } = await api.put<Filiado>('/api/filiados/me', filiado);
      setFiliado(data);

      // Atualiza o usuário no contexto de autenticação, se necessário
      if (usuario) {
        const usuarioAtualizado = { ...usuario, nome: data.nome, email: data.email, avatar_url: data.avatar_url };
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

  if (loading && !filiado) { // Evita piscar a tela de loading em updates
    return <View style={styles.container}><Text>Carregando...</Text></View>;
  }

  if (error) {
    return <View style={styles.container}><Text style={{color: 'red'}}>{error}</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.avatarContainer}>
        <Image 
          source={filiado?.avatar_url ? { uri: filiado.avatar_url } : require('../../assets/icon.png')} 
          style={styles.avatar} 
        />
        <View style={styles.buttonContainer}>
          <Button title={isUploading ? "Enviando..." : "Alterar Foto"} onPress={handleAvatarUpload} disabled={isUploading || loading} />
          {filiado?.avatar_url && (
            <View style={styles.buttonSpacer} />
          )}
          {filiado?.avatar_url && (
            <Button title="Remover Foto" onPress={handleAvatarRemove} color="#c00" disabled={isUploading || loading} />
          )}
        </View>
      </View>

      <Text style={styles.label}>Nome</Text>
      <TextInput
        style={styles.input}
        value={filiado?.nome || ''}
        onChangeText={(text) => setFiliado(f => f ? {...f, nome: text} : null)}
        placeholder="Nome Completo"
      />
      
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={filiado?.email || ''}
        onChangeText={(text) => setFiliado(f => f ? {...f, email: text} : null)}
        placeholder="seu@email.com"
        keyboardType="email-address"
      />

      <Text style={styles.label}>Telefone</Text>
      <TextInput
        style={styles.input}
        value={filiado?.telefone || ''}
        onChangeText={(text) => setFiliado(f => f ? {...f, telefone: text} : null)}
        placeholder="(99) 99999-9999"
        keyboardType="phone-pad"
      />

      {/* Adicionar outros campos aqui conforme a API permitir */}

      <Button title={loading ? "Salvando..." : "Salvar Alterações"} onPress={handleUpdate} disabled={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonSpacer: {
    width: 10,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
    backgroundColor: '#ccc',
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
});
