// mobile/src/screens/FiliadosScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useNetInfo } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFiliados } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { Filiado } from '../types/filiado';
import FiliadoCard from '../components/FiliadoCard';
import { normalizeText } from '../utils/masks';
import { normalizeSituacaoFuncional } from '../utils/filiadoUtils';

const FiliadosScreen: React.FC = () => {
  const { usuario: authUser } = useAuth();
  const cacheKey = `filiados_cache_${authUser?.id}_${authUser?.perfil_acesso}`;

  const [filiados, setFiliados] = useState<Filiado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('ATIVO');
  const [filtroSituacao, setFiltroSituacao] = useState('TODOS');
  const [promptedForSync, setPromptedForSync] = useState(false);

  const navigation = useNavigation();
  const netInfo = useNetInfo();

  useFocusEffect(
    useCallback(() => {
      const state = navigation.getState();
      const route = state.routes.find(r => r.name === 'Filiados');
      if (route?.params?.refresh) {
        fetchData();
        // Limpa o parâmetro para evitar refresh em focos subsequentes
        navigation.setParams({ refresh: false });
      }
    }, [navigation])
  );

  useEffect(() => {
    if (netInfo.isConnected && isOffline && !promptedForSync) {
      Alert.alert(
        'Conectado novamente',
        'Deseja sincronizar os dados agora?',
        [
          { text: 'Não', style: 'cancel' },
          { text: 'Sim', onPress: () => fetchData() },
        ]
      );
      setPromptedForSync(true);
    } else if (!netInfo.isConnected) {
      setPromptedForSync(false);
    }
  }, [netInfo.isConnected, isOffline, promptedForSync]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFiliados();
      let processedData = data;

      // Sanitize data only for FILIADO profile, preserving all fields for management
      if (authUser?.perfil_acesso === 'FILIADO') {
        processedData = data.map((f: Filiado) => {
          if (f.id !== authUser.id) {
            // Return a limited subset of fields for other users
            return {
              id: f.id,
              nome: f.nome,
              telefone1: f.telefone1,
              lotacao: f.lotacao,
              situacao: f.situacao,
              // Explicitly exclude CPF and other sensitive data
              cpf: undefined,
              email1: undefined,
            };
          }
          // Return the full object for the logged-in user
          return f;
        });
      }

      setFiliados(processedData);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      setIsOffline(false);
    } catch (apiError) {
      try {
        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (cachedData) {
          setFiliados(JSON.parse(cachedData));
          setIsOffline(true);
        } else {
          setError('Não foi possível carregar os dados. Verifique sua conexão.');
        }
      } catch (cacheError) {
        setError('Erro ao acessar o armazenamento local.');
      }
    } finally {
      setLoading(false);
    }
  }, [authUser, cacheKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setError(null);
    fetchData();
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#0000ff" /><Text>Carregando filiados...</Text></View>;
  }

  if (error) {
    return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.button} onPress={handleRefresh}><Text style={styles.buttonText}>Tentar Novamente</Text></TouchableOpacity></View>;
  }

  const filteredFiliados = filiados.filter(f => {
    const searchTermLower = searchTerm.toLowerCase();
    const searchTermDigits = searchTerm.replace(/\D/g, '');

    const nomeMatch = f.nome.toLowerCase().includes(searchTermLower);

    // A busca por CPF só é realizada se o campo existir e o usuário for da gestão.
    const cpfMatch = ehGestao && f.cpf && f.cpf.replace(/\D/g, '').includes(searchTermDigits);

    const textMatch = nomeMatch || cpfMatch;

    const estadoCadastro = f.arquivado_em ? 'ARQUIVADO' : 'ATIVO';
    const estadoMatch = filtroEstado === 'TODOS' || estadoCadastro === filtroEstado;

    const situacaoFuncional = normalizeSituacaoFuncional(f.situacao_funcional || f.situacao);
    const situacaoMatch = filtroSituacao === 'TODOS' || situacaoFuncional === filtroSituacao;

    return textMatch && estadoMatch && situacaoMatch;
  });

  const podeCriar = authUser?.perfil_acesso && ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes(authUser.perfil_acesso);
  const ehGestao = authUser?.perfil_acesso && ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes(authUser.perfil_acesso);

  const handleEditPress = (filiado: Filiado) => {
    if (netInfo.isConnected) {
      navigation.navigate('EditarFiliado', { filiado });
    } else {
      Alert.alert('Funcionalidade Offline', 'A edição de dados só pode ser feita quando você estiver online.');
    }
  };

  const handleNovoPress = () => {
    navigation.navigate('CriarFiliado');
  };

  return (
    <View style={styles.container}>
      {isOffline && <View style={styles.offlineBanner}><Text style={styles.offlineText}>Você está offline. Exibindo dados do cache.</Text></View>}
      <View style={styles.header}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou CPF..."
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {podeCriar && <TouchableOpacity style={styles.addButton} onPress={handleNovoPress}><Text style={styles.addButtonText}>Novo</Text></TouchableOpacity>}
      </View>
      <View style={styles.filtersContainer}>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={filtroEstado}
            style={styles.picker}
            onValueChange={(itemValue) => setFiltroEstado(itemValue)}
          >
            <Picker.Item label="Cadastro Ativo" value="ATIVO" />
            <Picker.Item label="Arquivados" value="ARQUIVADO" />
            <Picker.Item label="Todos Cadastros" value="TODOS" />
          </Picker>
        </View>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={filtroSituacao}
            style={styles.picker}
            onValueChange={(itemValue) => setFiltroSituacao(itemValue)}
          >
            <Picker.Item label="Todas Situações" value="TODOS" />
            <Picker.Item label="Ativo" value="ATIVO" />
            <Picker.Item label="Veterano" value="VETERANO" />
            <Picker.Item label="Pensionista" value="PENSIONISTA" />
          </Picker>
        </View>
      </View>
      <FlatList
        data={filteredFiliados}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <FiliadoCard
            filiado={item}
            currentUserProfile={authUser?.perfil_acesso || 'FILIADO'}
            onEdit={handleEditPress}
          />
        )}
        ListEmptyComponent={<View style={styles.centered}><Text>Nenhum filiado encontrado.</Text></View>}
        onRefresh={handleRefresh}
        refreshing={loading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  filtersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 8,
    gap: 8
  },
  pickerWrapper: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    height: 50,
    justifyContent: 'center',
  },
  picker: { height: 50 },
  searchInput: { flex: 1, height: 40, backgroundColor: '#f0f0f0', borderRadius: 8, paddingHorizontal: 10 },
  addButton: { marginLeft: 10, backgroundColor: '#007bff', paddingHorizontal: 15, justifyContent: 'center', borderRadius: 8 },
  addButtonText: { color: '#fff', fontWeight: 'bold' },
  errorText: { color: 'red', marginBottom: 10 },
  button: { backgroundColor: '#007bff', padding: 10, borderRadius: 5 },
  buttonText: { color: '#fff' },
  offlineBanner: { backgroundColor: '#ffc107', padding: 10, alignItems: 'center' },
  offlineText: { color: '#000' },
});

export default FiliadosScreen;
