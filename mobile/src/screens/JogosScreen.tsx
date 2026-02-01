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
import { formatTelefone } from '../shared/format/formatters';
import { getCanonicalFiliadoId, ROLES } from '../utils/filiadoUtils';
import { MODALIDADES_JOGOS_2026 } from '../constants/jogos';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';
import { useNavigation } from '@react-navigation/native';

const JogosScreen = () => {
  const navigation = useNavigation<any>();
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

  const handleSave = useCallback(async () => {
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
  }, [isConnected, form, fetchData]);

  useEffect(() => {
    const actions: MenuAction[] = [
      { label: 'Salvar Inscrição', icon: 'check-bold', onPress: handleSave }
    ];
    navigation.setOptions({
      headerRight: () => <HeaderMenu actions={actions} />,
      headerStyle: { backgroundColor: '#003366' },
      headerTintColor: '#fff',
      headerTitleAlign: 'center',
    });
  }, [navigation, handleSave]);

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
          <Text style={styles.bannerSubtitle}>🏅 Participe da maior integração esportiva da categoria!</Text>
        </View>

        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="information-outline" size={20} color="#003366" style={{ marginBottom: 4 }} />
          <Text style={styles.infoTitle}>II JOIN PRF (2º Jogos de Integração Nacional da PRF)</Text>
          <Text style={styles.infoText}>📅 12 a 17/04/2026</Text>
          <Text style={styles.infoText}>📍 Poços de Caldas-MG</Text>
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

        </View>

        {isManager && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 Planilha de Inscrições</Text>
            <ScrollView horizontal>
              <View>
                <View style={styles.tableHeader}>
                  <View style={[styles.tableHeaderCellContainer, { width: 150 }]}><Text style={styles.tableHeaderText}>Nome</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 80 }]}><Text style={styles.tableHeaderText}>Idade (2026)</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 100 }]}><Text style={styles.tableHeaderText}>Sexo</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 200 }]}><Text style={styles.tableHeaderText}>Modalidades</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 80 }]}><Text style={styles.tableHeaderText}>Qtd Fam.</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 150 }]}><Text style={styles.tableHeaderText}>Familiares</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 150 }]}><Text style={styles.tableHeaderText}>Observações</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 120 }]}><Text style={styles.tableHeaderText}>Telefone</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 180 }]}><Text style={styles.tableHeaderText}>E-mail(s)</Text></View>
                </View>
                {inscricoesGerais.map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.tableRow,
                      idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                    ]}
                  >
                    <View style={[styles.tableCellContainer, { width: 150 }]}><Text style={styles.tableCell}>{item.nome_filiado}</Text></View>
                    <View style={[styles.tableCellContainer, { width: 80 }]}><Text style={styles.tableCell}>{calculateAge2026(item.data_nascimento)}</Text></View>
                    <View style={[styles.tableCellContainer, { width: 100 }]}><Text style={styles.tableCell}>{formatGender(item.sexo)}</Text></View>
                    <View style={[styles.tableCellContainer, { width: 200 }]}>
                      <Text style={styles.tableCell}>
                        {(() => {
                          const mods = item.modalidades || [];
                          if (typeof mods.map !== 'function') {
                            logger.error('JOGOS_RENDER_TYPE_ERROR', new Error(`modalidades is ${typeof mods}`), { item: { id: item.id, filiado_id: item.filiado_id } });
                            return 'Erro nos dados';
                          }
                          return mods.map((mid: string) => {
                            const normalizedMid = mid?.toLowerCase();
                            const found = MODALIDADES_JOGOS_2026.find(m => m.id === normalizedMid || m.id === mid);
                            if (!found && mid) {
                              // Rebaixado para INFO para evitar poluição de logs conforme diretriz C
                              logger.info('JOGOS_UNKNOWN_SLUG', { slug: mid });
                            }
                            return found ? found.label : mid;
                          }).join(', ');
                        })()}
                      </Text>
                    </View>
                    <View style={[styles.tableCellContainer, { width: 80 }]}><Text style={styles.tableCell}>{item.qtd_familiares || 0}</Text></View>
                    <View style={[styles.tableCellContainer, { width: 150 }]}><Text style={styles.tableCell}>{item.familiares || '—'}</Text></View>
                    <View style={[styles.tableCellContainer, { width: 150 }]}><Text style={styles.tableCell}>{item.observacoes || '—'}</Text></View>
                    <View style={[styles.tableCellContainer, { width: 120 }]}><Text style={styles.tableCell}>{formatTelefone(item.telefone1) || '—'}</Text></View>
                    <View style={[styles.tableCellContainer, { width: 180 }]}><Text style={styles.tableCell}>{[item.email1, item.email2].filter(Boolean).join(' / ') || '—'}</Text></View>
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
  banner: { backgroundColor: '#003366', padding: 20, alignItems: 'center' },
  bannerSubtitle: { fontSize: 15, color: '#fff', textAlign: 'center', fontStyle: 'italic' },
  infoCard: {
    backgroundColor: '#e7f3ff',
    padding: 16,
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 12,
    borderLeftWidth: 5,
    borderLeftColor: '#003366',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
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
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f3f5', borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#ccc' },
  tableHeaderText: { fontWeight: 'bold', color: '#003366', textAlign: 'center' },
  tableRow: { flexDirection: 'row', borderLeftWidth: 1, borderColor: '#ccc' },
  tableCell: { fontSize: 12, color: '#333', textAlign: 'center', flexShrink: 1 },
  tableCellContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    minHeight: 44,
  },
  tableHeaderCellContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    minHeight: 44,
  },
  tableRowEven: { backgroundColor: '#fff' },
  tableRowOdd: { backgroundColor: '#f9f9f9' },
  offlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8, backgroundColor: '#f8d7da', borderRadius: 8, marginBottom: 15, alignSelf: 'center' },
  offlineText: { fontSize: 12, color: '#721c24', fontWeight: 'bold' },
});

export default JogosScreen;
