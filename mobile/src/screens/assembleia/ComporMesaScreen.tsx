import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, TextInput, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getAssembleiaEstado, definirMesa, substituirMesa } from '../../services/assembleiaService';
import SafeScreen from '../../components/SafeScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ComporMesaScreen({ route, navigation }: any) {
  const { id, substituir } = route.params;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [presentes, setPresentes] = useState<any[]>([]);
  const [presidenteId, setPresidenteId] = useState('');
  const [secretarioId, setSecretarioId] = useState('');
  const [justificativa, setJustificativa] = useState('');

  useEffect(() => {
    fetchPresentes();
  }, [id]);

  const fetchPresentes = async () => {
    try {
      setLoading(true);
      const data = await getAssembleiaEstado(id);

      if (data.quorumVigente && (data.quorumVigente as any).presentes) {
          setPresentes((data.quorumVigente as any).presentes);
      }

      if (data.mesa) {
          setPresidenteId((data.mesa as any).presidente_user_id?.toString() || '');
          setSecretarioId((data.mesa as any).secretario_user_id?.toString() || '');
      }

      setLoading(false);
    } catch (err) {
      Alert.alert('Erro', 'Falha ao carregar presentes.');
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    if (!presidenteId || !secretarioId) {
      Alert.alert('Aviso', 'Selecione o Presidente e o Secretário.');
      return;
    }

    if (substituir && justificativa.trim().length < 20) {
        Alert.alert('Aviso', 'A justificativa é obrigatória (mínimo 20 caracteres) para substituição.');
        return;
    }

    try {
      setSubmitting(true);
      if (substituir) {
        await substituirMesa(id, { presidente_user_id: presidenteId, secretario_user_id: secretarioId, justificativa });
        Alert.alert('Sucesso', 'Mesa substituída com sucesso!');
      } else {
        await definirMesa(id, { presidente_user_id: presidenteId, secretario_user_id: secretarioId });
        Alert.alert('Sucesso', 'Mesa definida com sucesso!');
      }
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Falha na operação.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;
  }

  return (
    <SafeScreen style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{substituir ? 'Substituir Mesa' : 'Compor Mesa'}</Text>
      <Text style={styles.subtitle}>Selecione os membros entre os participantes presentes.</Text>

      <Text style={styles.label}>Presidente da Mesa</Text>
      <View style={styles.pickerBox}>
        <Picker
          selectedValue={presidenteId}
          onValueChange={setPresidenteId}
          style={styles.picker}
          dropdownIconColor="#003366"
        >
          <Picker.Item label="Selecione..." value="" />
          {presentes.map(p => (
            <Picker.Item key={p.id} label={p.nome} value={p.id} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Secretário da Mesa</Text>
      <View style={styles.pickerBox}>
        <Picker
          selectedValue={secretarioId}
          onValueChange={setSecretarioId}
          style={styles.picker}
          dropdownIconColor="#003366"
        >
          <Picker.Item label="Selecione..." value="" />
          {presentes.map(p => (
            <Picker.Item key={p.id} label={p.nome} value={p.id} />
          ))}
        </Picker>
      </View>

      {substituir && (
        <>
            <Text style={styles.label}>Justificativa da Substituição</Text>
            <TextInput
                style={styles.textArea}
                placeholder="Descreva o motivo da substituição da mesa (mínimo 20 caracteres)..."
                multiline
                numberOfLines={4}
                value={justificativa}
                onChangeText={setJustificativa}
            />
        </>
      )}

      <TouchableOpacity style={styles.btnSalvar} onPress={handleSalvar} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#003366" /> : <Text style={styles.btnText}>{substituir ? 'Confirmar Substituição' : 'Confirmar Mesa'}</Text>}
      </TouchableOpacity>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f8', padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#003366', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  pickerBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 20, justifyContent: 'center' },
  picker: { color: '#333' },
  textArea: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, height: 100, textAlignVertical: 'top', marginBottom: 20 },
  btnSalvar: { backgroundColor: '#f1c40f', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20, marginBottom: 40 },
  btnText: { color: '#003366', fontWeight: 'bold', fontSize: 16 },
});
