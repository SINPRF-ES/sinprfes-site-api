import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getAssembleiaDetalhe, getAssembleiaEstado, abrirAssembleia, encerrarAssembleia, gerarTokenQuorum, realizarCheckin } from '../../services/assembleiaService';
import SafeScreen from '../../components/SafeScreen';
import HeaderMenu, { MenuAction } from '../../components/HeaderMenu';
import { Assembleia, AssembleiaEstado } from '../../types/assembleia';
import { useAuth } from '../../hooks/useAuth';
import { logger } from '../../infra/logger';

export default function AssembleiaDetalheScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { id } = route.params;
  const { usuario } = useAuth();
  const [assembleia, setAssembleia] = useState<Assembleia | null>(null);
  const [estado, setEstado] = useState<AssembleiaEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenInput, setTokenInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const isDiretoria = ['ADMIN', 'DIRETORIA'].includes(usuario?.perfil_acesso || '');

  const fetchData = async () => {
    try {
      setLoading(true);
      logger.info('ASSEMBLEIA_DETALHE_FETCH_START', { id, profile: usuario?.perfil_acesso });

      const [data, estadoData] = await Promise.all([
        getAssembleiaDetalhe(id),
        getAssembleiaEstado(id)
      ]);

      logger.info('ASSEMBLEIA_DETALHE_FETCH_SUCCESS', {
        id,
        hasAssembleia: !!data,
        hasEstado: !!estadoData,
        estadoName: data?.estado,
        hasQuorum: !!estadoData?.quorumVigente
      });

      setAssembleia(data);
      setEstado(estadoData);
    } catch (err: any) {
      logger.error('ASSEMBLEIA_DETALHE_FETCH_ERROR', err as Error, { id });
      console.error('[Assembleia.fetch]', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [id])
  );


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

  const handleGerarToken = useCallback(async () => {
    try {
      setActionLoading(true);
      const res = await gerarTokenQuorum(id);
      logger.info('TOKEN_GENERATED_AUTO_CHECKIN_START', { assembleiaId: id, token: res.token });

      try {
        await realizarCheckin(id, res.token);
        logger.info('TOKEN_GENERATED_AUTO_CHECKIN_SUCCESS', { assembleiaId: id });
        Alert.alert('Sucesso', `Token gerado: ${res.token}.\n\nSeu check-in foi realizado automaticamente.`);
      } catch (checkinErr) {
        logger.error('TOKEN_GENERATED_AUTO_CHECKIN_FAIL', checkinErr, { assembleiaId: id, token: res.token });
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
    const isAberta = assembleia?.estado === 'ABERTA';
    const actions: MenuAction[] = [];
    if (isDiretoria && assembleia) {
      if (assembleia.estado === 'CRIADA') {
        actions.push({ label: 'Abrir Assembleia', icon: 'play-circle-outline', onPress: handleAbrir });
      }
      if (isAberta) {
        actions.push({ label: 'Iniciar Votação', icon: 'plus-circle-outline', onPress: () => navigation.navigate('CriarItemVotacao', { id }) });
        actions.push({ label: 'Gerar Token Quórum', icon: 'key-variant', onPress: handleGerarToken });
        actions.push({ label: 'Encerrar Assembleia', icon: 'stop-circle-outline', onPress: handleEncerrar, isDestructive: true });
      }
    }
    navigation.setOptions({
      headerRight: () => <HeaderMenu actions={actions} />,
      title: 'Detalhes'
    });
  }, [navigation, assembleia, isDiretoria, handleAbrir, handleGerarToken, handleEncerrar]);

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
  const isAberta = assembleia.estado === 'ABERTA';

  return (
    <SafeScreen style={{ backgroundColor: '#f2f4f8' }}>
    <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={[styles.badge, styles[`badge${assembleia.estado}`]]}>
          <Text style={styles.badgeText}>{assembleia.estado}</Text>
        </View>
        <Text style={styles.tipoText}>{assembleia.tipo}</Text>
      </View>

      <Text style={styles.tituloText}>{assembleia.titulo}</Text>
      <Text style={styles.descricaoText}>{assembleia.descricao}</Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Quórum Atual</Text>
        <Text style={styles.infoValue}>{estado?.quorumVigente?.total || 0} presentes</Text>
      </View>

      {isAberta && (
        <View style={styles.interactionSection}>
          {hasCheckedIn ? (
            <View style={styles.salaBox}>
                <TouchableOpacity
                    style={styles.btnSala}
                    onPress={() => navigation.navigate('AssembleiaSala', { id })}
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
              <TouchableOpacity style={styles.btnCheckin} onPress={handleCheckin} disabled={actionLoading}>
                <Text style={styles.btnText}>Confirmar Presença</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

    </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f8', paddingHorizontal: 16, paddingTop: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#666', textAlign: 'center', marginTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeCRIADA: { backgroundColor: '#cfe2ff' },
  badgeABERTA: { backgroundColor: '#d1e7dd' },
  badgeENCERRADA: { backgroundColor: '#f8d7da' },
  badgeText: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  tipoText: { fontWeight: 'bold', color: '#666', fontSize: 16 },
  tituloText: { fontSize: 24, fontWeight: 'bold', color: '#003366', marginBottom: 8 },
  descricaoText: { fontSize: 16, color: '#555', marginBottom: 20 },
  infoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, elevation: 2 },
  infoTitle: { fontSize: 14, color: '#666', marginBottom: 4 },
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
  diretoriaSection: { marginTop: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  diretoriaButtons: { flexDirection: 'row', gap: 12 },
  btnManagement: { flex: 1, backgroundColor: '#f1c40f', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnDanger: { backgroundColor: '#e74c3c' },
});
