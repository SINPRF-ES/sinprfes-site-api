import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { iniciarVotacao } from '../../services/assembleiaService';

export default function CriarItemVotacaoScreen({ route, navigation }: any) {
  const { id } = route.params;
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [duracao, setDuracao] = useState('2');
  const [loading, setLoading] = useState(false);

  const handleSalvar = async () => {
    if (!titulo || !descricao) {
      Alert.alert('Aviso', 'Preencha todos os campos.');
      return;
    }

    try {
      setLoading(true);
      await iniciarVotacao(id, { titulo, descricao, duracao_minutos: parseInt(duracao) });
      Alert.alert('Sucesso', 'Votação iniciada!');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao iniciar votação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Título do Item *</Text>
      <TextInput
        style={styles.input}
        value={titulo}
        onChangeText={setTitulo}
        placeholder="Ex: Aprovação do Relatório de Contas"
      />

      <Text style={styles.label}>Descrição / Texto de Apoio *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={descricao}
        onChangeText={setDescricao}
        multiline
      />

      <Text style={styles.label}>Duração (minutos) *</Text>
      <TextInput
        style={styles.input}
        value={duracao}
        onChangeText={setDuracao}
        keyboardType="numeric"
        maxLength={1}
      />

      <TouchableOpacity style={styles.btnSalvar} onPress={handleSalvar} disabled={loading}>
        {loading ? <ActivityIndicator color="#003366" /> : <Text style={styles.btnText}>Iniciar Votação Agora</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f8', padding: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  btnSalvar: { backgroundColor: '#f1c40f', padding: 18, borderRadius: 30, alignItems: 'center' },
  btnText: { color: '#003366', fontWeight: 'bold', fontSize: 16 },
});
