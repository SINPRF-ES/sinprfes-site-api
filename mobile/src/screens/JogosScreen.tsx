// mobile/src/screens/JogosScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../infra/logger';
import { registrarInscricaoJogos, cancelarInscricaoJogos, getInscricoesJogos } from '../services/jogosService';
import NetInfo from '@react-native-community/netinfo';
import { formatISOToBR } from '../utils/date';
import { salvarJogosInscricoesOffline, listarJogosInscricoesOffline } from '../database/db';

const MODALIDADES_JOGOS_2026 = [
  { id: 'FUTSAL', label: 'Futsal', grupo: 'Coletivos' },
  { id: 'VOLEI_QUADRA', label: 'Vôlei de Quadra', grupo: 'Coletivos' },
  { id: 'VOLEI_AREIA', label: 'Vôlei de Areia', grupo: 'Coletivos' },
  { id: 'TENIS_MESA', label: 'Tênis de Mesa', grupo: 'Individuais' },
  { id: 'NATACAO', label: 'Natação', grupo: 'Individuais' },
  { id: 'ATLETISMO', label: 'Atletismo', grupo: 'Individuais' },
  { id: 'XADREZ', label: 'Xadrez', grupo: 'Outros' },
  { id: 'DOMINO', label: 'Dominó', grupo: 'Outros' },
];

