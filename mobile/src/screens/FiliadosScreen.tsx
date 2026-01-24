import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
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
import { logger } from '../infra/logger';
import SafeScreen from '../components/SafeScreen';

export default function FiliadosScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { usuario } = useAuth();
  const [filiados, setFiliados] = useState<Filiado[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCadastro, setFiltroCadastro] = useState('CADASTRO_ATIVO');
  const [filtroFuncional, setFiltroFuncional] = useState('TODOS');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const ehGestao = isGestao(usuario?.perfil_acesso);
  const cacheKey = `filiados_cache_${usuario?.id}`;

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);

      const params: any = {};
      if (filtroCadastro !== 'CADASTRO_ATIVO' && ehGestao) {
        params.incluirArquivados = '1';
      }

      const data = await getFiliados(params);

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
  }, [ehGestao, cacheKey, filtroCadastro]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData(true);
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
      // Filtro por Nome/CPF
      const nomeMatch = normalizeText(f.nome).includes(term);
      const cpfMatch = ehGestao && digits !== '' && onlyDigits(f.cpf || '').includes(digits);
      if (!nomeMatch && !cpfMatch) return false;

      // Filtro Situação Funcional
      if (filtroFuncional !== 'TODOS') {
        const situacao = (f.situacao_funcional || f.situacao || 'ATIVO').toUpperCase();
        if (situacao !== filtroFuncional) return false;
      }

      // Filtro Estado do Cadastro (local filter additionally)
      if (ehGestao) {
        if (filtroCadastro === 'ARQUIVADOS' && !f.arquivado_em) return false;
        if (filtroCadastro === 'CADASTRO_ATIVO' && f.arquivado_em) return false;
      }

      return true;
    });
  }, [filiados, searchTerm, ehGestao, filtroCadastro, filtroFuncional]);

  const handleEdit = (filiado: Filiado) => {
    const filiadoId = getCanonicalFiliadoId(filiado);
    logger.info('NAVIGATE_TO_EDITAR_FILIADO', { filiadoId });
    navigation.navigate('EditarFiliado', { filiadoId });
  };

  if (loading && filiados.length === 0) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;
  }

  return (
    <SafeScreen style={styles.container}>
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

      <View style={styles.filterRow}>
        {ehGestao && (
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Cadastro:</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={filtroCadastro}
                onValueChange={(v) => v && setFiltroCadastro(v)}
                style={styles.picker}
                mode="dropdown"
                dropdownIconColor="#003366"
              >
                <Picker.Item label="Selecione..." value="" color="#999" />
                <Picker.Item label="Ativos" value="CADASTRO_ATIVO" />
                <Picker.Item label="Arquivados" value="ARQUIVADOS" />
                <Picker.Item label="Todos" value="TODOS" />
              </Picker>
            </View>
          </View>
        )}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Situação:</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={filtroFuncional}
              onValueChange={(v) => v && setFiltroFuncional(v)}
              style={styles.picker}
              mode="dropdown"
              dropdownIconColor="#003366"
            >
              <Picker.Item label="Selecione..." value="" color="#999" />
              <Picker.Item label="Todos" value="TODOS" />
              <Picker.Item label="Ativo" value="ATIVO" />
              <Picker.Item label="Veterano" value="VETERANO" />
              <Picker.Item label="Pensionista" value="PENSIONISTA" />
            </Picker>
          </View>
        </View>
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
          style={[styles.fab, { bottom: 20 + insets.bottom }]}
          onPress={() => navigation.navigate('CriarFiliado')}
        >
          <MaterialCommunityIcons name="plus" size={30} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginTop: 16, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, borderRadius: 10, elevation: 2 },
  searchInput: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 16 },
  filterRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  filterGroup: { flex: 1 },
  filterLabel: { fontSize: 11, color: '#666', marginBottom: 2, fontWeight: 'bold' },
  pickerWrapper: { backgroundColor: '#fff', borderRadius: 8, height: 50, justifyContent: 'center', elevation: 1 },
  picker: { height: 50, color: '#333' },
  empty: { padding: 40, alignItems: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#003366', justifyContent: 'center', alignItems: 'center', elevation: 4 },
});
