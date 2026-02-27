import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import SafeScreen from '../components/SafeScreen';
import { PickerSafe } from '../components/PickerSafe';
import repasseService, { RepasseEvento, RepasseResumo, Responsavel } from '../services/repasseService';
import { useAuth } from '../hooks/useAuth';
import { formatDateToDdMmYyyy, formatISOToBR, toISODate } from '../utils/date';

const MIN_YEAR = 2026;

export default function RepasseScreen() {
  const { usuario } = useAuth();
  const ehGestao = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes((usuario?.perfil_acesso || '').toUpperCase());
  const initialYear = Math.max(new Date().getFullYear(), MIN_YEAR);

  const [year, setYear] = useState(initialYear);
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState<RepasseResumo | null>(null);
  const [eventosAbertos, setEventosAbertos] = useState<RepasseEvento[]>([]);
  const [alocacoesExpanded, setAlocacoesExpanded] = useState(false);

  const [queryResp, setQueryResp] = useState('');
  const [allResponsaveisCache, setAllResponsaveisCache] = useState<Responsavel[] | null>(null);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [eventoForm, setEventoForm] = useState({
    titulo: '',
    responsavel_filiado_id: null as number | null,
    data_evento: '',
    data_limite_alocacao: '',
    status: 'RASCUNHO',
    descricao: '',
  });

  const years = useMemo(() => {
    const end = Math.max(initialYear, year) + 5;
    const arr = [];
    for (let y = MIN_YEAR; y <= end; y++) arr.push(y);
    return arr;
  }, [initialYear, year]);

  const formatCurrency = (v: number | string | null | undefined) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

  const formatSituacaoLabel = (situacao?: string) => {
    const val = String(situacao || '').toUpperCase();
    if (val === 'VETERANO') return 'Veterano';
    if (val === 'ATIVO') return 'Ativo';
    return situacao || 'Não informado';
  };

  const loadResponsaveis = useCallback(async (q = '') => {
    if (!ehGestao) return;

    let baseList = allResponsaveisCache;
    if (!baseList) {
      baseList = await repasseService.listarResponsaveis('');
      setAllResponsaveisCache(baseList);
    }

    if (q && q.length >= 2) {
      const termo = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const apenasDigitos = q.replace(/\D/g, "");

      const filtered = baseList.filter(f => {
        const nomeNorm = f.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const matchesNome = nomeNorm.includes(termo);
        const cpfDigits = (f.cpf || "").replace(/\D/g, "");
        const matchesCpf = apenasDigitos && cpfDigits.includes(apenasDigitos);
        return matchesNome || matchesCpf;
      });
      setResponsaveis(filtered);
    } else {
      setResponsaveis(baseList);
    }
  }, [ehGestao, allResponsaveisCache]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resumoResp, eventosResp] = await Promise.all([
        repasseService.getResumo(year),
        repasseService.listarEventos(year, 'ABERTO'),
      ]);
      setResumo(resumoResp);
      setEventosAbertos(eventosResp);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar os dados de repasse.');
      setResumo(null);
      setEventosAbertos([]);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const id = setTimeout(() => {
      loadResponsaveis(queryResp);
    }, 250);
    return () => clearTimeout(id);
  }, [loadResponsaveis, queryResp]);

  const criarEvento = async () => {
    if (!eventoForm.titulo || !eventoForm.data_evento || !eventoForm.data_limite_alocacao) {
      Alert.alert('Validação', 'Preencha título, data do evento e data limite.');
      return;
    }
    try {
      const payload = {
        ...eventoForm,
        data_evento: toISODate(eventoForm.data_evento) || '',
        data_limite_alocacao: toISODate(eventoForm.data_limite_alocacao) || '',
      };
      await repasseService.criarEvento(payload);
      Alert.alert('Sucesso', 'Evento cadastrado com sucesso.');
      setEventoForm({ titulo: '', responsavel_filiado_id: null, data_evento: '', data_limite_alocacao: '', status: 'RASCUNHO', descricao: '' });
      await loadData();
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.message || 'Erro ao cadastrar evento.');
    }
  };

  const alocarMeuRecurso = async (eventoId: number) => {
    try {
      await repasseService.alocarMeuRecurso(eventoId);
      Alert.alert('Sucesso', 'Recurso alocado com sucesso.');
      await loadData();
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.message || 'Falha ao alocar recurso.');
    }
  };

  return (
    <SafeScreen style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.mainCard}>
            <Text style={styles.title}>Repasse</Text>
            <Text style={styles.subtitle}>Ano {year} • Apoio operacional e alocações</Text>

            <View style={styles.yearRow}>
              <PickerSafe
                label="Ano"
                labelStyle={styles.yearLabel}
                selectedValue={year}
                onValueChange={(v) => setYear(Number(v))}
                mode="dropdown"
                items={years.map((y) => ({ label: String(y), value: y }))}
                containerStyle={{ flex: 1 }}
              />
            </View>

            {loading && <ActivityIndicator color="#0b3a67" style={{ marginVertical: 16 }} />}

            {!loading && resumo && (
              <>
                {ehGestao && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Cadastrar evento (gestão)</Text>
                    <TextInput style={styles.input} placeholder="Título" value={eventoForm.titulo} onChangeText={(v) => setEventoForm((p) => ({ ...p, titulo: v }))} />
                    <TextInput
                      style={styles.input}
                      placeholder="Buscar responsável por nome ou lotação"
                      value={queryResp}
                      onChangeText={setQueryResp}
                    />
                    <PickerSafe
                      selectedValue={eventoForm.responsavel_filiado_id}
                      onValueChange={(v) => setEventoForm((p) => ({ ...p, responsavel_filiado_id: v as number | null }))}
                      mode="dropdown"
                      items={[
                        { label: 'Selecione...', value: null },
                        ...responsaveis.map((r) => ({
                          label: `${r.nome} (${formatSituacaoLabel(r.situacao)})`,
                          value: r.id,
                        })),
                      ]}
                    />
                    {responsaveis.length === 0 && queryResp.trim().length > 0 && (
                      <Text style={styles.emptyPickerText}>Nenhum filiado encontrado.</Text>
                    )}
                    <TextInput
                      style={styles.input}
                      placeholder="Data do evento (DD/MM/AAAA)"
                      value={eventoForm.data_evento}
                      onChangeText={(v) => setEventoForm((p) => ({ ...p, data_evento: formatDateToDdMmYyyy(v) }))}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Data limite (DD/MM/AAAA)"
                      value={eventoForm.data_limite_alocacao}
                      onChangeText={(v) => setEventoForm((p) => ({ ...p, data_limite_alocacao: formatDateToDdMmYyyy(v) }))}
                      keyboardType="numeric"
                    />
                    <TextInput style={styles.input} placeholder="Descrição" value={eventoForm.descricao} onChangeText={(v) => setEventoForm((p) => ({ ...p, descricao: v }))} />
                    <TouchableOpacity style={styles.primaryBtn} onPress={criarEvento}><Text style={styles.primaryBtnText}>Cadastrar evento</Text></TouchableOpacity>
                  </View>
                )}

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Apoio operacional por lotação</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator>
                    <View>
                      <View style={styles.tableHeader}>
                        <View style={[styles.tableHeaderCellContainer, { width: 170 }]}><Text style={styles.tableHeaderText}>Lotação</Text></View>
                        <View style={[styles.tableHeaderCellContainer, { width: 70 }]}><Text style={styles.tableHeaderText}>Ativos</Text></View>
                        <View style={[styles.tableHeaderCellContainer, { width: 130 }]}><Text style={[styles.tableHeaderText, styles.textRight]}>Crédito</Text></View>
                        <View style={[styles.tableHeaderCellContainer, { width: 130 }]}><Text style={[styles.tableHeaderText, styles.textRight]}>Débitos</Text></View>
                        <View style={[styles.tableHeaderCellContainer, { width: 130 }]}><Text style={[styles.tableHeaderText, styles.textRight]}>Saldo</Text></View>
                      </View>
                      {resumo.apoioPorLotacao.map((row, idx) => {
                        const semLotacao = row.lotacao === 'SEM LOTAÇÃO';
                        return (
                          <View key={row.lotacao} style={[styles.tableRow, idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd, semLotacao && styles.semLotacao]}>
                            <View style={[styles.tableCellContainer, { width: 170 }]}><Text style={[styles.tableCell, { fontWeight: semLotacao ? '700' : '500' }]}>{row.lotacao}</Text></View>
                            <View style={[styles.tableCellContainer, { width: 70 }]}><Text style={styles.tableCell}>{row.qtdAtivos}</Text></View>
                            <View style={[styles.tableCellContainer, { width: 130 }]}><Text style={[styles.tableCell, styles.textRight]}>{formatCurrency(row.creditoApoioOperacional)}</Text></View>
                            <View style={[styles.tableCellContainer, { width: 130 }]}><Text style={[styles.tableCell, styles.textRight]}>{formatCurrency(row.debitosApoioOperacional)}</Text></View>
                            <View style={[styles.tableCellContainer, { width: 130 }]}><Text style={[styles.tableCell, styles.textRight, { fontWeight: '700' }]}>{formatCurrency(row.saldoApoioOperacional)}</Text></View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                <View style={[styles.card, styles.highlightCard]}>
                  <Text style={styles.cardTitle}>Recurso não alocado</Text>
                  <Text style={styles.highlightValue}>{formatCurrency(resumo.recursoNaoAlocadoTotal)}</Text>
                </View>

                <View style={styles.card}>
                  <Text style={[styles.cardTitle, { textAlign: 'center' }]}>Alocações por evento</Text>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setAlocacoesExpanded((v) => !v)}>
                    <Text style={styles.secondaryBtnText}>{alocacoesExpanded ? 'Ocultar alocações' : 'Mostrar alocações'}</Text>
                  </TouchableOpacity>

                  {alocacoesExpanded && resumo.alocacoesPorEvento.map((grupo) => (
                    <View key={grupo.evento.id} style={styles.eventBox}>
                      <Text style={styles.eventTitle}>{grupo.evento.titulo}</Text>
                      <Text style={styles.eventMeta}>Evento: {formatISOToBR(grupo.evento.data_evento)} • Limite: {formatISOToBR(grupo.evento.data_limite_alocacao)}</Text>
                      <Text style={styles.eventTotal}>Total alocado: {formatCurrency(grupo.totalAlocado)}</Text>
                      {grupo.itens.length === 0 ? <Text style={styles.itemText}>Sem alocações.</Text> : grupo.itens.map((i) => (
                        <Text key={`${grupo.evento.id}-${i.filiado_id}`} style={styles.itemText}>• {i.nome} ({i.situacao}) — {formatCurrency(i.valorAlocado)}</Text>
                      ))}
                    </View>
                  ))}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Alocar meu recurso</Text>
                  {eventosAbertos.length === 0 ? (
                    <Text style={styles.itemText}>Sem eventos abertos no momento.</Text>
                  ) : (
                    eventosAbertos.map((e) => (
                      <TouchableOpacity key={e.id} style={styles.listBtn} onPress={() => alocarMeuRecurso(e.id)}>
                        <Text style={styles.listBtnText}>{e.titulo} • limite {formatISOToBR(e.data_limite_alocacao)}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#edf1f5' },
  container: { padding: 14 },
  mainCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  title: { textAlign: 'center', fontSize: 28, fontWeight: '700', color: '#0b3a67' },
  subtitle: { textAlign: 'center', color: '#5a6f82', marginBottom: 10 },
  yearRow: { marginBottom: 12 },
  yearLabel: { color: '#0b3a67', fontWeight: '700' },
  card: { backgroundColor: '#f9fbfd', borderRadius: 12, borderWidth: 1, borderColor: '#dce4ec', padding: 12, marginBottom: 12 },
  cardTitle: { color: '#0b3a67', fontWeight: '700', marginBottom: 8, fontSize: 16 },
  highlightCard: { borderLeftWidth: 4, borderLeftColor: '#0b8f6a' },
  highlightValue: { fontSize: 24, fontWeight: '700', color: '#0b3a67' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cfd8e3', borderRadius: 8, padding: 10, marginBottom: 8 },
  emptyPickerText: { fontSize: 12, color: '#6b7c8c', marginTop: 4 },
  primaryBtn: { backgroundColor: '#0b3a67', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 6 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { borderWidth: 1, borderColor: '#0b3a67', borderRadius: 8, padding: 8, alignItems: 'center' },
  secondaryBtnText: { color: '#0b3a67', fontWeight: '700' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#e8eef5', borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cfd8e3' },
  tableHeaderText: { fontSize: 11, color: '#0b3a67', fontWeight: '700', textTransform: 'uppercase' },
  tableHeaderCellContainer: {
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#cfd8e3',
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tableRow: { flexDirection: 'row', borderLeftWidth: 1, borderColor: '#dbe3ec' },
  tableRowEven: { backgroundColor: '#fff' },
  tableRowOdd: { backgroundColor: '#f7f9fb' },
  tableCellContainer: {
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#dbe3ec',
    minHeight: 52,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tableCell: { fontSize: 12, color: '#223243' },
  textRight: { textAlign: 'right' },
  semLotacao: { backgroundColor: '#fff5da' },
  eventBox: { borderWidth: 1, borderColor: '#dce4ec', borderRadius: 10, padding: 10, marginTop: 8, backgroundColor: '#fff' },
  eventTitle: { color: '#0b3a67', fontWeight: '700' },
  eventMeta: { fontSize: 12, color: '#677788', marginVertical: 3 },
  eventTotal: { fontSize: 13, fontWeight: '700', color: '#0b8f6a', marginBottom: 4 },
  itemText: { fontSize: 13, color: '#314354' },
  listBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cfd8e3', borderRadius: 8, padding: 10, marginTop: 8 },
  listBtnText: { color: '#0b3a67', fontWeight: '600' },
});
