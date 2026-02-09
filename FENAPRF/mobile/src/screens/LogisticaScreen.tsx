import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
  Linking,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../infra/logger';
import HeaderMenu, { MenuAction } from '../components/HeaderMenu';
import { useNavigation } from '@react-navigation/native';
import {
  getEventosLogistica,
  criarEventoLogistica,
  atualizarEventoLogistica,
  getInscricoesLogistica,
  registrarMinhaInscricaoLogistica,
  cancelarMinhaInscricaoLogistica,
  atualizarInscricaoTerceiroLogistica,
  cancelarInscricaoTerceiroLogistica
} from '../services/logisticaService';
import { STATUS_EVENTO, verificarConflitosUF } from '../constants/logistica';
import { isGestao, getCanonicalUserId, UF_NOME } from '../utils/user';
import { formatDateTimeMask, parseBRDateTimeToISO, formatISOToBRDateTime } from '../utils/date';
import { formatCPF, formatTelefone } from '../utils/format';
import api from '../services/apiService';

const LogisticaScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [eventos, setEventos] = useState<any[]>([]);
  const [eventoSelecionado, setEventoSelecionado] = useState<any>(null);
  const [inscricoes, setInscricoes] = useState<any[]>([]);
  const [minhaInscricao, setMinhaInscricao] = useState<any>(null);

  const [modalEventoVisible, setModalEventoVisible] = useState(false);
  const [modalInscricaoVisible, setModalInscricaoVisible] = useState(false);
  const [modalJustificativaVisible, setModalJustificativaVisible] = useState(false);

  const [formEvento, setFormEvento] = useState({
    id: '',
    titulo: '',
    descricao: '',
    data_inicio: '',
    data_fim: '',
    documento_url: '',
    documento_id: '',
    status: STATUS_EVENTO.ATIVO,
    justificativa: ''
  });

  const [formInscricao, setFormInscricao] = useState({
    id: '',
    evento_id: '',
    data_chegada: '',
    data_saida: '',
    observacoes: '',
    isTerceiro: false,
    justificativa: ''
  });

  const canManage = isGestao(user?.perfil_acesso);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const evs = await getEventosLogistica();
      setEventos(evs);

      if (evs.length > 0) {
        // Seleciona o primeiro evento ativo por padrão, ou o primeiro se nenhum ativo
        const defaultEv = evs.find((e: any) => e.status === STATUS_EVENTO.ATIVO) || evs[0];
        setEventoSelecionado(defaultEv);
      } else {
        setEventoSelecionado(null);
      }
    } catch (err) {
      logger.error('Logistica.fetchData', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInscricoes = useCallback(async () => {
    if (!eventoSelecionado) return;
    try {
      const ins = await getInscricoesLogistica(eventoSelecionado.id);
      setInscricoes(ins);

      const currentUserId = getCanonicalUserId(user);
      const minha = ins.find((i: any) => String(i.user_id) === currentUserId);
      setMinhaInscricao(minha || null);
    } catch (err) {
      logger.error('Logistica.fetchInscricoes', err);
    }
  }, [eventoSelecionado, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchInscricoes();
  }, [fetchInscricoes]);

  const conflictsByUF = useMemo(() => {
    const groups: Record<string, any[]> = {};
    inscricoes.forEach(i => {
      const uf = i.uf || 'BR';
      if (!groups[uf]) groups[uf] = [];
      groups[uf].push(i);
    });
    const result: Record<string, any[]> = {};
    Object.keys(groups).forEach(uf => {
      result[uf] = verificarConflitosUF(groups[uf]);
    });
    return result;
  }, [inscricoes]);

  const handleOpenDoc = () => {
    if (eventoSelecionado?.documento_id) {
      navigation.navigate('FileViewer', {
        fileId: eventoSelecionado.documento_id,
        title: 'Documento do Evento',
        context: 'publicacoes',
        type: 'pdf'
      });
    } else if (eventoSelecionado?.documento_url) {
      Linking.openURL(eventoSelecionado.documento_url).catch(() => Alert.alert('Erro', 'Não foi possível abrir o link.'));
    }
  };

  const handleSelectDocument = () => {
    navigation.navigate('Publicacoes', {
      mode: 'picker',
      onSelectFile: (file: any) => {
        setFormEvento(prev => ({
          ...prev,
          documento_id: file.id,
          documento_url: file.webViewLink || ''
        }));
      }
    });
  };

  const saveEvento = async () => {
    if (!formEvento.titulo || !formEvento.data_inicio || !formEvento.data_fim) {
      Alert.alert('Aviso', 'Preencha os campos obrigatórios.');
      return;
    }

    const isoInicio = parseBRDateTimeToISO(formEvento.data_inicio);
    const isoFim = parseBRDateTimeToISO(formEvento.data_fim);

    if (!isoInicio || !isoFim) {
      Alert.alert('Aviso', 'Datas inválidas (DD/MM/YYYY HH:mm).');
      return;
    }

    try {
      if (formEvento.id) {
        if (!formEvento.justificativa) {
          Alert.alert('Aviso', 'Justificativa é obrigatória.');
          return;
        }
        await atualizarEventoLogistica(formEvento.id, {
          ...formEvento,
          data_inicio: isoInicio,
          data_fim: isoFim
        });
      } else {
        await criarEventoLogistica({
          ...formEvento,
          data_inicio: isoInicio,
          data_fim: isoFim
        });
      }
      setModalEventoVisible(false);
      fetchData();
      Alert.alert('Sucesso', 'Evento salvo com sucesso!');
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível salvar o evento.');
    }
  };

  const handleEditEvento = () => {
    setFormEvento({
      id: eventoSelecionado.id,
      titulo: eventoSelecionado.titulo,
      descricao: eventoSelecionado.descricao || '',
      data_inicio: formatISOToBRDateTime(eventoSelecionado.data_inicio),
      data_fim: formatISOToBRDateTime(eventoSelecionado.data_fim),
      documento_url: eventoSelecionado.documento_url || '',
      documento_id: eventoSelecionado.documento_id || '',
      status: eventoSelecionado.status,
      justificativa: ''
    });
    setModalEventoVisible(true);
  };

  const handleCancelEvento = () => {
    Alert.alert(
      'Cancelar Evento',
      'Deseja realmente encerrar este evento?',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim',
          onPress: () => {
            setFormEvento({
              ...eventoSelecionado,
              data_inicio: formatISOToBRDateTime(eventoSelecionado.data_inicio),
              data_fim: formatISOToBRDateTime(eventoSelecionado.data_fim),
              status: STATUS_EVENTO.ENCERRADO,
              justificativa: ''
            });
            setModalEventoVisible(true); // Reusa o modal para pedir justificativa
          }
        }
      ]
    );
  };

  const saveInscricao = async () => {
    if (!formInscricao.data_chegada || !formInscricao.data_saida) {
      Alert.alert('Aviso', 'Datas são obrigatórias.');
      return;
    }

    const isoChegada = parseBRDateTimeToISO(formInscricao.data_chegada);
    const isoSaida = parseBRDateTimeToISO(formInscricao.data_saida);

    if (!isoChegada || !isoSaida) {
      Alert.alert('Aviso', 'Datas inválidas.');
      return;
    }

    if (new Date(isoChegada) >= new Date(isoSaida)) {
      Alert.alert('Aviso', 'Data de chegada deve ser anterior à saída.');
      return;
    }

    try {
      if (formInscricao.isTerceiro) {
        if (!formInscricao.justificativa) {
          Alert.alert('Aviso', 'Justificativa obrigatória.');
          return;
        }
        await atualizarInscricaoTerceiroLogistica(formInscricao.id, {
          data_chegada: isoChegada,
          data_saida: isoSaida,
          observacoes: formInscricao.observacoes,
          justificativa: formInscricao.justificativa
        });
      } else {
        await registrarMinhaInscricaoLogistica({
          evento_id: eventoSelecionado.id,
          data_chegada: isoChegada,
          data_saida: isoSaida,
          observacoes: formInscricao.observacoes
        });
      }
      setModalInscricaoVisible(false);
      fetchInscricoes();
      Alert.alert('Sucesso', 'Inscrição salva!');
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível salvar a inscrição.');
    }
  };

  const handleEditInscricao = (item?: any) => {
    if (item) {
      // Editar terceiro (Gestão)
      setFormInscricao({
        id: item.id,
        evento_id: item.evento_id,
        data_chegada: formatISOToBRDateTime(item.data_chegada),
        data_saida: formatISOToBRDateTime(item.data_saida),
        observacoes: item.observacoes || '',
        isTerceiro: true,
        justificativa: ''
      });
    } else {
      // Editar própria
      setFormInscricao({
        id: minhaInscricao?.id || '',
        evento_id: eventoSelecionado.id,
        data_chegada: minhaInscricao ? formatISOToBRDateTime(minhaInscricao.data_chegada) : '',
        data_saida: minhaInscricao ? formatISOToBRDateTime(minhaInscricao.data_saida) : '',
        observacoes: minhaInscricao ? minhaInscricao.observacoes : '',
        isTerceiro: false,
        justificativa: ''
      });
    }
    setModalInscricaoVisible(true);
  };

  const handleCancelInscricao = (item?: any) => {
    const isSelf = !item;
    const target = isSelf ? minhaInscricao : item;
    if (!target) return;

    if (!isSelf && canManage) {
        // Pedir justificativa para cancelar terceiro
        setFormInscricao({
            ...target,
            data_chegada: formatISOToBRDateTime(target.data_chegada),
            data_saida: formatISOToBRDateTime(target.data_saida),
            isTerceiro: true,
            justificativa: ''
        });
        setModalJustificativaVisible(true);
        return;
    }

    Alert.alert(
      'Cancelar Inscrição',
      'Deseja realmente cancelar sua inscrição?',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim',
          onPress: async () => {
            try {
              await cancelarMinhaInscricaoLogistica(eventoSelecionado.id);
              fetchInscricoes();
              Alert.alert('Sucesso', 'Inscrição cancelada.');
            } catch (e) { Alert.alert('Erro', 'Falha ao cancelar.'); }
          }
        }
      ]
    );
  };

  const confirmCancelTerceiro = async () => {
      if (!formInscricao.justificativa) {
          Alert.alert('Aviso', 'Justificativa obrigatória.');
          return;
      }
      try {
          await cancelarInscricaoTerceiroLogistica(formInscricao.id, { justificativa: formInscricao.justificativa });
          setModalJustificativaVisible(false);
          fetchInscricoes();
          Alert.alert('Sucesso', 'Inscrição cancelada.');
      } catch (e) { Alert.alert('Erro', 'Falha ao cancelar.'); }
  };

  const exportData = async (type: 'pdf' | 'xls') => {
    if (!eventoSelecionado) return;
    try {
        const url = `/logistica/eventos/${eventoSelecionado.id}/exportar/${type}`;
        // Reutilizando o token do apiService
        const response = await api.get(url, { responseType: 'blob' });
        // No mobile, abrir o link no navegador costuma ser mais fácil para download
        // Mas o ideal seria salvar o arquivo. Como é uma AGO, o gestor fará no PC via Web se possível.
        // Se precisar no mobile, usamos o link autenticado.
        const downloadUrl = `${api.defaults.baseURL}${url}?token=${api.defaults.headers.common['Authorization']?.toString().split(' ')[1]}`;
        Linking.openURL(downloadUrl);
    } catch (e) {
        Alert.alert('Erro', 'Falha ao exportar.');
    }
  };

  useEffect(() => {
    const actions: MenuAction[] = [];
    if (canManage) {
      actions.push({ label: 'Novo Evento', icon: 'plus-circle', onPress: () => {
        setFormEvento({ id: '', titulo: '', descricao: '', data_inicio: '', data_fim: '', documento_url: '', documento_id: '', status: STATUS_EVENTO.ATIVO, justificativa: '' });
        setModalEventoVisible(true);
      }});
      if (eventoSelecionado) {
        actions.push({ label: 'Alterar Evento', icon: 'pencil', onPress: handleEditEvento });
        actions.push({ label: 'Encerrar Evento', icon: 'close-circle', onPress: handleCancelEvento });
        actions.push({ label: 'Exportar PDF', icon: 'file-pdf-box', onPress: () => exportData('pdf') });
        actions.push({ label: 'Exportar XLS', icon: 'file-excel', onPress: () => exportData('xls') });
      }
    }

    navigation.setOptions({
      headerRight: () => actions.length > 0 ? <HeaderMenu actions={actions} /> : null,
      title: 'Módulo de Logística',
      headerStyle: { backgroundColor: '#003366' },
      headerTintColor: '#fff',
    });
  }, [navigation, canManage, eventoSelecionado]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;

  if (eventos.length === 0) {
    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name="truck-delivery" size={80} color="#ccc" />
        <Text style={styles.emptyText}>Nenhum evento logístico disponível.</Text>
        {canManage && (
          <TouchableOpacity style={styles.btnPrimary} onPress={() => setModalEventoVisible(true)}>
            <Text style={styles.btnText}>Criar Primeiro Evento</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Seletor de Eventos se houver mais de um ativo */}
        {eventos.filter(e => e.status === STATUS_EVENTO.ATIVO).length > 1 && (
            <View style={styles.selectorContainer}>
                <Text style={styles.selectorLabel}>Selecionar Evento:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {eventos.filter(e => e.status === STATUS_EVENTO.ATIVO).map(e => (
                        <TouchableOpacity
                            key={e.id}
                            style={[styles.selectorChip, eventoSelecionado?.id === e.id && styles.selectorChipActive]}
                            onPress={() => setEventoSelecionado(e)}
                        >
                            <Text style={[styles.selectorChipText, eventoSelecionado?.id === e.id && styles.selectorChipTextActive]}>
                                {e.titulo}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        )}

        {eventoSelecionado && (
          <View style={styles.eventCard}>
            <Text style={styles.eventTitle}>{eventoSelecionado.titulo}</Text>
            {eventoSelecionado.descricao ? <Text style={styles.eventDesc}>{eventoSelecionado.descricao}</Text> : null}
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="calendar-range" size={18} color="#666" />
              <Text style={styles.infoText}>
                {formatISOToBRDateTime(eventoSelecionado.data_inicio)} até {formatISOToBRDateTime(eventoSelecionado.data_fim)}
              </Text>
            </View>
            {(eventoSelecionado.documento_url || eventoSelecionado.documento_id) && (
              <TouchableOpacity style={styles.docButton} onPress={handleOpenDoc}>
                <MaterialCommunityIcons name="file-document-outline" size={20} color="#003366" />
                <Text style={styles.docButtonText}>Ver Documento Auxiliar</Text>
              </TouchableOpacity>
            )}

            {eventoSelecionado.status === STATUS_EVENTO.ENCERRADO ? (
              <View style={styles.closedBadge}>
                <Text style={styles.closedText}>EVENTO ENCERRADO</Text>
              </View>
            ) : (
              <View style={styles.actionsRow}>
                {minhaInscricao ? (
                  <>
                    <TouchableOpacity style={styles.btnEdit} onPress={() => handleEditInscricao()}>
                      <MaterialCommunityIcons name="pencil" size={18} color="#fff" />
                      <Text style={styles.btnTextSmall}>Alterar Minha Inscrição</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnCancel} onPress={() => handleCancelInscricao()}>
                      <MaterialCommunityIcons name="delete" size={18} color="#fff" />
                      <Text style={styles.btnTextSmall}>Cancelar</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={styles.btnPrimary} onPress={() => handleEditInscricao()}>
                    <MaterialCommunityIcons name="check-circle-outline" size={20} color="#fff" />
                    <Text style={styles.btnText}>Quero me inscrever</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {eventoSelecionado && (
          <View style={styles.tableCard}>
            <Text style={styles.tableTitle}>📋 Inscrições Confirmadas</Text>
            <ScrollView horizontal>
              <View>
                <View style={styles.tableHeader}>
                  <View style={[styles.cellHeader, { width: 180 }]}><Text style={styles.cellHeaderText}>Nome</Text></View>
                  <View style={[styles.cellHeader, { width: 120 }]}><Text style={styles.cellHeaderText}>Cargo</Text></View>
                  <View style={[styles.cellHeader, { width: 50 }]}><Text style={styles.cellHeaderText}>UF</Text></View>
                  <View style={[styles.cellHeader, { width: 140 }]}><Text style={styles.cellHeaderText}>Telefone</Text></View>
                  <View style={[styles.cellHeader, { width: 150 }]}><Text style={styles.cellHeaderText}>Chegada</Text></View>
                  <View style={[styles.cellHeader, { width: 150 }]}><Text style={styles.cellHeaderText}>Saída</Text></View>
                  {canManage && <View style={[styles.cellHeader, { width: 100 }]}><Text style={styles.cellHeaderText}>Ações</Text></View>}
                </View>

                {inscricoes.map((item, idx) => {
                  const uf = item.uf || 'BR';
                  const conflitos = conflictsByUF[uf] || [];
                  const hasConflict = conflitos.length > 0;

                  return (
                    <View key={item.id} style={[
                      styles.tableRow,
                      idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                      hasConflict && styles.tableRowConflict
                    ]}>
                      <View style={[styles.cell, { width: 180 }]}>
                        <Text style={styles.cellText}>{item.nome}</Text>
                        {hasConflict && (
                            <TouchableOpacity
                                style={styles.conflictBadge}
                                onPress={() => Alert.alert('Conflito de Representação', conflitos.map(c => c.mensagem).join('\n'))}
                            >
                                <MaterialCommunityIcons name="alert-circle" size={12} color="#fff" />
                                <Text style={styles.conflictBadgeText}>Conflito UF</Text>
                            </TouchableOpacity>
                        )}
                      </View>
                      <View style={[styles.cell, { width: 120 }]}><Text style={styles.cellText}>{item.cargo || '—'}</Text></View>
                      <View style={[styles.cell, { width: 50 }]}><Text style={styles.cellText}>{uf}</Text></View>
                      <View style={[styles.cell, { width: 140 }]}><Text style={styles.cellText}>{formatTelefone(item.telefone) || '—'}</Text></View>
                      <View style={[styles.cell, { width: 150 }]}><Text style={styles.cellText}>{formatISOToBRDateTime(item.data_chegada)}</Text></View>
                      <View style={[styles.cell, { width: 150 }]}><Text style={styles.cellText}>{formatISOToBRDateTime(item.data_saida)}</Text></View>
                      {canManage && (
                        <View style={[styles.cell, { width: 100, flexDirection: 'row', gap: 10 }]}>
                          <TouchableOpacity onPress={() => handleEditInscricao(item)}>
                            <MaterialCommunityIcons name="pencil" size={20} color="#003366" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleCancelInscricao(item)}>
                            <MaterialCommunityIcons name="delete" size={20} color="#d32f2f" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            {inscricoes.length === 0 && <Text style={styles.noInscText}>Nenhuma inscrição até o momento.</Text>}
          </View>
        )}
      </ScrollView>

      {/* MODAL EVENTO */}
      <Modal visible={modalEventoVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{formEvento.id ? 'Alterar Evento' : 'Novo Evento'}</Text>
            <KeyboardAwareScrollView>
              <Text style={styles.label}>Título *</Text>
              <TextInput style={styles.input} value={formEvento.titulo} onChangeText={t => setFormEvento({...formEvento, titulo: t})} placeholder="Ex: AGO 2026" />

              <Text style={styles.label}>Descrição</Text>
              <TextInput style={[styles.input, {height: 80}]} multiline value={formEvento.descricao} onChangeText={t => setFormEvento({...formEvento, descricao: t})} />

              <Text style={styles.label}>Data e Hora Início (DD/MM/YYYY HH:mm) *</Text>
              <TextInput style={styles.input} value={formEvento.data_inicio} onChangeText={t => setFormEvento({...formEvento, data_inicio: formatDateTimeMask(t)})} placeholder="00/00/0000 00:00" keyboardType="numeric" />

              <Text style={styles.label}>Data e Hora Fim (DD/MM/YYYY HH:mm) *</Text>
              <TextInput style={styles.input} value={formEvento.data_fim} onChangeText={t => setFormEvento({...formEvento, data_fim: formatDateTimeMask(t)})} placeholder="00/00/0000 00:00" keyboardType="numeric" />

              <Text style={styles.label}>Documento (Google Drive)</Text>
              <TouchableOpacity style={styles.docSelect} onPress={handleSelectDocument}>
                <Text style={styles.docSelectText}>{formEvento.documento_id ? '✓ Documento Selecionado' : 'Selecionar nas Publicações'}</Text>
              </TouchableOpacity>

              {formEvento.id && (
                <>
                  <Text style={styles.label}>Justificativa da Alteração *</Text>
                  <TextInput style={styles.input} value={formEvento.justificativa} onChangeText={t => setFormEvento({...formEvento, justificativa: t})} placeholder="Motivo da mudança" />
                </>
              )}
            </KeyboardAwareScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancelModal} onPress={() => setModalEventoVisible(false)}><Text style={styles.btnText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnSaveModal} onPress={saveEvento}><Text style={styles.btnText}>Salvar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL INSCRIÇÃO */}
      <Modal visible={modalInscricaoVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{formInscricao.isTerceiro ? 'Gerenciar Inscrição' : 'Minha Inscrição'}</Text>
            <KeyboardAwareScrollView>
              <Text style={styles.label}>Data/Hora Chegada *</Text>
              <TextInput style={styles.input} value={formInscricao.data_chegada} onChangeText={t => setFormInscricao({...formInscricao, data_chegada: formatDateTimeMask(t)})} placeholder="00/00/0000 00:00" keyboardType="numeric" />

              <Text style={styles.label}>Data/Hora Saída *</Text>
              <TextInput style={styles.input} value={formInscricao.data_saida} onChangeText={t => setFormInscricao({...formInscricao, data_saida: formatDateTimeMask(t)})} placeholder="00/00/0000 00:00" keyboardType="numeric" />

              <Text style={styles.label}>Observações</Text>
              <TextInput style={[styles.input, {height: 60}]} multiline value={formInscricao.observacoes} onChangeText={t => setFormInscricao({...formInscricao, observacoes: t})} />

              {formInscricao.isTerceiro && (
                <>
                  <Text style={styles.label}>Justificativa (Gestão) *</Text>
                  <TextInput style={styles.input} value={formInscricao.justificativa} onChangeText={t => setFormInscricao({...formInscricao, justificativa: t})} placeholder="Obrigatório" />
                </>
              )}
            </KeyboardAwareScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancelModal} onPress={() => setModalInscricaoVisible(false)}><Text style={styles.btnText}>Sair</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnSaveModal} onPress={saveInscricao}><Text style={styles.btnText}>Salvar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL JUSTIFICATIVA (CANCELAMENTO) */}
      <Modal visible={modalJustificativaVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 250 }]}>
            <Text style={styles.modalTitle}>Justificativa de Cancelamento</Text>
            <TextInput style={[styles.input, { flex: 1 }]} multiline value={formInscricao.justificativa} onChangeText={t => setFormInscricao({...formInscricao, justificativa: t})} placeholder="Informe o motivo" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancelModal} onPress={() => setModalJustificativaVisible(false)}><Text style={styles.btnText}>Voltar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnCancel} onPress={confirmCancelTerceiro}><Text style={styles.btnText}>Confirmar Cancelamento</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 15 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, color: '#999', marginVertical: 20 },
  selectorContainer: { marginBottom: 15 },
  selectorLabel: { fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 5 },
  selectorChip: { paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#ddd', borderRadius: 20, marginRight: 10 },
  selectorChipActive: { backgroundColor: '#003366' },
  selectorChipText: { color: '#333', fontSize: 13 },
  selectorChipTextActive: { color: '#fff', fontWeight: 'bold' },
  eventCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, elevation: 3, marginBottom: 15 },
  eventTitle: { fontSize: 20, fontWeight: 'bold', color: '#003366', marginBottom: 10 },
  eventDesc: { fontSize: 14, color: '#444', marginBottom: 15 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  infoText: { fontSize: 14, color: '#666' },
  docButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15, padding: 10, backgroundColor: '#f0f4f8', borderRadius: 8 },
  docButtonText: { color: '#003366', fontWeight: '600' },
  closedBadge: { backgroundColor: '#f8d7da', padding: 10, borderRadius: 8, marginTop: 15, alignItems: 'center' },
  closedText: { color: '#721c24', fontWeight: 'bold' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnPrimary: { backgroundColor: '#003366', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  btnEdit: { backgroundColor: '#27ae60', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  btnCancel: { backgroundColor: '#d32f2f', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { color: '#fff', fontWeight: 'bold' },
  btnTextSmall: { color: '#fff', fontWeight: '600', fontSize: 13 },
  tableCard: { backgroundColor: '#fff', borderRadius: 12, padding: 15, elevation: 3 },
  tableTitle: { fontSize: 16, fontWeight: 'bold', color: '#003366', marginBottom: 15 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#e9ecef', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  cellHeader: { padding: 10, borderRightWidth: 1, borderColor: '#dee2e6', justifyContent: 'center' },
  cellHeaderText: { fontWeight: 'bold', fontSize: 12, color: '#495057' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#dee2e6' },
  tableRowEven: { backgroundColor: '#fff' },
  tableRowOdd: { backgroundColor: '#f8f9fa' },
  tableRowConflict: { backgroundColor: '#fff3cd' }, // Amarelo para conflito
  cell: { padding: 10, borderRightWidth: 1, borderColor: '#dee2e6', justifyContent: 'center' },
  cellText: { fontSize: 12, color: '#333' },
  conflictBadge: { backgroundColor: '#d32f2f', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 2 },
  conflictBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  noInscText: { textAlign: 'center', color: '#999', marginTop: 20, fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, width: '100%', padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: 'bold', color: '#666', marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 14, backgroundColor: '#fafafa' },
  docSelect: { padding: 12, borderWidth: 1, borderColor: '#003366', borderStyle: 'dashed', borderRadius: 8, alignItems: 'center', marginTop: 5 },
  docSelectText: { color: '#003366', fontWeight: 'bold' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 25 },
  btnCancelModal: { backgroundColor: '#6c757d', padding: 12, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  btnSaveModal: { backgroundColor: '#003366', padding: 12, borderRadius: 8, minWidth: 80, alignItems: 'center' },
});

export default LogisticaScreen;
