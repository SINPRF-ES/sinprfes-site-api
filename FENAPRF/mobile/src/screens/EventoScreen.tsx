import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { useAuth } from "../hooks/useAuth";
import { API_BASE_URL } from "../config/api";

type EventoStatus = "RASCUNHO" | "AGENDADO" | "ABERTO" | "ENCERRADO" | "CANCELADO";
type EventoTipo = "AGE" | "AGO" | "INFORMATIVA" | "OUTROS";

type Evento = {
  id: string | number;
  tipo: EventoTipo;
  titulo: string;
  pauta_resumida?: string | null;
  status: EventoStatus;
  data_hora_inicio_prevista?: string | null;
  duracao_prevista_min?: number | null;
  edital_pdf_url?: string | null;
  abre_em?: string | null;
  encerra_em?: string | null;
  quorum_versao_atual?: number | null;
};

type Presenca = {
  id: string | number;
  evento_id: string | number;
  user_id: string | number;
  entrou_em: string;
  saiu_em: string | null;
  ativa: boolean;
  quorum_versao: number;
  device_id?: string | null;
};

type ProximoEventoResponse = { evento: Evento | null };

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function apiFetch<T>(
  url: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  let resp: Response;

  try {
    resp = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new Error("Falha de rede. Verifique sua conexão.");
  }

  const text = await resp.text();
  const data = text ? safeJson(text) : null;

  if (!resp.ok) {
    // Se vier HTML (Express default), cai aqui:
    const msg =
      (data && (data.error || data.message)) ||
      (text?.slice?.(0, 200) ? String(text).slice(0, 200) : null) ||
      `Erro HTTP ${resp.status}: ${resp.statusText || "Falha na requisição"}`;

    throw new Error(msg);
  }

  // Se a API retornar vazio, entrega objeto vazio do tipo esperado
  return (data ?? ({} as T)) as T;
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function EventoScreen() {
  const { token, user } = useAuth() as any;

  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);

  const [evento, setEvento] = useState<Evento | null>(null);
  const [presencas, setPresencas] = useState<Presenca[]>([]);

  const userId = useMemo(() => String(user?.id ?? ""), [user?.id]);

  const isAdmin = useMemo(() => {
    const perfil = String(user?.perfil ?? user?.role ?? "").toUpperCase();
    const roles = Array.isArray(user?.roles)
      ? user.roles.map((r: any) => String(r).toUpperCase())
      : [];
    return (
      perfil === "ADMIN" ||
      roles.includes("ADMIN") ||
      roles.includes("DIRETORIA") ||
      roles.includes("PRESIDENTE")
    );
  }, [user]);

  const minhaPresencaAtiva = useMemo(() => {
    if (!userId) return null;
    return presencas.find((p) => String(p.user_id) === userId && p.ativa) ?? null;
  }, [presencas, userId]);

  const totalPresentesAtivos = useMemo(
    () => presencas.filter((p) => p.ativa).length,
    [presencas]
  );

  const carregarTudo = useCallback(async () => {
    if (!token) return;

    // 1) Próximo evento (home do app)
    const prox = await apiFetch<ProximoEventoResponse>(
      `${API_BASE_URL}/api/eventos/proximo`,
      token
    );

    if (!prox.evento) {
      setEvento(null);
      setPresencas([]);
      return;
    }

    const evId = prox.evento.id;
    setEvento(prox.evento);

    // 2) Detalhe
    const detalhe = await apiFetch<Evento>(
      `${API_BASE_URL}/api/eventos/${evId}`,
      token
    );
    setEvento(detalhe);

    // 3) Presenças
    const pres = await apiFetch<Presenca[]>(
      `${API_BASE_URL}/api/eventos/${evId}/presencas`,
      token
    );
    setPresencas(pres);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      (async () => {
        try {
          setCarregando(true);
          await carregarTudo();
        } catch (e: any) {
          if (ativo) Alert.alert("Erro", e.message || "Falha ao carregar evento.");
        } finally {
          if (ativo) setCarregando(false);
        }
      })();

      return () => {
        ativo = false;
      };
    }, [carregarTudo])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await carregarTudo();
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Falha ao atualizar.");
    } finally {
      setRefreshing(false);
    }
  }, [carregarTudo]);

  async function runAction(fn: () => Promise<void>, okMsg?: string) {
    if (!token) return;
    if (working) return;

    try {
      setWorking(true);
      await fn();
      await carregarTudo();
      if (okMsg) Alert.alert("OK", okMsg);
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Falha na operação.");
    } finally {
      setWorking(false);
    }
  }

  async function entrar() {
    if (!evento) return;
    await runAction(
      async () => {
        await apiFetch(
          `${API_BASE_URL}/api/eventos/${evento.id}/entrar`,
          token!,
          { method: "POST" }
        );
      },
      "Presença registrada."
    );
  }

  async function sair() {
    if (!evento) return;
    await runAction(async () => {
      await apiFetch(`${API_BASE_URL}/api/eventos/${evento.id}/sair`, token!, {
        method: "POST",
      });
    });
  }

  function confirmarAbrirEvento() {
    if (!evento) return;
    Alert.alert("Abrir evento", "Confirma abrir o evento agora?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Abrir",
        style: "destructive",
        onPress: () =>
          runAction(async () => {
            await apiFetch(
              `${API_BASE_URL}/api/eventos/${evento.id}/abrir`,
              token!,
              { method: "POST" }
            );
          }),
      },
    ]);
  }

  function confirmarEncerrarEvento() {
    if (!evento) return;
    Alert.alert("Encerrar evento", "Confirma encerrar o evento agora?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Encerrar",
        style: "destructive",
        onPress: () =>
          runAction(async () => {
            await apiFetch(
              `${API_BASE_URL}/api/eventos/${evento.id}/encerrar`,
              token!,
              { method: "POST" }
            );
          }),
      },
    ]);
  }

  function confirmarRecontarQuorum() {
    if (!evento) return;
    Alert.alert(
      "Recontagem de quórum",
      "Isso vai derrubar todos os presentes (logout forçado do evento). Confirma?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Recontar",
          style: "destructive",
          onPress: () =>
            runAction(async () => {
              await apiFetch(
                `${API_BASE_URL}/api/eventos/${evento.id}/recontar-quorum`,
                token!,
                { method: "POST" }
              );
            }),
        },
      ]
    );
  }

  async function abrirEdital() {
    const url = evento?.edital_pdf_url;
    if (!url) return;

    const ok = await Linking.canOpenURL(url);
    if (!ok) {
      Alert.alert("PDF", "Não foi possível abrir o edital neste aparelho.");
      return;
    }
    Linking.openURL(url);
  }

  if (carregando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Carregando evento…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.h1}>Evento</Text>

        <Pressable
          onPress={working ? undefined : onRefresh}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons name="refresh" size={22} color="#111" />
        </Pressable>
      </View>

      {!evento ? (
        <View style={styles.card}>
          <Text style={styles.h2}>Nenhum evento agendado/aberto</Text>
          <Text style={styles.muted}>
            Quando a diretoria agendar um evento (AGE/AGO/etc), ele aparecerá aqui.
          </Text>
        </View>
      ) : (
        <>
          {/* Badge presença */}
          {minhaPresencaAtiva ? (
            <View style={styles.presenteBadge}>
              <MaterialCommunityIcons name="account-check" size={18} color="#0a0" />
              <Text style={styles.presenteText}>Você está presente</Text>
            </View>
          ) : (
            <View style={styles.ausenteBadge}>
              <MaterialCommunityIcons name="account-off" size={18} color="#b00" />
              <Text style={styles.ausenteText}>Você não está presente</Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.h2}>{evento.titulo}</Text>

            <KV k="Tipo" v={evento.tipo} />
            <KV k="Status" v={evento.status} />
            <KV k="Data/hora prevista" v={formatDateTime(evento.data_hora_inicio_prevista)} />
            <KV k="Abriu em" v={formatDateTime(evento.abre_em)} />
            <KV k="Encerrou em" v={formatDateTime(evento.encerra_em)} />

            {!!evento.pauta_resumida && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pauta resumida</Text>
                <Text style={styles.sectionBody}>{evento.pauta_resumida}</Text>
              </View>
            )}

            {!!evento.edital_pdf_url && (
              <Pressable
                onPress={abrirEdital}
                style={({ pressed }) => [styles.rowBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="document-text-outline" size={18} color="#111" />
                <Text style={styles.link}>Abrir edital (PDF)</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.h2}>Quórum</Text>

            <KV k="Presentes (ativos)" v={String(totalPresentesAtivos)} />
            <KV k="Versão do quórum" v={String(evento.quorum_versao_atual ?? "-")} />

            <View style={styles.actionsRow}>
              {evento.status === "ABERTO" ? (
                minhaPresencaAtiva ? (
                  <ActionButton
                    variant="danger"
                    disabled={working}
                    label="Sair do evento"
                    onPress={sair}
                  />
                ) : (
                  <ActionButton
                    variant="primary"
                    disabled={working}
                    label="Entrar no evento"
                    onPress={entrar}
                  />
                )
              ) : (
                <Text style={styles.muted}>
                  Para registrar presença, o evento precisa estar ABERTO.
                </Text>
              )}
            </View>
          </View>

          {isAdmin && (
            <View style={styles.cardAdmin}>
              <Text style={styles.h2}>Admin</Text>

              <View style={styles.actionsRow}>
                <ActionButton
                  variant="primary"
                  disabled={working || evento.status !== "AGENDADO"}
                  label="Abrir evento"
                  onPress={confirmarAbrirEvento}
                />
                <ActionButton
                  variant="danger"
                  disabled={working || evento.status !== "ABERTO"}
                  label="Encerrar evento"
                  onPress={confirmarEncerrarEvento}
                />
              </View>

              <View style={styles.actionsRow}>
                <ActionButton
                  variant="warn"
                  disabled={working || evento.status !== "ABERTO"}
                  label="Recontar quórum (derruba presentes)"
                  onPress={confirmarRecontarQuorum}
                />
              </View>

              <Text style={styles.mutedSmall}>
                Após abrir/encerrar/recontar, a tela recarrega evento + presenças automaticamente.
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.h2}>Presenças (debug)</Text>

            {presencas.length === 0 ? (
              <Text style={styles.muted}>Nenhuma presença registrada.</Text>
            ) : (
              presencas.map((p) => (
                <View key={String(p.id)} style={styles.presencaRow}>
                  <Text style={styles.presencaUser}>User #{p.user_id}</Text>
                  <Text style={styles.presencaMeta}>
                    {p.ativa ? "ATIVA" : "INATIVA"} • entrou {formatDateTime(p.entrou_em)}
                  </Text>
                  {!!p.device_id && <Text style={styles.presencaMeta}>device: {p.device_id}</Text>}
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  variant,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant: "primary" | "danger" | "warn";
}) {
  const base = [styles.btnBase];
  const variantStyle =
    variant === "primary"
      ? styles.btnPrimary
      : variant === "danger"
      ? styles.btnDanger
      : styles.btnWarn;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        ...base,
        variantStyle,
        disabled && styles.btnDisabled,
        pressed && !disabled && { opacity: 0.85 },
      ]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f3f5f7" },
  container: { padding: 16, paddingBottom: 28 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  iconBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e7e7",
  },
  iconBtnPressed: { opacity: 0.75 },

  h1: { fontSize: 22, fontWeight: "800", color: "#111" },
  h2: { fontSize: 16, fontWeight: "800", color: "#111", marginBottom: 10 },

  muted: { color: "#666", marginTop: 6 },
  mutedSmall: { color: "#666", marginTop: 10, fontSize: 12 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e7e7e7",
  },

  cardAdmin: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ffe3b0",
  },

  kv: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  k: { color: "#444", fontWeight: "700" },
  v: { color: "#111", fontWeight: "600" },

  section: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#eee" },
  sectionTitle: { fontWeight: "800", marginBottom: 6 },
  sectionBody: { color: "#222", lineHeight: 20 },

  rowBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  link: { color: "#0b63ce", fontWeight: "700" },

  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },

  btnBase: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  btnPrimary: { backgroundColor: "#FFC300" },
  btnDanger: { backgroundColor: "#e74c3c" },
  btnWarn: { backgroundColor: "#ffb020" },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontWeight: "800", color: "#111" },

  presenteBadge: {
    backgroundColor: "#eaffea",
    borderColor: "#b8efb8",
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  presenteText: { fontWeight: "900", color: "#0a0" },

  ausenteBadge: {
    backgroundColor: "#ffecec",
    borderColor: "#ffbcbc",
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  ausenteText: { fontWeight: "900", color: "#b00" },

  presencaRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#eee" },
  presencaUser: { fontWeight: "800", color: "#111" },
  presencaMeta: { color: "#666", marginTop: 2 },
});
