// mobile/src/screens/FiliadosScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useNetInfo } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFiliados } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { Filiado } from '../types/filiado';
import FiliadoCard from '../components/FiliadoCard';

const FiliadosScreen: React.FC = () => {
  const { user } = useAuth();
  const cacheKey = `filiados_cache_${user?.id}_${user?.perfil_acesso}`;

  const [filiados, setFiliados] = useState<Filiado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [promptedForSync, setPromptedForSync] = useState(false);

  const navigation = useNavigation();
  const { user } = useAuth();
  const netInfo = useNetInfo();

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
    setError(null); // Limpa erros anteriores
    try {
      // Tenta obter da API primeiro
      let data = await getFiliados();

      // Camada de defesa: sanitiza os dados se o perfil for FILIADO
      if (user?.perfil_acesso === 'FILIADO') {
        data = data.map((f: Filiado) => {
          if (f.id !== user.id) {
            return {
              id: f.id,
              nome: f.nome,
              telefone1: f.telefone1,
              lotacao: f.lotacao,
              situacao: f.situacao,
            };
          }
          return f; // Mantém todos os dados para o próprio usuário
        });
      }

      setFiliados(data);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      setIsOffline(false);
    } catch (apiError) {
      // Se a API falhar, tenta carregar do cache
      try {
        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (cachedData) {
          setFiliados(JSON.parse(cachedData));
          setIsOffline(true); // Informa que os dados são do cache
        } else {
          setError('Não foi possível carregar os dados. Verifique sua conexão.');
        }
      } catch (cacheError) {
        setError('Erro ao acessar o armazenamento local.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setError(null);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Carregando filiados...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={handleRefresh}>
          <Text style={styles.buttonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const filteredFiliados = filiados.filter(f =>
    f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.cpf?.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))
  );

  const podeCriar = user?.perfil_acesso && ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes(user.perfil_acesso);
  const ehGestao = user?.perfil_acesso && ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes(user.perfil_acesso);

  const handleCardPress = (item: Filiado) => {
    // Gestão só pode editar online
    if (ehGestao) {
      if (netInfo.isConnected) {
        navigation.navigate('EditarFiliado', { filiadoId: item.id });
      } else {
        Alert.alert('Funcionalidade Offline', 'A edição de dados de outros filiados só pode ser feita quando você estiver online.');
      }
      return;
    }

    // O próprio usuário pode acessar seus dados para editar (mesmo que a tela de edição bloqueie o salvamento)
    if (item.id === user?.id) {
      navigation.navigate('MeusDados'); // Reutiliza a tela "Meus Dados" que já tem a lógica de edição própria
    }
  };

  return (
    <View style={styles.container}>
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Você está offline. Exibindo dados do cache.</Text>
        </View>
      )}
      <View style={styles.header}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou CPF..."
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {podeCriar && (
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('CriarFiliado')}>
            <Text style={styles.addButtonText}>Novo</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={filteredFiliados}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <FiliadoCard
            filiado={item}
            currentUserProfile={user?.perfil_acesso || 'FILIADO'}
            onPress={() => handleCardPress(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text>Nenhum filiado encontrado.</Text>
          </View>
        }
        onRefresh={handleRefresh}
        refreshing={loading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  addButton: {
    marginLeft: 10,
    backgroundColor: '#007bff',
    paddingHorizontal: 15,
    justifyContent: 'center',
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
  },
  offlineBanner: {
    backgroundColor: '#ffc107',
    padding: 10,
    alignItems: 'center',
  },
  offlineText: {
    color: '#000',
  },
});

export default FiliadosScreen;
