import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, FlatList } from 'react-native';
import { submeterProposta, getAssembleiaEstado } from '../../services/assembleiaService';
import { Proposta } from '../../types/assembleia';

export default function PropostasScreen({ route }: any) {
  const { id } = route.params;
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);
  const [propostas, setPropostas] = useState<Proposta[]>([]);

  const handleSubmeter = async () => {
    if (!titulo || !descricao) {
      Alert.alert('Aviso', 'Preencha todos os campos.');
      return;
    }
    try {
      setLoading(true);
      await submeterProposta(id, { titulo, pauta: descricao });
      Alert.alert('Sucesso', 'Proposta enviada!');
      setTitulo('');
      setDescricao('');
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao enviar proposta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nova Proposta / Encaminhamento</Text>
        <TextInput
          style={styles.input}
          value={titulo}
          onChangeText={setTitulo}
          placeholder="Título curto"
        />
        <TextInput
          style={[styles.input, styles.textArea]}
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Descrição detalhada..."
          multiline
        />
        <TouchableOpacity
          style={styles.btnSubmeter}
          onPress={handleSubmeter}
          disabled={loading}
          accessibilityLabel={loading ? "Enviando proposta, aguarde..." : "Enviar Proposta"}
        >
          {loading ? <ActivityIndicator color="#003366" accessibilityLabel="Enviando..." /> : <Text style={styles.btnText}>Enviar Proposta</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f8', padding: 20 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366', marginBottom: 15 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  btnSubmeter: { backgroundColor: '#f1c40f', padding: 15, borderRadius: 30, alignItems: 'center' },
  btnText: { color: '#003366', fontWeight: 'bold', fontSize: 16 },
});
