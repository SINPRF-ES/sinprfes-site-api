import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { iniciarVotacao } from '../../services/assembleiaService';
import HeaderMenu, { MenuAction } from '../../components/HeaderMenu';

export default function CriarItemVotacaoScreen({ route, navigation }: any) {
  const { id } = route.params;
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [duracao, setDuracao] = useState('2');
  const [loading, setLoading] = useState(false);

  const handleSalvar = useCallback(async () => {
    if (!titulo || !descricao) {
      Alert.alert('Aviso', 'Preencha todos os campos.');
      return;
    }

    try {
      setLoading(true);
      await iniciarVotacao(id, { titulo, descricao, duracao_segundos: parseInt(duracao) * 60 });
      Alert.alert('Sucesso', 'Votação iniciada!');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao iniciar votação.');
    } finally {
      setLoading(false);
    }
  }, [id, titulo, descricao, duracao, navigation]);

  useEffect(() => {
    const actions: MenuAction[] = [
      { label: 'Iniciar Votação', icon: 'play-box-outline', onPress: handleSalvar }
    ];
    navigation.setOptions({
      headerRight: () => <HeaderMenu actions={actions} />,
      title: 'Novo Item'
    });
  }, [navigation, handleSalvar]);

  return (
    <KeyboardAwareScrollView style={styles.container} enableOnAndroid extraScrollHeight={50} keyboardOpeningTime={0}>
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
      <View style={styles.pickerBox}>
        <Picker
          selectedValue={duracao}
          onValueChange={(v) => setDuracao(v)}
          style={styles.picker}
          dropdownIconColor="#003366"
        >
          <Picker.Item label="Selecione..." value="" />
          <Picker.Item label="1 minuto" value="1" />
          <Picker.Item label="2 minutos" value="2" />
          <Picker.Item label="3 minutos" value="3" />
          <Picker.Item label="4 minutos" value="4" />
          <Picker.Item label="5 minutos" value="5" />
        </Picker>
      </View>

    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f8', padding: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16, color: '#333' },
  pickerBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 20, justifyContent: 'center' },
  picker: { color: '#333' },
  textArea: { height: 100, textAlignVertical: 'top' },
  btnSalvar: { backgroundColor: '#f1c40f', padding: 18, borderRadius: 30, alignItems: 'center' },
  btnText: { color: '#003366', fontWeight: 'bold', fontSize: 16 },
});
