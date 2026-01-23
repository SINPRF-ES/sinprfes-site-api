import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, ScrollView, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getAssembleiaEstado, enviarVoto, pedirPalavra } from '../../services/assembleiaService';
import { assembleiaSocket } from '../../services/assembleiaSocket';
import { AssembleiaEstado, VotacaoItem, VotoNominal } from '../../types/assembleia';
import { useAuth } from '../../hooks/useAuth';

export default function AssembleiaSalaScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { id } = route.params;
  const { usuario, token } = useAuth();
  const [estado, setEstado] = useState<AssembleiaEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingVoto, setSendingVoto] = useState(false);

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

  useEffect(() => {
    fetchData();

    if (token) {
      assembleiaSocket.connect(token);
      assembleiaSocket.joinRoom(id);

      assembleiaSocket.onEvent('session_state_changed', (data) => {
        setEstado(prev => prev ? { ...prev, assembleia: { ...prev.assembleia, estado: data.estado } } : null);
      });

      assembleiaSocket.onEvent('voting_started', (data) => {
        setEstado(prev => prev ? { ...prev, votacaoAtiva: data } : null);
      });

      assembleiaSocket.onEvent('vote_cast', (data) => {
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

      assembleiaSocket.onEvent('quorum_count_updated', (data) => {
        setEstado(prev => prev && prev.quorumVigente ? { ...prev, quorumVigente: { ...prev.quorumVigente, total: data.total } } : prev);
      });

      assembleiaSocket.onEvent('new_quorum_call', (data) => {
         fetchData(); // Mais seguro re-hidratar tudo
      });
    }

    return () => {
      assembleiaSocket.leaveRoom(id);
      assembleiaSocket.offEvent('session_state_changed');
      assembleiaSocket.offEvent('voting_started');
      assembleiaSocket.offEvent('vote_cast');
      assembleiaSocket.offEvent('quorum_count_updated');
      assembleiaSocket.offEvent('new_quorum_call');
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

  const handlePedirPalavra = async () => {
    try {
      await pedirPalavra(id);
      Alert.alert('Sucesso', 'Seu pedido foi registrado.');
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error || 'Falha ao solicitar palavra.');
    }
  };

  if (loading || !estado) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;
  }

  const { votacaoAtiva, quorumVigente } = estado;
  const votosNominais = votacaoAtiva?.votos || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.assembleiaTitulo}>{estado.assembleia.titulo}</Text>
        <View style={styles.quorumBox}>
          <MaterialCommunityIcons name="account-group" size={16} color="#666" />
          <Text style={styles.quorumText}>{quorumVigente?.total || 0} presentes</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {votacaoAtiva ? (
          <View style={styles.votacaoCard}>
            <View style={styles.votacaoHeader}>
              <Text style={styles.votacaoBadge}>{votacaoAtiva.estado}</Text>
              <MaterialCommunityIcons name="clock-outline" size={20} color="#e74c3c" />
            </View>
            <Text style={styles.votacaoTitulo}>{votacaoAtiva.titulo}</Text>
            <Text style={styles.votacaoDesc}>{votacaoAtiva.descricao}</Text>

            {votacaoAtiva.userEligible !== false ? (
              votacaoAtiva.userVoted ? (
                <View style={styles.votedNotice}>
                  <MaterialCommunityIcons name="check-circle" size={30} color="#27ae60" />
                  <Text style={styles.votedText}>Seu voto foi computado.</Text>
                </View>
              ) : (
                <View style={styles.votoActions}>
                  <TouchableOpacity
                    style={[styles.btnVoto, styles.btnSim]}
                    onPress={() => handleVotar('SIM')}
                    disabled={sendingVoto}
                  >
                    <Text style={styles.btnVotoText}>SIM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnVoto, styles.btnNao]}
                    onPress={() => handleVotar('NAO')}
                    disabled={sendingVoto}
                  >
                    <Text style={styles.btnVotoText}>NÃO</Text>
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <View style={styles.notEligibleBox}>
                <Text style={styles.notEligibleText}>Você não é elegível para este item (ausente no quórum).</Text>
              </View>
            )}

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
            <Text style={styles.sectionTitle}>Votos Nominais (Ao vivo)</Text>
            {votosNominais.map((v, i) => (
              <View key={i} style={styles.votoNominalRow}>
                <Text style={styles.nominalNome}>{v.nome}</Text>
                <Text style={[styles.nominalOpcao, styles[`opcao${v.voto}`]]}>{v.voto}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.btnFooter} onPress={handlePedirPalavra}>
          <MaterialCommunityIcons name="microphone" size={24} color="#003366" />
          <Text style={styles.btnFooterText}>Pedir Palavra</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnFooter} onPress={() => navigation.navigate('Propostas', { id })}>
          <MaterialCommunityIcons name="file-document-edit-outline" size={24} color="#003366" />
          <Text style={styles.btnFooterText}>Proposta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#ddd', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assembleiaTitulo: { fontSize: 16, fontWeight: 'bold', color: '#003366', flex: 1 },
  quorumBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quorumText: { fontSize: 12, color: '#666' },
  scrollContent: { padding: 16 },
  votacaoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 3, marginBottom: 20 },
  votacaoHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  votacaoBadge: { backgroundColor: '#e74c3c', color: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontSize: 10, fontWeight: 'bold' },
  votacaoTitulo: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  votacaoDesc: { fontSize: 14, color: '#666', marginBottom: 20 },
  votoActions: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  btnVoto: { flex: 1, padding: 16, borderRadius: 8, alignItems: 'center' },
  btnSim: { backgroundColor: '#27ae60' },
  btnNao: { backgroundColor: '#c0392b' },
  btnVotoText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  votedNotice: { alignItems: 'center', padding: 20 },
  votedText: { color: '#27ae60', fontWeight: 'bold', marginTop: 8 },
  notEligibleBox: { backgroundColor: '#fff3cd', padding: 12, borderRadius: 8, marginBottom: 20 },
  notEligibleText: { color: '#856404', fontSize: 13, textAlign: 'center' },
  placares: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 16 },
  placarItem: { flex: 1, alignItems: 'center' },
  placarLabel: { fontSize: 10, color: '#888', marginBottom: 4 },
  placarValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  waitingCard: { padding: 40, alignItems: 'center', gap: 12 },
  waitingText: { color: '#888', fontSize: 14 },
  nominaisSection: { marginTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  votoNominalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  nominalNome: { fontSize: 14, color: '#444' },
  nominalOpcao: { fontWeight: 'bold', fontSize: 12 },
  opcaoSIM: { color: '#27ae60' },
  opcaoNAO: { color: '#c0392b' },
  opcaoABSTENCAO: { color: '#7f8c8d' },
  footer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ddd', padding: 12, flexDirection: 'row', justifyContent: 'space-around' },
  btnFooter: { alignItems: 'center', gap: 4 },
  btnFooterText: { fontSize: 12, color: '#003366', fontWeight: 'bold' },
});
