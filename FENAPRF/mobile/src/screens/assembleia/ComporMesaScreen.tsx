import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { getAssembleiaEstado, definirMesa, substituirMesa, iniciarVotacao } from '../../services/assembleiaService';
import CanonicalPicker from '../../components/CanonicalPicker';
import SafeScreen from '../../components/SafeScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ComporMesaScreen({ route, navigation }: any) {
  const { id, substituir } = route.params;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [presentes, setPresentes] = useState<any[]>([]);
  const [presidenteId, setPresidenteId] = useState('');
  const [vicePresidenteId, setVicePresidenteId] = useState('');
  const [secretarioId, setSecretarioId] = useState('');
  const [secretario2Id, setSecretario2Id] = useState('');
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
          setPresidenteId(data.mesa.presidente_user_id?.toString() || '');
          setVicePresidenteId(data.mesa.vice_presidente_user_id?.toString() || '');
          setSecretarioId(data.mesa.secretario_user_id?.toString() || '');
          setSecretario2Id(data.mesa.secretario_2_user_id?.toString() || '');
      }

      setLoading(false);
    } catch (err) {
      Alert.alert('Erro', 'Falha ao carregar presentes.');
      setLoading(false);
    }
  };

  const handleProporVotacao = async () => {
    if (!presidenteId || !vicePresidenteId || !secretarioId || !secretario2Id) {
      Alert.alert('Aviso', 'Selecione todos os 4 membros da mesa.');
      return;
    }

    const pName = presentes.find(p => String(p.id) === presidenteId)?.nome;
    const vpName = presentes.find(p => String(p.id) === vicePresidenteId)?.nome;
    const s1Name = presentes.find(p => String(p.id) === secretarioId)?.nome;
    const s2Name = presentes.find(p => String(p.id) === secretario2Id)?.nome;

    try {
      setSubmitting(true);
      await iniciarVotacao(id, {
        titulo: 'Indicação da Mesa Diretora',
        descricao: `Proposta de composição:\nPresidente: ${pName}\nVice-Presidente: ${vpName}\n1º Secretário: ${s1Name}\n2º Secretário: ${s2Name}`,
        duracao_segundos: 120
      });
      Alert.alert('Sucesso', 'Votação de indicação da mesa iniciada na sala!');
      navigation.navigate('AssembleiaSala', { id });
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Falha ao iniciar votação.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSalvar = async () => {
    if (!presidenteId || !vicePresidenteId || !secretarioId || !secretario2Id) {
      Alert.alert('Aviso', 'Selecione todos os 4 membros da mesa.');
      return;
    }

    const ids = [presidenteId, vicePresidenteId, secretarioId, secretario2Id];
    if (new Set(ids).size !== 4) {
      Alert.alert('Aviso', 'Os membros da mesa devem ser pessoas diferentes.');
      return;
    }

    if (substituir && justificativa.trim().length < 20) {
        Alert.alert('Aviso', 'A justificativa é obrigatória (mínimo 20 caracteres) para substituição.');
        return;
    }

    try {
      setSubmitting(true);
      const payload = {
        presidente_user_id: presidenteId,
        vice_presidente_user_id: vicePresidenteId,
        secretario_user_id: secretarioId,
        secretario_2_user_id: secretario2Id,
      };

      if (substituir) {
        await substituirMesa(id, { ...payload, justificativa });
        Alert.alert('Sucesso', 'Mesa substituída com sucesso!');
      } else {
        await definirMesa(id, payload);
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
    <SafeScreen style={{ backgroundColor: '#f2f4f8' }}>
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={80}
        keyboardOpeningTime={0}
      >
      <Text style={styles.title}>{substituir ? 'Substituir Mesa' : 'Compor Mesa'}</Text>
      <Text style={styles.subtitle}>Selecione os membros entre os participantes presentes.</Text>

      <Text style={styles.label}>Presidente da Mesa</Text>
      <CanonicalPicker
        selectedValue={presidenteId}
        onValueChange={setPresidenteId}
        placeholder="Selecione..."
        wrapperStyle={{ marginBottom: 20 }}
        items={presentes.map(p => ({ label: p.nome, value: String(p.id) }))}
      />

      <Text style={styles.label}>Vice-Presidente</Text>
      <CanonicalPicker
        selectedValue={vicePresidenteId}
        onValueChange={setVicePresidenteId}
        placeholder="Selecione..."
        wrapperStyle={{ marginBottom: 20 }}
        items={presentes.map(p => ({ label: p.nome, value: String(p.id) }))}
      />

      <Text style={styles.label}>1º Secretário</Text>
      <CanonicalPicker
        selectedValue={secretarioId}
        onValueChange={setSecretarioId}
        placeholder="Selecione..."
        wrapperStyle={{ marginBottom: 20 }}
        items={presentes.map(p => ({ label: p.nome, value: String(p.id) }))}
      />

      <Text style={styles.label}>2º Secretário</Text>
      <CanonicalPicker
        selectedValue={secretario2Id}
        onValueChange={setSecretario2Id}
        placeholder="Selecione..."
        wrapperStyle={{ marginBottom: 20 }}
        items={presentes.map(p => ({ label: p.nome, value: String(p.id) }))}
      />

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

      {!substituir && (
        <TouchableOpacity style={[styles.btnSalvar, { backgroundColor: '#27ae60' }]} onPress={handleProporVotacao} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnText, { color: '#fff' }]}>Propor para Votação</Text>}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.btnSalvar} onPress={handleSalvar} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#003366" /> : <Text style={styles.btnText}>{substituir ? 'Confirmar Substituição' : 'Confirmar Mesa (Pós-Votação)'}</Text>}
      </TouchableOpacity>
      </KeyboardAwareScrollView>
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
