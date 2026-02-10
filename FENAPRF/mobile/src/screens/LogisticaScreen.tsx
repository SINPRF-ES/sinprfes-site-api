import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
  Linking,
  KeyboardAvoidingView,
  Platform,
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
  encerrarEventoLogistica,
  cancelarEventoLogistica,
  getInscricoesLogistica,
  registrarMinhaInscricaoLogistica,
  cancelarMinhaInscricaoLogistica,
  atualizarInscricaoTerceiroLogistica,
  cancelarInscricaoTerceiroLogistica
} from '../services/logisticaService';
import { downloadPublicacaoFile } from '../services/driveService';
import { STATUS_EVENTO, verificarConflitosUF } from '../constants/logistica';
import { isGestao, getCanonicalUserId, UF_NOME } from '../utils/user';
import { formatDateTimeMask, parseBRDateTimeToISO, formatISOToBRDateTime } from '../utils/date';
import { formatCpf, formatTelefone } from '../utils/format';
import api from '../services/apiService';
import SafeScreen from '../components/SafeScreen';
import { EMOJIS } from '../utils/emoji';
import { Picker } from '@react-native-picker/picker';
import PickerWrapper from '../components/PickerWrapper';
import Badge from '../components/Badge';

const LogisticaScreen = ({ route }: any) => {
  const navigation = useNavigation<any>();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_EVENTO.ATIVO);
  const [eventos, setEventos] = useState<any[]>([]);
  const [assembleias, setAssembleias] = useState<any[]>([]);
  const [eventoSelecionado, setEventoSelecionado] = useState<any>(null);
  const [inscricoes, setInscricoes] = useState<any[]>([]);
  const [minhaInscricao, setMinhaInscricao] = useState<any>(null);

  const [modalEventoVisible, setModalEventoVisible] = useState(false);
  const [modalInscricaoVisible, setModalInscricaoVisible] = useState(false);
  const [modalJustificativaVisible, setModalJustificativaVisible] = useState(false);
  const [modalEventoActionVisible, setModalEventoActionVisible] = useState(false);
  const [eventoActionType, setEventoActionType] = useState<'ENCERRAR' | 'CANCELAR'>('ENCERRAR');
  const [eventoActionJustificativa, setEventoActionJustificativa] = useState('');

  const [formEvento, setFormEvento] = useState({
    id: '',
    titulo: '',
    descricao: '',
    data_inicio: '',
    data_fim: '',
    documento_url: '',
    documento_id: '',
    status: STATUS_EVENTO.ATIVO,
    justificativa: '',
    assembleia_id: ''
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
  const perfil = (user?.perfil_acesso || "").toUpperCase();
  const canParticipate = perfil !== "ADMIN" && perfil !== "COLABORADOR";

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const effectiveStatus = statusFilter === 'ALL' ? undefined : statusFilter;
      const [evs, ass] = await Promise.all([
        getEventosLogistica(effectiveStatus),
        api.get('/api/assembleias').then(res => res.data).catch(() => [])
      ]);
      setEventos(evs);
      setAssembleias(ass.filter((a: any) => a.estado !== 'ENCERRADA'));

      if (evs.length > 0) {
        // Seleciona o primeiro evento ativo por padrão, ou o primeiro se nenhum ativo
        const defaultEv = evs.find((e: any) => e.status === STATUS_EVENTO.ATIVO) || evs[0];
        setEventoSelecionado(defaultEv);
      } else {
        setEventoSelecionado(null);
      }
    } catch (err: any) {
      logger.error('Logistica.fetchData', err as Error, {
        message: (err as Error).message,
        status: err.response?.status,
        url: err.config?.url,
        baseURL: err.config?.baseURL
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchInscricoes = useCallback(async () => {
    if (!eventoSelecionado) return;
    try {
      const ins = await getInscricoesLogistica(eventoSelecionado.id);
      setInscricoes(ins);

      const currentUserId = getCanonicalUserId(user);
      const minha = ins.find((i: any) => String(i.user_id) === currentUserId);
      setMinhaInscricao(minha || null);
    } catch (err: any) {
      logger.error('Logistica.fetchInscricoes', err as Error);
    }
  }, [eventoSelecionado, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData, statusFilter]);

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

  const handleOpenDoc = async () => {
    if (eventoSelecionado?.documento_id) {
      if (!token) {
        Alert.alert('Acesso Negado', 'Sua sessão expirou. Por favor, faça login novamente.');
        return;
      }

      try {
        setLoading(true);
        const { localUri, mimeType } = await downloadPublicacaoFile(
          eventoSelecionado.documento_id,
          'Documento_Evento.pdf',
          token,
          'application/pdf'
        );

        const safeMimeType = mimeType || 'application/pdf';

        navigation.navigate('FileViewer', {
          localUri,
          title: 'Documento do Evento',
          fileId: eventoSelecionado.documento_id,
          type: safeMimeType.includes('pdf') ? 'pdf' : (safeMimeType.startsWith('image/') ? 'image' : 'other'),
          context: 'publicacoes'
        });
      } catch (err: unknown) {
        const error = err as Error;
        logger.error('Logistica.openDoc.fail', error, {
          eventoId: eventoSelecionado.id,
          documento_id: eventoSelecionado.documento_id,
          tokenPresent: !!token,
          message: error.message
        });
        Alert.alert('Erro', 'Não foi possível baixar o documento.');
      } finally {
        setLoading(false);
      }
    } else if (eventoSelecionado?.documento_url) {
      const url = eventoSelecionado.documento_url;
      const isPDF = url.toLowerCase().split('?')[0].endsWith('.pdf');

      if (isPDF) {
          navigation.navigate('FileViewer', {
              remoteUrl: url,
              title: 'Documento do Evento',
              type: 'pdf',
              context: 'publicacoes'
          });
      } else {
          Linking.openURL(url).catch(() => Alert.alert('Erro', 'Não foi possível abrir o link.'));
      }
    }
  };

  const handleSelectDocument = () => {
    navigation.navigate('Publicacoes', {
      mode: 'picker',
      returnTo: 'Logistica'
    });
  };

  useEffect(() => {
    if (route.params?.selectedFile) {
        const file = route.params.selectedFile;
        setFormEvento(prev => ({
            ...prev,
            documento_id: file.id,
            documento_url: file.webViewLink || ''
        }));
        // Limpar param para não re-setar ao voltar de outras telas
        navigation.setParams({ selectedFile: undefined });
    }
  }, [route.params?.selectedFile]);

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
      logger.info('Logistica.CreateEvent.API_OK');
      setModalEventoVisible(false);
      fetchData();
      Alert.alert('Sucesso', 'Evento salvo com sucesso!');
    } catch (err: any) {
      logger.error('Logistica.CreateEvent.API_FAIL', err as Error);
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
      justificativa: '',
      assembleia_id: eventoSelecionado.assembleia_id || ''
    });
    setModalEventoVisible(true);
  };

  const handleEncerrarEvento = () => {
    setEventoActionType('ENCERRAR');
    setEventoActionJustificativa('');
    setModalEventoActionVisible(true);
  };

  const handleCancelEvento = () => {
    setEventoActionType('CANCELAR');
    setEventoActionJustificativa('');
    setModalEventoActionVisible(true);
  };

  const confirmEventoAction = async () => {
    if (!eventoActionJustificativa.trim()) {
      Alert.alert('Aviso', 'Justificativa é obrigatória.');
      return;
    }

    try {
      if (eventoActionType === 'ENCERRAR') {
        await encerrarEventoLogistica(eventoSelecionado.id, eventoActionJustificativa);
        Alert.alert('Sucesso', 'Evento encerrado com sucesso!');
      } else {
        await cancelarEventoLogistica(eventoSelecionado.id, eventoActionJustificativa);
        Alert.alert('Sucesso', 'Evento cancelado com sucesso!');
      }
      setModalEventoActionVisible(false);
      fetchData();
    } catch (err: any) {
      logger.error('Logistica.confirmEventoAction', err as Error);
      Alert.alert('Erro', 'Não foi possível processar a ação.');
    }
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
    } catch (err: any) {
      logger.error('Logistica.saveInscricao', err as Error);
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
            } catch (err: any) {
              logger.error('Logistica.cancelMinhaInscricao', err as Error);
              Alert.alert('Erro', 'Falha ao cancelar.');
            }
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
      } catch (err: any) {
          logger.error('Logistica.cancelInscricaoTerceiro', err as Error);
          Alert.alert('Erro', 'Falha ao cancelar.');
      }
  };

  const exportData = async (type: 'pdf' | 'xls') => {
    if (!eventoSelecionado) return;
    try {
        const url = `/api/logistica/eventos/${eventoSelecionado.id}/exportar/${type}`;
        logger.info('Logistica.exportData.Request', { type, eventoId: eventoSelecionado.id });

        const response = await api.get(url);
        Alert.alert('Exportação solicitada', response.data.message || 'Enviaremos o arquivo para seu e-mail.');
    } catch (err: any) {
        logger.error('Logistica.exportError', err as Error);
        const msg = err.response?.data?.error || err.response?.data?.message || 'Falha ao solicitar exportação.';
        Alert.alert('Erro', msg);
    }
  };

  useEffect(() => {
    const actions: MenuAction[] = [];
    if (canManage) {
      actions.push({ label: 'Novo Evento', icon: 'plus-circle', onPress: () => {
        logger.info('Logistica.CreateEvent.Click', { source: 'menu' });
        const initialForm: any = { id: '', titulo: '', descricao: '', data_inicio: '', data_fim: '', documento_url: '', documento_id: '', status: STATUS_EVENTO.ATIVO, justificativa: '', assembleia_id: '' };

        if (route.params?.prefill) {
            Object.assign(initialForm, route.params.prefill);
            // Limpar prefill para não repetir ao reabrir
            navigation.setParams({ prefill: undefined });
        }

        setFormEvento(initialForm);
        setModalEventoVisible(true);
        logger.info('Logistica.CreateEvent.ModalOpen');
      }});
      if (eventoSelecionado && eventoSelecionado.status === STATUS_EVENTO.ATIVO) {
        actions.push({ label: 'Alterar Evento', icon: 'pencil', onPress: handleEditEvento });
        actions.push({ label: 'Encerrar Evento', icon: 'close-circle', onPress: handleEncerrarEvento });
        actions.push({ label: 'Cancelar Evento', icon: 'cancel', onPress: handleCancelEvento });
        actions.push({ label: 'Exportar PDF', icon: 'file-pdf-box', onPress: () => exportData('pdf') });
        actions.push({ label: 'Exportar XLS', icon: 'file-excel', onPress: () => exportData('xls') });
      } else if (eventoSelecionado) {
        actions.push({ label: 'Exportar PDF', icon: 'file-pdf-box', onPress: () => exportData('pdf') });
        actions.push({ label: 'Exportar XLS', icon: 'file-excel', onPress: () => exportData('xls') });
      }
    }

    navigation.setOptions({
      headerRight: () => actions.length > 0 ? <HeaderMenu actions={actions} /> : null,
      title: `${EMOJIS.LOGISTICA} Logística`,
      headerStyle: { backgroundColor: '#003366' },
      headerTintColor: '#fff',
    });
  }, [navigation, canManage, eventoSelecionado]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;

  return (
    <SafeScreen style={styles.container}>
      <View style={styles.filterBar}>
        <Text style={styles.filterLabel}>Filtrar:</Text>
        <PickerWrapper style={styles.filterPickerWrapper}>
          <Picker
            selectedValue={statusFilter}
            onValueChange={(v) => setStatusFilter(v)}
            style={styles.filterPicker}
          >
            <Picker.Item label="Ativos" value={STATUS_EVENTO.ATIVO} />
            <Picker.Item label="Encerrados" value={STATUS_EVENTO.ENCERRADO} />
            <Picker.Item label="Cancelados" value={STATUS_EVENTO.CANCELADO} />
            <Picker.Item label="Todos" value="ALL" />
          </Picker>
        </PickerWrapper>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {canManage && (
          <TouchableOpacity
            style={[styles.btnPrimary, { marginBottom: 20 }]}
            onPress={() => {
              logger.info('Logistica.CreateEvent.Click', { source: 'body' });
              const initialForm: any = { id: '', titulo: '', descricao: '', data_inicio: '', data_fim: '', documento_url: '', documento_id: '', status: STATUS_EVENTO.ATIVO, justificativa: '', assembleia_id: '' };
              if (route.params?.prefill) {
                  Object.assign(initialForm, route.params.prefill);
                  navigation.setParams({ prefill: undefined });
              }
              setFormEvento(initialForm);
              setModalEventoVisible(true);
              logger.info('Logistica.CreateEvent.ModalOpen');
            }}
          >
            <MaterialCommunityIcons name="plus-circle" size={20} color="#fff" />
            <Text style={styles.btnText}>Criar Novo Evento</Text>
          </TouchableOpacity>
        )}

        {eventos.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="truck-delivery" size={80} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum evento logístico disponível.</Text>
          </View>
        )}

        {/* Seletor de Eventos */}
        {eventos.length > 1 && (
            <View style={styles.selectorContainer}>
                <Text style={styles.selectorLabel}>Selecionar Evento:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {eventos.map(e => (
                        <TouchableOpacity
                            key={e.id}
                            style={[
                              styles.selectorChip,
                              eventoSelecionado?.id === e.id && styles.selectorChipActive,
                              statusFilter === 'ALL' && e.status === STATUS_EVENTO.ENCERRADO && { borderColor: '#FFC107', borderWidth: 1 },
                              statusFilter === 'ALL' && e.status === STATUS_EVENTO.CANCELADO && { borderColor: '#D32F2F', borderWidth: 1 },
                            ]}
                            onPress={() => setEventoSelecionado(e)}
                        >
                            <Text style={[styles.selectorChipText, eventoSelecionado?.id === e.id && styles.selectorChipTextActive]}>
                                {e.titulo} {statusFilter === 'ALL' && `(${e.status === STATUS_EVENTO.ATIVO ? 'Ativo' : (e.status === STATUS_EVENTO.ENCERRADO ? 'Encerrado' : 'Cancelado')})`}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        )}

        {eventoSelecionado && (
          <View style={styles.eventCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <View style={{ flex: 1, minWidth: '60%' }}>
                  <Text style={styles.eventTitle}>{eventoSelecionado.titulo}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <Badge
                      label={eventoSelecionado.status === STATUS_EVENTO.ATIVO ? 'Ativo' : (eventoSelecionado.status === STATUS_EVENTO.ENCERRADO ? 'Encerrado' : 'Cancelado')}
                      variant={eventoSelecionado.status === STATUS_EVENTO.ATIVO ? 'success' : (eventoSelecionado.status === STATUS_EVENTO.ENCERRADO ? 'warning' : 'error')}
                    />
                    {eventoSelecionado.assembleia_id && (
                        <View style={styles.linkedBadge}>
                            <MaterialCommunityIcons name="link-variant" size={12} color="#003366" />
                            <Text style={styles.linkedBadgeText}>Vinculado à Assembleia</Text>
                        </View>
                    )}
                  </View>
                </View>
            </View>
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

            {eventoSelecionado.status !== STATUS_EVENTO.ATIVO ? (
              <View style={[styles.closedBadge, eventoSelecionado.status === STATUS_EVENTO.CANCELADO && styles.cancelledBadge]}>
                <Text style={[styles.closedText, eventoSelecionado.status === STATUS_EVENTO.CANCELADO && styles.cancelledText]}>
                  EVENTO {eventoSelecionado.status === STATUS_EVENTO.ENCERRADO ? 'ENCERRADO' : 'CANCELADO'}
                </Text>
              </View>
            ) : (
              <View style={styles.actionsRow}>
                {minhaInscricao ? (
                  <View style={styles.buttonGroupRow}>
                    <TouchableOpacity style={styles.btnEdit} onPress={() => handleEditInscricao()}>
                      <MaterialCommunityIcons name="pencil" size={18} color="#fff" />
                      <Text style={styles.btnTextSmall}>Alterar Inscrição</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnCancel} onPress={() => handleCancelInscricao()}>
                      <MaterialCommunityIcons name="delete" size={18} color="#fff" />
                      <Text style={styles.btnTextSmall}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  canParticipate ? (
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => handleEditInscricao()}>
                      <MaterialCommunityIcons name="check-circle-outline" size={20} color="#fff" />
                      <Text style={styles.btnText}>Quero me inscrever</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.closedBadge, { flex: 1, marginTop: 0 }]}>
                      <Text style={[styles.closedText, { fontSize: 13 }]}>Perfil de gestão não participa de eventos</Text>
                    </View>
                  )
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
                  <View style={[styles.cellHeader, { width: 150 }]}><Text style={styles.cellHeaderText}>Observação</Text></View>
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
                        <Text style={styles.cellText}>{item.nome || item.name}</Text>
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
                      <View style={[styles.cell, { width: 150 }]}><Text style={styles.cellText}>{item.observacoes || '—'}</Text></View>
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

      <Modal visible={modalEventoVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{formEvento.id ? 'Alterar Evento' : 'Novo Evento'}</Text>
            <KeyboardAwareScrollView enableOnAndroid extraScrollHeight={100}>
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

              <Text style={styles.label}>Assembleia Vinculada (Opcional)</Text>
              <PickerWrapper style={styles.pickerWrapper}>
                <Picker
                    selectedValue={formEvento.assembleia_id}
                    onValueChange={(val) => setFormEvento({ ...formEvento, assembleia_id: val })}
                    style={styles.picker}
                >
                    <Picker.Item label="Nenhuma" value="" />
                    {assembleias.map(a => (
                        <Picker.Item key={a.id} label={`${a.tipo} - ${a.titulo}`} value={a.id} />
                    ))}
                </Picker>
              </PickerWrapper>

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
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL INSCRIÇÃO */}
      <Modal visible={modalInscricaoVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{formInscricao.isTerceiro ? 'Gerenciar Inscrição' : 'Minha Inscrição'}</Text>
            <KeyboardAwareScrollView enableOnAndroid extraScrollHeight={100}>
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
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL AÇÃO EVENTO (ENCERRAR/CANCELAR) */}
      <Modal visible={modalEventoActionVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {eventoActionType === 'ENCERRAR' ? 'Encerrar Evento' : 'Cancelar Evento'}
            </Text>
            <Text style={styles.label}>
              {eventoActionType === 'ENCERRAR'
                ? 'Explique que o evento ocorreu e as inscrições serão fechadas.'
                : 'Explique o motivo do cancelamento do evento.'}
            </Text>
            <TextInput
              style={[styles.input, { height: 100 }]}
              multiline
              value={eventoActionJustificativa}
              onChangeText={setEventoActionJustificativa}
              placeholder="Justificativa obrigatória"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancelModal} onPress={() => setModalEventoActionVisible(false)}>
                <Text style={styles.btnText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSaveModal, eventoActionType === 'CANCELAR' && { backgroundColor: '#d32f2f' }]}
                onPress={confirmEventoAction}
              >
                <Text style={styles.btnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL JUSTIFICATIVA (CANCELAMENTO INSCRIÇÃO) */}
      <Modal visible={modalJustificativaVisible} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { height: 250 }]}>
            <Text style={styles.modalTitle}>Justificativa de Cancelamento</Text>
            <TextInput style={[styles.input, { flex: 1 }]} multiline value={formInscricao.justificativa} onChangeText={t => setFormInscricao({...formInscricao, justificativa: t})} placeholder="Informe o motivo" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancelModal} onPress={() => setModalJustificativaVisible(false)}><Text style={styles.btnText}>Voltar</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnCancel} onPress={confirmCancelTerceiro}><Text style={styles.btnText}>Confirmar Cancelamento</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
  },
  filterPickerWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  filterPicker: {
    flex: 1,
  },
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
  cancelledBadge: { backgroundColor: '#eee' },
  cancelledText: { color: '#666' },
  actionsRow: { marginTop: 20 },
  buttonGroupRow: { flexDirection: 'row', gap: 10, width: '100%' },
  btnPrimary: { backgroundColor: '#003366', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  btnEdit: { backgroundColor: '#27ae60', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  btnCancel: { backgroundColor: '#d32f2f', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
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
  linkedBadge: { backgroundColor: '#eef2f7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkedBadgeText: { fontSize: 10, color: '#003366', fontWeight: 'bold' },
  pickerWrapper: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, backgroundColor: '#fafafa', marginTop: 5 },
  picker: { height: 50, width: '100%' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 25 },
  btnCancelModal: { backgroundColor: '#6c757d', padding: 12, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  btnSaveModal: { backgroundColor: '#003366', padding: 12, borderRadius: 8, minWidth: 80, alignItems: 'center' },
});

export default LogisticaScreen;
