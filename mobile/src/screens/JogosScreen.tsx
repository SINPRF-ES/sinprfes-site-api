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
import { salvarJogosInscricoesOffline, listarJogosInscricoesOffline } from '../database/db';
import { getCanonicalFiliadoId, ROLES } from '../utils/filiadoUtils';

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
  const [isConnected, setIsConnected] = useState(true);

  const isManager = [ROLES.ADMIN, ROLES.DIRETORIA, ROLES.FUNCIONARIO, ROLES.ORGANIZADOR].includes(usuario?.perfil_acesso || '');

  const [form, setForm] = useState({
    sexo: '',
    qtd_familiares: '0',
    familiares: '',
    observacoes: '',
    modalidades: [] as string[],
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => setIsConnected(!!state.isConnected));
    return () => unsubscribe();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      let inscricoes;
      if (isConnected) {
        inscricoes = await getInscricoesJogos();
        await salvarJogosInscricoesOffline(inscricoes);
      } else {
        inscricoes = await listarJogosInscricoesOffline();
      }

      const currentUserId = usuario ? getCanonicalFiliadoId(usuario) : '';
      const minha = Array.isArray(inscricoes) ? inscricoes.find((i: any) => String(i.filiado_id) === currentUserId) : null;

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
      logger.error('[Jogos.fetch]', err);
    } finally {
      setLoading(false);
    }
  }, [isManager, usuario?.id, isConnected]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleModalidade = (id: string) => {
    setForm((prev) => {
      const exists = prev.modalidades.includes(id);
      return {
        ...prev,
        modalidades: exists ? prev.modalidades.filter(m => m !== id) : [...prev.modalidades, id]
      };
    });
  };

  const handleSave = async () => {
    if (!isConnected) { Alert.alert('Offline', 'Sem conexão.'); return; }
    if (form.modalidades.length === 0) { Alert.alert('Aviso', 'Selecione uma modalidade.'); return; }

    try {
      setSubmitting(true);
      await registrarInscricaoJogos(form);
      Alert.alert('Sucesso', 'Inscrição registrada!');
      fetchData();
    } catch (err: any) {
      Alert.alert('Erro', 'Não foi possível salvar.');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateAge2026 = (birthDate: any) => {
    if (!birthDate || typeof birthDate !== 'string') return '—';
    const year = birthDate.includes('-') ? birthDate.split('-')[0] : birthDate.split('/')[2];
    return 2026 - parseInt(year);
  };

  const formatGender = (s: string) => {
    if (!s) return '—';
    const lower = s.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>🏅 Jogos PRF 2026</Text>
          <Text style={styles.bannerSubtitle}>Participe da maior integração esportiva!</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Minha Inscrição</Text>
          <Text style={styles.label}>Sexo</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={form.sexo} onValueChange={(v) => setForm({ ...form, sexo: v })}>
              <Picker.Item label="Selecione..." value="" />
              <Picker.Item label="Masculino" value="MASCULINO" />
              <Picker.Item label="Feminino" value="FEMININO" />
            </Picker>
          </View>

          <Text style={[styles.label, { marginTop: 10 }]}>Modalidades</Text>
          {MODALIDADES_JOGOS_2026.map(m => (
            <TouchableOpacity key={m.id} style={styles.modItem} onPress={() => handleToggleModalidade(m.id)}>
              <MaterialCommunityIcons
                name={form.modalidades.includes(m.id) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={24} color="#003366"
              />
              <Text style={styles.modLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.btnPrimary, (submitting || !isConnected) && styles.btnDisabled]}
            onPress={handleSave}
            disabled={submitting || !isConnected}
          >
            <Text style={styles.btnText}>Salvar Inscrição</Text>
          </TouchableOpacity>
        </View>

        {isManager && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 Planilha de Inscrições</Text>
            <ScrollView horizontal>
              <View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { width: 150 }]}>Nome</Text>
                  <Text style={[styles.tableHeaderText, { width: 80 }]}>Idade 2026</Text>
                  <Text style={[styles.tableHeaderText, { width: 100 }]}>Sexo</Text>
                  <Text style={[styles.tableHeaderText, { width: 200 }]}>Modalidades</Text>
                </View>
                {inscricoesGerais.map((item, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { width: 150 }]}>{item.nome_filiado}</Text>
                    <Text style={[styles.tableCell, { width: 80 }]}>{calculateAge2026(item.data_nascimento)}</Text>
                    <Text style={[styles.tableCell, { width: 100 }]}>{formatGender(item.sexo)}</Text>
                    <Text style={[styles.tableCell, { width: 200 }]}>
                        {(item.modalidades || []).map((mid: string) => MODALIDADES_JOGOS_2026.find(m => m.id === mid)?.label || mid).join(', ')}
                    </Text>
                  </View>
                ))}
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
  bannerSubtitle: { fontSize: 14, color: '#fff', marginTop: 5 },
  card: { backgroundColor: '#fff', padding: 20, margin: 15, borderRadius: 12, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366', marginBottom: 15, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 10 },
  modItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  modLabel: { fontSize: 14, color: '#333' },
  btnPrimary: { backgroundColor: '#003366', padding: 15, borderRadius: 30, alignItems: 'center', marginTop: 15 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnDisabled: { opacity: 0.6 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f3f5', padding: 10 },
  tableHeaderText: { fontWeight: 'bold', color: '#003366' },
  tableRow: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tableCell: { fontSize: 12, color: '#333' },
  offlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8, backgroundColor: '#f8d7da', borderRadius: 8, marginBottom: 15, alignSelf: 'center' },
  offlineText: { fontSize: 12, color: '#721c24', fontWeight: 'bold' },
});

export default JogosScreen;
