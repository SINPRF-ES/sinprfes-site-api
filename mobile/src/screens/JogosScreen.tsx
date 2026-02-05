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

  const handleCancel = useCallback(async () => {
    Alert.alert(
      'Cancelar Inscrição',
      'Tem certeza que deseja cancelar sua inscrição nos Jogos 2026? Esta ação não pode ser desfeita.',
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
              Alert.alert('Erro', 'Não foi possível cancelar a inscrição.');
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  }, [fetchData]);

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
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="map-marker-radius" size={20} color="#003366" />
            <Text style={styles.infoText}>Local: <Text style={styles.bold}>Poços de Caldas-MG</Text></Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="calendar-clock" size={20} color="#003366" />
            <Text style={styles.infoText}>Data: <Text style={styles.bold}>12 a 17/04/2026</Text></Text>
          </View>
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

          <Text style={[styles.label, { marginTop: 20 }]}>Levará familiares? (Quantos?)</Text>
          <TextInput
            style={styles.input}
            value={form.qtd_familiares}
            onChangeText={(v) => setForm({ ...form, qtd_familiares: v.replace(/[^0-9]/g, '') })}
            keyboardType="numeric"
            placeholder="0"
          />

          <Text style={[styles.label, { marginTop: 15 }]}>Nome dos familiares (um por linha)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.familiares}
            onChangeText={(v) => setForm({ ...form, familiares: v })}
            multiline
            numberOfLines={3}
            placeholder="Ex: Maria (Esposa), João (Filho)..."
          />

          <Text style={[styles.label, { marginTop: 15 }]}>Observações Adicionais</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.observacoes}
            onChangeText={(v) => setForm({ ...form, observacoes: v })}
            multiline
            numberOfLines={3}
            placeholder="Restrições alimentares, necessidades especiais, etc."
          />

          <TouchableOpacity
            style={[styles.btnPrimary, submitting && styles.btnDisabled, { marginTop: 30 }]}
            onPress={handleSave}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Confirmar / Atualizar Inscrição 🚀</Text>
            )}
          </TouchableOpacity>

          {inscricao && (
            <TouchableOpacity
              style={[styles.btnCancel, submitting && styles.btnDisabled, { marginTop: 15 }]}
              onPress={handleCancel}
              disabled={submitting}
            >
              <Text style={styles.btnCancelText}>Cancelar minha Inscrição ❌</Text>
            </TouchableOpacity>
          )}
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
    backgroundColor: '#e6f0fa',
    margin: 15,
    marginBottom: 0,
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 5,
    borderLeftColor: '#003366',
    gap: 8,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 16, color: '#333' },
  bold: { fontWeight: 'bold' },
  card: { backgroundColor: '#fff', padding: 20, margin: 15, borderRadius: 12, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366', marginBottom: 15, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  pickerContainer: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 10, height: 50, justifyContent: 'center' },
  picker: { color: '#333', height: 50 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, color: '#333', fontSize: 16, backgroundColor: '#fff' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  grupoContainer: { marginTop: 15 },
  grupoTitulo: { fontSize: 14, fontWeight: 'bold', color: '#003366', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5, marginBottom: 5 },
  modItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  modLabel: { fontSize: 14, color: '#333', flex: 1 },
  btnPrimary: { backgroundColor: '#003366', padding: 15, borderRadius: 30, alignItems: 'center', marginTop: 15 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnCancel: { backgroundColor: '#e74c3c', padding: 12, borderRadius: 30, alignItems: 'center' },
  btnCancelText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
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
