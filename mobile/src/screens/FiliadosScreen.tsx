import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import api, { getFiliados } from '../services/apiService';
import FiliadoCard from '../components/FiliadoCard';
import { Filiado } from '../types/filiado';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { normalizeText } from '../utils/masks';
import { onlyDigits } from '../shared/format/formatters';
import { getCanonicalFiliadoId, isGestao } from '../utils/filiadoUtils';

export default function FiliadosScreen({ navigation, route }: any) {
  const { usuario } = useAuth();
  const [filiados, setFiliados] = useState<Filiado[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const ehGestao = isGestao(usuario?.perfil_acesso);
  const cacheKey = `filiados_cache_${usuario?.id}`;

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);

      const data = await getFiliados();

      let processedData = data;
      // Sanitização básica para perfil de filiado (diretório público interno)
      if (!ehGestao) {
        processedData = data.map((f: Filiado) => ({
          id: f.id,
          nome: f.nome,
          telefone1: f.telefone1,
          avatar_url: f.avatar_url,
          lotacao: f.lotacao,
          situacao: f.situacao,
          situacao_funcional: f.situacao_funcional,
        }));
      }

      setFiliados(processedData);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(processedData));
    } catch (err) {
      console.error('[Filiados.fetch]', err);
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) setFiliados(JSON.parse(cached));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ehGestao, cacheKey]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    if (route.params?.refresh) {
      fetchData(true);
      navigation.setParams({ refresh: false });
    }
  }, [route.params?.refresh, fetchData, navigation]);

  const filteredFiliados = useMemo(() => {
    const term = normalizeText(searchTerm);
    const digits = onlyDigits(searchTerm);

    return filiados.filter(f => {
      const nomeMatch = normalizeText(f.nome).includes(term);
      const cpfMatch = ehGestao && digits !== '' && onlyDigits(f.cpf || '').includes(digits);
      return nomeMatch || cpfMatch;
    });
  }, [filiados, searchTerm, ehGestao]);

  const handleEdit = (filiado: Filiado) => {
    navigation.navigate('EditarFiliado', { filiadoId: getCanonicalFiliadoId(filiado) });
  };

  if (loading && filiados.length === 0) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={24} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder={ehGestao ? "Buscar por nome ou CPF..." : "Buscar por nome..."}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm !== '' && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <MaterialCommunityIcons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredFiliados}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <FiliadoCard
            filiado={item}
            currentUserProfile={usuario?.perfil_acesso as any}
            onEdit={handleEdit}
          />
        )}
        refreshing={refreshing}
        onRefresh={() => fetchData(true)}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text>{searchTerm ? 'Nenhum filiado encontrado.' : 'Carregando lista...'}</Text>
          </View>
        }
      />

      {ehGestao && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CriarFiliado')}
        >
          <MaterialCommunityIcons name="plus" size={30} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, paddingHorizontal: 12, borderRadius: 10, elevation: 2 },
  searchInput: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 16 },
  empty: { padding: 40, alignItems: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#003366', justifyContent: 'center', alignItems: 'center', elevation: 4 },
});
