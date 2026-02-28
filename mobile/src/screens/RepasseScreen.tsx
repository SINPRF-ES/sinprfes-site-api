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

export default function RepasseScreen() {
  const { usuario } = useAuth();
  const ehGestao = ['ADMIN', 'DIRETORIA', 'FUNCIONARIO'].includes((usuario?.perfil_acesso || '').toUpperCase());
  const initialYear = Math.max(new Date().getFullYear(), MIN_YEAR);

  const [year, setYear] = useState(initialYear);
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState<RepasseResumo | null>(null);
  const [eventosAbertos, setEventosAbertos] = useState<RepasseEvento[]>([]);
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
  const [isFocusedScreen, setIsFocusedScreen] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);

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

  const loadData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
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
      isFetchingRef.current = false;
    }
  }, [year]);

  const refreshListaIfOpen = useCallback(async () => {
    if (!modalListaVisible || !selectedLotacao) return;
    try {
      const list = await repasseService.listarMovimentos(year, selectedLotacao);
      setMovimentos(list);
    } catch (_error) {
      // noop
    }
  }, [modalListaVisible, selectedLotacao, year]);

  const refreshNow = useCallback(async () => {
    await loadData();
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

  const abrirLancarDebito = (lot: string) => {
    setSelectedLotacao(lot);
    setDebitoForm({ valorCentavos: '0', observacao: '' });
    setModalDebitoVisible(true);
  };

  const salvarDebito = async () => {
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
    setSelectedLotacao(lot);
    setLoading(true);
    try {
      const list = await repasseService.listarMovimentos(year, lot);
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
        refreshNow();
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
      refreshNow();
    }, 12000);

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
                        <View style={[styles.tableHeaderCellContainer, { width: 170 }]}><Text style={[styles.tableHeaderText, styles.textCenter]}>Lotação</Text></View>
                        <View style={[styles.tableHeaderCellContainer, { width: 70 }]}><Text style={[styles.tableHeaderText, styles.textCenter]}>Ativos</Text></View>
                        <View style={[styles.tableHeaderCellContainer, { width: 130 }]}><Text style={[styles.tableHeaderText, styles.textCenter]}>Crédito</Text></View>
                        <View style={[styles.tableHeaderCellContainer, { width: 130 }]}><Text style={[styles.tableHeaderText, styles.textCenter]}>Débitos</Text></View>
                        <View style={[styles.tableHeaderCellContainer, { width: 130 }]}><Text style={[styles.tableHeaderText, styles.textCenter]}>Saldo</Text></View>
                        <View style={[styles.tableHeaderCellContainer, { width: 120 }]}><Text style={[styles.tableHeaderText, styles.textCenter]}>Ações</Text></View>
                      </View>
                      {resumo.apoioPorLotacao.map((row, idx) => {
                        const semLotacao = row.lotacao === 'SEM LOTAÇÃO';
                        return (
                          <View key={row.lotacao} style={[styles.tableRow, idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd, semLotacao && styles.semLotacao]}>
                            <View style={[styles.tableCellContainer, { width: 170 }]}><Text style={[styles.tableCell, styles.textCenter, { fontWeight: semLotacao ? '700' : '500' }]}>{row.lotacao}</Text></View>
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
