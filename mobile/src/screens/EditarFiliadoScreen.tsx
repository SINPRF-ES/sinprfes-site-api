// mobile/src/screens/EditarFiliadoScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useNetInfo } from '@react-native-community/netinfo';
import api from '../services/apiService';
import ContatoCard from '../components/ContatoCard';
import EnderecoCard from '../components/EnderecoCard';
import LotacaoCard from '../components/LotacaoCard';
import DependentesCard from '../components/DependentesCard';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Filiado } from '../types/filiado';

export default function EditarFiliadoScreen({ route, navigation }) {
  const { filiado: filiadoData } = route.params;
  const { usuario } = useAuth();
  const netInfo = useNetInfo();
  const [filiado, setFiliado] = useState<Filiado | null>(filiadoData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filiado) {
      Alert.alert('Erro', 'Dados do filiado não fornecidos.');
      navigation.goBack();
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
      await api.put(`/api/filiados/${filiado.id}`, filiado);
      Alert.alert('Sucesso', 'Filiado atualizado com sucesso.');
      navigation.navigate('Filiados', { refresh: true });
    } catch (err: any) {
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
    Alert.alert(
      'Confirmar Arquivamento',
      'Tem certeza de que deseja arquivar este filiado?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Arquivar',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await api.post(`/api/filiados/${filiadoId}/arquivar`);
              Alert.alert('Sucesso', 'Filiado arquivado com sucesso.');
              navigation.navigate('Filiados', { refresh: true });
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.message || 'Não foi possível arquivar o filiado.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleUnarchive = async () => {
    if (!netInfo.isConnected) {
      Alert.alert('Offline', 'A desarquivação de filiados só está disponível online.');
      return;
    }
    Alert.alert(
      'Confirmar Desarquivamento',
      'Tem certeza de que deseja desarquivar este filiado?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desarquivar',
          onPress: async () => {
            try {
              setLoading(true);
              await api.post(`/api/filiados/${filiadoId}/desarquivar`);
              Alert.alert('Sucesso', 'Filiado desarquivado com sucesso.');
              navigation.navigate('Filiados', { refresh: true });
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.message || 'Não foi possível desarquivar o filiado.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
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

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.title}>Editar Filiado</Text>
      
      <ContatoCard filiado={filiado} setFiliado={setFiliado} />
      <EnderecoCard filiado={filiado} setFiliado={setFiliado} />
      <LotacaoCard filiado={filiado} setFiliado={setFiliado} />
      <DependentesCard filiado={filiado} setFiliado={setFiliado} />

      <View style={styles.buttonContainer}>
        <Button title={loading ? "Salvando..." : "Salvar Alterações"} onPress={handleUpdate} disabled={loading} />
      </View>
      <View style={styles.buttonContainer}>
        {filiado.arquivado_em ? (
          <Button title="Desarquivar" onPress={handleUnarchive} color="green" disabled={loading} />
        ) : (
          <Button title="Arquivar" onPress={handleArchive} color="red" disabled={loading} />
        )}
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
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 10,
  },
});