const JogosScreen = () => {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inscricao, setInscricao] = useState<any>(null);
  const [inscricoesGerais, setInscricoesGerais] = useState<any[]>([]);
  const [netInfo, setNetInfo] = useState<any>({});

  const isManager = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO', 'ORGANIZADOR'].includes(usuario?.perfil_acesso || '');

  const [form, setForm] = useState({
    sexo: '',
    qtd_familiares: '0',
    familiares: '',
    observacoes: '',
    modalidades: [] as string[],
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => setNetInfo(state));
    return () => unsubscribe();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      let inscricoes;
      if (netInfo.isConnected) {
        inscricoes = await getInscricoesJogos();
        await salvarJogosInscricoesOffline(inscricoes);
      } else {
        inscricoes = await listarJogosInscricoesOffline();
      }

      const minha = inscricoes.find((i: any) => String(i.filiado_id) === String(usuario?.id));

      if (minha) {
        setInscricao(minha);
        setForm({
          sexo: minha.sexo || '',
          qtd_familiares: String(minha.qtd_familiares || '0'),
          familiares: minha.familiares || '',
          observacoes: minha.observacoes || '',
          modalidades: minha.modalidades || [],
        });
      } else {
        setInscricao(null);
        setForm({ sexo: '', qtd_familiares: '0', familiares: '', observacoes: '', modalidades: [] });
      }

      if (isManager) {
        setInscricoesGerais(inscricoes);
      }
    } catch (err) {
      logger.error('[Jogos.fetchData.error]', err);
      // Fallback offline caso a API falhe mas estejamos "conectados"
      try {
        const local = await listarJogosInscricoesOffline();
        setInscricoesGerais(local);
        const minhaLocal = local.find((i: any) => String(i.filiado_id) === String(usuario?.id));
        if (minhaLocal) {
          setInscricao(minhaLocal);
          setForm({
            sexo: minhaLocal.sexo || '',
            qtd_familiares: String(minhaLocal.qtd_familiares || '0'),
            familiares: minhaLocal.familiares || '',
            observacoes: minhaLocal.observacoes || '',
            modalidades: minhaLocal.modalidades || [],
          });
        }
      } catch (dbErr) {
        logger.error('[Jogos.fetchData.offlineFallback.error]', dbErr);
      }
    } finally {
      setLoading(false);
    }
  }, [isManager, usuario?.id, netInfo.isConnected]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleModalidade = (id: string) => {
    setForm((prev) => {
      const exists = prev.modalidades.includes(id);
      if (exists) {
        return { ...prev, modalidades: prev.modalidades.filter((m) => m !== id) };
      } else {
        return { ...prev, modalidades: [...prev.modalidades, id] };
      }
    });
  };

  const handleSave = async () => {
    if (!netInfo.isConnected) {
      Alert.alert('Offline', 'Você precisa de internet para enviar ou atualizar sua inscrição.');
      return;
    }

    if (form.modalidades.length === 0) {
      Alert.alert('Aviso', 'Selecione ao menos uma modalidade.');
      return;
    }

    try {
      setSubmitting(true);
      logger.info('[Jogos.submit.start]', { filiadoId: usuario?.id });
      await registrarInscricaoJogos(form);
      logger.info('[Jogos.submit.success]');
      Alert.alert('Sucesso', 'Sua inscrição foi registrada!');
      fetchData();
    } catch (err: any) {
      logger.error('[Jogos.submit.error]', err);
      Alert.alert('Erro', err.response?.data?.error || 'Não foi possível salvar a inscrição.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!netInfo.isConnected) {
      Alert.alert('Offline', 'Você precisa de internet para cancelar sua inscrição.');
      return;
    }

    Alert.alert(
      'Confirmar Cancelamento',
      'Tem certeza que deseja cancelar sua inscrição? Esta ação não pode ser desfeita.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              await cancelarInscricaoJogos();
              Alert.alert('Sucesso', 'Sua inscrição foi cancelada.');
              fetchData();
            } catch (err) {
              Alert.alert('Erro', 'Não foi possível cancelar.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const calculateAge2026 = (birthDate: string) => {
    if (!birthDate) return '—';
    try {
      const date = new Date(birthDate);
      if (isNaN(date.getTime())) return '—';
      return 2026 - date.getFullYear();
    } catch {
      return '—';
    }
  };

  const renderModalidades = () => {
    const grupos = MODALIDADES_JOGOS_2026.reduce((acc, curr) => {
      if (!acc[curr.grupo]) acc[curr.grupo] = [];
      acc[curr.grupo].push(curr);
      return acc;
    }, {} as any);

    return Object.keys(grupos).map((grupo) => (
      <View key={grupo} style={styles.grupoBox}>
        <Text style={styles.grupoTitulo}>{grupo}</Text>
        {grupos[grupo].map((m: any) => (
          <TouchableOpacity
            key={m.id}
            style={styles.modItem}
            onPress={() => handleToggleModalidade(m.id)}
          >
            <MaterialCommunityIcons
              name={form.modalidades.includes(m.id) ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
              color={form.modalidades.includes(m.id) ? '#003366' : '#757575'}
            />
            <Text style={styles.modLabel}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ));
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>🏅 Jogos PRF 2026</Text>
          <Text style={styles.bannerSubtitle}>Participe da maior integração esportiva!</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Inscrição</Text>
          {!netInfo.isConnected && (
            <View style={styles.offlineBadge}>
              <MaterialCommunityIcons name="cloud-off-outline" size={16} color="#721c24" />
              <Text style={styles.offlineText}>Visualizando modo offline</Text>
            </View>
          )}

          <Text style={styles.label}>Sexo (Para fins de categoria)</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={form.sexo}
              onValueChange={(v) => setForm({ ...form, sexo: v })}
            >
              <Picker.Item label="Selecione..." value="" />
              <Picker.Item label="Masculino" value="MASCULINO" />
              <Picker.Item label="Feminino" value="FEMININO" />
            </Picker>
          </View>

          <Text style={[styles.label, { marginTop: 15 }]}>Modalidades (Selecione ao menos uma)</Text>
          {renderModalidades()}

          <Text style={styles.label}>Levará familiares? (Quantos?)</Text>
          <TextInput
            style={styles.input}
            value={form.qtd_familiares}
            onChangeText={(v) => setForm({ ...form, qtd_familiares: v })}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Nome dos familiares (um por linha)</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            value={form.familiares}
            onChangeText={(v) => setForm({ ...form, familiares: v })}
            multiline
            placeholder="Ex: Maria (Esposa), João (Filho)..."
          />

          <Text style={styles.label}>Observações Adicionais</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            value={form.observacoes}
            onChangeText={(v) => setForm({ ...form, observacoes: v })}
            multiline
          />

          <TouchableOpacity
            style={[styles.btnPrimary, (submitting || !netInfo.isConnected) && styles.btnDisabled]}
            onPress={handleSave}
            disabled={submitting || !netInfo.isConnected}
          >
            <Text style={styles.btnText}>{inscricao ? 'Atualizar Inscrição 🚀' : 'Confirmar Inscrição 🚀'}</Text>
          </TouchableOpacity>

          {inscricao && (
            <TouchableOpacity
              style={[styles.btnDanger, (submitting || !netInfo.isConnected) && styles.btnDisabled, { marginTop: 10 }]}
              onPress={handleCancel}
              disabled={submitting || !netInfo.isConnected}
            >
              <Text style={styles.btnText}>Cancelar Inscrição ❌</Text>
            </TouchableOpacity>
          )}
        </View>

        {isManager && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 Planilha de Inscrições (Gestão)</Text>
            <ScrollView horizontal persistentScrollbar>
              <View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { width: 150 }]}>Nome</Text>
                  <Text style={[styles.tableHeaderText, { width: 100 }]}>Nascimento</Text>
                  <Text style={[styles.tableHeaderText, { width: 60 }]}>Idade 2026</Text>
                  <Text style={[styles.tableHeaderText, { width: 100 }]}>Sexo</Text>
                  <Text style={[styles.tableHeaderText, { width: 200 }]}>Modalidades</Text>
                </View>
                {inscricoesGerais.map((item, idx) => (
                  <View key={idx} style={[styles.tableRow, idx % 2 === 0 ? {} : { backgroundColor: '#f9f9f9' }]}>
                    <Text style={[styles.tableCell, { width: 150, fontWeight: 'bold' }]}>{item.nome_filiado}</Text>
                    <Text style={[styles.tableCell, { width: 100 }]}>{formatISOToBR(item.data_nascimento)}</Text>
                    <Text style={[styles.tableCell, { width: 60, textAlign: 'center' }]}>{calculateAge2026(item.data_nascimento)}</Text>
                    <Text style={[styles.tableCell, { width: 100 }]}>{item.sexo}</Text>
                    <Text style={[styles.tableCell, { width: 200 }]} numberOfLines={2}>
                      {(item.modalidades || []).map((id: string) => MODALIDADES_JOGOS_2026.find(m => m.id === id)?.label || id).join(', ')}
                    </Text>
                  </View>
                ))}
                {inscricoesGerais.length === 0 && <Text style={{ padding: 20 }}>Nenhuma inscrição.</Text>}
              </View>
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  scrollContent: { paddingBottom: 40 },
  banner: { backgroundColor: '#003366', padding: 30, alignItems: 'center' },
  bannerTitle: { fontSize: 24, fontWeight: 'bold', color: '#f1c40f' },
  bannerSubtitle: { fontSize: 14, color: '#fff', marginTop: 5, textAlign: 'center' },
  card: { backgroundColor: '#fff', padding: 20, margin: 15, borderRadius: 12, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 15, backgroundColor: '#fff', fontSize: 16 },
  pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 10, backgroundColor: '#fff' },
  grupoBox: { backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  grupoTitulo: { fontWeight: 'bold', color: '#003366', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#003366', paddingBottom: 4 },
  modItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modLabel: { fontSize: 14, color: '#333' },
  btnPrimary: { backgroundColor: '#003366', padding: 18, borderRadius: 30, alignItems: 'center' },
  btnDanger: { backgroundColor: '#e74c3c', padding: 15, borderRadius: 30, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnDisabled: { opacity: 0.6 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f3f5', padding: 10, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  tableHeaderText: { fontWeight: 'bold', color: '#003366', fontSize: 12 },
  tableRow: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  tableCell: { fontSize: 12, color: '#333' },
  offlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8, backgroundColor: '#f8d7da', borderRadius: 8, marginBottom: 15, alignSelf: 'center' },
  offlineText: { fontSize: 12, color: '#721c24', fontWeight: 'bold' },
});

export default JogosScreen;
