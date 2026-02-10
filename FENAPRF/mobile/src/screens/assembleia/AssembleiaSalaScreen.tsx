import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, ScrollView, FlatList, AppState, AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getAssembleiaEstado, getAssembleiaEstadoMini, enviarVoto, pedirPalavra, concederPalavra, iniciarVotacaoProposta, gerarTokenQuorum, encerrarVotacao, encerrarAssembleia, suspenderAssembleia, retomarAssembleia } from '../../services/assembleiaService';
import { assembleiaSocket } from '../../services/assembleiaSocket';
import { formatTimeSP } from '../../utils/date';
import HeaderMenu, { MenuAction } from '../../components/HeaderMenu';
import { AssembleiaEstado, VotacaoItem, VotoNominal } from '../../types/assembleia';
import { useAuth } from '../../hooks/useAuth';

export default function AssembleiaSalaScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { id } = route.params;
  const { user, token } = useAuth();
  const [estado, setEstado] = useState<AssembleiaEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingVoto, setSendingVoto] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const perfil = (user?.perfil_acesso || '').toUpperCase();
  const isDiretoria = perfil === 'DIRETORIA' || perfil === 'ADMIN';
  const isPresidente = estado?.mesa && (estado.mesa as any).presidente_user_id === user?.id;
  const isElegivel = ['DIRETORIA', 'CONSELHEIRO', 'COLABORADOR'].includes(perfil);
  const temAutoridade = isPresidente || isDiretoria;
  const canSeeToken = estado?.quorumVigente?.token && (temAutoridade || user?.id === (estado.quorumVigente as any).gerado_por_user_id);

  const handlePedirPalavra = useCallback(async () => {
    try {
      await pedirPalavra(id);
      Alert.alert('Sucesso', 'Seu pedido foi registrado.');
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Falha ao solicitar palavra.');
    }
  }, [id]);

  const fetchData = useCallback(async () => {
    try {
      const data = await getAssembleiaEstado(id);
      setEstado(data);
    } catch (err) {
      console.error('[Sala.fetch]', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleRecontagem = useCallback(async () => {
    Alert.alert('Confirmar Recontagem', 'Isso invalidará todos os check-ins atuais e gerará um novo token. Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sim, Recontar', onPress: async () => {
        try {
          await gerarTokenQuorum(id, { tipo_chamada: 'RECONTAGEM' });
        } catch (err: any) {
          Alert.alert('Erro', err.response?.data?.error || 'Falha ao solicitar recontagem.');
        }
      }}
    ]);
  }, [id]);

  const handleEncerrarVotacaoManual = useCallback(async () => {
    if (!estado?.votacaoAtiva) return;
    try {
      await encerrarVotacao(id, estado.votacaoAtiva.id);
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Falha ao encerrar votação.');
    }
  }, [id, estado?.votacaoAtiva]);

  const handleConcederPalavra = async (pid: string) => {
    try {
      await concederPalavra(id, pid);
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Falha ao conceder palavra.');
    }
  };

  const handleIniciarVotacaoProposta = async (prid: string) => {
    try {
      const res = await iniciarVotacaoProposta(id, prid);
      if ((res as any).status === 'RETIRADA_AUTOR_AUSENTE') {
        Alert.alert('Proposta Retirada', 'A proposta foi retirada de pauta automaticamente pois o autor não está presente na votação.');
        fetchData();
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Falha ao iniciar votação da proposta.');
    }
  };

  const handleEncerrarAssembleiaManual = useCallback(async () => {
    Alert.alert('Confirmar Encerramento', 'Deseja encerrar definitivamente esta assembleia? Esta ação gerará a ATA final.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sim, Encerrar', style: 'destructive', onPress: async () => {
        try {
          await encerrarAssembleia(id);
        } catch (err: any) {
          Alert.alert('Erro', err.response?.data?.error || 'Falha ao encerrar assembleia.');
        }
      }}
    ]);
  }, [id]);

  const handleSuspender = useCallback(() => {
    Alert.prompt(
      'Suspender Assembleia',
      'Informe o motivo da suspensão e previsão de retorno:',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Suspender',
          onPress: async (motivo) => {
            if (!motivo) return Alert.alert('Erro', 'O motivo é obrigatório.');
            try {
              await suspenderAssembleia(id, { motivo });
              Alert.alert('Sucesso', 'Assembleia suspensa.');
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.error || 'Falha ao suspender.');
            }
          }
        }
      ]
    );
  }, [id]);

  const handleRetomar = useCallback(async () => {
    try {
      await retomarAssembleia(id);
      Alert.alert('Sucesso', 'Assembleia retomada.');
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Falha ao retomar.');
    }
  }, [id]);

  // Configura as ações do cabeçalho
  useEffect(() => {
    const actions: MenuAction[] = [
      { label: 'Pedir Palavra', icon: 'microphone', onPress: handlePedirPalavra },
      { label: 'Nova Proposta', icon: 'file-document-edit-outline', onPress: () => navigation.navigate('Propostas', { id }) }
    ];

    if (temAutoridade) {
      if (estado?.assembleia.estado === 'INICIADO') {
        actions.push({ label: 'Iniciar Votação', icon: 'plus-circle-outline', onPress: () => navigation.navigate('CriarItemVotacao', { id }) });
        actions.push({ label: 'Solicitar Recontagem', icon: 'refresh', onPress: handleRecontagem });
        actions.push({ label: 'Suspender Assembleia', icon: 'pause-circle-outline', onPress: handleSuspender });
      } else if (estado?.assembleia.estado === 'SUSPENSA') {
        actions.push({ label: 'Retomar Assembleia', icon: 'play-circle-outline', onPress: handleRetomar });
      }

      if (isDiretoria && estado?.votacaoAtiva && estado.votacaoAtiva.status === 'ATIVA') {
        actions.push({ label: 'Encerrar Votação Item', icon: 'stop-circle-outline', onPress: handleEncerrarVotacaoManual });
      }
      if (isDiretoria) {
        actions.push({ label: 'Encerrar Assembleia', icon: 'close-circle-outline', onPress: handleEncerrarAssembleiaManual, isDestructive: true });
      }
    }

    navigation.setOptions({
      headerRight: () => <HeaderMenu actions={actions} />,
      title: 'Sala de Votação'
    });
  }, [id, isPresidente, estado?.votacaoAtiva?.status, handlePedirPalavra, handleRecontagem, handleEncerrarVotacaoManual, handleEncerrarAssembleiaManual, navigation]);

  // Carregamento inicial de dados
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let interval: any;
    let isActive = true;

    const getPollingInterval = () => {
        if (!estado) return 5000;
        if (estado.assembleia.estado === 'ENCERRADA') return 0;
        if (estado.votacaoAtiva && estado.votacaoAtiva.status === 'ATIVA') return 2000;
        return 5000;
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
                if (mini.assembleia.estado === 'ENCERRADA') {
                    navigation.navigate('AssembleiaDetalhe', { id });
                }
            }
        } catch (err) {
            console.warn('[Polling.Sala.Error]', err);
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
  }, [id, estado?.assembleia?.estado, !!estado?.votacaoAtiva, navigation]);

  // Gerenciamento de Socket.IO
  useEffect(() => {
    if (token) {
      assembleiaSocket.connect(token);
      assembleiaSocket.joinRoom(id);

      assembleiaSocket.onEvent('assembleia:status_changed', (data) => {
        setEstado(prev => prev ? { ...prev, assembleia: { ...prev.assembleia, estado: data.estado } } : null);
        if (data.estado === 'ENCERRADA') {
            navigation.goBack();
        }
      });

      assembleiaSocket.onEvent('votacao:iniciada', (data) => {
        setEstado(prev => prev ? { ...prev, votacaoAtiva: data } : null);
      });

      assembleiaSocket.onEvent('voto:updated', (data) => {
        setEstado(prev => {
          if (!prev || !prev.votacaoAtiva) return prev;
          return {
            ...prev,
            votacaoAtiva: {
              ...prev.votacaoAtiva,
              contagem: data.contagem,
              votos: data.votos
            }
          };
        });
      });

      assembleiaSocket.onEvent('assembleia:checkin_updated', (data) => {
        setEstado(prev => prev && prev.quorumVigente ? {
          ...prev,
          quorumVigente: { ...prev.quorumVigente, total: data.total, quorum_necessario: data.quorum_necessario }
        } : prev);
      });

      assembleiaSocket.onEvent('word_queue_updated', (data) => {
        setEstado(prev => prev ? { ...prev, pedidosPalavra: data } : null);
      });

      assembleiaSocket.onEvent('new_proposal', (data) => {
        setEstado(prev => prev ? { ...prev, propostas: [...prev.propostas, data] } : null);
      });

      assembleiaSocket.onEvent('proposals_updated', (data) => {
        setEstado(prev => prev ? { ...prev, propostas: data } : null);
      });

      assembleiaSocket.onEvent('assembleia:token_gerado', () => {
         fetchData();
      });

      assembleiaSocket.onEvent('assembleia:recontagem', () => {
         fetchData();
         Alert.alert('Recontagem', 'Uma nova recontagem foi iniciada. Por favor, realize o check-in novamente na tela de detalhes.');
         navigation.navigate('AssembleiaDetalhe', { id });
      });

      assembleiaSocket.onEvent('votacao:encerrada', (data) => {
          setEstado(prev => prev && prev.votacaoAtiva ? { ...prev, votacaoAtiva: { ...prev.votacaoAtiva, ...data, status: 'ENCERRADA' } } : prev);
      });

      assembleiaSocket.onEvent('assembleia:encerrada', () => {
          navigation.navigate('AssembleiaDetalhe', { id });
      });
    }

    return () => {
      assembleiaSocket.leaveRoom(id);
      assembleiaSocket.offEvent('assembleia:status_changed');
      assembleiaSocket.offEvent('votacao:iniciada');
      assembleiaSocket.offEvent('voto:updated');
      assembleiaSocket.offEvent('assembleia:checkin_updated');
      assembleiaSocket.offEvent('word_queue_updated');
      assembleiaSocket.offEvent('new_proposal');
      assembleiaSocket.offEvent('proposals_updated');
      assembleiaSocket.offEvent('assembleia:token_gerado');
      assembleiaSocket.offEvent('assembleia:recontagem');
      assembleiaSocket.offEvent('votacao:encerrada');
      assembleiaSocket.offEvent('assembleia:encerrada');
    };
  }, [id, token, fetchData]);

  const handleVotar = async (voto: 'SIM' | 'NAO') => {
    if (!estado?.votacaoAtiva) return;
    try {
      setSendingVoto(true);
      await enviarVoto(id, estado.votacaoAtiva.id, voto);
      Alert.alert('Sucesso', 'Voto registrado com sucesso!');
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Falha ao votar.');
    } finally {
      setSendingVoto(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (estado?.votacaoAtiva && estado.votacaoAtiva.status === 'ATIVA') {
       const end = new Date(estado.votacaoAtiva.encerra_em).getTime();
       interval = setInterval(() => {
          const now = new Date().getTime();
          const diff = Math.max(0, Math.floor((end - now) / 1000));
          setTimeLeft(diff);
          if (diff === 0) {
              fetchData();
              clearInterval(interval);
          }
       }, 1000);
    } else {
        setTimeLeft(null);
    }
    return () => clearInterval(interval);
  }, [estado?.votacaoAtiva, fetchData]);

  if (loading || !estado) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;
  }

  const { votacaoAtiva, quorumVigente } = estado;
  const votosNominais = votacaoAtiva?.votos || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
            <Text style={styles.assembleiaTitulo}>{estado.assembleia.titulo}</Text>
            <View style={styles.quorumBox}>
                <MaterialCommunityIcons name="account-group" size={16} color="#666" />
                <Text style={styles.quorumText}>{quorumVigente?.total || 0} presentes</Text>
            </View>
        </View>
        {estado.mesa && (
            <View style={styles.mesaBrief}>
                <MaterialCommunityIcons name="account-tie" size={24} color="#003366" />
            </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {canSeeToken && (
            <View style={styles.tokenCard}>
                <Text style={styles.tokenLabel}>🔑 Token de Presença Vigente</Text>
                <Text style={styles.tokenValue}>{estado.quorumVigente?.token}</Text>
                <Text style={styles.tokenHint}>Compartilhe com os presentes</Text>
            </View>
        )}

        {estado.assembleia.estado === 'SUSPENSA' && (
            <View style={styles.suspensaCard}>
                <MaterialCommunityIcons name="pause-circle" size={48} color="#7f8c8d" />
                <Text style={styles.suspensaTitle}>Assembleia Suspensa</Text>
                <Text style={styles.suspensaMotivo}>{estado.assembleia.suspensao_motivo}</Text>
                {estado.assembleia.data_hora_retorno && (
                    <Text style={styles.suspensaRetorno}>Previsão de retorno: {new Date(estado.assembleia.data_hora_retorno).toLocaleString()}</Text>
                )}
            </View>
        )}

        {estado.mesa && (
            <View style={styles.mesaCard}>
                <Text style={styles.mesaTitle}>🧑‍⚖️ Mesa Diretora</Text>
                <View style={styles.mesaRow}>
                    <Text style={styles.mesaLabel}>Presidente:</Text>
                    <Text style={styles.mesaValue}>{estado.mesa.presidente_nome}</Text>
                </View>
                <View style={styles.mesaRow}>
                    <Text style={styles.mesaLabel}>Vice-Presidente:</Text>
                    <Text style={styles.mesaValue}>{estado.mesa.vice_presidente_nome || '-'}</Text>
                </View>
                <View style={styles.mesaRow}>
                    <Text style={styles.mesaLabel}>1º Secretário:</Text>
                    <Text style={styles.mesaValue}>{estado.mesa.secretario_nome}</Text>
                </View>
                <View style={styles.mesaRow}>
                    <Text style={styles.mesaLabel}>2º Secretário:</Text>
                    <Text style={styles.mesaValue}>{estado.mesa.secretario_2_nome || '-'}</Text>
                </View>

                {temAutoridade && estado.assembleia.estado === 'INICIADO' && (
                    <View style={styles.mesaAcoes}>
                        <Text style={styles.mesaAcoesTitle}>Ações de Comando</Text>
                        <View style={styles.mesaAcoesGrid}>
                            {isDiretoria && (
                                <TouchableOpacity
                                    style={styles.btnComando}
                                    onPress={() => navigation.navigate('CriarItemVotacao', { id })}
                                    accessibilityLabel="Novo Item de Votação"
                                    accessibilityRole="button"
                                >
                                    <MaterialCommunityIcons name="plus-circle" size={20} color="#fff" />
                                    <Text style={styles.btnComandoText}>Novo Item</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.btnComando, !isDiretoria && { flex: 0, paddingHorizontal: 30 }]}
                                onPress={handleRecontagem}
                                accessibilityLabel="Solicitar Recontagem de Quórum"
                                accessibilityRole="button"
                            >
                                <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
                                <Text style={styles.btnComandoText}>Recontar Quórum</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        )}
        {votacaoAtiva ? (
          <View style={styles.votacaoCard}>
            <Text style={styles.sectionTitle}>🗳️ Votação Ativa</Text>
            <View style={styles.votacaoHeader}>
              <Text style={styles.votacaoBadge}>{votacaoAtiva.status}</Text>
              {timeLeft !== null && (
                  <View style={styles.timerBox}>
                    <MaterialCommunityIcons name="clock-outline" size={20} color="#e74c3c" />
                    <Text style={styles.timerText}>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</Text>
                  </View>
              )}
            </View>
            <Text style={styles.votacaoTitulo}>{votacaoAtiva.titulo}</Text>
            <Text style={styles.votacaoDesc}>{votacaoAtiva.descricao}</Text>

            {votacaoAtiva.status === 'ATIVA' && isElegivel && votacaoAtiva.user_eligibility?.elegivel !== false ? (
              votacaoAtiva.user_eligibility?.jaVotou ? (
                <View style={styles.votedNotice}>
                  <MaterialCommunityIcons name="check-circle" size={30} color="#27ae60" />
                  <Text style={styles.votedText}>Seu voto foi computado.</Text>
                  <TouchableOpacity style={{ marginTop: 10 }} onPress={() => setEstado(prev => prev ? { ...prev, votacaoAtiva: { ...prev.votacaoAtiva!, user_eligibility: { ...prev.votacaoAtiva!.user_eligibility!, jaVotou: false } } } : null)}>
                      <Text style={{ color: '#003366', textDecorationLine: 'underline' }}>Alterar Voto</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.votoActions}>
                  <TouchableOpacity
                    style={[styles.btnVoto, styles.btnSim]}
                    onPress={() => handleVotar('SIM')}
                    disabled={sendingVoto}
                    accessibilityLabel="Votar SIM"
                    accessibilityRole="button"
                  >
                    <Text style={styles.btnVotoText}>SIM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnVoto, styles.btnNao]}
                    onPress={() => handleVotar('NAO')}
                    disabled={sendingVoto}
                    accessibilityLabel="Votar NÃO"
                    accessibilityRole="button"
                  >
                    <Text style={styles.btnVotoText}>NÃO</Text>
                  </TouchableOpacity>
                </View>
              )
            ) : votacaoAtiva.status === 'ATIVA' ? (
              <View style={styles.notEligibleBox}>
                <Text style={styles.notEligibleText}>Você não é elegível para este item (ausente no quórum).</Text>
              </View>
            ) : null}

            {votacaoAtiva.contagem && (
              <View style={styles.placares}>
                <View style={styles.placarItem}>
                  <Text style={styles.placarLabel}>SIM</Text>
                  <Text style={styles.placarValue}>{votacaoAtiva.contagem.SIM}</Text>
                </View>
                <View style={styles.placarItem}>
                  <Text style={styles.placarLabel}>NÃO</Text>
                  <Text style={styles.placarValue}>{votacaoAtiva.contagem.NAO}</Text>
                </View>
                <View style={styles.placarItem}>
                  <Text style={styles.placarLabel}>ABST.</Text>
                  <Text style={styles.placarValue}>{votacaoAtiva.contagem.ABSTENCAO}</Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.waitingCard}>
            <ActivityIndicator size="small" color="#666" />
            <Text style={styles.waitingText}>Aguardando próximo item de pauta...</Text>
          </View>
        )}

        {votosNominais.length > 0 && (
          <View style={styles.nominaisSection}>
            <Text style={styles.sectionTitle}>👥 Votos Nominais (Ao vivo)</Text>
            {votosNominais.map((v, i) => (
              <View key={i} style={styles.votoNominalRow}>
                <Text style={styles.nominalNome}>{v.name || v.nome}</Text>
                <Text style={[styles.nominalOpcao, styles[`opcao${v.voto}`]]}>{v.voto}</Text>
              </View>
            ))}
          </View>
        )}

        {(estado.pedidosPalavra || []).length > 0 && (
          <View style={styles.nominaisSection}>
            <Text style={styles.sectionTitle}>🗣️ Pedidos de Palavra</Text>
            {estado.pedidosPalavra.map((p: any, i: number) => (
              <View key={i} style={styles.itemInteracaoRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.nominalNome}>{p.user_name || p.user_nome} <Text style={{ color: '#999', fontSize: 11, fontWeight: 'normal' }}>· {formatTimeSP(p.criado_em)}</Text></Text>
                  <Text style={styles.itemStatus}>{p.status}</Text>
                </View>
                {temAutoridade && p.status === 'PENDENTE' && (
                  <TouchableOpacity
                    style={styles.btnAcaoPequeno}
                    onPress={() => handleConcederPalavra(p.id)}
                    accessibilityLabel={`Conceder palavra para ${p.user_name || p.user_nome}`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.btnAcaoPequenoText}>Conceder</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {(estado.propostas || []).length > 0 && (
          <View style={styles.nominaisSection}>
            <Text style={styles.sectionTitle}>📝 Propostas e Encaminhamentos</Text>
            {estado.propostas.map((pr: any, i: number) => (
              <View key={i} style={styles.propostaCard}>
                <Text style={styles.propostaTitulo}>{pr.titulo} <Text style={{ color: '#999', fontSize: 11, fontWeight: 'normal' }}>· {formatTimeSP(pr.criado_em)}</Text></Text>
                <Text style={styles.propostaAutor}>Por: {pr.author_name || pr.autor_nome}</Text>
                <Text style={styles.propostaDesc}>{pr.descricao}</Text>
                <View style={styles.propostaFooter}>
                   <Text style={[styles.itemStatus, { marginBottom: 0 }]}>{pr.status}</Text>
                   {temAutoridade && pr.status === 'ATIVA' && (
                      <TouchableOpacity
                        style={styles.btnAcaoPequeno}
                        onPress={() => handleIniciarVotacaoProposta(pr.id)}
                        accessibilityLabel={`Iniciar votação para a proposta: ${pr.titulo}`}
                        accessibilityRole="button"
                      >
                        <Text style={styles.btnAcaoPequenoText}>Votar Proposta</Text>
                      </TouchableOpacity>
                   )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#ddd', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assembleiaTitulo: { fontSize: 16, fontWeight: 'bold', color: '#003366' },
  quorumBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  quorumText: { fontSize: 12, color: '#666' },
  mesaBrief: { padding: 4 },
  mesaCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 16, borderLeftWidth: 5, borderLeftColor: '#003366' },
  mesaTitle: { fontSize: 14, fontWeight: 'bold', color: '#003366', marginBottom: 12, textAlign: 'center', textTransform: 'uppercase' },
  mesaRow: { flexDirection: 'row', gap: 6, marginBottom: 2 },
  mesaLabel: { fontSize: 12, color: '#666', fontWeight: 'bold' },
  mesaValue: { fontSize: 12, color: '#333' },
  mesaAcoes: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12 },
  mesaAcoesTitle: { fontSize: 11, fontWeight: 'bold', color: '#999', marginBottom: 8, textTransform: 'uppercase' },
  mesaAcoesGrid: { flexDirection: 'row', gap: 10 },
  tokenCard: { backgroundColor: '#fffdf0', borderRadius: 12, padding: 16, marginBottom: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#f1c40f', alignItems: 'center' },
  tokenLabel: { fontSize: 12, fontWeight: 'bold', color: '#856404', marginBottom: 4, textTransform: 'uppercase' },
  tokenValue: { fontSize: 32, fontWeight: '900', color: '#003366', letterSpacing: 8 },
  tokenHint: { fontSize: 11, color: '#999', marginTop: 4 },
  btnComando: { backgroundColor: '#003366', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' },
  btnComandoText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  suspensaCard: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 24, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#dee2e6' },
  suspensaTitle: { fontSize: 20, fontWeight: 'bold', color: '#343a40', marginTop: 12, marginBottom: 8 },
  suspensaMotivo: { fontSize: 16, color: '#6c757d', textAlign: 'center', fontStyle: 'italic' },
  suspensaRetorno: { fontSize: 14, color: '#003366', fontWeight: 'bold', marginTop: 12 },
  scrollContent: { padding: 16 },
  votacaoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 3, marginBottom: 20 },
  votacaoHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  votacaoBadge: { backgroundColor: '#e74c3c', color: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontSize: 10, fontWeight: 'bold', alignSelf: 'flex-start' },
  timerBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerText: { color: '#e74c3c', fontWeight: 'bold', fontSize: 18 },
  votacaoTitulo: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  votacaoDesc: { fontSize: 14, color: '#666', marginBottom: 20 },
  votoActions: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  btnVoto: { flex: 1, padding: 16, borderRadius: 8, alignItems: 'center' },
  btnSim: { backgroundColor: '#27ae60' },
  btnNao: { backgroundColor: '#c0392b' },
  btnVotoText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  votedNotice: { alignItems: 'center', padding: 20 },
  votedText: { color: '#27ae60', fontWeight: 'bold', marginTop: 8 },
  notEligibleBox: { backgroundColor: '#f8d7da', padding: 12, borderRadius: 8, marginBottom: 20 },
  notEligibleText: { color: '#721c24', fontSize: 13, textAlign: 'center', fontWeight: '500' },
  placares: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 16 },
  placarItem: { flex: 1, alignItems: 'center' },
  placarLabel: { fontSize: 10, color: '#888', marginBottom: 4 },
  placarValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  waitingCard: { padding: 40, alignItems: 'center', gap: 12 },
  waitingText: { color: '#888', fontSize: 14 },
  nominaisSection: { marginTop: 10, backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 12, textAlign: 'center', textTransform: 'uppercase' },
  votoNominalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  nominalNome: { fontSize: 14, color: '#444', flex: 1 },
  nominalOpcao: { fontWeight: 'bold', fontSize: 12 },
  opcaoSIM: { color: '#27ae60' },
  opcaoNAO: { color: '#c0392b' },
  opcaoABSTENCAO: { color: '#7f8c8d' },
  itemInteracaoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemStatus: { fontSize: 10, color: '#888', fontWeight: 'bold', marginTop: 2 },
  btnAcaoPequeno: { backgroundColor: '#f1c40f', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  btnAcaoPequenoText: { fontSize: 12, color: '#003366', fontWeight: 'bold' },
  propostaCard: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  propostaTitulo: { fontSize: 15, fontWeight: 'bold', color: '#003366', marginBottom: 2 },
  propostaAutor: { fontSize: 11, color: '#666', marginBottom: 6 },
  propostaDesc: { fontSize: 13, color: '#444', marginBottom: 10 },
  propostaFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ddd', padding: 12, flexDirection: 'row', justifyContent: 'space-around' },
  btnFooter: { alignItems: 'center', gap: 4 },
  btnFooterText: { fontSize: 12, color: '#003366', fontWeight: 'bold' },
});
