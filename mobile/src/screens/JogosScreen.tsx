// mobile/src/screens/JogosScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SafeScreen from '../components/SafeScreen';
import { useAuth } from '../hooks/useAuth';
import { logger } from '../infra/logger';
import { getInscricoesJogos } from '../services/jogosService';
import NetInfo from '@react-native-community/netinfo';
import { salvarJogosInscricoesOffline, listarJogosInscricoesOffline } from '../database/db';
import { formatTelefone } from '../shared/format/formatters';
import { ROLES } from '../utils/filiadoUtils';
import { MODALIDADES_JOGOS_2026 } from '../constants/jogos';

const JogosScreen = () => {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inscricoesGerais, setInscricoesGerais] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(true);

  const isManager = [ROLES.ADMIN, ROLES.DIRETORIA, ROLES.FUNCIONARIO, ROLES.ORGANIZADOR].includes(usuario?.perfil_acesso || '');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => setIsConnected(!!state.isConnected));
    return () => unsubscribe();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      logger.info('JOGOS_FETCH_START', { isConnected });
      let inscricoes;
      if (isConnected) {
        inscricoes = await getInscricoesJogos();
        await salvarJogosInscricoesOffline(inscricoes);
      } else {
        inscricoes = await listarJogosInscricoesOffline();
      }

      logger.info('JOGOS_FETCH_SHAPE', {
        isArray: Array.isArray(inscricoes),
        length: inscricoes?.length,
        firstItemKeys: inscricoes?.[0] ? Object.keys(inscricoes[0]) : [],
        hasModalidades: inscricoes?.[0] ? !!inscricoes[0].modalidades : false
      });


      if (isManager) {
        setInscricoesGerais(inscricoes);
      }
    } catch (err: any) {
      logger.error('[Jogos.fetch]', err);
    } finally {
      setLoading(false);
    }
  }, [isManager, usuario?.id, isConnected]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const calculateAge2026 = (birthDate: any) => {
    if (!birthDate || typeof birthDate !== 'string') return '—';
    const year = birthDate.includes('-') ? birthDate.split('-')[0] : birthDate.split('/')[2];
    return 2026 - parseInt(year);
  };

  const formatGender = (s: string) => {
    if (!s) return '—';
    const lower = s.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;

  return (
    <SafeScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.banner}>
          <Text style={styles.bannerSubtitle}>🏅 Participe da maior integração esportiva da categoria!</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="map-marker-radius" size={20} color="#003366" />
            <Text style={styles.infoText}>Local: <Text style={styles.bold}>Poços de Caldas-MG</Text></Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="calendar-clock" size={20} color="#003366" />
            <Text style={styles.infoText}>Data: <Text style={styles.bold}>12 a 17/04/2026</Text></Text>
          </View>
        </View>

        {!isManager && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Visualização restrita</Text>
            <Text style={styles.infoText}>A visualização de participantes dos Jogos de Integração 2026 está disponível apenas para perfis de gestão.</Text>
          </View>
        )}

        {isManager && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 Planilha de Inscrições</Text>
            <ScrollView horizontal>
              <View>
                <View style={styles.tableHeader}>
                  <View style={[styles.tableHeaderCellContainer, { width: 150 }]}><Text style={styles.tableHeaderText}>Nome</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 80 }]}><Text style={styles.tableHeaderText}>Idade (2026)</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 100 }]}><Text style={styles.tableHeaderText}>Sexo</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 200 }]}><Text style={styles.tableHeaderText}>Modalidades</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 80 }]}><Text style={styles.tableHeaderText}>Qtd Fam.</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 150 }]}><Text style={styles.tableHeaderText}>Familiares</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 150 }]}><Text style={styles.tableHeaderText}>Observações</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 120 }]}><Text style={styles.tableHeaderText}>Telefone</Text></View>
                  <View style={[styles.tableHeaderCellContainer, { width: 180 }]}><Text style={styles.tableHeaderText}>E-mail(s)</Text></View>
                </View>
                {inscricoesGerais.map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.tableRow,
                      idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                    ]}
                  >
                    <View style={[styles.tableCellContainer, { width: 150 }]}><Text style={styles.tableCell}>{item.nome_filiado}</Text></View>
                    <View style={[styles.tableCellContainer, { width: 80 }]}><Text style={styles.tableCell}>{calculateAge2026(item.data_nascimento)}</Text></View>
                    <View style={[styles.tableCellContainer, { width: 100 }]}><Text style={styles.tableCell}>{formatGender(item.sexo)}</Text></View>
                    <View style={[styles.tableCellContainer, { width: 200 }]}>
                      <Text style={styles.tableCell}>
                        {(() => {
                          const mods = item.modalidades || [];
                          if (typeof mods.map !== 'function') {
                            logger.error('JOGOS_RENDER_TYPE_ERROR', new Error(`modalidades is ${typeof mods}`), { item: { id: item.id, filiado_id: item.filiado_id } });
                            return 'Erro nos dados';
                          }
                          return mods.map((mid: string) => {
                            const normalizedMid = mid?.toLowerCase();
                            const found = MODALIDADES_JOGOS_2026.find(m => m.id === normalizedMid || m.id === mid);
                            if (!found && mid) {
                              // Rebaixado para INFO para evitar poluição de logs conforme diretriz C
                              logger.info('JOGOS_UNKNOWN_SLUG', { slug: mid });
                            }
                            return found ? found.label : mid;
                          }).join(', ');
                        })()}
                      </Text>
                    </View>
                    <View style={[styles.tableCellContainer, { width: 80 }]}><Text style={styles.tableCell}>{item.qtd_familiares || 0}</Text></View>
                    <View style={[styles.tableCellContainer, { width: 150 }]}><Text style={styles.tableCell}>{item.familiares || '—'}</Text></View>
                    <View style={[styles.tableCellContainer, { width: 150 }]}><Text style={styles.tableCell}>{item.observacoes || '—'}</Text></View>
                    <View style={[styles.tableCellContainer, { width: 120 }]}><Text style={styles.tableCell}>{formatTelefone(item.telefone1) || '—'}</Text></View>
                    <View style={[styles.tableCellContainer, { width: 180 }]}><Text style={styles.tableCell}>{[item.email1, item.email2].filter(Boolean).join(' / ') || '—'}</Text></View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  scrollContent: { paddingBottom: 40 },
  banner: { backgroundColor: '#003366', padding: 20, alignItems: 'center' },
  bannerSubtitle: { fontSize: 15, color: '#fff', textAlign: 'center', fontStyle: 'italic' },
  infoCard: {
    backgroundColor: '#e6f0fa',
    margin: 15,
    marginBottom: 0,
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 5,
    borderLeftColor: '#003366',
    gap: 8,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 16, color: '#333' },
  bold: { fontWeight: 'bold' },
  card: { backgroundColor: '#fff', padding: 20, margin: 15, borderRadius: 12, elevation: 3 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366', marginBottom: 15, textAlign: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f3f5', borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#ccc' },
  tableHeaderText: { fontWeight: 'bold', color: '#003366', textAlign: 'center' },
  tableRow: { flexDirection: 'row', borderLeftWidth: 1, borderColor: '#ccc' },
  tableCell: { fontSize: 12, color: '#333', textAlign: 'center', flexShrink: 1 },
  tableCellContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    minHeight: 44,
  },
  tableHeaderCellContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    minHeight: 44,
  },
  tableRowEven: { backgroundColor: '#fff' },
  tableRowOdd: { backgroundColor: '#f9f9f9' },
});

export default JogosScreen;
