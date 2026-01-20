import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Switch,
  FlatList,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../hooks/useAuth';
import { useNetInfo } from '@react-native-community/netinfo';
import {
  getMinhaInscricaoJogos,
  registrarInscricaoJogos,
  cancelarInscricaoJogos,
  getInscricoesJogos,
} from '../services/jogosService';
import { logger } from '../infra/logger';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const MODALIDADES_JOGOS_2026 = [
  { id: 'atletismo_100m_masc', label: '100m Masculino', grupo: 'Atletismo' },
  { id: 'atletismo_100m_fem', label: '100m Feminino', grupo: 'Atletismo' },
  { id: 'atletismo_400m_masc', label: '400m Masculino', grupo: 'Atletismo' },
  { id: 'atletismo_400m_fem', label: '400m Feminino', grupo: 'Atletismo' },
  { id: 'atletismo_1500m_masc', label: '1500m Masculino', grupo: 'Atletismo' },
  { id: 'atletismo_1500m_fem', label: '1500m Feminino', grupo: 'Atletismo' },
  { id: 'atletismo_5000m_masc', label: '5000m Masculino', grupo: 'Atletismo' },
  { id: 'atletismo_5000m_fem', label: '5000m Feminino', grupo: 'Atletismo' },
  { id: 'beach_tenis_dupla_livre', label: 'Beach Tênis - Dupla Livre', grupo: 'Beach Tênis' },
  { id: 'beach_tenis_dupla_mista', label: 'Beach Tênis - Dupla Mista', grupo: 'Beach Tênis' },
  { id: 'canastra', label: 'Canastra', grupo: 'Jogos de Mesa' },
  { id: 'domino', label: 'Dominó', grupo: 'Jogos de Mesa' },
  { id: 'truco_duplas', label: 'Truco (Duplas)', grupo: 'Jogos de Mesa' },
  { id: 'xadrez', label: 'Xadrez', grupo: 'Jogos de Mesa' },
  { id: 'futebol_society_livre', label: 'Futebol Society (Livre)', grupo: 'Futebol' },
  { id: 'futebol_society_master', label: 'Futebol Society (Master - Acima de 55 anos)', grupo: 'Futebol' },
  { id: 'futsal_livre', label: 'Futsal (Livre)', grupo: 'Futebol' },
  { id: 'futevolei', label: 'Futevôlei', grupo: 'Vôlei' },
  { id: 'voleibol_livre', label: 'Voleibol (Livre)', grupo: 'Vôlei' },
  { id: 'voleibol_praia_dupla_masc', label: 'Vôlei de Praia - Dupla Masculina', grupo: 'Vôlei' },
  { id: 'voleibol_praia_dupla_mista', label: 'Vôlei de Praia - Dupla Mista', grupo: 'Vôlei' },
  { id: 'jiu_jitsu', label: 'Jiu-Jitsu', grupo: 'Artes Marciais' },
  { id: 'natacao_50m_livre_masc', label: '50m Nado Livre (Masculino)', grupo: 'Natação' },
  { id: 'natacao_50m_livre_fem', label: '50m Nado Livre (Feminino)', grupo: 'Natação' },
  { id: 'natacao_50m_costas_masc', label: '50m Nado Costas (Masculino)', grupo: 'Natação' },
  { id: 'natacao_50m_costas_fem', label: '50m Nado Costas (Feminino)', grupo: 'Natação' },
  { id: 'natacao_50m_peito_masc', label: '50m Nado Peito (Masculino)', grupo: 'Natação' },
  { id: 'natacao_50m_peito_fem', label: '50m Nado Peito (Feminino)', grupo: 'Natação' },
  { id: 'natacao_50m_borboleta_masc', label: '50m Nado Borboleta (Masculino)', grupo: 'Natação' },
  { id: 'natacao_50m_borboleta_fem', label: '50m Nado Borboleta (Feminino)', grupo: 'Natação' },
  { id: 'natacao_revezamento_4x50m_livre', label: 'Revezamento 4x50m Livre', grupo: 'Natação' },
  { id: 'natacao_revezamento_2x50m_misto', label: 'Revezamento 2x50 Misto', grupo: 'Natação' },
  { id: 'sinuca_individual', label: 'Sinuca Individual', grupo: 'Sinuca' },
  { id: 'sinuca_duplas', label: 'Sinuca Duplas', grupo: 'Sinuca' },
  { id: 'tenis_quadra_individual_masc', label: 'Tênis de Quadra - Individual (Masculino)', grupo: 'Tênis' },
  { id: 'tenis_quadra_duplas_livre', label: 'Tênis de Quadra - Duplas (Livre)', grupo: 'Tênis' },
  { id: 'tenis_mesa_masc', label: 'Tênis de Mesa (Masculino)', grupo: 'Tênis de Mesa' },
  { id: 'tenis_mesa_fem', label: 'Tênis de Mesa (Feminino)', grupo: 'Tênis de Mesa' },
  { id: 'tenis_mesa_duplas', label: 'Tênis de Mesa (Duplas)', grupo: 'Tênis de Mesa' },
  { id: 'tiro_nra_masc', label: 'Tiro NRA (Masculino)', grupo: 'Tiro' },
  { id: 'tiro_nra_fem', label: 'Tiro NRA (Feminino)', grupo: 'Tiro' },
  { id: 'tiro_ispc_masc', label: 'Tiro ISPC (Masculino)', grupo: 'Tiro' },
  { id: 'tiro_ispc_fem', label: 'Tiro ISPC (Feminino)', grupo: 'Tiro' },
  { id: 'peteca', label: 'Peteca', grupo: 'Exibição' },
  { id: 'damas', label: 'Damas', grupo: 'Exibição' },
  { id: 'bocha', label: 'Bocha', grupo: 'Exibição' },
];

