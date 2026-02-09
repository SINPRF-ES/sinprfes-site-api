// mobile/src/screens/CriarUserScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useNetInfo } from '@react-native-community/netinfo';
import api from '../services/apiService';
import ContatoCard from '../components/ContatoCard';
import EnderecoCard from '../components/EnderecoCard';
import VinculoCard from '../components/VinculoCard';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import SafeScreen from '../components/SafeScreen';
import { User } from '../types/user';
import { toISODate } from '../utils/date';
import { onlyDigits } from '../utils/format';
import { isGestao as checkIsGestao, ROLES } from '../utils/user';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';
import { normalizeNome } from '../utils/user';

const initialUserState: any = {
  nome: '',
  name: '',
  sexo: null,
  cpf: '',
  email1: '',
  email: '',
  telefone1: '',
  telefone2: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  cidade: '',
  uf: '',
  situacao: 'ATIVO', // Valor padrão
  perfil_acesso: ROLES.CONSELHEIRO as any, // Valor padrão FENAPRF
  cargo: '',
  cargo_mandato_inicio: '',
  cargo_mandato_fim: '',
  perfil_acesso2: '',
  cargo2: '',
  uf2: '',
};

export default function CriarUserScreen({ navigation }: any) {
  const { user: authUser } = useAuth();
  const netInfo = useNetInfo();

  const [user, setUser] = useState<Partial<User>>(initialUserState);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setUser(initialUserState);
    }, [])
  );

  const handleCreate = useCallback(async (ignoreWarnings = false) => {
    if (!netInfo.isConnected) {
      Alert.alert('Offline', 'A criação de membros só está disponível online.');
      return;
    }

    const nomeEfetivo = user.nome || user.name;
    const emailEfetivo = user.email1 || user.email;

    const perfil = user.perfil_acesso as string;
    const isCouncil = perfil === ROLES.CONSELHEIRO || perfil === ROLES.DIRETORIA;

    if (!nomeEfetivo || !user.cpf || !emailEfetivo) {
      Alert.alert('Erro de Validação', 'Nome, CPF e Email são obrigatórios.');
      return;
    }

    if (perfil === ROLES.CONSELHEIRO && (!user.uf || user.uf === 'BR')) {
      Alert.alert('Erro de Validação', 'UF é obrigatória para Conselheiros.');
      return;
    }

    if (isCouncil && !user.cargo) {
      Alert.alert('Erro de Validação', 'O cargo é obrigatório para este perfil.');
      return;
    }

    if (onlyDigits(user.cpf).length !== 11) {
      Alert.alert('Erro de Validação', 'O CPF deve conter 11 dígitos.');
      return;
    }

    try {
      setLoading(true);

      // Sanitização e normalização do payload (Fiel às regras de isolamento FENAPRF)
      const payload: any = {
          nome: normalizeNome(user.nome || user.name || ''),
          name: normalizeNome(user.nome || user.name || ''),
          cpf: onlyDigits(user.cpf || ''),
          email1: user.email1 || user.email,
          email: user.email1 || user.email,
          sexo: user.sexo || null,
          telefone1: onlyDigits(user.telefone1 || ''),
          telefone2: onlyDigits(user.telefone2 || ''),
          cep: onlyDigits(user.cep || ''),
          logradouro: user.logradouro,
          numero: user.numero,
          complemento: user.complemento,
          cidade: user.cidade,
          uf: (perfil === ROLES.CONSELHEIRO) ? user.uf : 'BR',
          perfil_acesso: perfil,
          cargo: isCouncil ? user.cargo : (perfil === ROLES.ADMIN ? 'Administrador' : 'Colaborador'),
          ignoreWarnings
      };

      if (user.data_nascimento) {
        payload.data_nascimento = toISODate(user.data_nascimento) || (user.data_nascimento as any);
      }

      // Regras de negócio FENAPRF: Enviar campos de mandato/2º vínculo apenas para o conselho
      if (isCouncil) {
          payload.cargo_mandato_inicio = user.cargo_mandato_inicio ? toISODate(user.cargo_mandato_inicio) || user.cargo_mandato_inicio : null;
          payload.cargo_mandato_fim = user.cargo_mandato_fim ? toISODate(user.cargo_mandato_fim) || user.cargo_mandato_fim : null;
          payload.perfil_acesso2 = user.perfil_acesso2 || null;
          payload.cargo2 = user.cargo2 || null;
          payload.uf2 = user.uf2 || null;
      }

      await api.post('/api/users', payload);
      Alert.alert('Sucesso', 'Membro criado com sucesso.');
      navigation.navigate('Users', { refresh: true });
    } catch (err: any) {
      if (err.response?.data?.code === 'DATA_DUPLICATED_WARNING') {
        Alert.alert(
          'Aviso de Duplicidade',
          err.response.data.message,
          [
            { text: 'Voltar e corrigir', style: 'cancel' },
            { text: 'Continuar mesmo assim', onPress: () => handleCreate(true) }
          ]
        );
      } else {
        Alert.alert('Erro', err.response?.data?.message || 'Não foi possível criar o membro.');
      }
    } finally {
      setLoading(false);
    }
  }, [user, netInfo.isConnected, navigation]);

  useEffect(() => {
    const actions: MenuAction[] = [
      { label: 'Criar Membro', icon: 'account-plus', onPress: handleCreate }
    ];
    navigation.setOptions({
      headerRight: () => <HeaderMenu actions={actions} />,
      headerStyle: { backgroundColor: '#003366' },
      headerTintColor: '#fff',
      headerTitleAlign: 'center',
    });
  }, [navigation, user, loading, handleCreate]);

  // Renderiza apenas se for perfil de GESTAO
  if (!authUser || !checkIsGestao(authUser.perfil_acesso)) {
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
        user={user as User}
        setUser={setUser as any}
        isEditing={true}
        isManagement={true}
      />
      <EnderecoCard user={user as User} setUser={setUser as any} />

      <VinculoCard
        user={user as User}
        setUser={setUser as any}
        isGestao={true}
        currentUserProfile={authUser?.perfil_acesso}
      />

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
