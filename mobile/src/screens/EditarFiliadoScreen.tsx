// src/screens/EditarFiliadoScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import api from '../services/apiService';
import type { Filiado, Dependente } from '../types/filiado';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'EditarFiliado'>;

const initialDependente: Dependente = { nome: '', cpf: '', data_nascimento: '', parentesco: '' };

// --- Funções de Validação ---
const isCpfValido = (cpf: string | null | undefined): boolean => {
  if (!cpf) return false;
  const cpfNumerico = cpf.replace(/\D/g, '');
  return cpfNumerico.length === 11;
};

const isDataValida = (data: string | null | undefined): boolean => {
    if (!data) return false;
    const regexApi = /^\d{4}-\d{2}-\d{2}/;
    const regexUser = /^\d{2}\/\d{2}\/\d{4}$/;

    if (regexApi.test(data)) {
        const dataObj = new Date(data);
        return !isNaN(dataObj.getTime());
    }

    if (regexUser.test(data)) {
        const [dia, mes, ano] = data.split('/').map(Number);
        const dataObj = new Date(ano, mes - 1, dia);
        return dataObj.getFullYear() === ano && dataObj.getMonth() === mes - 1 && dataObj.getDate() === dia;
    }
    
    return false;
};

const formatarDataParaAPI = (data: string): string => {
    if (data.includes('/')) {
        const [dia, mes, ano] = data.split('/');
        return `${ano}-${mes}-${dia}`;
    }
    return data.split('T')[0];
};

const formatarDataParaExibicao = (data: string | null | undefined): string => {
    if (!data) return '';
    if (data.includes('/')) return data;
    try {
        const [ano, mes, dia] = data.split('T')[0].split('-');
        return `${dia}/${mes}/${ano}`;
    } catch {
        return data;
    }
};

export default function EditarFiliadoScreen({ route, navigation }: Props) {
  const { filiadoId } = route.params;
  const [filiado, setFiliado] = useState<Filiado | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchFiliado = async () => {
      setLoading(true);
      try {
        const { data } = await api.get<Filiado>(`/api/filiados/${filiadoId}`);
        const dependentesFormatados = data.dependentes?.map(d => ({
            ...d,
            data_nascimento: formatarDataParaExibicao(d.data_nascimento),
        })) || [];
        const dependentesCompletos = Array(5).fill(null).map((_, i) => dependentesFormatados[i] || { ...initialDependente });
        setFiliado({ ...data, dependentes: dependentesCompletos });
      } catch (e: any) {
        setError('Falha ao carregar dados do filiado.');
      } finally {
        setLoading(false);
      }
    };
    fetchFiliado();
  }, [filiadoId]);

  const handleInputChange = (field: keyof Omit<Filiado, 'dependentes'>, value: any) => {
    setFiliado(prev => (prev ? { ...prev, [field]: value } : null));
  };

  const handleDependenteChange = (index: number, field: keyof Dependente, value: string) => {
    if (!filiado) return;
    const novosDependentes = [...(filiado.dependentes || [])];
    novosDependentes[index] = { ...novosDependentes[index], [field]: value };
    setFiliado(prev => ({ ...prev, dependentes: novosDependentes }));
  };

  const handleUpdate = async () => {
    if (!filiado) return;
    
    // Validações...
    // (A mesma lógica da tela de criação)

    setLoading(true);
    try {
      const dependentesValidos = filiado.dependentes?.filter(d => d.nome && d.cpf).map(d => ({
          ...d,
          cpf: d.cpf?.replace(/\D/g, ''),
          data_nascimento: d.data_nascimento ? formatarDataParaAPI(d.data_nascimento) : null,
      }));
      const payload = { ...filiado, dependentes: dependentesValidos };
      
      await api.put(`/api/filiados/${filiadoId}`, payload);
      Alert.alert('Sucesso', 'Filiado atualizado com sucesso!');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message || 'Não foi possível atualizar o filiado.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !filiado) {
    return <ActivityIndicator size="large" style={{ marginTop: 20 }} />;
  }

  if (error) {
    return <Text style={{ color: 'red', textAlign: 'center', marginTop: 20 }}>{error}</Text>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Editar Filiado</Text>
      
      <Text style={styles.sectionTitle}>Dados do Filiado</Text>
      <Text style={styles.label}>Nome Completo</Text>
      <TextInput style={styles.input} value={filiado?.nome || ''} onChangeText={text => handleInputChange('nome', text)} />
      
      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} value={filiado?.email || ''} onChangeText={text => handleInputChange('email', text)} keyboardType="email-address" autoCapitalize="none" />

      <Text style={styles.label}>CPF</Text>
      <TextInput style={styles.input} value={filiado?.cpf || ''} onChangeText={text => handleInputChange('cpf', text)} keyboardType="numeric" maxLength={11} />

      <Text style={styles.label}>Telefone</Text>
      <TextInput style={styles.input} value={filiado?.telefone || ''} onChangeText={text => handleInputChange('telefone', text)} keyboardType="phone-pad" />

      <Text style={styles.sectionTitle}>Dependentes</Text>
      {filiado?.dependentes?.map((dep, index) => (
        <View key={index} style={styles.dependenteBox}>
          <Text style={styles.dependenteTitle}>Dependente {index + 1}</Text>
          <TextInput style={styles.input} placeholder="Nome do Dependente" value={dep.nome} onChangeText={text => handleDependenteChange(index, 'nome', text)} />
          <TextInput style={styles.input} placeholder="CPF (11 dígitos)" value={dep.cpf} onChangeText={text => handleDependenteChange(index, 'cpf', text)} keyboardType="numeric" maxLength={11} />
          <TextInput style={styles.input} placeholder="Data de Nascimento (DD/MM/AAAA)" value={dep.data_nascimento} onChangeText={text => handleDependenteChange(index, 'data_nascimento', text)} />
          <TextInput style={styles.input} placeholder="Parentesco" value={dep.parentesco} onChangeText={text => handleDependenteChange(index, 'parentesco', text)} />
        </View>
      ))}

      <Button title={loading ? 'Atualizando...' : 'Salvar Alterações'} onPress={handleUpdate} disabled={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f2f4f8' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#003366' },
  label: { fontSize: 16, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 15, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10, color: '#003366' },
  dependenteBox: { borderWidth: 1, borderColor: '#ddd', borderRadius: 5, padding: 10, marginBottom: 15, backgroundColor: '#fff' },
  dependenteTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
});
