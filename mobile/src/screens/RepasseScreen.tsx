import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import SafeScreen from '../components/SafeScreen';
import repasseService, { MesRepasse, Responsavel } from '../services/repasseService';
import { useAuth } from '../hooks/useAuth';
import { isGestao } from '../utils/filiadoUtils';

const nomesMeses = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function RepasseScreen() {
  const { usuario } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [meses, setMeses] = useState<MesRepasse[]>([]);
  const [totalAcumuladoGeral, setTotalAcumuladoGeral] = useState(0);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

  const ehGestao = isGestao(usuario?.perfil_acesso);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [data, resps] = await Promise.all([
        repasseService.getRepasseAno(year),
        repasseService.listarResponsaveis()
      ]);
      setMeses(data.meses);
      setTotalAcumuladoGeral(data.totalAcumuladoGeral);
      setResponsaveis(resps);
    } catch (err) {
      console.error(err);
      Alert.alert('Erro', 'Não foi possível carregar os dados de repasse.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateLocalidade = (month: number, lotacao: string, field: string, value: any) => {
    const newMeses = [...meses];
    const mesIndex = newMeses.findIndex(m => m.month === month);
    if (mesIndex === -1) return;

    const locIndex = newMeses[mesIndex].localidades.findIndex(l => l.lotacao === lotacao);
    if (locIndex === -1) return;

    const loc = { ...newMeses[mesIndex].localidades[locIndex] };
    if (field === 'responsavelId') loc.responsavelId = value;
    if (field === 'prfTotal') loc.prfTotal = parseInt(value) || 0;
    if (field === 'reembolsoMes') loc.reembolsoMes = parseFloat(value) || 0;

    newMeses[mesIndex].localidades[locIndex] = loc;

    // Recalcular localmente para feedback instantâneo
    recalculate(newMeses, month);
    setMeses(newMeses);
  };

  const handleUpdatePerCapita = (month: number, value: string) => {
    const newMeses = [...meses];
    const mesIndex = newMeses.findIndex(m => m.month === month);
    if (mesIndex === -1) return;

    newMeses[mesIndex].perCapita = parseFloat(value) || 0;
    recalculate(newMeses, month);
    setMeses(newMeses);
  };

  const recalculate = (mesesList: MesRepasse[], month: number) => {
    const m = mesesList.find(m => m.month === month);
    if (!m) return;

    const perCapita = m.perCapita;
    m.localidades.forEach(loc => {
      if (loc.prfTotal > 0) {
        loc.percentual = (loc.filiadosAtivos / loc.prfTotal) * 100;
        const base = loc.filiadosAtivos * perCapita;
        let factor = 0;
        if (loc.percentual >= 90) factor = 1.0;
        else if (loc.percentual >= 80) factor = 0.7;
        else if (loc.percentual >= 70) factor = 0.4;
        loc.creditoMes = base * factor;
      } else {
        loc.percentual = null;
        loc.creditoMes = 0;
      }
    });

    m.totalRepasseMes = m.localidades.reduce((acc, l) => acc + l.creditoMes, 0);

    // Recalcular acumulados ano
    const lotacoes = ["SEDE", "DEL 01 - Viana", "DEL 02 - Serra", "DEL 03 - Guarapari", "DEL 04 - Linhares"];
    const acumulados: any = {};
    lotacoes.forEach(lot => {
      let somaCred = 0;
      let somaReem = 0;
      mesesList.forEach(mes => {
        const l = mes.localidades.find(ll => ll.lotacao === lot);
        if (l) {
            somaCred += l.creditoMes;
            somaReem += l.reembolsoMes;
        }
      });
      acumulados[lot] = somaCred - somaReem;
    });

    mesesList.forEach(mes => {
      mes.localidades.forEach(l => {
        l.acumuladoAno = acumulados[l.lotacao];
      });
    });

    setTotalAcumuladoGeral(Object.values(acumulados).reduce((acc: any, curr: any) => acc + curr, 0) as number);
  };

  const handleSaveMonth = async (month: number) => {
    const m = meses.find(ms => ms.month === month);
    if (!m) return;

    try {
      setLoading(true);
      await repasseService.updateRepasseMes(
        year,
        month,
        m.perCapita,
        m.localidades.map(l => ({
          lotacaoKey: l.lotacao,
          responsavelId: l.responsavelId,
          prfTotal: l.prfTotal,
          reembolsoMes: l.reembolsoMes
        }))
      );
      Alert.alert('Sucesso', `Dados de ${nomesMeses[month - 1]} salvos.`);
      fetchData();
    } catch (err) {
      Alert.alert('Erro', 'Falha ao salvar dados.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number) => {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (loading && meses.length === 0) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#003366" /></View>;
  }

  return (
    <SafeScreen style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>💱 Repasse Mensal</Text>
              <Text style={styles.subtitle}>Gestão de créditos por localidade</Text>
            </View>
            <View style={styles.yearPickerWrapper}>
              <Picker
                selectedValue={year}
                onValueChange={(v) => setYear(v)}
                style={styles.yearPicker}
              >
                {[year, year - 1, year - 2].map(y => (
                  <Picker.Item key={y} label={String(y)} value={y} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Total Acumulado Geral ({year})</Text>
            <Text style={styles.statsValue}>{formatCurrency(totalAcumuladoGeral)}</Text>
          </View>

          {meses.map((m) => (
            <View key={m.month} style={styles.monthCard}>
              <TouchableOpacity
                style={styles.monthHeader}
                onPress={() => setExpandedMonth(expandedMonth === m.month ? null : m.month)}
              >
                <View style={styles.monthHeaderLeft}>
                  <Text style={styles.monthName}>{nomesMeses[m.month - 1]}</Text>
                  <Text style={styles.monthCapita}>Per Capita: {formatCurrency(m.perCapita)}</Text>
                </View>
                <View style={styles.monthHeaderRight}>
                  <Text style={styles.monthTotal}>{formatCurrency(m.totalRepasseMes)}</Text>
                  <MaterialCommunityIcons
                    name={expandedMonth === m.month ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color="#003366"
                  />
                </View>
              </TouchableOpacity>

              {expandedMonth === m.month && (
                <View style={styles.monthDetails}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Per Capita do Mês</Text>
                    <TextInput
                      style={styles.input}
                      value={String(m.perCapita)}
                      keyboardType="numeric"
                      onChangeText={(v) => handleUpdatePerCapita(m.month, v)}
                    />
                  </View>

                  {m.localidades.map((loc) => (
                    <View key={loc.lotacao} style={styles.locCard}>
                      <Text style={styles.locName}>{loc.lotacao}</Text>

                      <View style={styles.locGrid}>
                        <View style={styles.locCol}>
                          <Text style={styles.locLabel}>Responsável</Text>
                          <View style={styles.locPickerWrapper}>
                            <Picker
                              selectedValue={loc.responsavelId}
                              onValueChange={(v) => handleUpdateLocalidade(m.month, loc.lotacao, 'responsavelId', v)}
                              style={styles.locPicker}
                            >
                              <Picker.Item label="Selecione..." value={null} />
                              {responsaveis.map(r => (
                                <Picker.Item key={r.id} label={r.nome} value={r.id} />
                              ))}
                            </Picker>
                          </View>
                        </View>
                      </View>

                      <View style={styles.locGrid}>
                        <View style={styles.locCol}>
                          <Text style={styles.locLabel}>Filiados Ativos</Text>
                          <Text style={styles.locValue}>{loc.filiadosAtivos}</Text>
                        </View>
                        <View style={styles.locCol}>
                          <Text style={styles.locLabel}>PRF Total</Text>
                          <TextInput
                            style={styles.locInput}
                            value={String(loc.prfTotal)}
                            keyboardType="numeric"
                            onChangeText={(v) => handleUpdateLocalidade(m.month, loc.lotacao, 'prfTotal', v)}
                          />
                        </View>
                      </View>

                      <View style={styles.locGrid}>
                        <View style={styles.locCol}>
                          <Text style={styles.locLabel}>% Filiação</Text>
                          <Text style={[styles.locValue, { color: (loc.percentual || 0) < 70 ? '#c62828' : '#2e7d32' }]}>
                            {loc.percentual === null ? '—' : `${loc.percentual.toFixed(1)}%`}
                          </Text>
                        </View>
                        <View style={styles.locCol}>
                          <Text style={styles.locLabel}>Crédito Mês</Text>
                          <Text style={[styles.locValue, { fontWeight: 'bold' }]}>{formatCurrency(loc.creditoMes)}</Text>
                        </View>
                      </View>

                      <View style={styles.locGrid}>
                        <View style={styles.locCol}>
                          <Text style={styles.locLabel}>Reembolso</Text>
                          <TextInput
                            style={styles.locInput}
                            value={String(loc.reembolsoMes)}
                            keyboardType="numeric"
                            onChangeText={(v) => handleUpdateLocalidade(m.month, loc.lotacao, 'reembolsoMes', v)}
                          />
                        </View>
                        <View style={styles.locCol}>
                          <Text style={styles.locLabel}>Acumulado Ano</Text>
                          <Text style={[styles.locValue, { color: '#e67e22', fontWeight: 'bold' }]}>{formatCurrency(loc.acumuladoAno)}</Text>
                        </View>
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={() => handleSaveMonth(m.month)}
                  >
                    <Text style={styles.saveButtonText}>Salvar {nomesMeses[m.month - 1]}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#003366' },
  subtitle: { fontSize: 13, color: '#666' },
  yearPickerWrapper: { backgroundColor: '#fff', borderRadius: 8, width: 120, elevation: 2 },
  yearPicker: { height: 40 },
  statsCard: { backgroundColor: '#003366', padding: 20, borderRadius: 12, marginBottom: 20, elevation: 4 },
  statsLabel: { color: '#fff', opacity: 0.8, fontSize: 13, marginBottom: 5 },
  statsValue: { color: '#ffc107', fontSize: 24, fontWeight: 'bold' },
  monthCard: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, elevation: 2, overflow: 'hidden' },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  monthHeaderLeft: { flex: 1 },
  monthName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  monthCapita: { fontSize: 12, color: '#777', marginTop: 2 },
  monthHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthTotal: { fontSize: 15, fontWeight: 'bold', color: '#003366' },
  monthDetails: { padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 5 },
  input: { backgroundColor: '#f9f9f9', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#ddd', fontSize: 16 },
  locCard: { backgroundColor: '#fcfcfc', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 15, marginBottom: 10 },
  locName: { fontSize: 15, fontWeight: 'bold', color: '#003366', marginBottom: 10 },
  locGrid: { flexDirection: 'row', gap: 15, marginBottom: 10 },
  locCol: { flex: 1 },
  locLabel: { fontSize: 11, color: '#888', marginBottom: 3 },
  locValue: { fontSize: 14, color: '#333' },
  locInput: { backgroundColor: '#fff', padding: 6, borderRadius: 4, borderWidth: 1, borderColor: '#ccc', fontSize: 14, color: '#333' },
  locPickerWrapper: { backgroundColor: '#fff', borderRadius: 4, borderWidth: 1, borderColor: '#ccc', height: 40, justifyContent: 'center' },
  locPicker: { height: 40 },
  saveButton: { backgroundColor: '#003366', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
