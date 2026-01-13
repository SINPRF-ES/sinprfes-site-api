// src/screens/CriarFiliadoScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import api from '../services/apiService';
import type { Filiado, Dependente } from '../types/filiado';

const initialDependente: Dependente = { nome: '', cpf: '', data_nascimento: '', parentesco: '' };

// --- Funções de Validação ---
const isCpfValido = (cpf: string | null | undefined): boolean => {
  if (!cpf) return false;
  const cpfNumerico = cpf.replace(/\D/g, '');
  return cpfNumerico.length === 11;
};

const isDataValida = (data: string | null | undefined): boolean => {
  if (!data) return false;
  const regex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!regex.test(data)) return false;

  const [dia, mes, ano] = data.split('/').map(Number);
  const dataObj = new Date(ano, mes - 1, dia);
  
  return dataObj.getFullYear() === ano && dataObj.getMonth() === mes - 1 && dataObj.getDate() === dia;
};

const formatarDataParaAPI = (data: string): string => {
    const [dia, mes, ano] = data.split('/');
    return `${ano}-${mes}-${dia}`;
};

export default function CriarFiliadoScreen({ navigation }: any) {
  const [filiado, setFiliado] = useState<Partial<Filiado>>({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    dependentes: Array(5).fill(null).map(() => ({ ...initialDependente })),
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: keyof Omit<Filiado, 'dependentes'>, value: any) => {
    setFiliado(prev => ({ ...prev, [field]: value }));
  };

  const handleDependenteChange = (index: number, field: keyof Dependente, value: string) => {
    const novosDependentes = [...(filiado.dependentes || [])];
    novosDependentes[index] = { ...novosDependentes[index], [field]: value };
    setFiliado(prev => ({ ...prev, dependentes: novosDependentes }));
  };
  
  const handleSave = async () => {
    // Validação do filiado
    if (!filiado.nome || !filiado.cpf) {
        Alert.alert('Erro de Validação', 'Nome e CPF do filiado são obrigatórios.');
        return;
    }
    if (!isCpfValido(filiado.cpf)) {
        Alert.alert('Erro de Validação', 'O CPF do filiado é inválido. Deve conter 11 dígitos.');
        return;
    }

    // Validação dos dependentes
    const dependentesParaValidar = filiado.dependentes?.filter(d => d.nome || d.cpf || d.data_nascimento || d.parentesco) || [];
    for (const [index, dep] of dependentesParaValidar.entries()) {
      if (!dep.nome || !dep.cpf) {
        Alert.alert('Erro de Validação', `O nome e o CPF são obrigatórios para o Dependente ${index + 1}.`);
        return;
      }
      if (!isCpfValido(dep.cpf)) {
        Alert.alert('Erro de Validação', `O CPF do Dependente ${index + 1} é inválido.`);
        return;
      }
      if (dep.data_nascimento && !isDataValida(dep.data_nascimento)) {
          Alert.alert('Erro de Validação', `A data de nascimento do Dependente ${index + 1} é inválida. Use o formato DD/MM/AAAA.`);
          return;
      }
    }

    setLoading(true);
    try {
      const dependentesValidos = dependentesParaValidar.map(d => ({
          ...d,
          cpf: d.cpf?.replace(/\D/g, ''),
          data_nascimento: d.data_nascimento ? formatarDataParaAPI(d.data_nascimento) : null,
      }));
      const payload = { 
          ...filiado,
          cpf: filiado.cpf?.replace(/\D/g, ''),
          dependentes: dependentesValidos
      };

      await api.post('/api/filiados', payload);
      Alert.alert('Sucesso', 'Novo filiado criado com sucesso!');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.message || 'Não foi possível criar o filiado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Criar Novo Filiado</Text>
      
      <Text style={styles.sectionTitle}>Dados do Filiado</Text>
      <Text style={styles.label}>Nome Completo</Text>
      <TextInput style={styles.input} value={filiado.nome} onChangeText={text => handleInputChange('nome', text)} />
      
      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} value={filiado.email || ''} onChangeText={text => handleInputChange('email', text)} keyboardType="email-address" autoCapitalize="none" />

      <Text style={styles.label}>CPF</Text>
      <TextInput style={styles.input} value={filiado.cpf} onChangeText={text => handleInputChange('cpf', text)} keyboardType="numeric" maxLength={11} />

      <Text style={styles.label}>Telefone</Text>
      <TextInput style={styles.input} value={filiado.telefone || ''} onChangeText={text => handleInputChange('telefone', text)} keyboardType="phone-pad" />


      <Text style={styles.sectionTitle}>Dependentes (até 5)</Text>
      {filiado.dependentes?.map((dep, index) => (
        <View key={index} style={styles.dependenteBox}>
          <Text style={styles.dependenteTitle}>Dependente {index + 1}</Text>
          <TextInput style={styles.input} placeholder="Nome do Dependente" value={dep.nome} onChangeText={text => handleDependenteChange(index, 'nome', text)} />
          <TextInput style={styles.input} placeholder="CPF (11 dígitos)" value={dep.cpf} onChangeText={text => handleDependenteChange(index, 'cpf', text)} keyboardType="numeric" maxLength={11} />
          <TextInput style={styles.input} placeholder="Data de Nascimento (DD/MM/AAAA)" value={dep.data_nascimento} onChangeText={text => handleDependenteChange(index, 'data_nascimento', text)} />
          <TextInput style={styles.input} placeholder="Parentesco" value={dep.parentesco} onChangeText={text => handleDependenteChange(index, 'parentesco', text)} />
        </View>
      ))}

      <Button title={loading ? 'Salvando...' : 'Salvar Filiado'} onPress={handleSave} disabled={loading} />
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
