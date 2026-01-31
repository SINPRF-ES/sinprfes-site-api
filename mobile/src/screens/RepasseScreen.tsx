import React, { Component, ErrorInfo, ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SafeScreen from '../components/SafeScreen';
import repasseService, { MesRepasse, Responsavel } from '../services/repasseService';
import { getFiliados } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../infra/logger';

const nomesMeses = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const LOTACAO_KEYWORDS: any = {
  "SEDE": "SEDE",
  "DEL 01 - Viana": "VIANA",
  "DEL 02 - Serra": "SERRA",
  "DEL 03 - Guarapari": "GUARAPARI",
  "DEL 04 - Linhares": "LINHARES"
};

class RepasseErrorBoundary extends Component<{ children: ReactNode, breadcrumbs: string[] }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('REPASSE_RENDER_ERROR', error, {
      componentStack: errorInfo.componentStack,
      breadcrumbs: this.props.breadcrumbs
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ color: 'red', fontWeight: 'bold' }}>⚠️ Erro ao carregar repasse.</Text>
          <Text style={{ color: '#666', marginTop: 10 }}>Tente recarregar a tela.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RepasseScreen() {
  const { usuario } = useAuth();
  const breadcrumbsRef = useRef<string[]>([]);

  const bc = (msg: string, meta?: any) => {
    breadcrumbsRef.current.push(msg);
    if (breadcrumbsRef.current.length > 50) breadcrumbsRef.current.shift();
    logger.info('REPASSE_BC', { msg, ...meta });
  };

  const safeNumber = (v: any, fallback = 0) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const normalizeLocalidade = (str: string) => {
    return (str || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .toUpperCase();
  };

  const formatCurrency = (v: any) =>
    safeNumber(v, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [meses, setMeses] = useState<MesRepasse[]>([]);
  const [totalAcumuladoGeral, setTotalAcumuladoGeral] = useState(0);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(new Date().getMonth() + 1);

  console.info('[REPASSE][STATE]', {
    year,
    loading,
    mesesCount: meses?.length,
    totalAcumuladoGeral,
    responsaveisCount: responsaveis?.length,
    expandedMonth,
    usuarioPerfil: usuario?.perfil_acesso,
  });

  // Implementação local para máxima robustez contra erros de importação (UI_RENDER_CRASH)
  const ehGestao = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes((usuario?.perfil_acesso || '').toUpperCase());

  const fetchData = useCallback(async () => {
    bc('fetch:start', { year });
    try {
      setLoading(true);

      bc('api:call:start', { year, ehGestao });
      const [respAno, respResps, respFiliados] = await Promise.allSettled([
        repasseService.getRepasseAno(year),
        ehGestao ? repasseService.listarResponsaveis() : Promise.resolve([]),
        getFiliados()
      ]);
      bc('api:call:end', {
        anoStatus: respAno.status,
        respsStatus: respResps.status,
        filiadosStatus: respFiliados.status
      });

      if (respAno.status === 'fulfilled') {
        const data = respAno.value;

        // Passo 1: Normalização robusta de dados (sanitização preventiva)
        const mesesApi = Array.isArray(data?.meses) ? data.meses : [];
        const mesesNorm: MesRepasse[] = mesesApi.map(m => ({
          ...m,
          month: safeNumber(m?.month, 0),
          perCapita: safeNumber(m?.perCapita, 0),
          totalRepasseMes: safeNumber(m?.totalRepasseMes, 0),
          localidades: Array.isArray(m?.localidades) ? m.localidades.map(l => ({
            ...l,
            lotacao: String(l?.lotacao || ''),
            filiadosAtivos: safeNumber(l?.filiadosAtivos, 0),
            prfTotal: safeNumber(l?.prfTotal, 0),
            percentual: (l?.percentual == null) ? null : safeNumber(l.percentual),
            creditoMes: safeNumber(l?.creditoMes, 0),
            reembolsoMes: safeNumber(l?.reembolsoMes, 0),
            acumuladoAno: safeNumber(l?.acumuladoAno, 0),
            responsavelId: l?.responsavelId ?? null,
            responsavelNome: String(l?.responsavelNome || ''),
          })) : [],
        }));

        // Task 2: Unificar contagem de filiados ativos (Fonte: Listar Filiados)
        if (respFiliados.status === 'fulfilled') {
          const allFiliados = Array.isArray(respFiliados.value) ? respFiliados.value : [];
          bc('REPASSE_LOCALIDADE_NORMALIZATION', { allFiliadosCount: allFiliados.length });

          const activeFiliados = allFiliados.filter(f => {
            const situacao = (f.situacao_funcional || f.situacao || 'ATIVO').toUpperCase();
            return situacao === 'ATIVO' && !f.arquivado_em;
          });

          const counts: any = {};
          Object.keys(LOTACAO_KEYWORDS).forEach(lot => {
            const kw = LOTACAO_KEYWORDS[lot];
            counts[lot] = activeFiliados.filter(f =>
              normalizeLocalidade(f.lotacao || 'SEDE').includes(kw)
            ).length;
          });

          bc('unify_counts:done', counts);

          mesesNorm.forEach(m => {
            m.localidades.forEach(l => {
              if (counts[l.lotacao] !== undefined) {
                l.filiadosAtivos = counts[l.lotacao];
                // Recalcular percentual e crédito com base no novo número de ativos
                const perCapita = Number(m.perCapita || 0);
                if (l.prfTotal > 0) {
                  l.percentual = (l.filiadosAtivos / l.prfTotal) * 100;
                  const base = l.filiadosAtivos * perCapita;
                  let factor = 0;
                  if (l.percentual >= 90) factor = 1.0;
                  else if (l.percentual >= 80) factor = 0.7;
                  else if (l.percentual >= 70) factor = 0.4;
                  l.creditoMes = base * factor;
                } else {
                  l.percentual = null;
                  l.creditoMes = 0;
                }
              }
            });
            m.totalRepasseMes = m.localidades.reduce((acc, l) => acc + (l.creditoMes || 0), 0);
          });
        } else {
          logger.warn('REPASSE_FILIADOS_COUNT_FALLBACK', { reason: respFiliados.status });
        }

        // Recalcular acumulado anual após unificação de contagens
        const lotacoesLabels = ["SEDE", "DEL 01 - Viana", "DEL 02 - Serra", "DEL 03 - Guarapari", "DEL 04 - Linhares"];
        const acumulados: any = {};
        lotacoesLabels.forEach(lot => {
          let somaCred = 0;
          let somaReem = 0;
          mesesNorm.forEach(mes => {
            const l = mes.localidades.find(ll => ll.lotacao === lot);
            if (l) {
              somaCred += l.creditoMes;
              somaReem += l.reembolsoMes;
            }
          });
          acumulados[lot] = somaCred - somaReem;
        });

        mesesNorm.forEach(mes => {
          mes.localidades.forEach(l => {
            l.acumuladoAno = acumulados[l.lotacao] || 0;
          });
        });

        const totalAcumuladoNorm = Object.values(acumulados).reduce((acc: any, curr: any) => acc + curr, 0) as number;

        bc('normalize:done', {
          mesesLen: mesesNorm.length,
          total: totalAcumuladoNorm
        });

        setMeses(mesesNorm);
        setTotalAcumuladoGeral(totalAcumuladoNorm);
      } else {
        logger.error('REPASSE_FETCH_ERROR', respAno.reason, {
          fn: 'getRepasseAno',
          breadcrumbs: breadcrumbsRef.current,
          year
        });
        setMeses([]);
      }

      if (respResps.status === 'fulfilled') {
        const respsData = respResps.value;
        setResponsaveis(Array.isArray(respsData) ? respsData : []);
      } else {
        setResponsaveis([]);
      }

      if (respAno.status === 'rejected') {
        Alert.alert('Erro', 'Não foi possível carregar os dados de repasse para este ano.');
      }
    } catch (err: any) {
      logger.error('REPASSE_FETCH_ERROR', err, {
        message: err.message,
        stack: err.stack,
        breadcrumbs: breadcrumbsRef.current,
        year
      });
      setMeses([]);
      setResponsaveis([]);
    } finally {
      setLoading(false);
    }
  }, [year, ehGestao]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateLocalidade = (month: number, lotacao: string, field: string, value: any) => {
    const newMeses = [...meses];
    const mesIndex = newMeses.findIndex(m => m.month === month);
    if (mesIndex === -1) return;

    const locIndex = newMeses[mesIndex].localidades.findIndex(l => l.lotacao === lotacao);
    if (locIndex === -1) return;

    const loc = { ...newMeses[mesIndex].localidades[locIndex] };
    if (field === 'responsavelId') loc.responsavelId = value;
    if (field === 'prfTotal') loc.prfTotal = parseInt(value) || 0;
    if (field === 'reembolsoMes') loc.reembolsoMes = parseFloat(value) || 0;

    newMeses[mesIndex].localidades[locIndex] = loc;

    recalculate(newMeses, month);
    setMeses(newMeses);
  };

  const handleUpdatePerCapita = (month: number, value: string) => {
    const newMeses = [...meses];
    const mesIndex = newMeses.findIndex(m => m.month === month);
    if (mesIndex === -1) return;

    newMeses[mesIndex].perCapita = parseFloat(value) || 0;
    recalculate(newMeses, month);
    setMeses(newMeses);
  };

  const recalculate = (mesesList: MesRepasse[], month: number) => {
    console.info('[REPASSE][LOGIC] Recalculate start', { month });
    const m = (mesesList || []).find(m => m.month === month);
    if (!m) return;

    const perCapita = Number(m.perCapita || 0);
    console.info('[REPASSE][FOR_EACH][recalculate.localidades]', { count: m.localidades?.length });
    (m.localidades || []).forEach(loc => {
      const prfTotal = Number(loc.prfTotal || 0);
      const filiadosAtivos = Number(loc.filiadosAtivos || 0);

      if (prfTotal > 0) {
        loc.percentual = (filiadosAtivos / prfTotal) * 100;
        const base = filiadosAtivos * perCapita;
        let factor = 0;
        if (loc.percentual >= 90) factor = 1.0;
        else if (loc.percentual >= 80) factor = 0.7;
        else if (loc.percentual >= 70) factor = 0.4;
        loc.creditoMes = base * factor;
      } else {
        loc.percentual = null;
        loc.creditoMes = 0;
      }
    });

    console.info('[REPASSE][REDUCE][totalRepasseMes]');
    m.totalRepasseMes = (m.localidades || []).reduce((acc, l) => acc + Number(l.creditoMes || 0), 0);

    const lotacoes = ["SEDE", "DEL 01 - Viana", "DEL 02 - Serra", "DEL 03 - Guarapari", "DEL 04 - Linhares"];
    const acumulados: any = {};
    console.info('[REPASSE][FOR_EACH][lotacoes]');
    lotacoes.forEach(lot => {
      let somaCred = 0;
      let somaReem = 0;
      console.info(`[REPASSE][FOR_EACH][mesesList] for lotacao ${lot}`);
      (mesesList || []).forEach(mes => {
        const l = (mes.localidades || []).find(ll => ll.lotacao === lot);
        if (l) {
            somaCred += Number(l.creditoMes || 0);
            somaReem += Number(l.reembolsoMes || 0);
        }
      });
      acumulados[lot] = somaCred - somaReem;
    });

    console.info('[REPASSE][FOR_EACH][mesesList] update acumuladoAno');
    (mesesList || []).forEach(mes => {
      (mes.localidades || []).forEach(l => {
        l.acumuladoAno = Number(acumulados[l.lotacao] || 0);
      });
    });

    console.info('[REPASSE][REDUCE][totalAcumuladoGeral]');
    setTotalAcumuladoGeral(Object.values(acumulados).reduce((acc: any, curr: any) => acc + Number(curr || 0), 0) as number);
  };

  const handleSaveMonth = async (month: number) => {
    const m = meses.find(ms => ms.month === month);
    if (!m) return;

    try {
      setLoading(true);
      console.info('[REPASSE][MAP][handleSaveMonth.localidades]');
      await repasseService.updateRepasseMes(
        year,
        month,
        m.perCapita,
        (m.localidades || []).map(l => ({
          lotacaoKey: l.lotacao,
          responsavelId: l.responsavelId,
          prfTotal: l.prfTotal,
          reembolsoMes: l.reembolsoMes
        }))
      );
      Alert.alert('Sucesso', `Dados de ${nomesMeses[month - 1]} salvos.`);
      fetchData();
    } catch (err) {
      Alert.alert('Erro', 'Falha ao salvar dados.');
    } finally {
      setLoading(false);
    }
  };

  const getPercentColor = (percent: number | null | undefined) => {
    if (percent == null || !Number.isFinite(percent)) return '#888';
    if (percent < 70) return '#c62828';
    if (percent < 80) return '#fcc419';
    return '#2e7d32';
  };


  if (loading && meses.length === 0) {
    console.info('[REPASSE][RENDER] Loading state active');
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;
  }

  if (!meses) {
    console.warn('[REPASSE][RENDER] meses indefinido');
    return <View style={styles.centered}><Text>Carregando repasse...</Text></View>;
  }

  bc('render:start', { selectedYear: year, mesesLen: meses?.length, totalType: typeof totalAcumuladoGeral });

  return (
    <SafeScreen style={styles.container}>
      <RepasseErrorBoundary breadcrumbs={breadcrumbsRef.current}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>💱 Repasse Mensal</Text>
              <Text style={styles.subtitle}>Gestão de créditos por localidade</Text>
            </View>
            <View style={styles.yearPickerWrapper}>
              <Picker
                selectedValue={year}
                onValueChange={(v) => setYear(v)}
                style={styles.yearPicker}
                mode="dropdown"
                dropdownIconColor="#003366"
              >
                {[year, year - 1, year - 2].map(y => (
                  <Picker.Item key={y} label={String(y)} value={y} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Total Acumulado Geral ({year})</Text>
            <Text style={styles.statsValue}>{formatCurrency(totalAcumuladoGeral)}</Text>
          </View>

          {meses.length === 0 && !loading && (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="cash-off" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Nenhum dado de repasse encontrado para o ano de {year}.</Text>
            </View>
          )}

          {(() => {
            bc('render:list:meses', { mesesLen: meses.length });

            if (!Array.isArray(meses)) {
              return null;
            }

            return meses.map((m) => (
              <View key={m.month} style={styles.monthCard}>
                <TouchableOpacity
                  style={styles.monthHeader}
                  onPress={() => setExpandedMonth(expandedMonth === m.month ? null : m.month)}
                >
                  <View style={styles.monthHeaderLeft}>
                    <Text style={styles.monthName}>{nomesMeses[m.month - 1] || `Mês ${m.month}`}</Text>
                    <Text style={styles.monthCapita}>Per Capita: {formatCurrency(m.perCapita)}</Text>
                  </View>
                  <View style={styles.monthHeaderRight}>
                    <Text style={styles.monthTotal}>{formatCurrency(m.totalRepasseMes)}</Text>
                    <MaterialCommunityIcons
                      name={expandedMonth === m.month ? 'chevron-up' : 'chevron-down'}
                      size={24}
                      color="#003366"
                    />
                  </View>
                </TouchableOpacity>

                {expandedMonth === m.month && (
                  <View style={styles.monthDetails}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Per Capita do Mês</Text>
                      <TextInput
                        style={styles.input}
                        value={String(m.perCapita)}
                        keyboardType="numeric"
                        onChangeText={(v) => handleUpdatePerCapita(m.month, v)}
                      />
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                      <View style={styles.tableContainer}>
                        <View style={styles.tableHeader}>
                          <View style={[styles.tableHeaderCell, { width: 130 }]}><Text style={styles.tableHeaderText}>Lotação</Text></View>
                          {ehGestao && <View style={[styles.tableHeaderCell, { width: 200 }]}><Text style={styles.tableHeaderText}>Responsável</Text></View>}
                          <View style={[styles.tableHeaderCell, { width: 70 }]}><Text style={styles.tableHeaderText}>Ativos</Text></View>
                          <View style={[styles.tableHeaderCell, { width: 90 }]}><Text style={styles.tableHeaderText}>PRF Total</Text></View>
                          <View style={[styles.tableHeaderCell, { width: 60 }]}><Text style={styles.tableHeaderText}>%</Text></View>
                          <View style={[styles.tableHeaderCell, { width: 110 }]}><Text style={styles.tableHeaderText}>Crédito Mês</Text></View>
                          <View style={[styles.tableHeaderCell, { width: 110 }]}><Text style={styles.tableHeaderText}>Reembolso</Text></View>
                          <View style={[styles.tableHeaderCell, { width: 120 }]}><Text style={styles.tableHeaderText}>Acumulado Ano</Text></View>
                        </View>

                        {(() => {
                          bc('render:list:localidades', { month: m.month, locLen: m.localidades?.length });

                          if (!Array.isArray(m.localidades)) {
                            return null;
                          }

                          return m.localidades.map((loc, idx) => (
                            <View
                              key={loc.lotacao}
                              style={[
                                styles.tableRow,
                                idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd
                              ]}
                            >
                              <View style={[styles.tableCell, { width: 130 }]}><Text style={[styles.valueCell, { fontWeight: 'bold' }]}>{String(loc.lotacao || '—')}</Text></View>

                              {ehGestao && (
                                <View style={[styles.tableCell, { width: 200 }]}>
                                  <View style={styles.pickerWrapperCell}>
                                    <Picker
                                      selectedValue={loc.responsavelId}
                                      onValueChange={(v) => handleUpdateLocalidade(m.month, loc.lotacao, 'responsavelId', v)}
                                      style={styles.pickerCell}
                                      mode="dropdown"
                                      dropdownIconColor="#003366"
                                    >
                                      <Picker.Item label="Selecione..." value={null} />
                                      {(() => {
                                        const kw = LOTACAO_KEYWORDS[loc.lotacao];
                                        const respList = (responsaveis || []);

                                        let filtered = respList.filter(r => {
                                          if (!kw || !r.lotacao) return true;
                                          return normalizeLocalidade(r.lotacao).includes(kw);
                                        });

                                        if (filtered.length === 0 && respList.length > 0) {
                                          bc('REPASSE_RESP_FILTER_FALLBACK', { lotacao: loc.lotacao });
                                          filtered = respList;
                                        }

                                        return filtered.map(r => (
                                          <Picker.Item key={r.id} label={r.nome} value={r.id} />
                                        ));
                                      })()}
                                    </Picker>
                                  </View>
                                </View>
                              )}

                              <View style={[styles.tableCell, { width: 70 }]}><Text style={styles.valueCell}>{Number(loc.filiadosAtivos || 0)}</Text></View>

                              <View style={[styles.tableCell, { width: 90 }]}>
                                {ehGestao ? (
                                  <TextInput
                                    style={styles.inputCell}
                                    value={String(loc.prfTotal || 0)}
                                    keyboardType="numeric"
                                    onChangeText={(v) => handleUpdateLocalidade(m.month, loc.lotacao, 'prfTotal', v)}
                                  />
                                ) : (
                                  <Text style={styles.valueCell}>{Number(loc.prfTotal || 0)}</Text>
                                )}
                              </View>

                              <View style={[styles.tableCell, { width: 60 }]}>
                                <Text style={[styles.valueCell, { color: getPercentColor(loc.percentual), fontWeight: 'bold' }]}>
                                  {(loc.percentual == null || !Number.isFinite(loc.percentual)) ? '—' : `${Number(loc.percentual).toFixed(1)}%`}
                                </Text>
                              </View>

                              <View style={[styles.tableCell, { width: 110 }]}><Text style={[styles.valueCell, { fontWeight: 'bold' }]}>{formatCurrency(loc.creditoMes)}</Text></View>

                              <View style={[styles.tableCell, { width: 110 }]}>
                                {ehGestao ? (
                                  <TextInput
                                    style={styles.inputCell}
                                    value={String(loc.reembolsoMes || 0)}
                                    keyboardType="numeric"
                                    onChangeText={(v) => handleUpdateLocalidade(m.month, loc.lotacao, 'reembolsoMes', v)}
                                  />
                                ) : (
                                  <Text style={styles.valueCell}>{formatCurrency(loc.reembolsoMes)}</Text>
                                )}
                              </View>

                              <View style={[styles.tableCell, { width: 120 }]}><Text style={[styles.valueCell, { color: '#e67e22', fontWeight: 'bold' }]}>{formatCurrency(loc.acumuladoAno)}</Text></View>
                            </View>
                          ));
                        })()}
                      </View>
                    </ScrollView>

                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={() => handleSaveMonth(m.month)}
                    >
                      <Text style={styles.saveButtonText}>Salvar {nomesMeses[m.month - 1]}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ));
          })()}
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </RepasseErrorBoundary>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 15 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#003366' },
  subtitle: { fontSize: 13, color: '#666' },
  yearPickerWrapper: { backgroundColor: '#fff', borderRadius: 8, width: 150, flexShrink: 0, elevation: 2 },
  yearPicker: { height: 52 },
  statsCard: { backgroundColor: '#003366', padding: 20, borderRadius: 12, marginBottom: 20, elevation: 4 },
  statsLabel: { color: '#fff', opacity: 0.8, fontSize: 13, marginBottom: 5 },
  statsValue: { color: '#ffc107', fontSize: 24, fontWeight: 'bold' },
  monthCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, elevation: 2, overflow: 'hidden' },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  monthHeaderLeft: { flex: 1 },
  monthName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  monthCapita: { fontSize: 12, color: '#777', marginTop: 2 },
  monthHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthTotal: { fontSize: 15, fontWeight: 'bold', color: '#003366' },
  monthDetails: { padding: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 5 },
  input: { backgroundColor: '#f9f9f9', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#ddd', fontSize: 16 },
  saveButton: { backgroundColor: '#003366', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 20 },
  emptyText: { color: '#999', fontSize: 16, textAlign: 'center', marginTop: 10 },

  tableContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f3f5',
    borderBottomWidth: 2,
    borderBottomColor: '#ccc',
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  tableHeaderText: {
    fontWeight: 'bold',
    color: '#003366',
    fontSize: 11,
    textAlign: 'center',
    textTransform: 'uppercase'
  },
  tableHeaderCell: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#ccc',
    minHeight: 44
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableRowEven: { backgroundColor: '#fff' },
  tableRowOdd: { backgroundColor: '#f8f9fa' },
  tableCell: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#ccc',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    minHeight: 52
  },
  valueCell: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center'
  },
  inputCell: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 6,
    padding: 4,
    fontSize: 12,
    width: '95%',
    textAlign: 'center',
    height: 36
  },
  pickerWrapperCell: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 6,
    width: '95%',
    height: 52,
    justifyContent: 'center'
  },
  pickerCell: {
    color: '#333',
    height: 52
  },
});
