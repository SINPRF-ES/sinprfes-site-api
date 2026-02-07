import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import assembleiaService from '../services/assembleiaService';
import { useAssembleiaSession } from '../hooks/useAssembleiaSession';

export default function GestaoAssembleiaScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { id } = route.params;

  const { propostas, refresh } = useAssembleiaSession(id);

  const [loading, setLoading] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ token: string, valido_ate: string } | null>(null);

  const [votTitulo, setVotTitulo] = useState('');
  const [votDuracao, setVotDuracao] = useState('1');
  const [selectedPropostaId, setSelectedPropostaId] = useState<string | null>(null);

  const [mesaUserId, setMesaUserId] = useState('');
  const [mesaCargo, setMesaCargo] = useState<'PRESIDENTE' | 'SECRETARIO'>('PRESIDENTE');

  const handleGerarQuorum = async () => {
    setLoading(true);
    try {
      const info = await assembleiaService.gerarQuorum(id);
      setTokenInfo(info);
      Alert.alert('Sucesso', `Token gerado: ${info.token}. Válido por 10 minutos.`);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível gerar novo quórum.');
    } finally {
      setLoading(false);
    }
  };

  const handleIniciarVotacao = async () => {
    if (!votTitulo && !selectedPropostaId) {
      Alert.alert('Erro', 'Informe o título da votação ou selecione uma proposta.');
      return;
    }

    setLoading(true);
    try {
      let payload: any = {
        titulo: votTitulo,
        descricao: '',
        duracao_minutos: parseInt(votDuracao)
      };

      if (selectedPropostaId) {
         const prop = propostas.find(p => p.id === selectedPropostaId);
         payload.titulo = prop?.titulo;
         payload.proposta_id = selectedPropostaId;
      }

      await assembleiaService.iniciarVotacao(id, payload);
      setVotTitulo('');
      setSelectedPropostaId(null);
      Alert.alert('Sucesso', 'Votada iniciada em tempo real!');
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao iniciar votação');
    } finally {
      setLoading(false);
    }
  };

  const handleEncerrar = async () => {
    Alert.alert(
      'Encerrar Assembleia',
      'Tem certeza que deseja encerrar a sessão? Esta ação é irreversível.',
      [
        { text: 'Não' },
        {
          text: 'Sim, Encerrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await assembleiaService.encerrar(id);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Erro', 'Falha ao encerrar assembleia.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Presença e Quórum</Text>
          <Text style={styles.sectionDesc}>Inicie uma chamada de quórum para validar quem pode votar nas próximas pautas.</Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleGerarQuorum}
            disabled={loading}
          >
            <MaterialCommunityIcons name="account-plus" size={20} color="#fff" />
            <Text style={styles.buttonText}>Gerar Novo Token (Recontagem)</Text>
          </TouchableOpacity>

          {tokenInfo && (
            <View style={styles.tokenCard}>
              <Text style={styles.tokenLabel}>TOKEN ATIVO:</Text>
              <Text style={styles.tokenValue}>{tokenInfo.token}</Text>
              <Text style={styles.tokenExpire}>Válido até {new Date(tokenInfo.valido_ate).toLocaleTimeString()}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nova Votação</Text>
          <Text style={styles.sectionDesc}>O snapshot de elegibilidade será baseado no último quórum gerado acima.</Text>

          <Text style={styles.label}>A partir de uma proposta:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.propostasScroll}>
             {propostas.filter(p => p.estado === 'PENDENTE').map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.propBadge, selectedPropostaId === p.id && styles.activeProp]}
                  onPress={() => {
                    setSelectedPropostaId(p.id);
                    setVotTitulo('');
                  }}
                >
                   <Text style={[styles.propBadgeText, selectedPropostaId === p.id && styles.activePropText]}>{p.titulo}</Text>
                </TouchableOpacity>
             ))}
          </ScrollView>

          {!selectedPropostaId && (
            <TextInput
              style={styles.input}
              placeholder="Ou digite um novo Título de Pauta"
              value={votTitulo}
              onChangeText={setVotTitulo}
            />
          )}

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Duração (minutos)</Text>
              <TextInput
                style={styles.input}
                value={votDuracao}
                onChangeText={setVotDuracao}
                keyboardType="number-pad"
              />
            </View>
            <TouchableOpacity
              style={[styles.startButton, { flex: 1 }]}
              onPress={handleIniciarVotacao}
              disabled={loading}
            >
              <Text style={styles.buttonText}>🚀 Iniciar Agora</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mesa Diretora</Text>
          <Text style={styles.sectionDesc}>Defina os membros da mesa para a ata.</Text>

          <TextInput
            style={styles.input}
            placeholder="ID do User"
            value={mesaUserId}
            onChangeText={setMesaUserId}
          />

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.outlineButton, mesaCargo === 'PRESIDENTE' && styles.activeOutline, { flex: 1 }]}
              onPress={() => setMesaCargo('PRESIDENTE')}
            >
              <Text style={[styles.outlineButtonText, mesaCargo === 'PRESIDENTE' && styles.activeOutlineText]}>Presidente</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outlineButton, mesaCargo === 'SECRETARIO' && styles.activeOutline, { flex: 1 }]}
              onPress={() => setMesaCargo('SECRETARIO')}
            >
              <Text style={[styles.outlineButtonText, mesaCargo === 'SECRETARIO' && styles.activeOutlineText]}>Secretário</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: 12 }]}
            onPress={async () => {
              if (!mesaUserId) return;
              setLoading(true);
              try {
                await assembleiaService.definirMesa(id, { user_id: mesaUserId, cargo: mesaCargo });
                setMesaUserId('');
                Alert.alert('Sucesso', 'Mesa atualizada!');
              } catch (error) {
                Alert.alert('Erro', 'Falha ao definir mesa.');
              } finally {
                setLoading(false);
              }
            }}
          >
            <Text style={styles.buttonText}>Confirmar Membro</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { marginTop: 40 }]}>
          <TouchableOpacity style={styles.dangerButton} onPress={handleEncerrar}>
            <MaterialCommunityIcons name="stop-circle" size={20} color="#fff" />
            <Text style={styles.buttonText}>Encerrar Assembleia</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#003366',
    flexDirection: 'row',
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tokenCard: {
    marginTop: 16,
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#003366',
    borderStyle: 'dashed',
  },
  tokenLabel: {
    fontSize: 12,
    color: '#003366',
    fontWeight: 'bold',
  },
  tokenValue: {
    fontSize: 48,
    fontWeight: '900',
    color: '#003366',
    letterSpacing: 4,
  },
  tokenExpire: {
    fontSize: 12,
    color: '#d9534f',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#f2f4f8',
    height: 54,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
  },
  startButton: {
    backgroundColor: '#28a745',
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButton: {
    backgroundColor: '#dc3545',
    flexDirection: 'row',
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#003366',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: '#003366',
    fontWeight: 'bold',
    fontSize: 14,
  },
  activeOutline: {
    backgroundColor: '#003366',
  },
  activeOutlineText: {
    color: '#fff',
  },
  propostasScroll: {
     marginBottom: 16,
  },
  propBadge: {
     backgroundColor: '#f0f0f0',
     paddingHorizontal: 16,
     paddingVertical: 8,
     borderRadius: 20,
     marginRight: 8,
     borderWidth: 1,
     borderColor: '#ddd',
  },
  activeProp: {
     backgroundColor: '#003366',
     borderColor: '#003366',
  },
  propBadgeText: {
     color: '#666',
     fontSize: 13,
  },
  activePropText: {
     color: '#fff',
  }
});
