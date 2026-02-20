import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';

import SafeScreen from '../components/SafeScreen';
import { useAuth } from '../hooks/useAuth';
import { obterVotacao, votar } from '../services/votacaoService';
import { getStableDeviceId } from '../utils/deviceId';
import { logger } from '../infra/logger';

import type { VotacaoDetalhe } from '../types/votacao';

type RouteParams = { id: number };

export default function VotacaoDetalheScreen() {
  const { token, biometriaHabilitada, desbloquearComBiometria } = useAuth();
  const route = useRoute();
  const { id } = route.params as RouteParams;

  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [votacao, setVotacao] = useState<VotacaoDetalhe | null>(null);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState<number | null>(null);

  async function carregar() {
    if (!token) return;
    try {
      setLoading(true);
      logger.info('VOTACAO_DETALHE_LOAD_START', { id });
      const v = await obterVotacao(token, id);
      setVotacao(v);
    } catch (e: any) {
      logger.error('VOTACAO_DETALHE_LOAD_ERROR', e, { id });
      Alert.alert('Erro', e?.message || 'Falha ao carregar votação.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmarVoto() {
    if (!token || !votacao) return;
    if (!opcaoSelecionada) {
      Alert.alert('Atenção', 'Selecione uma opção.');
      return;
    }
    if (votacao.status !== 'ABERTA') {
      Alert.alert('Atenção', 'Esta votação não está aberta.');
      return;
    }

    try {
      setEnviando(true);

      let biometriaConfirmada = false;
      if (biometriaHabilitada) {
        const ok = await desbloquearComBiometria();
        if (!ok) {
          Alert.alert('Atenção', 'Biometria não confirmada. Voto cancelado.');
          return;
        }
        biometriaConfirmada = true;
      }

      const deviceId = await getStableDeviceId();

      const res = await votar(token, votacao.id, {
        opcao_id: opcaoSelecionada,
        device_id: deviceId,
        biometria_confirmada: biometriaConfirmada,
      });

      Alert.alert('Sucesso', res.message || 'Voto computado.');
      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao votar.');
    } finally {
      setEnviando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Carregando…</Text>
      </View>
    );
  }

  if (!votacao) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Votação indisponível.</Text>
      </View>
    );
  }

  return (
    <SafeScreen style={styles.container}>
      <Text style={styles.title}>{votacao.titulo}</Text>
      <Text style={styles.desc}>{votacao.descricao}</Text>
      <Text style={styles.meta}>Status: {votacao.status}</Text>

      <Text style={styles.section}>Opções</Text>

      {votacao.opcoes.map((op) => {
        const selected = opcaoSelecionada === op.id;
        return (
          <Pressable
            key={op.id}
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => setOpcaoSelecionada(op.id)}
          >
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{op.texto}</Text>
          </Pressable>
        );
      })}

      <Pressable
        style={[styles.voteBtn, (enviando || votacao.status !== 'ABERTA') && styles.voteBtnDisabled]}
        onPress={confirmarVoto}
        disabled={enviando || votacao.status !== 'ABERTA'}
      >
        <Text style={styles.voteBtnText}>
          {enviando ? 'Enviando…' : biometriaHabilitada ? 'Votar (confirmará biometria)' : 'Votar'}
        </Text>
      </Pressable>

      <Text style={styles.note}>
        Observação: votar exige internet. A leitura desta tela pode ser cacheada numa próxima etapa.
      </Text>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#f2f4f8' },
  muted: { color: '#666' },

  container: { flex: 1, padding: 16, backgroundColor: '#f2f4f8' },
  title: { fontSize: 18, fontWeight: '800', color: '#003366', marginBottom: 8 },
  desc: { color: '#333', marginBottom: 10 },
  meta: { color: '#555', marginBottom: 12 },

  section: { fontWeight: '800', color: '#003366', marginBottom: 8 },
  option: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e4e6ea', marginBottom: 10 },
  optionSelected: { borderColor: '#003366' },
  optionText: { color: '#111', fontWeight: '600' },
  optionTextSelected: { color: '#003366' },

  voteBtn: { marginTop: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: '#003366', alignItems: 'center' },
  voteBtnDisabled: { opacity: 0.6 },
  voteBtnText: { color: '#fff', fontWeight: '800' },

  note: { marginTop: 12, fontSize: 12, color: '#666' },
});
