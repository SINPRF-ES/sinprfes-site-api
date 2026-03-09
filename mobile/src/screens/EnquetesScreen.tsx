import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SafeScreen from '../components/SafeScreen';
import { COLORS } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { EMOJI } from '../constants/emojis';
import { createPoll, getPollById, listPolls, votePoll, type PollDetail, type PollSummary } from '../services/pollsService';

const formatDate = (value?: string) => {
  if (!value) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
};

export default function EnquetesScreen() {
  const { usuario } = useAuth();
  const isDiretoria = useMemo(() => ['ADMIN', 'DIRETORIA'].includes(String(usuario?.perfil_acesso || '').toUpperCase()), [usuario?.perfil_acesso]);

  const [status, setStatus] = useState<'ativas' | 'encerradas'>('ativas');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [selected, setSelected] = useState<PollDetail | null>(null);
  const [voteSelection, setVoteSelection] = useState<number[]>([]);
  const [otherAnswers, setOtherAnswers] = useState<Record<number, string>>({});

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'YES_NO' | 'MULTIPLE_CHOICE'>('YES_NO');
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [allowOther, setAllowOther] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [options, setOptions] = useState(['', '']);

  const load = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const data = await listPolls(status);
      setPolls(data);
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.error || 'Não foi possível carregar enquetes.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [status]);

  React.useEffect(() => {
    if (isDiretoria) load();
  }, [load, isDiretoria]);

  const openPoll = async (id: number) => {
    try {
      const detail = await getPollById(id);
      setSelected(detail);
      setVoteSelection((detail.my_votes || []).map((v) => Number(v.option_id)));
      const map: Record<number, string> = {};
      (detail.my_votes || []).forEach((v) => {
        if (v.other_text) map[Number(v.option_id)] = String(v.other_text);
      });
      setOtherAnswers(map);
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.error || 'Não foi possível abrir a enquete.');
    }
  };

  const toggleVote = (optionId: number) => {
    if (!selected) return;
    if (selected.allow_multiple_answers) {
      setVoteSelection((prev) => prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]);
      return;
    }
    setVoteSelection([optionId]);
  };

  const submitVote = async () => {
    if (!selected) return;
    if (!voteSelection.length) {
      Alert.alert('Atenção', 'Selecione ao menos uma opção.');
      return;
    }

    for (const id of voteSelection) {
      const opt = selected.options.find((o) => Number(o.id) === Number(id));
      if (opt?.is_other && !String(otherAnswers[id] || '').trim()) {
        Alert.alert('Atenção', 'Informe o texto da opção Outro.');
        return;
      }
    }

    try {
      await votePoll(selected.id, { option_ids: voteSelection, other_texts: otherAnswers });
      await openPoll(selected.id);
      await load(true);
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.error || 'Não foi possível salvar o voto.');
    }
  };

  const submitCreate = async () => {
    const normalizedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!title.trim() || !deadlineDate) {
      Alert.alert('Atenção', 'Preencha pergunta e data limite.');
      return;
    }
    if (type === 'MULTIPLE_CHOICE' && normalizedOptions.length < 2) {
      Alert.alert('Atenção', 'Informe ao menos duas opções válidas.');
      return;
    }

    try {
      await createPoll({
        title: title.trim(),
        type,
        allow_multiple_answers: type === 'MULTIPLE_CHOICE' && allowMultiple,
        allow_other_option: type === 'MULTIPLE_CHOICE' && allowOther,
        deadline_date: deadlineDate,
        options: normalizedOptions,
      });
      setShowCreate(false);
      setTitle('');
      setDeadlineDate('');
      setAllowMultiple(false);
      setAllowOther(false);
      setType('YES_NO');
      setOptions(['', '']);
      await load(true);
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.error || 'Não foi possível criar enquete.');
    }
  };

  if (!isDiretoria) {
    return <SafeScreen style={styles.container}><View style={styles.card}><Text style={styles.text}>Acesso restrito à diretoria.</Text></View></SafeScreen>;
  }

  return (
    <SafeScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
        <View style={styles.card}>
          <Text style={styles.title}>{EMOJI.ENQUETES} Enquetes</Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.tab, status === 'ativas' && styles.tabActive]} onPress={() => setStatus('ativas')}><Text>Ativas</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tab, status === 'encerradas' && styles.tabActive]} onPress={() => setStatus('encerradas')}><Text>Encerradas</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.btn} onPress={() => setShowCreate(true)}><Text style={styles.btnText}>+ Nova enquete</Text></TouchableOpacity>
        </View>

        {loading ? <ActivityIndicator color={COLORS.prfBlue} /> : polls.map((poll) => (
          <TouchableOpacity key={poll.id} style={styles.card} onPress={() => openPoll(poll.id)}>
            <Text style={styles.question}>{poll.title}</Text>
            <Text style={styles.text}>Data limite: {formatDate(poll.deadline_date || poll.deadline_at)}</Text>
            <Text style={styles.text}>Participantes: {poll.participants || 0}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeScreen style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <TouchableOpacity onPress={() => setSelected(null)}><Text style={styles.link}>Fechar</Text></TouchableOpacity>
            {selected && (
              <View style={styles.card}>
                <Text style={styles.title}>{EMOJI.ENQUETES} Enquete</Text>
                <Text style={styles.question}>{selected.title}</Text>
                <Text style={styles.text}>Data limite: {formatDate(selected.deadline_date || selected.deadline_at)}</Text>
                {(selected.options || []).map((opt) => (
                  <View key={opt.id} style={styles.option}>
                    <TouchableOpacity onPress={() => toggleVote(opt.id)}>
                      <Text>{voteSelection.includes(opt.id) ? (selected.allow_multiple_answers ? '☑' : '🔘') : (selected.allow_multiple_answers ? '☐' : '⚪')} {opt.label}</Text>
                    </TouchableOpacity>
                    {opt.is_other && voteSelection.includes(opt.id) && (
                      <TextInput value={otherAnswers[opt.id] || ''} onChangeText={(v) => setOtherAnswers((p) => ({ ...p, [opt.id]: v }))} placeholder="Digite sua resposta livre" style={styles.input} />
                    )}
                    <Text style={styles.text}>{opt.votes_count || 0} voto(s)</Text>
                    {(opt.voters || []).map((v, i) => <Text key={`${opt.id}-${i}`} style={styles.voter}>• {v.nome}{v.other_text ? ` — ${v.other_text}` : ''}</Text>)}
                  </View>
                ))}
                {selected.status === 'ACTIVE' && <TouchableOpacity style={styles.btn} onPress={submitVote}><Text style={styles.btnText}>Salvar voto</Text></TouchableOpacity>}
              </View>
            )}
          </ScrollView>
        </SafeScreen>
      </Modal>

      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <SafeScreen style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <TouchableOpacity onPress={() => setShowCreate(false)}><Text style={styles.link}>Fechar</Text></TouchableOpacity>
            <View style={styles.card}>
              <Text style={styles.title}>{EMOJI.ENQUETES} Nova enquete</Text>
              <TextInput value={title} onChangeText={setTitle} multiline numberOfLines={4} placeholder="Pergunta da enquete" style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]} />
              <View style={styles.row}>
                <TouchableOpacity style={[styles.tab, type === 'YES_NO' && styles.tabActive]} onPress={() => { setType('YES_NO'); setAllowMultiple(false); setAllowOther(false); }}><Text>Sim/Não</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tab, type === 'MULTIPLE_CHOICE' && styles.tabActive]} onPress={() => setType('MULTIPLE_CHOICE')}><Text>Múltipla</Text></TouchableOpacity>
              </View>
              <TextInput value={deadlineDate} onChangeText={setDeadlineDate} placeholder="Data limite (AAAA-MM-DD)" style={styles.input} />

              {type === 'MULTIPLE_CHOICE' && (
                <>
                  {options.map((opt, idx) => (
                    <View key={idx} style={styles.row}>
                      <TextInput value={opt} onChangeText={(v) => setOptions((prev) => prev.map((x, i) => i === idx ? v : x))} placeholder={`Opção ${idx + 1}`} style={[styles.input, { flex: 1 }]} />
                      {idx >= 2 && <TouchableOpacity onPress={() => setOptions((prev) => prev.filter((_, i) => i !== idx))}><Text style={styles.link}>Remover</Text></TouchableOpacity>}
                    </View>
                  ))}
                  <TouchableOpacity onPress={() => setOptions((prev) => [...prev, ''])}><Text style={styles.link}>+ Adicionar opção</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setAllowMultiple((v) => !v)}><Text>{allowMultiple ? '☑' : '☐'} Permitir mais de uma resposta por usuário</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setAllowOther((v) => !v)}><Text>{allowOther ? '☑' : '☐'} Permitir resposta livre (Outro)</Text></TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.btn} onPress={submitCreate}><Text style={styles.btnText}>Salvar enquete</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </SafeScreen>
      </Modal>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, gap: 8 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.prfBlue },
  question: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  text: { color: COLORS.textMuted },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  tab: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#e9f1ff', borderColor: COLORS.prfBlue },
  btn: { backgroundColor: COLORS.prfBlue, borderRadius: 8, padding: 11, alignItems: 'center' },
  btnText: { color: COLORS.white, fontWeight: '700' },
  link: { color: COLORS.prfBlue, fontWeight: '700' },
  option: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, gap: 4 },
  voter: { color: COLORS.text, fontSize: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: COLORS.white },
});
