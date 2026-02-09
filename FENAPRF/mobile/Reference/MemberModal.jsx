import React, { useEffect, useMemo, useRef, useState } from "react";
import { styles } from "./styles";
import {
  PERFIS,
  PERFIS_CADASTRO_BASE,
  CARGOS_CONSELHO,
  CARGOS_DIRETORIA,
  UFS_DETALHADAS,
} from "./constants";
import { maskCPF, maskPhone, maskCEP } from "../../utils/masks";

function safeUpper(v) {
  return (v ?? "").toString().toUpperCase();
}

function formatarDataBRRobusta(dateLike) {
  if (!dateLike) return "";
  const raw = String(dateLike);

  const d = new Date(dateLike);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  return raw;
}

async function fetchViaCEP(cepDigits) {
  const cep = (cepDigits || "").toString().replace(/\D/g, "");
  if (cep.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  const data = await res.json();
  if (data?.erro) return null;
  return data;
}

export default function MemberModal({
  open,
  mode = "view", // "view" | "edit" | "create" | "archive" | "unarchive"
  member,
  currentUserPerfil,
  onClose,
  onSave,
  saving = false,
  errorMessage = "",
  // ✅ NOVO (opcional): permite mostrar e navegar para o ocupante do cargo
  conflictInfo = null,
  onOpenConflict = null,
}) {
  // Hooks SEMPRE no topo
  const [draft, setDraft] = useState(member || {});
  const [motivo, setMotivo] = useState("");
  // ✅ Multi-vínculo (Diretoria + Conselho): UI para criar 2º vínculo
  const [addSegundoVinculo, setAddSegundoVinculo] = useState(false);
  const [vinculo2, setVinculo2] = useState({ perfil_acesso: "", cargo: "", uf: "" });
  const cepTimerRef = useRef(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(member || {});
    setMotivo("");
    const hasSecond =
      Boolean((member || {})?.perfil_acesso2 && String((member || {})?.perfil_acesso2 || "").trim()) ||
      Boolean((member || {})?.cargo2 && String((member || {})?.cargo2 || "").trim()) ||
      Boolean((member || {})?.uf2 && String((member || {})?.uf2 || "").trim());

    setAddSegundoVinculo(hasSecond);
    setVinculo2(
      hasSecond
        ? {
            perfil_acesso: (member || {})?.perfil_acesso2 || "",
            cargo: (member || {})?.cargo2 || "",
            uf: (member || {})?.uf2 || "",
          }
        : { perfil_acesso: "", cargo: "", uf: "" }
    );
  }, [member, open, mode]);

  const perfilDraft = safeUpper(draft?.perfil_acesso);

  const canEditSensitive = useMemo(() => {
    const p = safeUpper(currentUserPerfil);
    return (
      p === PERFIS.ADMIN ||
      p === PERFIS.DIRETORIA ||
      p === PERFIS.COLABORADOR
    );
  }, [currentUserPerfil]);

  const cargoOptions = useMemo(() => {
    if (perfilDraft === PERFIS.CONSELHEIRO) return CARGOS_CONSELHO;
    if (perfilDraft === PERFIS.DIRETORIA) return CARGOS_DIRETORIA;
    if (perfilDraft === PERFIS.ADMIN)
      return [...CARGOS_DIRETORIA, ...CARGOS_CONSELHO];
    return [];
  }, [perfilDraft]);

  const perfil2 = useMemo(() => {
    if (perfilDraft === PERFIS.DIRETORIA) return PERFIS.CONSELHEIRO;
    if (perfilDraft === PERFIS.CONSELHEIRO) return PERFIS.DIRETORIA;
    return "";
  }, [perfilDraft]);

  const secondCargoOptions = useMemo(() => {
    if (perfil2 === PERFIS.CONSELHEIRO) return CARGOS_CONSELHO;
    if (perfil2 === PERFIS.DIRETORIA) return CARGOS_DIRETORIA;
    return [];
  }, [perfil2]);

  // Mantém o vínculo 2 sempre complementar (quando habilitado)
  useEffect(() => {
    if (!addSegundoVinculo) return;
    if (!perfil2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAddSegundoVinculo(false);
      setVinculo2({ perfil_acesso: "", cargo: "", uf: "" });
      return;
    }
    setVinculo2((prev) => ({
      ...prev,
      perfil_acesso: perfil2,
      cargo: prev?.perfil_acesso === perfil2 ? prev.cargo : "",
      uf: prev?.perfil_acesso === perfil2 ? prev.uf : "",
    }));
  }, [addSegundoVinculo, perfil2]);

  const set = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  const handleCepChange = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    set({ cep: digits });

    if (cepTimerRef.current) clearTimeout(cepTimerRef.current);
    if (digits.length === 8) {
      cepTimerRef.current = setTimeout(async () => {
        const data = await fetchViaCEP(digits);
        if (!data) return;
        set({
          logradouro: data.logradouro || "",
          bairro: data.bairro || "",
          cidade: data.localidade || "",
          uf_endereco: safeUpper(data.uf || ""),
        });
      }, 350);
    }
  };

  if (!open) return null;

  const isReadOnly = mode === "view";
  const arquivadoEm = draft?.arquivado_em ?? member?.arquivado_em ?? null;
  const arquivadoMotivo = String(
    draft?.arquivado_motivo ?? member?.arquivado_motivo ?? ""
  ).trim();
  const dataArquivamentoFmt = formatarDataBRRobusta(arquivadoEm);
  const isArchived = !!arquivadoEm;

  const canShowConflictActions =
    !!conflictInfo?.conflictUserId && typeof onOpenConflict === "function";

  // Modal Arquivar / Desarquivar (com motivo)
  if (mode === "archive" || mode === "unarchive") {
    const titulo = mode === "archive" ? "Arquivar membro" : "Desarquivar membro";
    const placeholder =
      mode === "archive"
        ? "Descreva de forma clara e objetiva o motivo do arquivamento…"
        : "Descreva de forma clara e objetiva o motivo do desarquivamento…";
    const confirmLabel = mode === "archive" ? "Arquivar" : "Desarquivar";
    const savingLabel = mode === "archive" ? "Arquivando..." : "Desarquivando...";

    return (
      <div
        style={styles.modalOverlay}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div style={styles.modal}>
          <div
            style={{
              ...styles.modalHeader,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <div style={{ fontWeight: 950, fontSize: 16 }}>{titulo}</div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              disabled={saving}
              style={{
                ...styles.closeBtn,
                position: "absolute",
                right: 16,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              ×
            </button>
          </div>

          {errorMessage ? (
            <div
              style={{
                margin: "12px 16px 0 16px",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,0,0,0.25)",
                background: "rgba(255,0,0,0.08)",
                color: "#b91c1c",
                fontWeight: 900,
                lineHeight: 1.3,
              }}
              role="alert"
            >
              {errorMessage}

              {canShowConflictActions ? (
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    justifyContent: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      onOpenConflict(
                        conflictInfo.conflictUserId,
                        conflictInfo.conflictUserName
                      )
                    }
                    style={styles.primaryBtn}
                  >
                    Abrir ocupante
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={onClose}
                    style={styles.secondaryBtn}
                  >
                    Fechar
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={{ ...styles.modalBody, display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ textAlign: "center" }}>
                Informe o motivo do {mode === "archive" ? "arquivamento" : "desarquivamento"} de{" "}
                <strong>{member?.name}</strong>.
              </div>

              <textarea
                style={{ ...styles.textarea, width: "100%", minHeight: 220, resize: "vertical" }}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder={placeholder}
                disabled={saving}
              />
            </div>
          </div>

          <div
            style={{
              ...styles.modalFooter,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <button type="button" onClick={onClose} style={styles.secondaryBtn} disabled={saving}>
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => onSave({ motivo: motivo.trim() })}
              style={styles.primaryBtn}
              disabled={saving || !motivo.trim()}
            >
              {saving ? savingLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // View/Edit/Create (com histórico no view)
  return (
    <div
      style={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div style={{ fontWeight: 950, fontSize: 16, color: "#0f172a" }}>
            {mode === "create"
              ? "Novo membro"
              : mode === "edit"
              ? "Editar membro"
              : "Detalhes do membro"}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.closeBtn}
            aria-label="Fechar"
            disabled={saving}
          >
            ×
          </button>
        </div>

        {errorMessage ? (
          <div
            style={{
              margin: "12px 16px 0 16px",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,0,0,0.25)",
              background: "rgba(255,0,0,0.08)",
              color: "#b91c1c",
              fontWeight: 900,
              lineHeight: 1.3,
            }}
            role="alert"
          >
            {errorMessage}

            {canShowConflictActions ? (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  justifyContent: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    onOpenConflict(
                      conflictInfo.conflictUserId,
                      conflictInfo.conflictUserName
                    )
                  }
                  style={styles.primaryBtn}
                >
                  Abrir ocupante
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={onClose}
                  style={styles.secondaryBtn}
                >
                  Fechar
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={styles.modalBody}>
          {mode === "view" && (isArchived || arquivadoMotivo) && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "rgba(15, 23, 42, 0.03)",
              }}
            >
              <div style={{ fontWeight: 950, marginBottom: 6, color: "#0f172a" }}>
                Histórico de arquivamento
              </div>

              <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.35 }}>
                <div>
                  <strong>Status:</strong> {isArchived ? "Arquivado" : "Ativo"}
                </div>

                {dataArquivamentoFmt ? (
                  <div>
                    <strong>Data:</strong> {dataArquivamentoFmt}
                  </div>
                ) : null}

                {arquivadoMotivo ? (
                  <div style={{ marginTop: 6 }}>
                    <strong>Motivo:</strong> {arquivadoMotivo}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
            Identificação
          </div>

          <div style={styles.grid3}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Nome</label>
              <input
                style={isReadOnly ? styles.inputDisabled : styles.input}
                disabled={isReadOnly || saving}
                value={draft?.name || ""}
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>CPF</label>
              <input
                style={
                  isReadOnly || !canEditSensitive
                    ? styles.inputDisabled
                    : styles.input
                }
                disabled={isReadOnly || !canEditSensitive || saving}
                value={maskCPF((draft?.cpf || "").toString())}
                onChange={(e) =>
                  set({ cpf: e.target.value.replace(/\D/g, "") })
                }
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>E-mail</label>
              <input
                style={isReadOnly ? styles.inputDisabled : styles.input}
                disabled={isReadOnly || saving}
                value={draft?.email || ""}
                onChange={(e) => set({ email: e.target.value })}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Perfil</label>
              <select
                style={
                  isReadOnly || !canEditSensitive
                    ? styles.inputDisabled
                    : styles.select
                }
                disabled={isReadOnly || !canEditSensitive || saving}
                value={perfilDraft || ""}
                onChange={(e) => set({ perfil_acesso: e.target.value })}
              >
                <option value="">Selecione…</option>
                {PERFIS_CADASTRO_BASE.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value={PERFIS.ADMIN}>ADMIN</option>
              </select>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Cargo</label>
              <select
                style={
                  isReadOnly || !canEditSensitive
                    ? styles.inputDisabled
                    : styles.select
                }
                disabled={isReadOnly || !canEditSensitive || saving}
                value={(draft?.cargo || "").toString()}
                onChange={(e) => set({ cargo: e.target.value })}
              >
                <option value="">Selecione…</option>
                {cargoOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>UF do Mandato</label>
              <select
                style={
                  isReadOnly || !canEditSensitive
                    ? styles.inputDisabled
                    : styles.select
                }
                disabled={isReadOnly || !canEditSensitive || saving}
                value={safeUpper(draft?.uf) || ""}
                onChange={(e) => set({ uf: e.target.value })}
              >
                <option value="">Selecione…</option>
                {UFS_DETALHADAS.map((u) => (
                  <option key={u.sigla} value={u.sigla}>
                    {u.sigla} — {u.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ✅ VÍNCULO ADICIONAL (somente ADMIN/COLAB/DIRETORIA com permissão de gestão) */}
          {!isReadOnly && canEditSensitive && (
            <div
              style={{
                marginTop: 14,
                padding: "12px 12px",
                borderRadius: 14,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "rgba(15, 23, 42, 0.02)",
              }}
            >
              <div style={{ fontWeight: 950, color: "#0f172a", marginBottom: 6 }}>
                Vínculo adicional (opcional)
              </div>

              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.35, marginBottom: 10 }}>
                Permite acumular exatamente 2 vínculos no mesmo CPF, <strong>somente</strong> se for{" "}
                <strong>1 de Diretoria</strong> e <strong>1 de Conselho</strong>. ADMIN/COLABORADOR não acumulam.
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, color: "#0f172a" }}>
                  <input
                    type="checkbox"
                    checked={addSegundoVinculo}
                    disabled={!perfil2 || perfilDraft === PERFIS.ADMIN || perfilDraft === PERFIS.COLABORADOR || saving}
                    onChange={(e) => setAddSegundoVinculo(e.target.checked)}
                  />
                  Adicionar 2º vínculo ({perfil2 || "—"})
                </label>

                {!perfil2 && (
                  <span style={{ fontSize: 12, color: "#b91c1c", fontWeight: 900 }}>
                    Selecione primeiro um perfil de cadeira (DIRETORIA ou CONSELHEIRO).
                  </span>
                )}
              </div>

              {addSegundoVinculo && perfil2 ? (
                <div style={{ marginTop: 12 }}>
                  <div style={styles.grid3}>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Perfil (2º vínculo)</label>
                      <input style={styles.inputDisabled} disabled value={perfil2} />
                    </div>

                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Cargo (2º vínculo)</label>
                      <select
                        style={styles.select}
                        disabled={saving}
                        value={(vinculo2?.cargo || "").toString()}
                        onChange={(e) => setVinculo2((prev) => ({ ...prev, cargo: e.target.value }))}
                      >
                        <option value="">Selecione…</option>
                        {secondCargoOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.inputGroup}>
                      <label style={styles.label}>UF do Mandato (2º vínculo)</label>
                      <select
                        style={perfil2 === PERFIS.CONSELHEIRO ? styles.select : styles.inputDisabled}
                        disabled={saving || perfil2 !== PERFIS.CONSELHEIRO}
                        value={safeUpper(vinculo2?.uf) || ""}
                        onChange={(e) => setVinculo2((prev) => ({ ...prev, uf: e.target.value }))}
                      >
                        <option value="">Selecione…</option>
                        {UFS_DETALHADAS.map((u) => (
                          <option key={u.sigla} value={u.sigla}>
                            {u.sigla} — {u.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                    O 2º vínculo será criado como um novo registro (sem duplicar senha). Se a cadeira já estiver ocupada,
                    o sistema vai bloquear e informar o ocupante.
                  </div>
                </div>
              ) : null}
            </div>
          )}

<div style={{ fontWeight: 900, color: "#0f172a", marginTop: 18, marginBottom: 10 }}>
            Contato
          </div>

          <div style={styles.grid3}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Telefone</label>
              <input
                style={isReadOnly ? styles.inputDisabled : styles.input}
                disabled={isReadOnly || saving}
                value={maskPhone((draft?.telefone1 || "").toString())}
                onChange={(e) =>
                  set({ telefone1: e.target.value.replace(/\D/g, "") })
                }
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Telefone 2</label>
              <input
                style={isReadOnly ? styles.inputDisabled : styles.input}
                disabled={isReadOnly || saving}
                value={maskPhone((draft?.telefone2 || "").toString())}
                onChange={(e) =>
                  set({ telefone2: e.target.value.replace(/\D/g, "") })
                }
              />
            </div>
          </div>

          <div style={{ fontWeight: 900, color: "#0f172a", marginTop: 18, marginBottom: 10 }}>
            Endereço
          </div>

          <div style={styles.grid3}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>CEP</label>
              <input
                style={isReadOnly ? styles.inputDisabled : styles.input}
                disabled={isReadOnly || saving}
                value={maskCEP((draft?.cep || "").toString())}
                onChange={(e) => handleCepChange(e.target.value)}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>UF do Endereço (ViaCEP)</label>
              <input
                style={styles.inputDisabled}
                disabled
                value={safeUpper(draft?.uf_endereco) || ""}
                placeholder="—"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Logradouro</label>
              <input
                style={styles.inputDisabled}
                disabled
                value={draft?.logradouro || ""}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Número</label>
              <input
                style={isReadOnly ? styles.inputDisabled : styles.input}
                disabled={isReadOnly || saving}
                value={draft?.numero || ""}
                onChange={(e) => set({ numero: e.target.value })}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Complemento</label>
              <input
                style={isReadOnly ? styles.inputDisabled : styles.input}
                disabled={isReadOnly || saving}
                value={draft?.complemento || ""}
                onChange={(e) => set({ complemento: e.target.value })}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Bairro</label>
              <input
                style={styles.inputDisabled}
                disabled
                value={draft?.bairro || ""}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Cidade</label>
              <input
                style={styles.inputDisabled}
                disabled
                value={draft?.cidade || ""}
              />
            </div>
          </div>
        </div>

        
          {mode === "view" && (
            (Array.isArray(draft?.vinculos) && draft.vinculos.length > 1) ||
            draft?.perfil_acesso2 || draft?.cargo2 || draft?.uf2
          ) ? (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)" }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>
                {Array.isArray(draft?.vinculos) && draft.vinculos.length > 1 ? "Vínculos" : "2º vínculo"}
              </div>

              {Array.isArray(draft?.vinculos) && draft.vinculos.length > 1 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {draft.vinculos.map((v, idx) => (
                    <div
                      key={`${String(v?.perfil_acesso || "")}-${String(v?.cargo || "")}-${String(v?.uf || "")}-${idx}`}
                      style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(15,23,42,0.10)" }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                        {String(v?.perfil_acesso || "").toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 950 }}>
                        {v?.cargo} {v?.uf ? `— ${String(v.uf).toUpperCase()}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  <div>
                    <span style={{ fontWeight: 800 }}>Perfil:</span>{" "}
                    {String(draft?.perfil_acesso2 || "").toUpperCase() || "—"}
                  </div>
                  <div>
                    <span style={{ fontWeight: 800 }}>Cargo:</span> {draft?.cargo2 || "—"}
                  </div>
                  <div>
                    <span style={{ fontWeight: 800 }}>UF:</span> {draft?.uf2 || "—"}
                  </div>
                </div>
              )}
            </div>
          ) : null}

<div style={{ ...styles.modalFooter, justifyContent: "center" }}>
          <button
            type="button"
            onClick={onClose}
            style={styles.secondaryBtn}
            disabled={saving}
          >
            Fechar
          </button>

          {mode !== "view" && (
            <button
              type="button"
              onClick={() => onSave({ ...draft, __secondVinculo: addSegundoVinculo ? { ...vinculo2, perfil_acesso: perfil2 } : null })}
              style={styles.primaryBtn}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
