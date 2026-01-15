// mobile/src/screens/CriarFiliadoScreen.tsx
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useNetInfo } from '@react-native-community/netinfo';
import api from '../services/apiService';
import ContatoCard from '../components/ContatoCard';
import EnderecoCard from '../components/EnderecoCard';
import LotacaoCard from '../components/LotacaoCard';
import DependentesCard from '../components/DependentesCard';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Filiado } from '../types/filiado';

const initialFiliadoState: Partial<Filiado> = {
  nome: '',
  cpf: '',
  email1: '',
  email2: '',
  telefone1: '',
  telefone2: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  cidade: '',
  uf: '',
  lotacao: 'SR-ES', // Valor padrão
  situacao: 'ATIVO', // Valor padrão
  dep1_nome: '', dep1_cpf: '', dep1_nascimento: null, dep1_parentesco: '',
  dep2_nome: '', dep2_cpf: '', dep2_nascimento: null, dep2_parentesco: '',
  dep3_nome: '', dep3_cpf: '', dep3_nascimento: null, dep3_parentesco: '',
  dep4_nome: '', dep4_cpf: '', dep4_nascimento: null, dep4_parentesco: '',
  dep5_nome: '', dep5_cpf: '', dep5_nascimento: null, dep5_parentesco: '',
};

export default function CriarFiliadoScreen({ navigation }) {
  const { usuario } = useAuth();
  const netInfo = useNetInfo();
  const [filiado, setFiliado] = useState<Partial<Filiado>>(initialFiliadoState);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!netInfo.isConnected) {
      Alert.alert('Offline', 'A criação de filiados só está disponível online.');
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
      await api.post('/api/filiados', filiado);
      Alert.alert('Sucesso', 'Filiado criado com sucesso.');
      navigation.navigate('Filiados', { refresh: true });
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Não foi possível criar o filiado.');
    } finally {
      setLoading(false);
    }
  };

  // Renderiza apenas se for perfil de GESTAO
  if (!usuario || !['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes(usuario.perfil_acesso)) {
    return (
      <View style={styles.centered}>
        <Text>Acesso negado.</Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.title}>Novo Filiado</Text>
      
      {/* Reutilizar os cards para entrada de dados */}
      <ContatoCard filiado={filiado as Filiado} setFiliado={setFiliado} />
      <EnderecoCard filiado={filiado as Filiado} setFiliado={setFiliado} />
      <LotacaoCard filiado={filiado as Filiado} setFiliado={setFiliado} />
      <DependentesCard filiado={filiado as Filiado} setFiliado={setFiliado} />

      <View style={styles.saveButtonContainer}>
        <Button title={loading ? "Criando..." : "Criar Filiado"} onPress={handleCreate} disabled={loading} />
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
  saveButtonContainer: {
    marginTop: 10,
    marginBottom: 40,
  },
});
