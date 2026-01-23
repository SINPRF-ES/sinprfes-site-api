import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { criarAssembleia } from '../../services/assembleiaService';

export default function CriarAssembleiaScreen({ navigation }: any) {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'AGE' | 'AGO'>('AGE');
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSalvar = async () => {
    if (!titulo || !descricao) {
      Alert.alert('Aviso', 'Preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setLoading(true);
      await criarAssembleia({ titulo, tipo, descricao });
      Alert.alert('Sucesso', 'Assembleia criada com sucesso!');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao criar assembleia.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Título *</Text>
      <TextInput
        style={styles.input}
        value={titulo}
        onChangeText={setTitulo}
        placeholder="Ex: Assembleia Geral Extraordinária 01/2026"
      />

      <Text style={styles.label}>Tipo *</Text>
      <View style={styles.pickerBox}>
        <Picker selectedValue={tipo} onValueChange={(itemValue) => setTipo(itemValue as any)}>
          <Picker.Item label="Extraordinária (AGE)" value="AGE" />
          <Picker.Item label="Ordinária (AGO)" value="AGO" />
        </Picker>
      </View>

      <Text style={styles.label}>Pauta / Descrição *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={descricao}
        onChangeText={setDescricao}
        placeholder="Descreva os itens da pauta..."
        multiline
        numberOfLines={6}
      />

      <TouchableOpacity style={styles.btnSalvar} onPress={handleSalvar} disabled={loading}>
        {loading ? <ActivityIndicator color="#003366" /> : <Text style={styles.btnText}>Criar Assembleia</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f8', padding: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16 },
  pickerBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 20 },
  textArea: { height: 120, textAlignVertical: 'top' },
  btnSalvar: { backgroundColor: '#f1c40f', padding: 18, borderRadius: 30, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#003366', fontWeight: 'bold', fontSize: 16 },
});
