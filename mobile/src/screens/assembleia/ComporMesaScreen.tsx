import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getAssembleiaEstado, definirMesa } from '../../services/assembleiaService';
import SafeScreen from '../../components/SafeScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ComporMesaScreen({ route, navigation }: any) {
  const { id } = route.params;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [presentes, setPresentes] = useState<any[]>([]);
  const [presidenteId, setPresidenteId] = useState('');
  const [secretarioId, setSecretarioId] = useState('');

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

    try {
      setSubmitting(true);
      await definirMesa(id, { presidente_user_id: presidenteId, secretario_user_id: secretarioId });
      Alert.alert('Sucesso', 'Mesa definida com sucesso!');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Falha ao definir mesa.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;
  }

  return (
    <SafeScreen style={styles.container}>
      <Text style={styles.label}>Presidente da Mesa</Text>
      <View style={styles.pickerBox}>
        <Picker
          selectedValue={presidenteId}
          onValueChange={setPresidenteId}
          style={styles.picker}
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
        >
          <Picker.Item label="Selecione..." value="" />
          {presentes.map(p => (
            <Picker.Item key={p.id} label={p.nome} value={p.id} />
          ))}
        </Picker>
      </View>

      <TouchableOpacity style={styles.btnSalvar} onPress={handleSalvar} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#003366" /> : <Text style={styles.btnText}>Confirmar Mesa</Text>}
      </TouchableOpacity>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f8', padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  pickerBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 20, justifyContent: 'center' },
  picker: { color: '#333' },
  btnSalvar: { backgroundColor: '#f1c40f', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#003366', fontWeight: 'bold', fontSize: 16 },
});
