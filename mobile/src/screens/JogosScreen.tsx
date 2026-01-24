// mobile/src/screens/JogosScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../infra/logger';
import { registrarInscricaoJogos, cancelarInscricaoJogos, getInscricoesJogos } from '../services/jogosService';
import NetInfo from '@react-native-community/netinfo';
import { salvarJogosInscricoesOffline, listarJogosInscricoesOffline } from '../database/db';
import { getCanonicalFiliadoId, ROLES } from '../utils/filiadoUtils';
import { MODALIDADES_JOGOS_2026 } from '../constants/jogos';

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
      logger.info('JOGOS_FETCH_START', { isConnected });
      let inscricoes;
      if (isConnected) {
        inscricoes = await getInscricoesJogos();
        await salvarJogosInscricoesOffline(inscricoes);
      } else {
        inscricoes = await listarJogosInscricoesOffline();
      }

      logger.info('JOGOS_FETCH_SHAPE', {
        isArray: Array.isArray(inscricoes),
        length: inscricoes?.length,
        firstItemKeys: inscricoes?.[0] ? Object.keys(inscricoes[0]) : [],
        hasModalidades: inscricoes?.[0] ? !!inscricoes[0].modalidades : false
      });

      const currentUserId = getCanonicalFiliadoId(usuario);
      const minha = inscricoes.find((i: any) => String(i.filiado_id) === currentUserId);

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
    } catch (err: any) {
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
      logger.info('JOGOS_SAVE_START', { modalidadesCount: form.modalidades.length });
      await registrarInscricaoJogos(form);
      Alert.alert('Sucesso', 'Inscrição registrada!');
      fetchData();
    } catch (err: any) {
      logger.error('JOGOS_SAVE_ERROR', err);
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
      <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent} enableOnAndroid extraScrollHeight={50} keyboardOpeningTime={0}>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>🏅 Jogos PRF 2026</Text>
          <Text style={styles.bannerSubtitle}>Participe da maior integração esportiva!</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Minha Inscrição</Text>
          <Text style={styles.label}>Sexo</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={form.sexo}
              onValueChange={(v) => setForm({ ...form, sexo: v })}
              style={styles.picker}
              dropdownIconColor="#003366"
            >
              <Picker.Item label="Selecione..." value="" color="#999" />
              <Picker.Item label="Masculino" value="MASCULINO" />
              <Picker.Item label="Feminino" value="FEMININO" />
            </Picker>
          </View>

          <Text style={[styles.label, { marginTop: 10 }]}>Modalidades</Text>
          {(() => {
            const agruparModalidades = (lista: any[]) => {
              return lista.reduce((acc, item) => {
                if (!acc[item.grupo]) acc[item.grupo] = [];
                acc[item.grupo].push(item);
                return acc;
              }, {});
            };
            const grupos: any = agruparModalidades(MODALIDADES_JOGOS_2026);
            return Object.keys(grupos).map(grupo => (
              <View key={grupo} style={styles.grupoContainer}>
                <Text style={styles.grupoTitulo}>{grupo}</Text>
                {grupos[grupo].map((m: any) => (
                  <TouchableOpacity key={m.id} style={styles.modItem} onPress={() => handleToggleModalidade(m.id)}>
                    <MaterialCommunityIcons
                      name={form.modalidades.includes(m.id) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={24} color="#003366"
                    />
                    <Text style={styles.modLabel}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ));
          })()}

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
                  <Text style={[styles.tableHeaderText, { width: 80 }]}>Idade (2026)</Text>
                  <Text style={[styles.tableHeaderText, { width: 100 }]}>Sexo</Text>
                  <Text style={[styles.tableHeaderText, { width: 200 }]}>Modalidades</Text>
                  <Text style={[styles.tableHeaderText, { width: 80 }]}>Qtd Fam.</Text>
                  <Text style={[styles.tableHeaderText, { width: 150 }]}>Familiares</Text>
                  <Text style={[styles.tableHeaderText, { width: 150 }]}>Observações</Text>
                  <Text style={[styles.tableHeaderText, { width: 120 }]}>Telefone</Text>
                  <Text style={[styles.tableHeaderText, { width: 180 }]}>E-mail(s)</Text>
                </View>
                {inscricoesGerais.map((item, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { width: 150 }]}>{item.nome_filiado}</Text>
                    <Text style={[styles.tableCell, { width: 80 }]}>{calculateAge2026(item.data_nascimento)}</Text>
                    <Text style={[styles.tableCell, { width: 100 }]}>{formatGender(item.sexo)}</Text>
                    <Text style={[styles.tableCell, { width: 200 }]}>
                        {(() => {
                          const mods = item.modalidades || [];
                          if (typeof mods.map !== 'function') {
                            logger.error('JOGOS_RENDER_TYPE_ERROR', new Error(`modalidades is ${typeof mods}`), { item: { id: item.id, filiado_id: item.filiado_id } });
                            return 'Erro nos dados';
                          }
                          return mods.map((mid: string) => {
                            const found = MODALIDADES_JOGOS_2026.find(m => m.id === mid);
                            if (!found && mid) {
                              logger.warn('JOGOS_UNKNOWN_SLUG', { slug: mid });
                            }
                            return found ? found.label : mid;
                          }).join(', ');
                        })()}
                    </Text>
                    <Text style={[styles.tableCell, { width: 80 }]}>{item.qtd_familiares || 0}</Text>
                    <Text style={[styles.tableCell, { width: 150 }]}>{item.familiares || '—'}</Text>
                    <Text style={[styles.tableCell, { width: 150 }]}>{item.observacoes || '—'}</Text>
                    <Text style={[styles.tableCell, { width: 120 }]}>{item.telefone1 || '—'}</Text>
                    <Text style={[styles.tableCell, { width: 180 }]}>{[item.email1, item.email2].filter(Boolean).join(' / ') || '—'}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </KeyboardAwareScrollView>
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
  pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 10, height: 50, justifyContent: 'center' },
  picker: { color: '#333', height: 50 },
  grupoContainer: { marginTop: 15 },
  grupoTitulo: { fontSize: 14, fontWeight: 'bold', color: '#003366', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5, marginBottom: 5 },
  modItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  modLabel: { fontSize: 14, color: '#333', flex: 1 },
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
