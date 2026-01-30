// mobile/src/screens/CriarFiliadoScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useNetInfo } from '@react-native-community/netinfo';
import api from '../services/apiService';
import ContatoCard from '../components/ContatoCard';
import EnderecoCard from '../components/EnderecoCard';
import LotacaoCard from '../components/LotacaoCard';
import DependentesCard from '../components/DependentesCard';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SafeScreen from '../components/SafeScreen';
import { Filiado } from '../types/filiado';
import { toISODate } from '../utils/date';
import { onlyDigits } from '../shared/format/formatters';
import { isGestao as checkIsGestao } from '../utils/filiadoUtils';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';

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
  lotacao: 'SEDE', // Valor padrão
  situacao: 'ATIVO', // Valor padrão
  perfil_acesso: 'FILIADO', // Valor padrão
  dep1_nome: '', dep1_cpf: '', dep1_nascimento: null, dep1_parentesco: '',
  dep2_nome: '', dep2_cpf: '', dep2_nascimento: null, dep2_parentesco: '',
  dep3_nome: '', dep3_cpf: '', dep3_nascimento: null, dep3_parentesco: '',
  dep4_nome: '', dep4_cpf: '', dep4_nascimento: null, dep4_parentesco: '',
  dep5_nome: '', dep5_cpf: '', dep5_nascimento: null, dep5_parentesco: '',
};

export default function CriarFiliadoScreen({ navigation }: any) {
  const { usuario } = useAuth();
  const netInfo = useNetInfo();

  const [filiado, setFiliado] = useState<Partial<Filiado>>(initialFiliadoState);
  const [loading, setLoading] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!netInfo.isConnected) {
      Alert.alert('Offline', 'A criação de filiados só está disponível online.');
      return;
    }

    if (!filiado.nome || !filiado.cpf || !filiado.email1 || !filiado.telefone1) {
      Alert.alert('Erro de Validação', 'Nome, CPF, Email 1 e Telefone 1 são obrigatórios.');
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

      const payload = { ...filiado };

      // Normalização
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

        const depDate = `dep${i}_data_nascimento`;
        if (payload[depDate]) {
          payload[depDate] = toISODate(payload[depDate] as string) || payload[depDate];
        }
      }

      await api.post('/api/filiados', payload);
      Alert.alert('Sucesso', 'Filiado criado com sucesso.');
      navigation.navigate('Filiados', { refresh: true });
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Não foi possível criar o filiado.');
    } finally {
      setLoading(false);
    }
  }, [filiado, netInfo.isConnected, navigation]);

  useEffect(() => {
    const actions: MenuAction[] = [
      { label: 'Criar Filiado', icon: 'account-plus', onPress: handleCreate }
    ];
    navigation.setOptions({
      headerRight: () => <HeaderMenu actions={actions} />,
      headerStyle: { backgroundColor: '#003366' },
      headerTintColor: '#fff',
      headerTitleAlign: 'center',
    });
  }, [navigation, filiado, loading, handleCreate]);

  // Renderiza apenas se for perfil de GESTAO
  if (!usuario || !checkIsGestao(usuario.perfil_acesso)) {
    return (
      <View style={styles.centered}>
        <Text>Acesso negado.</Text>
      </View>
    );
  }

  return (
    <SafeScreen style={styles.container}>
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      enableOnAndroid
      extraScrollHeight={50}
      keyboardOpeningTime={0}
    >
      {/* Reutilizar os cards para entrada de dados */}
      <ContatoCard
        filiado={filiado as Filiado}
        setFiliado={setFiliado}
        isEditing={true}
        isManagement={true}
      />
      <EnderecoCard filiado={filiado as Filiado} setFiliado={setFiliado} />
      <LotacaoCard filiado={filiado as Filiado} setFiliado={setFiliado} isEditing={true} />
      <DependentesCard filiado={filiado as Filiado} setFiliado={setFiliado} isEditing={true} />

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
