// src/screens/MeusDadosScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Image, ScrollView } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import api from '../services/apiService';
import type { Filiado } from '../types/filiado'; // Supondo que o tipo exista

export default function MeusDadosScreen() {
  const { usuario, setSessao, token } = useAuth();
  const [filiado, setFiliado] = useState<Filiado | null>(null);
  const [loading, setLoading] = useState(true);
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
      // (aqui, assumimos que o `usuario` no AuthContext tem os mesmos campos básicos)
      if (usuario) {
        const usuarioAtualizado = { ...usuario, nome: data.nome, email: data.email };
        await setSessao(token!, usuarioAtualizado); // Precisamos do token aqui
      }

      Alert.alert('Sucesso', 'Seus dados foram atualizados.');
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Não foi possível atualizar os dados.');
    } finally {
      setLoading(false);
    }
  };
  
  // TODO: Implementar upload de avatar com ImagePicker
  const handleAvatarUpload = () => {
    Alert.alert('Em construção', 'O upload de avatar será implementado em breve.');
  };

  if (loading) {
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
        <Button title="Alterar Foto" onPress={handleAvatarUpload} />
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
