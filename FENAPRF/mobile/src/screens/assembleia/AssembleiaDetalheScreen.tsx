import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, TextInput, Modal, Image, AppState, AppStateStatus } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { getAssembleiaDetalhe, getAssembleiaEstado, getAssembleiaEstadoMini, abrirAssembleia, encerrarAssembleia, gerarTokenQuorum, realizarCheckin, iniciarExecucao, solicitarRelatorio } from '../../services/assembleiaService';
import SafeScreen from '../../components/SafeScreen';
import HeaderMenu, { MenuAction } from '../../components/HeaderMenu';
import { Assembleia, AssembleiaEstado } from '../../types/assembleia';
import { useAuth } from '../../hooks/useAuth';
import { logger } from '../../infra/logger';
import { getAssembleiaStatusLabel } from '../../utils/format';
import { assembleiaSocket } from '../../services/assembleiaSocket';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function AssembleiaDetalheScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { id } = route.params;
  const { user, token } = useAuth();
  const [assembleia, setAssembleia] = useState<Assembleia | null>(null);
  const [estado, setEstado] = useState<AssembleiaEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenInput, setTokenInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [editalLoading, setEditalLoading] = useState(false);

  const perfil = (user?.perfil_acesso || '').toUpperCase();
  const isDiretoria = ['ADMIN', 'DIRETORIA'].includes(perfil);
  const isElegivel = ['DIRETORIA', 'CONSELHEIRO', 'COLABORADOR'].includes(perfil);
  const isPresidente = estado?.mesa && (estado.mesa as any).presidente_user_id === user?.id;
  const canSeeToken = estado?.quorumVigente?.token && (isPresidente || isDiretoria || user?.id === (estado.quorumVigente as any).gerado_por_user_id);
  const canGenerateReport = (assembleia?.estado === 'ENCERRADO' || assembleia?.estado === 'INICIADO' || assembleia?.estado === 'EM_CREDENCIAMENTO' || assembleia?.estado === 'SUSPENSA');

  const [estadoLoading, setEstadoLoading] = useState(false);

  const fetchEstado = async () => {
    try {
      setEstadoLoading(true);
      const estadoData = await getAssembleiaEstado(id);
      setEstado(estadoData);
    } catch (err: any) {
      logger.error('ASSEMBLEIA_ESTADO_FETCH_ERROR', err instanceof Error ? err : new Error(String(err)), { id });
    } finally {
      setEstadoLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      logger.info('ASSEMBLEIA_DETALHE_FETCH_START', { id, profile: user?.perfil_acesso });

      // Detalhe básico é obrigatório
      const data = await getAssembleiaDetalhe(id);
      setAssembleia(data);

      // Estado pode falhar ou ser carregado em paralelo de forma resiliente
      fetchEstado();

      logger.info('ASSEMBLEIA_DETALHE_FETCH_SUCCESS', {
        id,
        hasAssembleia: !!data,
        estadoName: data?.estado
      });
    } catch (err: any) {
      logger.error('ASSEMBLEIA_DETALHE_FETCH_ERROR', err instanceof Error ? err : new Error(String(err)), { id });
      console.error('[Assembleia.fetch]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: any;
    let isActive = true;

    const getPollingInterval = () => {
        if (!assembleia) return 8000;
        if (assembleia.estado === 'ENCERRADA') return 0;
        if (estado?.votacaoAtiva && (estado.votacaoAtiva as any).status === 'ATIVA') return 2000;
        if (assembleia.estado === 'EM_CURSO') return 5000;
        return 8000;
    };

    const runPolling = async () => {
        if (!isActive || AppState.currentState !== 'active') return;
        const currentInterval = getPollingInterval();
        if (currentInterval === 0) return;

        try {
            const mini = await getAssembleiaEstadoMini(id);
            if (mini && isActive) {
                setEstado(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        assembleia: { ...prev.assembleia, estado: mini.assembleia.estado },
                        quorumVigente: mini.quorumVigente ? {
                            ...prev.quorumVigente,
                            ...mini.quorumVigente
                        } : prev.quorumVigente,
                        votacaoAtiva: mini.votacaoAtiva
                    } as any;
                });

                if (mini.assembleia.estado !== assembleia?.estado) {
                    setAssembleia(prev => prev ? { ...prev, estado: mini.assembleia.estado } : null);
                }
            }
        } catch (err) {
            console.warn('[Polling.Detalhe.Error]', err);
        }

        if (isActive) {
            const nextInterval = getPollingInterval();
            if (nextInterval > 0) {
                interval = setTimeout(runPolling, nextInterval);
            }
        }
    };

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
            runPolling();
        } else {
            if (interval) clearTimeout(interval);
        }
    });

    runPolling();

    return () => {
        isActive = false;
        if (interval) clearTimeout(interval);
        subscription.remove();
    };
  }, [id, assembleia?.estado, !!estado?.votacaoAtiva]);

  useEffect(() => {
    fetchData();

    if (token) {
      assembleiaSocket.connect(token);
      assembleiaSocket.joinRoom(id);

      assembleiaSocket.onEvent('assembleia:status_changed', (data) => {
        setAssembleia(prev => prev ? { ...prev, estado: data.estado } : null);
      });

      assembleiaSocket.onEvent('assembleia:checkin_updated', (data) => {
        setEstado(prev => prev && prev.quorumVigente ? {
          ...prev,
          quorumVigente: { ...prev.quorumVigente, total: data.total, quorum_necessario: data.quorum_necessario }
        } : prev);
      });

      assembleiaSocket.onEvent('assembleia:token_gerado', () => {
        fetchData();
      });

      assembleiaSocket.onEvent('assembleia:recontagem', () => {
        fetchData();
      });
    }

    return () => {
      assembleiaSocket.leaveRoom(id);
      assembleiaSocket.offEvent('assembleia:status_changed');
      assembleiaSocket.offEvent('assembleia:checkin_updated');
      assembleiaSocket.offEvent('assembleia:token_gerado');
      assembleiaSocket.offEvent('assembleia:recontagem');
    };
  }, [id, token]);


  const handleAbrir = useCallback(async () => {
    Alert.alert('Confirmar', 'Deseja abrir esta assembleia para participação?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sim, Abrir', onPress: async () => {
        try {
          setActionLoading(true);
          await abrirAssembleia(id);
          fetchData();
        } catch (err: any) {
          Alert.alert('Erro', err.response?.data?.message || 'Falha ao abrir.');
        } finally {
          setActionLoading(false);
        }
      }}
    ]);
  }, [id, fetchData]);

  const handleEncerrar = useCallback(async () => {
    Alert.alert('Confirmar', 'Deseja encerrar definitivamente esta assembleia?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sim, Encerrar', style: 'destructive', onPress: async () => {
        try {
          setActionLoading(true);
          await encerrarAssembleia(id);
          fetchData();
        } catch (err: any) {
          Alert.alert('Erro', err.response?.data?.message || 'Falha ao encerrar.');
        } finally {
          setActionLoading(false);
        }
      }}
    ]);
  }, [id, fetchData]);

  const handleIniciarExecucao = useCallback(async () => {
    try {
      setActionLoading(true);
      await iniciarExecucao(id);
      Alert.alert('Sucesso', 'Assembleia iniciada! A pauta agora pode ser deliberada na sala.');
      fetchData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Falha ao iniciar execução.');
    } finally {
      setActionLoading(false);
    }
  }, [id, fetchData]);

  const handleSolicitarRelatorio = useCallback(async () => {
    try {
      setActionLoading(true);
      await solicitarRelatorio(id);
      Alert.alert('Sucesso', 'Pedido de relatório registrado. O documento será enviado para seu e-mail.');
    } catch (err: any) {
      Alert.alert('Erro', 'Falha ao solicitar relatório.');
    } finally {
      setActionLoading(false);
    }
  }, [id]);

  const handleGerarToken = useCallback(async (isGlobal = false) => {
    try {
      setActionLoading(true);
      const tipoChamada = isGlobal ? 'GLOBAL' : 'PRIMEIRA';
      const res = await gerarTokenQuorum(id, { tipo_chamada: tipoChamada, is_global: isGlobal });
      logger.info('TOKEN_GENERATED_AUTO_CHECKIN_START', { assembleiaId: id, token: res.token, isGlobal });

      try {
        await realizarCheckin(id, res.token);
        logger.info('TOKEN_GENERATED_AUTO_CHECKIN_SUCCESS', { assembleiaId: id });
        Alert.alert('Sucesso', `Token gerado: ${res.token}.\n\nSeu check-in foi realizado automaticamente.`);
      } catch (checkinErr: any) {
        logger.error('TOKEN_GENERATED_AUTO_CHECKIN_FAIL', checkinErr instanceof Error ? checkinErr : new Error(String(checkinErr)), { assembleiaId: id, token: res.token });
        Alert.alert('Atenção', `Token gerado: ${res.token}, mas não conseguimos realizar seu auto-checkin. Por favor, insira o token manualmente.`);
      }

      fetchData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao gerar token.');
    } finally {
      setActionLoading(false);
    }
  }, [id, fetchData]);

  useEffect(() => {
    const isCredenciamento = assembleia?.estado === 'EM_CREDENCIAMENTO';
    const actions: MenuAction[] = [];
    if ((isDiretoria || isPresidente) && assembleia) {
      if (isDiretoria && assembleia.estado === 'CRIADO') {
        actions.push({ label: 'Gerar QR Global', icon: 'qrcode', onPress: () => handleGerarToken(true) });
      }
      if (isCredenciamento && isDiretoria) {
        const isMesaEstabelecida = !!(estado?.mesa as any)?.estabelecida_em;
        actions.push({
            label: isMesaEstabelecida ? 'Substituir Mesa' : 'Compor Mesa',
            icon: isMesaEstabelecida ? 'account-convert-outline' : 'account-group-outline',
            onPress: () => navigation.navigate('ComporMesa', { id, substituir: isMesaEstabelecida })
        });
        actions.push({ label: 'Iniciar Execução', icon: 'play-box-multiple-outline', onPress: handleIniciarExecucao });
        actions.push({ label: 'Novo Token Quórum', icon: 'key-variant', onPress: () => handleGerarToken(false) });
        actions.push({ label: 'Encerrar Assembleia', icon: 'stop-circle-outline', onPress: handleEncerrar, isDestructive: true });
      }
      if (assembleia.estado === 'INICIADO' || assembleia.estado === 'SUSPENSA') {
        actions.push({ label: 'Ir para Sala', icon: 'door-open', onPress: () => {
            navigation.navigate('AssembleiaSala', { id });
        }});
        if (isDiretoria || isPresidente) {
          actions.push({ label: 'Iniciar Votação', icon: 'plus-circle-outline', onPress: () => navigation.navigate('CriarItemVotacao', { id }) });
        }
        actions.push({ label: 'Encerrar Assembleia', icon: 'stop-circle-outline', onPress: handleEncerrar, isDestructive: true });
      }
      if (canGenerateReport) {
        actions.push({ label: 'Relatório PDF', icon: 'file-pdf-box', onPress: handleSolicitarRelatorio });
      }
    } else if (assembleia && canGenerateReport) {
      // Caso não seja diretoria nem presidente (ex: CONSELHEIRO), mas pode gerar relatório
      actions.push({ label: 'Relatório PDF', icon: 'file-pdf-box', onPress: handleSolicitarRelatorio });
    }
    navigation.setOptions({
      headerRight: () => <HeaderMenu actions={actions} />,
      title: 'Detalhes'
    });
  }, [navigation, assembleia, isDiretoria, handleAbrir, handleGerarToken, handleEncerrar, handleIniciarExecucao, handleSolicitarRelatorio]);

  const handleCheckin = async () => {
    if (tokenInput.length !== 6) {
      Alert.alert('Aviso', 'O token deve ter 6 dígitos.');
      return;
    }
    try {
      setActionLoading(true);
      await realizarCheckin(id, tokenInput);
      Alert.alert('Sucesso', 'Check-in realizado com sucesso!');
      setTokenInput('');
      fetchData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Token inválido ou expirado.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerEdital = async () => {
    if (!assembleia?.edital_url) return;

    const url = assembleia.edital_url;
    const cleanUrl = url.split('?')[0];
    const extension = cleanUrl.split('.').pop()?.toLowerCase();

    navigation.navigate('FileViewer', {
        remoteUrl: url,
        title: `Edital - ${assembleia.titulo}`,
        fileId: id,
        type: (extension === 'pdf' || assembleia.edital_format === 'pdf') ? 'pdf' : (['jpg', 'jpeg', 'png', 'webp'].includes(extension || '') ? 'image' : 'other'),
        context: 'assembleia-edital',
        format: assembleia.edital_format,
        resourceType: assembleia.edital_resource_type
    });
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;
  }

  if (!assembleia) {
    // Screen-level guard log
    logger.warn('ASSEMBLEIA_DETALHE_GUARD_TRIGGERED', { id, loading });

    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#e74c3c" />
        <Text style={styles.errorText}>Não foi possível carregar os dados desta assembleia.</Text>
        <TouchableOpacity style={[styles.btnAction, { marginTop: 20 }]} onPress={fetchData}>
          <Text style={styles.btnActionText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasCheckedIn = estado?.quorumVigente?.userHasCheckedIn || false;
  const isParticipavel = assembleia.estado === 'EM_CREDENCIAMENTO' || assembleia.estado === 'INICIADO' || assembleia.estado === 'SUSPENSA';
  const isEncerrada = assembleia.estado === 'ENCERRADO';
  const isIniciado = assembleia.estado === 'INICIADO' || assembleia.estado === 'SUSPENSA';

  return (
    <SafeScreen style={{ backgroundColor: '#f2f4f8' }}>
    <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={80}
        keyboardOpeningTime={0}
    >
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.btnVoltar}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#003366" />
          <Text style={styles.btnVoltarText}>Voltar para Lista</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={[styles.badge, styles[`badge${assembleia.estado}`]]}>
          <Text style={styles.badgeText}>{getAssembleiaStatusLabel(assembleia.estado)}</Text>
        </View>
        <Text style={styles.tipoText}>{assembleia.tipo}</Text>
      </View>

      <Text style={styles.tituloText}>{assembleia.titulo}</Text>

      <View style={styles.pautaCard}>
          <Text style={styles.pautaTitle}>📌 Pauta da Assembleia</Text>
          <Text style={styles.pautaText}>{assembleia.pauta}</Text>
      </View>

      <View style={styles.fieldRow}>
          <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>📅 Data do Evento</Text>
              <Text style={styles.fieldValue}>
                  {assembleia.data_evento ? new Date(assembleia.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '--/--/----'}
              </Text>
          </View>
          {!isEncerrada && (
          <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>🕒 Chamadas (1ª / 2ª)</Text>
              <Text style={styles.fieldValue}>{assembleia.hora_primeira_chamada} / {assembleia.hora_segunda_chamada}</Text>
          </View>
          )}
      </View>

      {canSeeToken && (
        <View style={styles.tokenCardVigente}>
            <Text style={styles.tokenLabelVigente}>🔑 Token de Presença Vigente</Text>
            <Text style={styles.tokenValueVigente}>{estado?.quorumVigente?.token}</Text>
            <Text style={styles.tokenHintVigente}>Compartilhe este código com os users presentes</Text>
        </View>
      )}

      {isIniciado && estado?.mesa && (
        <View style={[styles.infoCard, { borderLeftWidth: 5, borderLeftColor: '#003366' }]}>
            <Text style={styles.infoTitle}>🧑‍⚖️ Mesa Diretora</Text>
            <View style={styles.mesaRow}>
                <MaterialCommunityIcons name="account-tie" size={20} color="#003366" />
                <Text style={styles.mesaLabel}>Presidente:</Text>
                <Text style={styles.mesaValue}>{estado.mesa.presidente_nome}</Text>
            </View>
            <View style={styles.mesaRow}>
                <MaterialCommunityIcons name="account-tie-outline" size={20} color="#003366" />
                <Text style={styles.mesaLabel}>Vice-Pres:</Text>
                <Text style={styles.mesaValue}>{estado.mesa.vice_presidente_nome || '-'}</Text>
            </View>
            <View style={styles.mesaRow}>
                <MaterialCommunityIcons name="account-edit" size={20} color="#003366" />
                <Text style={styles.mesaLabel}>1º Sec:</Text>
                <Text style={styles.mesaValue}>{estado.mesa.secretario_nome}</Text>
            </View>
            <View style={styles.mesaRow}>
                <MaterialCommunityIcons name="account-edit-outline" size={20} color="#003366" />
                <Text style={styles.mesaLabel}>2º Sec:</Text>
                <Text style={styles.mesaValue}>{estado.mesa.secretario_2_nome || '-'}</Text>
            </View>
        </View>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>📄 Edital de Convocação</Text>
        {assembleia.edital_url ? (
          <TouchableOpacity
            style={styles.btnEdital}
            onPress={handleVerEdital}
            disabled={editalLoading}
            accessibilityLabel="Ver Edital de Convocação"
            accessibilityRole="button"
          >
            {editalLoading ? (
              <ActivityIndicator size="small" color="#003366" />
            ) : (
              <MaterialCommunityIcons
                name={assembleia.edital_url.toLowerCase().endsWith('.pdf') ? 'file-pdf-box' : 'image'}
                size={24}
                color="#003366"
              />
            )}
            <Text style={styles.btnEditalText}>
              {editalLoading ? 'Carregando...' : 'Ver Edital'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.noEditalBox}>
            <MaterialCommunityIcons name="file-cancel-outline" size={20} color="#999" />
            <Text style={styles.noEditalText}>Sem edital anexado</Text>
          </View>
        )}
      </View>

      {!isEncerrada && (
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>👥 Quórum Atual</Text>
        {estadoLoading ? (
            <ActivityIndicator size="small" color="#003366" style={{ alignSelf: 'flex-start', marginVertical: 8 }} />
        ) : !estado ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles.infoValue, { color: '#999' }]}>Indisponível</Text>
                <TouchableOpacity onPress={fetchEstado} style={styles.btnRetrySmall}>
                    <MaterialCommunityIcons name="refresh" size={16} color="#003366" />
                    <Text style={styles.btnRetrySmallText}>Tentar</Text>
                </TouchableOpacity>
            </View>
        ) : (
            <>
                <Text style={styles.infoValue}>{estado?.quorumVigente?.total || 0} presentes</Text>
                {estado?.quorumVigente && (
                <View style={styles.quorumDetails}>
                    {!isIniciado && (
                        <>
                            <Text style={styles.quorumStatus}>
                                {estado.quorumVigente.tipo_chamada === 'PRIMEIRA' ? '1ª Chamada (Qualificado)' : '2ª Chamada (Real)'}
                            </Text>
                            <Text style={styles.quorumStatus}>
                                Total de Users Aptos: {estado.quorumVigente.quorum_total_ativos || 0}
                            </Text>
                            <Text style={styles.quorumStatus}>
                                Mínimo necessário: {estado.quorumVigente.quorum_necessario || 'Qualquer número'}
                            </Text>
                        </>
                    )}
                    {isIniciado && (
                         <Text style={styles.quorumStatus}>
                            Quórum vigente (na abertura): {estado.quorumVigente.total} presentes
                         </Text>
                    )}
                </View>
                )}

                <View style={{ marginTop: 15, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 }}>
                    <Text style={[styles.infoTitle, { fontSize: 12, textAlign: 'left', marginBottom: 5 }]}>Lista Nominal</Text>
                    {estado.quorumVigente?.presentes && estado.quorumVigente.presentes.length > 0 ? (
                        estado.quorumVigente.presentes.map((p: any) => (
                        <View key={p.id} style={styles.presenteRow}>
                            <MaterialCommunityIcons name="account-check" size={16} color="#27ae60" />
                            <Text style={styles.presenteNome}>{p.nome}</Text>
                        </View>
                        ))
                    ) : (
                        <Text style={styles.emptyTextSmall}>Nenhum presente registrado.</Text>
                    )}
                </View>
            </>
        )}
      </View>
      )}

      {(isDiretoria || canGenerateReport) && assembleia && !isEncerrada && (
        <View style={[styles.infoCard, styles.diretoriaSection]}>
            <Text style={styles.infoTitle}>⚡ Ações e Gestão</Text>
            <View style={styles.diretoriaButtons}>
                {isDiretoria && assembleia.estado === 'CRIADO' && (
                    <TouchableOpacity
                      style={styles.btnManagement}
                      onPress={() => handleGerarToken(true)}
                    >
                        <Text style={styles.btnActionText}>Gerar QR Global</Text>
                    </TouchableOpacity>
                )}
                {isDiretoria && assembleia.estado === 'EM_CREDENCIAMENTO' && (
                    <>
                        <TouchableOpacity
                          style={styles.btnManagement}
                          onPress={() => navigation.navigate('ComporMesa', { id, substituir: !!(estado?.mesa as any)?.estabelecida_em })}
                        >
                            <Text style={styles.btnActionText}>{(estado?.mesa as any)?.estabelecida_em ? 'Trocar Mesa' : 'Compor Mesa'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.btnManagement}
                          onPress={() => handleGerarToken(false)}
                        >
                            <Text style={styles.btnActionText}>Novo Token</Text>
                        </TouchableOpacity>
                    </>
                )}
                {isDiretoria && (assembleia.estado === 'INICIADO' || assembleia.estado === 'SUSPENSA') && (
                    <>
                        <TouchableOpacity
                          style={styles.btnManagement}
                          onPress={() => navigation.navigate('ComporMesa', { id, substituir: true })}
                        >
                            <Text style={styles.btnActionText}>Trocar Mesa</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.btnManagement, styles.btnDanger]}
                          onPress={handleEncerrar}
                        >
                            <Text style={[styles.btnActionText, { color: '#fff' }]}>Encerrar</Text>
                        </TouchableOpacity>
                    </>
                )}
                {canGenerateReport && (
                    <TouchableOpacity
                      style={styles.btnManagement}
                      onPress={handleSolicitarRelatorio}
                    >
                        <Text style={styles.btnActionText}>Relatório PDF</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
      )}

      {isEncerrada && (
        <View style={[styles.infoCard, { borderLeftWidth: 5, borderLeftColor: '#003366', alignItems: 'center' }]}>
            <MaterialCommunityIcons name="file-check" size={48} color="#003366" />
            <Text style={[styles.tituloText, { fontSize: 18, marginTop: 10, textAlign: 'center' }]}>Assembleia Encerrada</Text>
            <Text style={{ color: '#666', textAlign: 'center', marginBottom: 20 }}>Os itens desta assembleia foram deliberados. O relatório consolidado está disponível para solicitação.</Text>
            <TouchableOpacity
                style={[styles.btnSala, { width: '100%', backgroundColor: '#27ae60' }]}
                onPress={handleSolicitarRelatorio}
                disabled={actionLoading}
            >
                <MaterialCommunityIcons name="file-pdf-box" size={24} color="#fff" />
                <Text style={styles.btnSalaText}>{actionLoading ? 'Solicitando...' : 'Solicitar Relatório PDF'}</Text>
            </TouchableOpacity>
        </View>
      )}

      {isParticipavel && (
        <View style={styles.interactionSection}>
          {!isElegivel ? (
             <View style={styles.notEligibleBox}>
                <MaterialCommunityIcons name="lock" size={24} color="#856404" />
                <Text style={styles.notEligibleText}>Seu perfil ({perfil}) não possui permissão para realizar check-in.</Text>
             </View>
          ) : hasCheckedIn ? (
            <View style={styles.salaBox}>
                <TouchableOpacity
                    style={styles.btnSala}
                    onPress={() => navigation.navigate('AssembleiaSala', { id })}
                    accessibilityLabel="Ir para a Sala de Votação"
                    accessibilityRole="button"
                >
                    <MaterialCommunityIcons name="door-open" size={24} color="#fff" />
                    <Text style={styles.btnSalaText}>Ir para a Sala de Votação</Text>
                </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.checkinCard}>
              <Text style={styles.checkinTitle}>Check-in necessário</Text>
              <Text style={styles.checkinSubtitle}>Informe o token de 6 dígitos para registrar sua presença.</Text>
              <TextInput
                style={styles.tokenInput}
                placeholder="000000"
                keyboardType="numeric"
                maxLength={6}
                value={tokenInput}
                onChangeText={setTokenInput}
              />
              <TouchableOpacity
                style={styles.btnCheckin}
                onPress={handleCheckin}
                disabled={actionLoading}
                accessibilityLabel="Confirmar Presença com Token"
                accessibilityRole="button"
              >
                <Text style={styles.btnText}>{actionLoading ? 'Confirmando...' : 'Confirmar Presença'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

    </KeyboardAwareScrollView>


    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  btnRetrySmall: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, borderRadius: 6, backgroundColor: '#eee' },
  btnRetrySmallText: { fontSize: 12, color: '#003366', fontWeight: 'bold' },
  btnEdital: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#003366',
    padding: 12,
    borderRadius: 8,
  },
  btnEditalText: { color: '#003366', fontWeight: 'bold', fontSize: 16 },
  noEditalBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 4 },
  noEditalText: { color: '#999', fontSize: 14, fontStyle: 'italic' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 15 },
  closeButton: { padding: 5 },
  viewerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  fullImage: { width: '100%', height: '100%' },
  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#eee' },
  shareBtn: {
    flexDirection: 'row',
    backgroundColor: '#003366',
    padding: 15,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },
  container: { flex: 1, backgroundColor: '#f2f4f8', paddingHorizontal: 16, paddingTop: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#666', textAlign: 'center', marginTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeCRIADO: { backgroundColor: '#cfe2ff' },
  badgeEM_CREDENCIAMENTO: { backgroundColor: '#d1e7dd' },
  badgeINICIADO: { backgroundColor: '#fff3cd' },
  badgeSUSPENSA: { backgroundColor: '#e2e3e5' },
  badgeENCERRADO: { backgroundColor: '#f8d7da' },
  badgeText: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  tipoText: { fontWeight: 'bold', color: '#666', fontSize: 16 },
  tituloText: { fontSize: 24, fontWeight: 'bold', color: '#003366', marginBottom: 8 },
  descricaoText: { fontSize: 16, color: '#555', marginBottom: 20 },
  infoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, elevation: 2 },
  infoTitle: { fontSize: 14, color: '#666', marginBottom: 12, textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase' },
  infoValue: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  btnAction: { backgroundColor: '#f1c40f', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnActionText: { color: '#003366', fontWeight: 'bold' },
  interactionSection: { marginBottom: 20 },
  salaBox: { width: '100%' },
  btnSala: { backgroundColor: '#003366', padding: 18, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  btnSalaText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  checkinCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderLeftWidth: 5, borderLeftColor: '#f1c40f' },
  checkinTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  checkinSubtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  tokenInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 24, textAlign: 'center', marginBottom: 16, letterSpacing: 8 },
  btnCheckin: { backgroundColor: '#f1c40f', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#003366', fontWeight: 'bold', fontSize: 16 },
  quorumDetails: { marginTop: 8, gap: 2 },
  quorumStatus: { fontSize: 12, color: '#666' },
  mesaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  mesaLabel: { fontSize: 14, fontWeight: 'bold', color: '#555' },
  mesaValue: { fontSize: 14, color: '#333' },
  presenteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
  presenteNome: { fontSize: 14, color: '#333' },
  emptyTextSmall: { fontSize: 13, color: '#999', textAlign: 'center', fontStyle: 'italic', marginVertical: 8 },
  notEligibleBox: { backgroundColor: '#fff3cd', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  notEligibleText: { color: '#856404', fontSize: 14, flex: 1, fontWeight: '500' },
  btnVoltar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  btnVoltarText: { color: '#003366', fontWeight: 'bold', fontSize: 14 },
  pautaCard: { backgroundColor: '#f8fbff', borderRadius: 12, padding: 16, marginBottom: 20, borderLeftWidth: 5, borderLeftColor: '#003366', borderTopWidth: 1, borderTopColor: '#e0e8f0', borderRightWidth: 1, borderRightColor: '#e0e8f0', borderBottomWidth: 1, borderBottomColor: '#e0e8f0' },
  pautaTitle: { fontSize: 14, fontWeight: 'bold', color: '#003366', marginBottom: 8 },
  pautaText: { fontSize: 15, color: '#333', lineHeight: 22 },
  fieldRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  fieldGroup: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  fieldLabel: { fontSize: 10, fontWeight: 'bold', color: '#666', textTransform: 'uppercase', marginBottom: 4 },
  fieldValue: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  diretoriaSection: { marginTop: 0 },
  diretoriaButtons: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  btnManagement: { minWidth: '30%', flex: 1, backgroundColor: '#f1c40f', padding: 12, borderRadius: 8, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  btnDanger: { backgroundColor: '#e74c3c' },
  tokenCardVigente: { backgroundColor: '#fffdf0', borderRadius: 12, padding: 20, marginBottom: 20, borderStyle: 'dashed', borderWidth: 2, borderColor: '#f1c40f', alignItems: 'center', elevation: 2 },
  tokenLabelVigente: { fontSize: 13, fontWeight: 'bold', color: '#856404', marginBottom: 8, textTransform: 'uppercase' },
  tokenValueVigente: { fontSize: 40, fontWeight: '900', color: '#003366', letterSpacing: 10 },
  tokenHintVigente: { fontSize: 12, color: '#666', marginTop: 8, fontWeight: '500' },
});
