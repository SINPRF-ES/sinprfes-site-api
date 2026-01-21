import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Votacao, VotoContagem, VotoNominal } from '../types';
import assembleiaService from '../services/assembleiaService';

interface Props {
  assembleiaId: string;
  votacao: Votacao;
  contagem: VotoContagem;
  votos: VotoNominal[];
  tempoRestante: number;
}

export default function VotacaoAtiva({ assembleiaId, votacao, contagem, votos, tempoRestante }: Props) {
  const [loading, setLoading] = useState(false);
  const [votoRealizado, setVotoRealizado] = useState<'SIM' | 'NAO' | null>(null);

  const handleVoto = async (voto: 'SIM' | 'NAO') => {
    setLoading(true);
    try {
      await assembleiaService.votar(assembleiaId, votacao.id, voto);
      setVotoRealizado(voto);
      Alert.alert('Sucesso', 'Voto registrado com sucesso!');
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

  const renderVotoNominal = ({ item }: { item: VotoNominal }) => (
    <View style={styles.votoNominalItem}>
      <Text style={styles.voterName}>{item.nome}</Text>
      <View style={[styles.miniBadge, { backgroundColor: item.voto === 'SIM' ? '#28a745' : item.voto === 'NAO' ? '#dc3545' : '#6c757d' }]}>
        <Text style={styles.miniBadgeText}>{item.voto}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.votoTitle}>VOTAÇÃO EM CURSO</Text>
        <View style={styles.timerBadge}>
          <MaterialCommunityIcons name="clock-outline" size={16} color="#d9534f" />
          <Text style={styles.timerText}>{formatTempo(tempoRestante)}</Text>
        </View>
      </View>

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

      {!votoRealizado ? (
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
      ) : (
        <View style={styles.votedContainer}>
          <MaterialCommunityIcons name="check-circle" size={24} color="#28a745" />
          <Text style={styles.votedText}>Você votou: {votoRealizado}</Text>
        </View>
      )}

      <Text style={styles.nominalTitle}>Votos Nominais (Público)</Text>
      <View style={styles.nominalListContainer}>
         {votos.length > 0 ? (
            votos.slice(0, 10).map((v, i) => (
               <View key={i} style={styles.votoNominalItem}>
                  <Text style={styles.voterName} numberOfLines={1}>{v.nome}</Text>
                  <View style={[styles.miniBadge, { backgroundColor: v.voto === 'SIM' ? '#28a745' : v.voto === 'NAO' ? '#dc3545' : '#6c757d' }]}>
                    <Text style={styles.miniBadgeText}>{v.voto}</Text>
                  </View>
               </View>
            ))
         ) : (
            <Text style={styles.emptyNominal}>Nenhum voto registrado ainda.</Text>
         )}
         {votos.length > 10 && <Text style={styles.moreVotes}>+ {votos.length - 10} outros votos</Text>}
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  votoTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#003366',
    letterSpacing: 1,
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
  tituloItem: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  descricaoItem: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  countContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  countBox: {
    alignItems: 'center',
  },
  countValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#003366',
  },
  countLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  voteButton: {
    flex: 1,
    height: 54,
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.5,
  },
  votedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#e6f4ea',
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  votedText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e7e34',
  },
  nominalTitle: {
     fontSize: 14,
     fontWeight: 'bold',
     color: '#666',
     marginBottom: 10,
     borderTopWidth: 1,
     borderTopColor: '#eee',
     paddingTop: 16,
  },
  nominalListContainer: {
     gap: 8,
  },
  votoNominalItem: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     paddingVertical: 4,
  },
  voterName: {
     fontSize: 13,
     color: '#444',
     flex: 1,
  },
  miniBadge: {
     paddingHorizontal: 6,
     paddingVertical: 2,
     borderRadius: 4,
     minWidth: 40,
     alignItems: 'center',
  },
  miniBadgeText: {
     color: '#fff',
     fontSize: 10,
     fontWeight: 'bold',
  },
  emptyNominal: {
     fontSize: 12,
     color: '#999',
     fontStyle: 'italic',
  },
  moreVotes: {
     fontSize: 11,
     color: '#999',
     textAlign: 'center',
     marginTop: 4,
  },
  loader: {
    marginTop: 12,
  }
});
