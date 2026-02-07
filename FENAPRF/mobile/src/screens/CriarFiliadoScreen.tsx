// mobile/src/screens/CriarFiliadoScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useNetInfo } from '@react-native-community/netinfo';
import api from '../services/apiService';
import ContatoCard from '../components/ContatoCard';
import EnderecoCard from '../components/EnderecoCard';
import LotacaoCard from '../components/LotacaoCard';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SafeScreen from '../components/SafeScreen';
import { User } from '../types/usuario';
import { toISODate } from '../utils/date';
import { onlyDigits } from '../shared/format/formatters';
import { isGestao as checkIsGestao, ROLES } from '../utils/filiadoUtils';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';
import { normalizeNome } from '../utils/canon';

const initialFiliadoState: Partial<User> = {
  name: '',
  sexo: null,
  cpf: '',
  email: '',
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
  perfil_acesso: ROLES.CONSELHEIRO as any, // Valor padrão FENAPRF
  cargo: '',
  cargo_mandato_inicio: '',
  cargo_mandato_fim: '',
  perfil_acesso2: '',
  cargo2: '',
  uf2: '',
};

export default function CriarFiliadoScreen({ navigation }: any) {
  const { usuario } = useAuth();
  const netInfo = useNetInfo();

  const [filiado, setFiliado] = useState<Partial<User>>(initialFiliadoState);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFiliado(initialFiliadoState);
    }, [])
  );

  const handleCreate = useCallback(async () => {
    if (!netInfo.isConnected) {
      Alert.alert('Offline', 'A criação de usuários só está disponível online.');
      return;
    }

    if (!filiado.name || !filiado.cpf || !filiado.email || !filiado.telefone1) {
      Alert.alert('Erro de Validação', 'Nome, CPF, Email e Telefone são obrigatórios.');
      return;
    }
    if (filiado.cpf.length !== 11) {
      Alert.alert('Erro de Validação', 'O CPF deve conter 11 dígitos.');
      return;
    }

    try {
      setLoading(true);

      const payload = { ...filiado };

      // Normalização
      if (payload.name) payload.name = normalizeNome(payload.name);
      if (payload.sexo === '') payload.sexo = null;
      payload.cpf = onlyDigits(payload.cpf);
      payload.telefone1 = onlyDigits(payload.telefone1);
      if (payload.telefone2) payload.telefone2 = onlyDigits(payload.telefone2);
      if (payload.cep) payload.cep = onlyDigits(payload.cep);

      if (payload.data_nascimento) {
        payload.data_nascimento = toISODate(payload.data_nascimento) || payload.data_nascimento;
      }

      await api.post('/api/users', payload);
      Alert.alert('Sucesso', 'Usuário criado com sucesso.');
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
        filiado={filiado as User}
        setFiliado={setFiliado as any}
        isEditing={true}
        isManagement={true}
      />
      <EnderecoCard filiado={filiado as User} setFiliado={setFiliado as any} />
      <LotacaoCard filiado={filiado as User} setFiliado={setFiliado as any} isEditing={true} />

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