const JogosScreen = () => {
  const { usuario } = useAuth();
  const netInfo = useNetInfo();
  const isManager = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO', 'ORGANIZADOR'].includes(usuario?.perfil_acesso || '');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inscricao, setInscricao] = useState<any>(null);
  const [inscricoesGerais, setInscricoesGerais] = useState<any[]>([]);

  const [form, setForm] = useState({
    sexo: '',
    qtd_familiares: '0',
    familiares: '',
    observacoes: '',
    modalidades: [] as string[],
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const minInsc = await getMinhaInscricaoJogos().catch(() => null);
      if (minInsc) {
        setInscricao(minInsc);
        setForm({
          sexo: minInsc.sexo || '',
          qtd_familiares: String(minInsc.qtd_familiares || 0),
          familiares: minInsc.familiares || '',
          observacoes: minInsc.observacoes || '',
          modalidades: minInsc.modalidades || [],
        });
      }

      if (isManager) {
        const gerais = await getInscricoesJogos();
        setInscricoesGerais(gerais);
      }
    } catch (err) {
      logger.error('[Jogos.fetchData.error]', err);
    } finally {
      setLoading(false);
    }
  }, [isManager]);

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
      Alert.alert('Offline', 'Conecte-se para salvar.');
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
      Alert.alert('Erro', 'Não foi possível salvar a inscrição.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
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
              setInscricao(null);
              setForm({ sexo: '', qtd_familiares: '0', familiares: '', observacoes: '', modalidades: [] });
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
    const year = new Date(birthDate).getFullYear();
    return 2026 - year;
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
            style={[styles.btnPrimary, submitting && styles.btnDisabled]}
            onPress={handleSave}
            disabled={submitting}
          >
            <Text style={styles.btnText}>{inscricao ? 'Atualizar Inscrição 🚀' : 'Confirmar Inscrição 🚀'}</Text>
          </TouchableOpacity>

          {inscricao && (
            <TouchableOpacity
              style={[styles.btnDanger, submitting && styles.btnDisabled, { marginTop: 10 }]}
              onPress={handleCancel}
              disabled={submitting}
            >
              <Text style={styles.btnText}>Cancelar Inscrição ❌</Text>
            </TouchableOpacity>
          )}
        </View>

        {isManager && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 Planilha de Inscrições (Gestão)</Text>
            <ScrollView horizontal>
              <View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { width: 150 }]}>Nome</Text>
                  <Text style={[styles.tableHeaderText, { width: 60 }]}>Idade</Text>
                  <Text style={[styles.tableHeaderText, { width: 100 }]}>Sexo</Text>
                  <Text style={[styles.tableHeaderText, { width: 200 }]}>Modalidades</Text>
                </View>
                {inscricoesGerais.map((item, idx) => (
                  <View key={idx} style={[styles.tableRow, idx % 2 === 0 ? {} : { backgroundColor: '#f9f9f9' }]}>
                    <Text style={[styles.tableCell, { width: 150, fontWeight: 'bold' }]}>{item.nome_filiado}</Text>
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
});

export default JogosScreen;
