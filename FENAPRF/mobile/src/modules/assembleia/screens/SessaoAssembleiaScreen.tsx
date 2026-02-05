import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { useAssembleiaSession } from '../hooks/useAssembleiaSession';
import { useQuorum } from '../hooks/useQuorum';
import { useVotacao } from '../hooks/useVotacao';
import CheckinAssembleia from '../components/CheckinAssembleia';
import VotacaoAtiva from '../components/VotacaoAtiva';
import assembleiaService from '../services/assembleiaService';

export default function SessaoAssembleiaScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const { usuario } = useAuth();

  const { assembleia, pedidosPalavra, propostas, mesa, quorumVigente: qVigente, votacaoAtiva: vAtiva, socket, carregando, refresh } = useAssembleiaSession(id);
  const { quorumVigente, chamadaAtiva, setChamadaAtiva } = useQuorum(id, socket, qVigente);
  const { votacaoAtiva, contagem, votos, tempoRestante, userEligibility } = useVotacao(id, socket, vAtiva);

  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [propostaModalVisible, setPropostaModalVisible] = useState(false);
  const [propostaTitulo, setPropostaTitulo] = useState('');

  const isDiretoria = usuario?.perfil_acesso === 'DIRETORIA' || usuario?.perfil_acesso === 'ADMIN';

  if (carregando) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#003366" />
        <Text>Carregando sessão...</Text>
      </View>
    );
  }

  if (!assembleia) {
    return (
      <View style={styles.centered}>
        <Text>Assembleia não encontrada.</Text>
      </View>
    );
  }

  const handlePedirPalavra = async () => {
    try {
      await assembleiaService.pedirPalavra(id);
      Alert.alert('Sucesso', 'Pedido de palavra registrado!');
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao pedir palavra');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Header da Sessão */}
        <View style={styles.sessionHeader}>
          <Text style={styles.sessionTitle}>{assembleia.titulo}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: assembleia.estado === 'ABERTA' ? '#28a745' : '#6c757d' }]}>
              <Text style={styles.statusText}>{assembleia.estado}</Text>
            </View>
            <View style={styles.quorumBadge}>
              <MaterialCommunityIcons name="account-group" size={16} color="#003366" />
              <Text style={styles.quorumText}>{quorumVigente?.total || 0} presentes</Text>
            </View>
          </View>
        </View>

        {/* UI de Gestão (Diretoria) */}
        {isDiretoria && assembleia.estado === 'ABERTA' && (
          <TouchableOpacity
            style={styles.gestaoButton}
            onPress={() => navigation.navigate('GestaoAssembleia', { id })}
          >
            <MaterialCommunityIcons name="shield-account" size={20} color="#fff" />
            <Text style={styles.gestaoButtonText}>Painel de Gestão da Diretoria</Text>
          </TouchableOpacity>
        )}

        {/* Check-in (se necessário) */}
        {assembleia.estado === 'ABERTA' && chamadaAtiva && !hasCheckedIn && !qVigente?.userHasCheckedIn && (
          <CheckinAssembleia
            assembleiaId={id}
            onSuccess={() => {
              setHasCheckedIn(true);
              setChamadaAtiva(null);
            }}
          />
        )}

        {/* Votação Ativa */}
        {votacaoAtiva && (
          <VotacaoAtiva
            assembleiaId={id}
            votacao={votacaoAtiva}
            contagem={contagem}
            votos={votos}
            tempoRestante={tempoRestante}
            userEligibility={userEligibility}
          />
        )}

        {/* Info da Mesa */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="gavel" size={20} color="#003366" />
            <Text style={styles.cardTitle}>Mesa Diretora</Text>
          </View>
          <View style={styles.mesaRow}>
            <Text style={styles.mesaLabel}>Presidente:</Text>
            <Text style={styles.mesaValue}>{mesa.find(m => m.cargo === 'PRESIDENTE')?.filiado_nome || 'Aguardando definição...'}</Text>
          </View>
          <View style={styles.mesaRow}>
            <Text style={styles.mesaLabel}>Secretário:</Text>
            <Text style={styles.mesaValue}>{mesa.find(m => m.cargo === 'SECRETARIO')?.filiado_nome || 'Aguardando definição...'}</Text>
          </View>
        </View>

        {/* Fila de Palavra */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="account-voice" size={20} color="#003366" />
            <Text style={styles.cardTitle}>Fila de Palavra</Text>
            <TouchableOpacity style={styles.actionBtn} onPress={handlePedirPalavra}>
              <Text style={styles.actionBtnText}>✋ Pedir Palavra</Text>
            </TouchableOpacity>
          </View>
          {pedidosPalavra.length > 0 ? (
            pedidosPalavra.map((p, idx) => (
              <View key={p.id} style={styles.filaItem}>
                <Text style={styles.filaPos}>{idx + 1}º</Text>
                <Text style={styles.filaNome}>{p.filiado_nome || 'Filiado'}</Text>
                {p.estado === 'EM_FALA' && <View style={styles.falaBadge}><Text style={styles.falaBadgeText}>Falando</Text></View>}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Ninguém na fila.</Text>
          )}
        </View>

        {/* Modal Novo Encaminhamento */}
        <Modal
          visible={propostaModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setPropostaModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Novo Encaminhamento</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Título da Proposta"
                value={propostaTitulo}
                onChangeText={setPropostaTitulo}
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setPropostaModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.confirmBtn]}
                  onPress={async () => {
                    if (!propostaTitulo) return;
                    try {
                      await assembleiaService.criarProposta(id, { titulo: propostaTitulo, descricao: '' });
                      setPropostaTitulo('');
                      setPropostaModalVisible(false);
                      Alert.alert('Sucesso', 'Encaminhamento enviado!');
                    } catch (error) {
                      Alert.alert('Erro', 'Falha ao enviar proposta.');
                    }
                  }}
                >
                  <Text style={styles.confirmBtnText}>Enviar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Propostas / Encaminhamentos */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="lightbulb-outline" size={20} color="#003366" />
            <Text style={styles.cardTitle}>Propostas</Text>
          </View>
          {propostas.length > 0 ? (
            propostas.map((prop) => (
              <View key={prop.id} style={styles.propostaItem}>
                <Text style={styles.propostaTitulo}>{prop.titulo}</Text>
                <Text style={styles.propostaAutor}>por {prop.autor_nome || 'Filiado'}</Text>
                <View style={[styles.miniBadge, { alignSelf: 'flex-start', marginTop: 4, backgroundColor: prop.estado === 'PENDENTE' ? '#ffc107' : prop.estado === 'VOTADA' ? '#28a745' : '#dc3545' }]}>
                   <Text style={styles.miniBadgeText}>{prop.estado}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Nenhuma proposta cadastrada.</Text>
          )}
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={() => setPropostaModalVisible(true)}
          >
            <Text style={styles.outlineButtonText}>+ Novo Encaminhamento</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  sessionHeader: {
    marginBottom: 20,
  },
  sessionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quorumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    gap: 6,
  },
  quorumText: {
    fontSize: 13,
    color: '#003366',
    fontWeight: '600',
  },
  gestaoButton: {
    backgroundColor: '#003366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  gestaoButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#003366',
    flex: 1,
  },
  actionBtn: {
    backgroundColor: '#e6f0ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#003366',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mesaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  mesaLabel: {
    fontSize: 14,
    color: '#666',
  },
  mesaValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  filaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
    gap: 12,
  },
  filaPos: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#003366',
    width: 30,
  },
  filaNome: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  falaBadge: {
    backgroundColor: '#28a745',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  falaBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  propostaItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  propostaTitulo: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  propostaAutor: {
    fontSize: 12,
    color: '#999',
  },
  emptyText: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
    paddingVertical: 8,
  },
  outlineButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#003366',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: '#003366',
    fontWeight: 'bold',
    fontSize: 14,
  },
  miniBadge: {
     paddingHorizontal: 6,
     paddingVertical: 2,
     borderRadius: 4,
  },
  miniBadgeText: {
     color: '#fff',
     fontSize: 10,
     fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#f2f4f8',
    height: 54,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#eee',
  },
  confirmBtn: {
    backgroundColor: '#003366',
  },
  cancelBtnText: {
    color: '#666',
    fontWeight: 'bold',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});
