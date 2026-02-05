import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Votacao, VotoContagem, VotoNominal } from '../types';
import assembleiaService from '../services/assembleiaService';

interface Props {
  assembleiaId: string;
  votacao: Votacao;
  contagem: VotoContagem;
  votos: VotoNominal[];
  tempoRestante: number;
  userEligibility: { elegivel: boolean, motivo?: string };
}

export default function VotacaoAtiva({ assembleiaId, votacao, contagem, votos, tempoRestante, userEligibility }: Props) {
  const [loading, setLoading] = useState(false);
  const [votoRealizado, setVotoRealizado] = useState<'SIM' | 'NAO' | null>(null);

  const handleVoto = async (voto: 'SIM' | 'NAO') => {
    if (!userEligibility.elegivel) {
       Alert.alert('Não Elegível', userEligibility.motivo || 'Você não pode votar neste item.');
       return;
    }

    setLoading(true);
    try {
      await assembleiaService.votar(assembleiaId, votacao.id, voto);
      setVotoRealizado(voto);
      // Feedback imediato
    } catch (error: any) {
      const message = error.response?.data?.error || 'Não foi possível registrar seu voto.';
      Alert.alert('Erro', message);
    } finally {
      setLoading(false);
    }
  };

  const formatTempo = (segundos: number) => {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
           <Text style={styles.votoTitle}>VOTAÇÃO EM CURSO</Text>
           <View style={[styles.eligibilityBadge, { backgroundColor: userEligibility.elegivel ? '#e6f4ea' : '#fff5f5' }]}>
              <MaterialCommunityIcons
                 name={userEligibility.elegivel ? "check-decagram" : "alert-decagram"}
                 size={14}
                 color={userEligibility.elegivel ? "#28a745" : "#d9534f"}
              />
              <Text style={[styles.eligibilityText, { color: userEligibility.elegivel ? "#28a745" : "#d9534f" }]}>
                 Elegível: {userEligibility.elegivel ? 'SIM' : 'NÃO'}
              </Text>
           </View>
        </View>
        <View style={styles.timerBadge}>
          <MaterialCommunityIcons name="clock-outline" size={16} color="#d9534f" />
          <Text style={styles.timerText}>{formatTempo(tempoRestante)}</Text>
        </View>
      </View>

      {!userEligibility.elegivel && (
         <View style={styles.reasonBox}>
            <Text style={styles.reasonText}>⚠️ {userEligibility.motivo}</Text>
         </View>
      )}

      <Text style={styles.tituloItem}>{votacao.titulo}</Text>
      {votacao.descricao && <Text style={styles.descricaoItem}>{votacao.descricao}</Text>}

      <View style={styles.countContainer}>
        <View style={styles.countBox}>
          <Text style={styles.countValue}>{contagem.SIM}</Text>
          <Text style={styles.countLabel}>SIM</Text>
        </View>
        <View style={styles.countBox}>
          <Text style={styles.countValue}>{contagem.NAO}</Text>
          <Text style={styles.countLabel}>NÃO</Text>
        </View>
        <View style={styles.countBox}>
          <Text style={styles.countValue}>{contagem.ABSTENCAO}</Text>
          <Text style={styles.countLabel}>ABST.</Text>
        </View>
      </View>

      {userEligibility.elegivel && !votoRealizado && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.voteButton, styles.simButton, loading && styles.disabled]}
            onPress={() => handleVoto('SIM')}
            disabled={loading}
          >
            <MaterialCommunityIcons name="thumb-up" size={24} color="#fff" />
            <Text style={styles.voteButtonText}>SIM</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voteButton, styles.naoButton, loading && styles.disabled]}
            onPress={() => handleVoto('NAO')}
            disabled={loading}
          >
            <MaterialCommunityIcons name="thumb-down" size={24} color="#fff" />
            <Text style={styles.voteButtonText}>NÃO</Text>
          </TouchableOpacity>
        </View>
      )}

      {votoRealizado && (
        <View style={styles.votedContainer}>
          <MaterialCommunityIcons name="check-circle" size={24} color="#28a745" />
          <Text style={styles.votedText}>Seu voto (Registrado): {votoRealizado}</Text>
        </View>
      )}

      <View style={styles.nominalSection}>
         <Text style={styles.nominalTitle}>Votos Nominais (Público)</Text>
         <ScrollView style={styles.nominalList} nestedScrollEnabled>
            {votos.length > 0 ? (
               votos.map((v, i) => (
                  <View key={v.filiado_id || i} style={styles.votoNominalItem}>
                     <Text style={styles.voterName} numberOfLines={1}>{v.nome}</Text>
                     <View style={[styles.miniBadge, { backgroundColor: v.voto === 'SIM' ? '#28a745' : v.voto === 'NAO' ? '#dc3545' : '#6c757d' }]}>
                       <Text style={styles.miniBadgeText}>{v.voto}</Text>
                     </View>
                  </View>
               ))
            ) : (
               <Text style={styles.emptyNominal}>Nenhum voto registrado.</Text>
            )}
         </ScrollView>
      </View>

      {loading && <ActivityIndicator style={styles.loader} color="#003366" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#003366',
    marginBottom: 16,
    maxHeight: 500,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  votoTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#003366',
    letterSpacing: 1,
  },
  eligibilityBadge: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingHorizontal: 8,
     paddingVertical: 2,
     borderRadius: 6,
     marginTop: 4,
     gap: 4,
  },
  eligibilityText: {
     fontSize: 10,
     fontWeight: 'bold',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#feb2b2',
  },
  timerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d9534f',
    marginLeft: 4,
  },
  reasonBox: {
     backgroundColor: '#fffaf0',
     padding: 10,
     borderRadius: 8,
     borderWidth: 1,
     borderColor: '#fee9c1',
     marginBottom: 16,
  },
  reasonText: {
     fontSize: 12,
     color: '#856404',
  },
  tituloItem: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  descricaoItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  countContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  countBox: {
    alignItems: 'center',
  },
  countValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#003366',
  },
  countLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  voteButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  simButton: {
    backgroundColor: '#28a745',
  },
  naoButton: {
    backgroundColor: '#dc3545',
  },
  voteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.5,
  },
  votedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#e6f4ea',
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  votedText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e7e34',
  },
  nominalSection: {
     flex: 1,
     borderTopWidth: 1,
     borderTopColor: '#eee',
     paddingTop: 12,
  },
  nominalTitle: {
     fontSize: 12,
     fontWeight: 'bold',
     color: '#666',
     marginBottom: 8,
  },
  nominalList: {
     flex: 1,
  },
  votoNominalItem: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     paddingVertical: 4,
     borderBottomWidth: 1,
     borderBottomColor: '#f8f9fa',
  },
  voterName: {
     fontSize: 12,
     color: '#444',
     flex: 1,
  },
  miniBadge: {
     paddingHorizontal: 6,
     paddingVertical: 2,
     borderRadius: 4,
     minWidth: 45,
     alignItems: 'center',
  },
  miniBadgeText: {
     color: '#fff',
     fontSize: 9,
     fontWeight: 'bold',
  },
  emptyNominal: {
     fontSize: 11,
     color: '#999',
     fontStyle: 'italic',
     textAlign: 'center',
  },
  loader: {
    marginTop: 12,
  }
});
