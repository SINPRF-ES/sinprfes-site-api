import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import SafeScreen from '../components/SafeScreen';
import { PickerSafe } from '../components/PickerSafe';
import repasseService, { RepasseEvento, RepasseMovimento, RepasseResumo, Responsavel } from '../services/repasseService';
import { useAuth } from '../hooks/useAuth';
import { formatDateToDdMmYyyy, formatISOToBR, toISODate } from '../utils/date';
import { formatCentavosBRL, sanitizeToCentavos } from '../shared/format/formatters';

const MIN_YEAR = 2026;
const AUTO_POLL_INTERVAL_MS = 30000;

type RepasseResumoLike = RepasseResumo & {
  totalNaoAlocado?: number;
  alocacoes?: Array<{ eventoId: number; valorAlocado: number }>;
};

type RepasseEventoLike = RepasseEvento & {
  valor_total_alocado?: number;
};

type RepasseMovimentoLike = RepasseMovimento & {
  updated_at?: string;
};

export default function RepasseScreen() {
  const { usuario } = useAuth();
  const ehGestao = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes((usuario?.perfil_acesso || '').toUpperCase());
  const initialYear = Math.max(new Date().getFullYear(), MIN_YEAR);

  const [year, setYear] = useState(initialYear);
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState<RepasseResumo | null>(null);
  const [eventosAbertos, setEventosAbertos] = useState<RepasseEvento[]>([]);
  const [eventosTodos, setEventosTodos] = useState<RepasseEvento[]>([]);
  const [alocacoesExpanded, setAlocacoesExpanded] = useState(false);

  // Débitos
  const [modalDebitoVisible, setModalDebitoVisible] = useState(false);
  const [selectedLotacao, setSelectedLotacao] = useState('');
  const [debitoForm, setDebitoForm] = useState({ valorCentavos: '0', observacao: '' });

  const [modalListaVisible, setModalListaVisible] = useState(false);
  const [movimentos, setMovimentos] = useState<RepasseMovimento[]>([]);

  const [modalEditVisible, setModalEditVisible] = useState(false);
  const [editForm, setEditForm] = useState({ id: 0, valorCentavos: '0', observacao: '' });
  const [deleteForm, setDeleteForm] = useState({ id: 0, justificativa: '' });
  const [modalDeleteVisible, setModalDeleteVisible] = useState(false);
  const [modalDeleteEventoVisible, setModalDeleteEventoVisible] = useState(false);
  const [deleteEventoId, setDeleteEventoId] = useState(0);
  const [deleteEventoJustificativa, setDeleteEventoJustificativa] = useState('');
  const [modalCancelAlocacaoVisible, setModalCancelAlocacaoVisible] = useState(false);
  const [cancelAlocacaoForm, setCancelAlocacaoForm] = useState({ eventoId: 0, filiadoId: 0, nome: '', justificativa: '', gestao: false });
  const [isFocusedScreen, setIsFocusedScreen] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);
  const lastResumoSignatureRef = useRef<string>('');
  const lastEventosSignatureRef = useRef<string>('');
  const lastMovimentosSignatureRef = useRef<string>('');

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

  const valorBackendToCentavos = (mov: RepasseMovimento) => {
    if (mov.valor_centavos !== undefined && mov.valor_centavos !== null) return sanitizeToCentavos(String(mov.valor_centavos));
    if (mov.valorCentavos !== undefined && mov.valorCentavos !== null) return sanitizeToCentavos(String(mov.valorCentavos));
    return sanitizeToCentavos(String(Math.round(Number(mov.valor || 0) * 100)));
  };

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

  const makeResumoSignature = (value: RepasseResumoLike | null) => {
    if (!value) return '';
    return JSON.stringify({
      totalNaoAlocado: value.totalNaoAlocado,
      lotacoes: (value.apoioPorLotacao || []).map((r) => [r.lotacao, r.qtdAtivos, r.creditoApoioOperacional, r.debitosApoioOperacional, r.saldoApoioOperacional]),
      alocacoes: (value.alocacoes || []).map((a: { eventoId: number; valorAlocado: number }) => [a.eventoId, a.valorAlocado]),
    });
  };

  const makeEventosSignature = (value: RepasseEventoLike[]) => JSON.stringify((value || []).map((e) => [e.id, e.titulo, e.status, e.valor_total_alocado]));
  const makeMovimentosSignature = (value: RepasseMovimentoLike[]) => JSON.stringify((value || []).map((m) => [m.id, m.updated_at || m.created_at, m.valor_centavos ?? m.valorCentavos ?? m.valor, m.observacao]));

  const loadData = useCallback(async (showLoading = true) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const [resumoResp, eventosResp, todosResp] = await Promise.all([
        repasseService.getResumo(year),
        repasseService.listarEventos(year, 'ABERTO'),
        repasseService.listarEventos(year, undefined, ehGestao),
      ]);
      const resumoSignature = makeResumoSignature(resumoResp);
      const eventosSignature = makeEventosSignature(eventosResp);

      if (resumoSignature !== lastResumoSignatureRef.current) {
        lastResumoSignatureRef.current = resumoSignature;
        setResumo(resumoResp);
      }
      if (eventosSignature !== lastEventosSignatureRef.current) {
        lastEventosSignatureRef.current = eventosSignature;
        setEventosAbertos(eventosResp);
      }
      setEventosTodos(todosResp || []);
    } catch (error) {
      if (showLoading) {
        Alert.alert('Erro', 'Não foi possível carregar os dados de repasse.');
        setResumo(null);
        setEventosAbertos([]);
        setEventosTodos([]);
      }
    } finally {
      if (showLoading) setLoading(false);
      isFetchingRef.current = false;
    }
  }, [year]);

  const refreshListaIfOpen = useCallback(async () => {
    if (!modalListaVisible || !selectedLotacao) return;
    try {
      const list = await repasseService.listarMovimentos(year, selectedLotacao);
      const sig = makeMovimentosSignature(list);
      if (sig !== lastMovimentosSignatureRef.current) {
        lastMovimentosSignatureRef.current = sig;
        setMovimentos(list);
      }
    } catch (_error) {
      // noop
    }
  }, [modalListaVisible, selectedLotacao, year]);

  const refreshNow = useCallback(async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
    await loadData(showLoading);
    await refreshListaIfOpen();
  }, [loadData, refreshListaIfOpen]);

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
    if (!ehGestao) {
      Alert.alert('Acesso restrito', 'Ação permitida apenas para gestão.');
      return;
    }
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
      await refreshNow({ showLoading: false });
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.message || 'Erro ao cadastrar evento.');
    }
  };

  const alocarMeuRecurso = async (eventoId: number) => {
    try {
      await repasseService.alocarMeuRecurso(eventoId);
      Alert.alert('Sucesso', 'Recurso alocado com sucesso.');
      await refreshNow({ showLoading: false });
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.message || 'Falha ao alocar recurso.');
    }
  };

  const abrirRetiradaMinhaAlocacao = (eventoId: number) => {
    setCancelAlocacaoForm({ eventoId, filiadoId: Number(usuario?.id || 0), nome: usuario?.nome || 'Meu recurso', justificativa: '', gestao: false });
    setModalCancelAlocacaoVisible(true);
  };

  const abrirRetiradaGestaoAlocacao = (eventoId: number, filiadoId: number, nome: string) => {
    if (!ehGestao) return;
    setCancelAlocacaoForm({ eventoId, filiadoId, nome, justificativa: '', gestao: true });
    setModalCancelAlocacaoVisible(true);
  };

  const confirmarRetiradaAlocacao = async () => {
    const justificativa = cancelAlocacaoForm.justificativa.trim();
    if (justificativa.length < 5) return;

    try {
      if (cancelAlocacaoForm.gestao) {
        await repasseService.retirarAlocacaoGestao(cancelAlocacaoForm.eventoId, { filiado_id: cancelAlocacaoForm.filiadoId, justificativa });
      } else {
        await repasseService.retirarMinhaAlocacao(cancelAlocacaoForm.eventoId, { justificativa });
      }
      setModalCancelAlocacaoVisible(false);
      Alert.alert('Sucesso', 'Alocação retirada com sucesso.');
      await refreshNow({ showLoading: false });
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.message || 'Falha ao retirar alocação.');
    }
  };

  const editarEventoGestao = async (evento: RepasseEvento) => {
    if (!ehGestao) return;
    try {
      await repasseService.atualizarEvento(evento.id, { status: evento.status === 'ABERTO' ? 'ENCERRADO' : 'ABERTO' });
      Alert.alert('Sucesso', 'Evento atualizado.');
      await refreshNow({ showLoading: false });
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.message || 'Falha ao atualizar evento.');
    }
  };

  const excluirEventoGestao = (eventoId: number) => {
    if (!ehGestao) return;
    setDeleteEventoId(eventoId);
    setDeleteEventoJustificativa('');
    setModalDeleteEventoVisible(true);
  };

  const confirmarExclusaoEvento = async () => {
    const justificativa = deleteEventoJustificativa.trim();
    if (justificativa.length < 5) return;
    try {
      await repasseService.excluirEvento(deleteEventoId, { justificativa });
      setModalDeleteEventoVisible(false);
      Alert.alert('Sucesso', 'Evento excluído.');
      await refreshNow({ showLoading: false });
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.message || 'Falha ao excluir evento.');
    }
  };

  const abrirLancarDebito = (lot: string) => {
    if (!ehGestao) {
      Alert.alert('Acesso restrito', 'Ação permitida apenas para gestão.');
      return;
    }
    setSelectedLotacao(lot);
    setDebitoForm({ valorCentavos: '0', observacao: '' });
    setModalDebitoVisible(true);
  };

  const salvarDebito = async () => {
    if (!ehGestao) {
      Alert.alert('Acesso restrito', 'Ação permitida apenas para gestão.');
      return;
    }
    const valorCentavos = Number(sanitizeToCentavos(debitoForm.valorCentavos));
    if (!Number.isFinite(valorCentavos) || valorCentavos <= 0) {
      Alert.alert('Validação', 'Informe um valor válido maior que zero.');
      return;
    }
    if (debitoForm.observacao.length < 3) {
      Alert.alert('Validação', 'Informe uma observação (mínimo 3 caracteres).');
      return;
    }

    try {
      await repasseService.criarMovimento({
        ano_ref: year,
        lotacao_id: selectedLotacao,
        valor_centavos: valorCentavos,
        observacao: debitoForm.observacao,
      });
      setModalDebitoVisible(false);
      Alert.alert('Sucesso', 'Débito lançado com sucesso.');
      await refreshNow();
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.message || 'Erro ao salvar débito.');
    }
  };

  const abrirVerDebitos = async (lot: string) => {
    if (!ehGestao) {
      Alert.alert('Acesso restrito', 'Ação permitida apenas para gestão.');
      return;
    }
    setSelectedLotacao(lot);
    setLoading(true);
    try {
      const list = await repasseService.listarMovimentos(year, lot);
      const sig = makeMovimentosSignature(list);
      lastMovimentosSignatureRef.current = sig;
      setMovimentos(list);
      setModalListaVisible(true);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar os débitos.');
    } finally {
      setLoading(false);
    }
  };

  const abrirEditarDebito = (mov: RepasseMovimento) => {
    setEditForm({ id: mov.id, valorCentavos: valorBackendToCentavos(mov), observacao: mov.observacao });
    setModalEditVisible(true);
  };

  const atualizarDebito = async () => {
    if (!ehGestao) {
      Alert.alert('Acesso restrito', 'Ação permitida apenas para gestão.');
      return;
    }
    const valorCentavos = Number(sanitizeToCentavos(editForm.valorCentavos));
    if (!Number.isFinite(valorCentavos) || valorCentavos <= 0) {
      Alert.alert('Validação', 'Informe um valor válido maior que zero.');
      return;
    }
    if (editForm.observacao.length < 3) {
      Alert.alert('Validação', 'Informe uma observação (mínimo 3 caracteres).');
      return;
    }

    try {
      await repasseService.atualizarMovimento(editForm.id, {
        valor_centavos: valorCentavos,
        observacao: editForm.observacao,
      });
      setModalEditVisible(false);
      setModalListaVisible(false);
      Alert.alert('Sucesso', 'Débito atualizado.');
      await refreshNow();
      await abrirVerDebitos(selectedLotacao);
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.message || 'Erro ao atualizar débito.');
    }
  };

  const abrirExcluirDebito = (mov: RepasseMovimento) => {
    setDeleteForm({ id: mov.id, justificativa: '' });
    setModalDeleteVisible(true);
  };

  const excluirDebito = async () => {
    if (!ehGestao) {
      Alert.alert('Acesso restrito', 'Ação permitida apenas para gestão.');
      return;
    }
    const justificativa = deleteForm.justificativa.trim();
    if (justificativa.length < 5) return;

    try {
      const deletedId = deleteForm.id;
      setMovimentos((prev) => prev.filter((m) => m.id !== deletedId));
      await repasseService.excluirMovimento(deletedId, { justificativa });
      setModalDeleteVisible(false);
      Alert.alert('Sucesso', 'Débito excluído.');
      await refreshNow();
      await abrirVerDebitos(selectedLotacao);
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.message || 'Erro ao excluir débito.');
    }
  };

  useFocusEffect(useCallback(() => {
    setIsFocusedScreen(true);
    loadData();
    return () => setIsFocusedScreen(false);
  }, [loadData]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isFocusedScreen) {
        refreshNow({ showLoading: false });
      }
    });
    return () => sub.remove();
  }, [isFocusedScreen, refreshNow]);

  useEffect(() => {
    if (!isFocusedScreen) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
      return;
    }

    pollingRef.current = setInterval(() => {
      refreshNow({ showLoading: false });
    }, AUTO_POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
  }, [isFocusedScreen, refreshNow]);

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
              <TouchableOpacity style={[styles.actionBtn, { alignSelf: 'flex-end' }]} onPress={() => refreshNow({ showLoading: true })}>
                <Text style={styles.actionBtnText}>Atualizar</Text>
              </TouchableOpacity>
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
                      selectedValue={eventoForm.responsavel_filiado_id ?? undefined}
                      onValueChange={(v) => setEventoForm((p) => ({ ...p, responsavel_filiado_id: v as number | null }))}
                      mode="dropdown"
                      items={[
                          { label: 'Selecione...', value: undefined },
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
                        <View style={[styles.tableHeaderCellContainer, { width: 170 }]}><Text style={[styles.tableHeaderText, styles.textCenter]}>Lotação</Text></View>
                        <View style={[styles.tableHeaderCellContainer, { width: 70 }]}><Text style={[styles.tableHeaderText, styles.textCenter]}>Ativos</Text></View>
                        <View style={[styles.tableHeaderCellContainer, { width: 130 }]}><Text style={[styles.tableHeaderText, styles.textCenter]}>Crédito</Text></View>
                        <View style={[styles.tableHeaderCellContainer, { width: 130 }]}><Text style={[styles.tableHeaderText, styles.textCenter]}>Débitos</Text></View>
                        <View style={[styles.tableHeaderCellContainer, { width: 130 }]}><Text style={[styles.tableHeaderText, styles.textCenter]}>Saldo</Text></View>
                        <View style={[styles.tableHeaderCellContainer, { width: 120 }]}><Text style={[styles.tableHeaderText, styles.textCenter]}>Ações</Text></View>
                      </View>
                      {resumo.apoioPorLotacao.map((row, idx) => {
                        return (
                          <View key={row.lotacao} style={[styles.tableRow, idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                            <View style={[styles.tableCellContainer, { width: 170 }]}><Text style={[styles.tableCell, styles.textCenter, { fontWeight: '500' }]}>{row.lotacao}</Text></View>
                            <View style={[styles.tableCellContainer, { width: 70 }]}><Text style={[styles.tableCell, styles.textCenter]}>{row.qtdAtivos}</Text></View>
                            <View style={[styles.tableCellContainer, { width: 130 }]}><Text style={[styles.tableCell, styles.textCenter, { color: '#0b3a67', fontWeight: '600' }]}>{formatCurrency(row.creditoApoioOperacional)}</Text></View>
                            <View style={[styles.tableCellContainer, { width: 130 }]}><Text style={[styles.tableCell, styles.textCenter, { color: '#dc3545', fontWeight: '600' }]}>{formatCurrency(row.debitosApoioOperacional)}</Text></View>
                            <View style={[styles.tableCellContainer, { width: 130 }]}><Text style={[styles.tableCell, styles.textCenter, { fontWeight: '700' }]}>{formatCurrency(row.saldoApoioOperacional)}</Text></View>
                            <View style={[styles.tableCellContainer, { width: 120, flexDirection: 'row', gap: 4, justifyContent: 'center' }]}>
                              <TouchableOpacity style={styles.actionBtn} onPress={() => abrirLancarDebito(row.lotacao)}><Text style={styles.actionBtnText}>Lançar</Text></TouchableOpacity>
                              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#607589' }]} onPress={() => abrirVerDebitos(row.lotacao)}><Text style={styles.actionBtnText}>Ver</Text></TouchableOpacity>
                            </View>
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
                      {grupo.itens.length === 0 ? <Text style={styles.itemText}>Sem alocações.</Text> : grupo.itens.map((i) => {
                        const filiadoId = Number(i.filiado_id || i.filiadoId || 0);
                        return (
                          <View key={`${grupo.evento.id}-${filiadoId}-${i.nome}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <Text style={[styles.itemText, { flex: 1 }]}>• {i.nome} ({i.situacao}) — {formatCurrency(i.valorAlocado)}</Text>
                            {ehGestao && filiadoId > 0 && (
                              <TouchableOpacity style={styles.deleteBtn} onPress={() => abrirRetiradaGestaoAlocacao(grupo.evento.id, filiadoId, i.nome)}>
                                <Text style={styles.deleteBtnText}>Cancelar</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}

                  {ehGestao && alocacoesExpanded && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={[styles.eventMeta, { fontWeight: '700' }]}>Cancelados (somente gestão)</Text>
                      {(resumo.alocacoesCanceladas || []).length === 0 ? (
                        <Text style={styles.itemText}>Sem eventos cancelados.</Text>
                      ) : (resumo.alocacoesCanceladas || []).map((grupo) => (
                        <View key={`cancelado-${grupo.evento.id}`} style={styles.eventBox}>
                          <Text style={styles.eventTitle}>{grupo.evento.titulo}</Text>
                          <Text style={styles.itemText}>Motivo: {grupo.evento.delete_reason || 'Não informado'}</Text>
                          <Text style={styles.itemText}>Cancelado por: {grupo.evento.deleted_by_nome || `ID ${grupo.evento.deleted_by_user_id || '-'}`}</Text>
                          <Text style={styles.itemText}>Cancelado em: {formatISOToBR(grupo.evento.deleted_at || '')}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Alocação de recurso</Text>
                  {eventosAbertos.length === 0 ? (
                    <Text style={styles.itemText}>Sem eventos abertos no momento.</Text>
                  ) : (
                    eventosAbertos.map((e) => (
                      <View key={e.id} style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <TouchableOpacity style={[styles.listBtn, { flex: 1, marginTop: 0 }]} onPress={() => alocarMeuRecurso(e.id)}>
                          <Text style={styles.listBtnText}>{e.titulo} • limite {formatISOToBR(e.data_limite_alocacao)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => abrirRetiradaMinhaAlocacao(e.id)}>
                          <Text style={styles.deleteBtnText}>Retirar</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>

                {ehGestao && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Gestão de eventos</Text>
                    {eventosTodos.filter((e) => !e.deleted_at).length === 0 ? (
                      <Text style={styles.itemText}>Sem eventos ativos.</Text>
                    ) : eventosTodos.filter((e) => !e.deleted_at).map((e) => (
                      <View key={`gestao-${e.id}`} style={styles.eventBox}>
                        <Text style={styles.eventTitle}>{e.titulo}</Text>
                        <Text style={styles.eventMeta}>Status: {e.status} • Limite: {formatISOToBR(e.data_limite_alocacao)}</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                          <TouchableOpacity style={styles.editBtn} onPress={() => editarEventoGestao(e)}><Text style={styles.editBtnText}>Alternar status</Text></TouchableOpacity>
                          <TouchableOpacity style={styles.deleteBtn} onPress={() => excluirEventoGestao(e.id)}><Text style={styles.deleteBtnText}>Excluir</Text></TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    <Text style={[styles.eventMeta, { fontWeight: '700', marginTop: 10 }]}>Cancelados</Text>
                    {eventosTodos.filter((e) => !!e.deleted_at).length === 0 ? (
                      <Text style={styles.itemText}>Sem eventos cancelados.</Text>
                    ) : eventosTodos.filter((e) => !!e.deleted_at).map((e) => (
                      <View key={`gestao-cancelado-${e.id}`} style={styles.eventBox}>
                        <Text style={styles.eventTitle}>{e.titulo}</Text>
                        <Text style={styles.itemText}>Motivo: {e.delete_reason || 'Não informado'}</Text>
                        <Text style={styles.itemText}>Cancelado por: {e.deleted_by_nome || `ID ${e.deleted_by_user_id || '-'}`}</Text>
                        <Text style={styles.itemText}>Cancelado em: {formatISOToBR(e.deleted_at || '')}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>


        {/* Modal Cancelar Alocação */}
        <Modal visible={modalCancelAlocacaoVisible} transparent animationType="fade" onRequestClose={() => setModalCancelAlocacaoVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Cancelar alocação</Text>
              <Text style={styles.modalSubtitle}>{cancelAlocacaoForm.gestao ? `Filiado: ${cancelAlocacaoForm.nome}` : 'Sua própria alocação'}</Text>
              <TextInput
                style={[styles.input, { height: 90 }]}
                placeholder="Informe a justificativa"
                multiline
                value={cancelAlocacaoForm.justificativa}
                onChangeText={(v) => setCancelAlocacaoForm((p) => ({ ...p, justificativa: v }))}
              />
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalCancelAlocacaoVisible(false)}><Text style={styles.cancelBtnText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, cancelAlocacaoForm.justificativa.trim().length < 5 && { opacity: 0.5 }]}
                  disabled={cancelAlocacaoForm.justificativa.trim().length < 5}
                  onPress={confirmarRetiradaAlocacao}
                >
                  <Text style={styles.saveBtnText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Lançar Débito */}
        <Modal visible={modalDebitoVisible} transparent animationType="fade" onRequestClose={() => setModalDebitoVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Lançar Débito</Text>
              <Text style={styles.modalSubtitle}>Lotação: {selectedLotacao}</Text>
              <TextInput
                style={styles.input}
                placeholder="Valor (R$)"
                keyboardType="numeric"
                value={formatCentavosBRL(debitoForm.valorCentavos)}
                onChangeText={(v) => setDebitoForm((p) => ({ ...p, valorCentavos: sanitizeToCentavos(v) }))}
              />
              <TextInput
                style={[styles.input, { height: 80 }]}
                placeholder="Observação"
                multiline
                value={debitoForm.observacao}
                onChangeText={(v) => setDebitoForm((p) => ({ ...p, observacao: v }))}
              />
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalDebitoVisible(false)}><Text style={styles.cancelBtnText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={salvarDebito}><Text style={styles.saveBtnText}>Salvar</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Lista Débitos */}
        <Modal visible={modalListaVisible} transparent animationType="fade" onRequestClose={() => setModalListaVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxWidth: '90%', width: 500 }]}>
              <Text style={styles.modalTitle}>Débitos: {selectedLotacao}</Text>
              <ScrollView style={{ maxHeight: 400 }}>
                {movimentos.length === 0 ? <Text style={styles.emptyText}>Nenhum débito encontrado.</Text> : movimentos.map((m) => (
                  <View key={m.id} style={styles.movimentoItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.movimentoDate}>{formatISOToBR(m.created_at)}</Text>
                      <Text style={styles.movimentoValue}>{formatCentavosBRL(valorBackendToCentavos(m))}</Text>
                      <Text style={styles.movimentoObs}>{m.observacao}</Text>
                    </View>
                    <View style={{ gap: 6 }}>
                      <TouchableOpacity style={styles.editBtn} onPress={() => abrirEditarDebito(m)}><Text style={styles.editBtnText}>Editar</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => abrirExcluirDebito(m)}><Text style={styles.deleteBtnText}>Excluir</Text></TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalListaVisible(false)}><Text style={styles.cancelBtnText}>Fechar</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Editar Débito */}
        <Modal visible={modalEditVisible} transparent animationType="fade" onRequestClose={() => setModalEditVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Editar Débito</Text>
              <TextInput
                style={styles.input}
                placeholder="Valor (R$)"
                keyboardType="numeric"
                value={formatCentavosBRL(editForm.valorCentavos)}
                onChangeText={(v) => setEditForm((p) => ({ ...p, valorCentavos: sanitizeToCentavos(v) }))}
              />
              <TextInput
                style={[styles.input, { height: 80 }]}
                placeholder="Observação"
                multiline
                value={editForm.observacao}
                onChangeText={(v) => setEditForm((p) => ({ ...p, observacao: v }))}
              />
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalEditVisible(false)}><Text style={styles.cancelBtnText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={atualizarDebito}><Text style={styles.saveBtnText}>Salvar</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Excluir Débito */}
        <Modal visible={modalDeleteVisible} transparent animationType="fade" onRequestClose={() => setModalDeleteVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Excluir Lançamento</Text>
              <Text style={styles.modalSubtitle}>Tem certeza que deseja excluir este lançamento?</Text>
              <TextInput
                style={[styles.input, { height: 90 }]}
                placeholder="Informe o motivo da exclusão"
                multiline
                value={deleteForm.justificativa}
                onChangeText={(v) => setDeleteForm((p) => ({ ...p, justificativa: v }))}
              />
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalDeleteVisible(false)}><Text style={styles.cancelBtnText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, deleteForm.justificativa.trim().length < 5 && { opacity: 0.5 }]}
                  disabled={deleteForm.justificativa.trim().length < 5}
                  onPress={excluirDebito}
                >
                  <Text style={styles.saveBtnText}>Confirmar Exclusão</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={modalDeleteEventoVisible} transparent animationType="fade" onRequestClose={() => setModalDeleteEventoVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Excluir Evento</Text>
              <Text style={styles.modalSubtitle}>Informe a justificativa da exclusão.</Text>
              <TextInput
                style={[styles.input, { height: 90 }]}
                placeholder="Justificativa"
                multiline
                value={deleteEventoJustificativa}
                onChangeText={setDeleteEventoJustificativa}
              />
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalDeleteEventoVisible(false)}><Text style={styles.cancelBtnText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, deleteEventoJustificativa.trim().length < 5 && { opacity: 0.5 }]}
                  disabled={deleteEventoJustificativa.trim().length < 5}
                  onPress={confirmarExclusaoEvento}
                >
                  <Text style={styles.saveBtnText}>Excluir Evento</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
  eventBox: { borderWidth: 1, borderColor: '#dce4ec', borderRadius: 10, padding: 10, marginTop: 8, backgroundColor: '#fff' },
  eventTitle: { color: '#0b3a67', fontWeight: '700' },
  eventMeta: { fontSize: 12, color: '#677788', marginVertical: 3 },
  eventTotal: { fontSize: 13, fontWeight: '700', color: '#0b8f6a', marginBottom: 4 },
  itemText: { fontSize: 13, color: '#314354' },
  listBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cfd8e3', borderRadius: 8, padding: 10, marginTop: 8 },
  listBtnText: { color: '#0b3a67', fontWeight: '600' },
  textCenter: { textAlign: 'center' },
  actionBtn: { padding: 6, borderRadius: 4, backgroundColor: '#0b3a67', minWidth: 50, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0b3a67', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#5a6f82', marginBottom: 12 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn: { padding: 10 },
  cancelBtnText: { color: '#607589', fontWeight: '600' },
  saveBtn: { backgroundColor: '#0b3a67', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  emptyText: { textAlign: 'center', marginVertical: 20, color: '#5a6f82' },
  movimentoItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center' },
  movimentoDate: { fontSize: 11, color: '#5a6f82' },
  movimentoValue: { fontSize: 15, fontWeight: '700', color: '#0b3a67' },
  movimentoObs: { fontSize: 13, color: '#223243' },
  editBtn: { backgroundColor: '#e8eef5', padding: 8, borderRadius: 6 },
  editBtnText: { fontSize: 12, color: '#0b3a67', fontWeight: '600' },
  deleteBtn: { backgroundColor: '#fee4e2', padding: 8, borderRadius: 6 },
  deleteBtnText: { fontSize: 12, color: '#b42318', fontWeight: '700' },
});
