import React, { useState } from "react";
import { styles } from "./styles";
import { FILTROS_MEMBROS, getBandeiraUF, tituloCargoUf } from "./constants";
import MemberModal from "./MemberModal";
import brasilFlag from "../../assets/branding/brasil.png";
import { normalizeName } from "../../utils/text";
import { onlyDigits } from "../../utils/masks";

function safeUpper(v) {
  return (v ?? "").toString().toUpperCase();
}

function extractApiError(err) {
  const msg =
    err?.response?.data?.error ||
    err?.message ||
    "Falha inesperada ao executar a ação.";
  return { msg };
}

/** Formata data de forma resiliente.
 * - tenta Date parse
 * - se falhar, tenta string ISO truncada
 * - se falhar, retorna raw
 */
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

  // Tentativa simples: "YYYY-MM-DD"
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  return raw;
}

function tooltipArquivamento(m) {
  const rawEm = m?.arquivado_em ?? m?.arquivadoEm ?? null;
  const dataFmt = formatarDataBRRobusta(rawEm);
  const motivo = String(m?.arquivado_motivo || "").trim();

  // Sempre retornar algo não vazio
  if (dataFmt && motivo) return `Arquivado em ${dataFmt} — Motivo: ${motivo}`;
  if (dataFmt) return `Arquivado em ${dataFmt}`;
  if (motivo) return `Arquivado — Motivo: ${motivo}`;
  return "Membro arquivado";
}

export default function MembersPage({
  busca,
  setBusca,
  filtroMembros,
  setFiltroMembros,
  ufFiltro,
  setUfFiltro,
  ufsDisponiveis,
  membrosFiltrados,
  allMembros = null,
  currentUserPerfil,
  canManageMembers,
  // ✅ exibição
  filtroExibicao,
  setFiltroExibicao,
  onCreateMember,
  onUpdateMember,
  onArchiveMember,
  onUnarchiveMember, // (member, motivo)
}) {
  const [modal, setModal] = useState({
    open: false,
    mode: "view",
    member: null,
  });

  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [cargoConflict, setCargoConflict] = useState(null);
  // cargoConflict: { conflictUserId?: string, conflictUserName?: string }

  const canArchive = ["ADMIN", "COLABORADOR"].includes(
    safeUpper(currentUserPerfil)
  );

  const getFlagForMember = (m) => {
    const p = safeUpper(m?.perfil_acesso);
    if (["ADMIN", "COLABORADOR", "DIRETORIA"].includes(p)) return brasilFlag;
    if (p === "CONSELHEIRO" && m?.uf) return getBandeiraUF(m.uf);
    return null;
  };

  // alinhado ao backend: arquivado_em define arquivado
  const isArchived = (m) => !!(m?.arquivado_em ?? m?.arquivadoEm);

  // ✅ Enriquecimento local: identifica 2º vínculo (mesmo CPF, outro registro ativo)
  // Não altera a lista, apenas o objeto passado para o modal (view/edit).
  const enrichWithSecondVinculo = (m) => {
    try {
      if (!m) return m;
      // Se o backend já trouxe o 2º vínculo (perfil_acesso2/cargo2/uf2), não tenta derivar por CPF.
      if (m?.perfil_acesso2 || m?.cargo2 || m?.uf2) return m;
      if (!Array.isArray(allMembros)) return m;

      const cpf = onlyDigits(m?.cpf);
      if (!cpf || cpf.length !== 11) return m;

      const other = allMembros.find((x) => {
        if (!x) return false;
        if (String(x.id) === String(m.id)) return false;
        if (isArchived(x)) return false;
        return onlyDigits(x.cpf) === cpf;
      });

      if (!other) return m;

      return {
        ...m,
        perfil_acesso2: other?.perfil_acesso || "",
        cargo2: other?.cargo || "",
        uf2: other?.uf || "",
        second_user_id: other?.id || null,
      };
    } catch {
      return m;
    }
  };

  const closeModal = () => {
    setSaving(false);
    setModalError("");
    setCargoConflict(null);
    setModal({ open: false, mode: "view", member: null });
  };

  const openConflictOccupant = (conflictUserId, conflictUserName) => {
    // Fecha o modal atual (edição/criação/desarquivar) para abrir o ocupante
    closeModal();

    // Garante que o ocupante (ativo) fique visível na lista
    try {
      setFiltroExibicao?.("ATIVOS");
    } catch {
      /* ignore */
    }
    try {
      setFiltroMembros?.("PADRAO");
      setUfFiltro?.("");
    } catch {
      /* ignore */
    }

    if (conflictUserName) {
      setBusca(conflictUserName);
    }

    const poolList = Array.isArray(allMembros) ? allMembros : membrosFiltrados;
    const occupant = (poolList || []).find(
      (m) => String(m.id) === String(conflictUserId)
    );

    // Abre o modal "Ver" do ocupante (se já estiver carregado)
    if (occupant) {
      setTimeout(() => {
        setModal({ open: true, mode: "view", member: enrichWithSecondVinculo(occupant) });
      }, 0);
    }

    // Scroll/âncora no card
    setTimeout(() => {
      const el = document.getElementById(`member-card-${conflictUserId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  };

  const handleSave = async (payload) => {
    try {
      setSaving(true);
      setModalError("");

      if (modal.mode === "create") {
        await onCreateMember(payload);
        closeModal();
        return;
      }

      if (modal.mode === "edit") {
        await onUpdateMember(modal.member, payload);
        closeModal();
        return;
      }

      if (modal.mode === "archive") {
        const motivo = String(payload?.motivo || "").trim();
        if (!motivo) {
          setSaving(false);
          setModalError("Informe o motivo do arquivamento.");
          return;
        }
        if (!modal?.member?.id) {
          setSaving(false);
          setModalError("ID do membro não encontrado. Recarregue a página.");
          return;
        }
        await onArchiveMember(modal.member, motivo);
        closeModal();
        return;
      }

      if (modal.mode === "unarchive") {
        const motivo = String(payload?.motivo || "").trim();
        if (!motivo) {
          setSaving(false);
          setModalError("Informe o motivo do desarquivamento.");
          return;
        }
        if (!modal?.member?.id) {
          setSaving(false);
          setModalError("ID do membro não encontrado. Recarregue a página.");
          return;
        }
        await onUnarchiveMember(modal.member, motivo);
        closeModal();
        return;
      }

      setSaving(false);
    } catch (err) {
      const data = err?.response?.data;

      if (data?.code === "CARGO_JA_OCUPADO") {
        setSaving(false);
        // Mostra o alerta diretamente no modal
        setModalError(data?.error || "Cargo já ocupado.");
        setCargoConflict({
          conflictUserId: data?.details?.conflictUserId,
          conflictUserName: data?.details?.conflictUserName,
        });
        return;
      }

      const { msg } = extractApiError(err);
      console.error("MembersPage action error:", err);
      setSaving(false);
      setModalError(msg);
    }
  };

  // ✅ Evita duplicidade de opções no select (caso constants tenha repetição acidental)
  const filtrosMembrosUnicos = Array.isArray(FILTROS_MEMBROS)
    ? FILTROS_MEMBROS.filter((f, idx, arr) => {
        const v = String(f?.value ?? "").trim();
        const lbl = String(f?.label ?? "").trim().toLowerCase();
        return (
          arr.findIndex((x) => String(x?.value ?? "").trim() === v) === idx &&
          arr.findIndex((x) => String(x?.label ?? "").trim().toLowerCase() === lbl) === idx
        );
      })
    : [];

  // ✅ Regra: por padrão, esconder ADMIN/COLABORADOR para não poluir a listagem.
  // Eles só aparecem quando o usuário escolhe explicitamente o filtro "ADMIN_COLAB".
  const membrosVisiveis = (() => {
    const list = Array.isArray(membrosFiltrados) ? membrosFiltrados : [];
    const isPriv = (m) => ["ADMIN", "COLABORADOR"].includes(safeUpper(m?.perfil_acesso));

    if (filtroMembros === "ADMIN_COLAB") return list.filter(isPriv);
    return list.filter((m) => !isPriv(m));
  })();



  return (
    <div style={styles.card}>
      <div style={styles.cardTitleRow}>
        <div>
          <div style={styles.h2}>Membros</div>
          <div style={styles.muted}>Diretoria e conselheiros</div>
        </div>

        {canManageMembers && (
          <button
            style={styles.primaryBtn}
            onClick={() => {
              setModalError("");
              setCargoConflict(null);
              setModal({ open: true, mode: "create", member: {} });
            }}
          >
            ➕ Novo membro
          </button>
        )}
      </div>

      <div style={styles.toolbar}>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail, CPF, UF, cargo…"
          style={styles.search}
        />

        <select
          value={filtroExibicao}
          onChange={(e) => setFiltroExibicao(e.target.value)}
          style={styles.select}
          title="Exibir"
        >
          <option value="ATIVOS">Ativos</option>
          <option value="ARQUIVADOS">Arquivados</option>
          <option value="TODOS">Todos</option>
        </select>

        <select
          value={filtroMembros}
          onChange={(e) => setFiltroMembros(e.target.value)}
          style={styles.select}
        >
          {filtrosMembrosUnicos.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
          {!filtrosMembrosUnicos.some((f) => String(f?.value) === "ADMIN_COLAB") ? (
            <option value="ADMIN_COLAB">Admin / Colaborador</option>
          ) : null}
</select>

        {filtroMembros === "UF" && (
          <select
            value={ufFiltro}
            onChange={(e) => setUfFiltro(e.target.value)}
            style={styles.select}
          >
            <option value="">Selecione a UF…</option>
            {ufsDisponiveis.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={styles.gridCards}>
          {membrosVisiveis.map((m) => {
            const flag = getFlagForMember(m);
            const archived = isArchived(m);

            return (
              <div
                key={m.id}
                id={`member-card-${m.id}`}
                style={styles.memberCard}
              >
                {flag && <img src={flag} alt="" style={styles.flagCorner} />}

                {archived && (
                  <div
                    title={tooltipArquivamento(m)}
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      zIndex: 6,
                      pointerEvents: "auto",
                      cursor: "help",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 900,
                      background: "rgba(255, 247, 237, 0.96)",
                      color: "#9a3412",
                      border: "1px solid rgba(251, 146, 60, 0.35)",
                      boxShadow: "0 8px 24px rgba(15,23,42,0.10)",
                      lineHeight: 1,
                      userSelect: "none",
                    }}
                  >
                    ARQUIVADO <span aria-hidden="true">ⓘ</span>
                  </div>
                )}

                <div style={styles.memberTop}>
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt={normalizeName(m.name)}
                      style={styles.avatar}
                    />
                  ) : (
                    <div style={styles.avatarFallbackSm}>👤</div>
                  )}

                  <div style={styles.memberInfo}>
                    <div style={styles.memberName}>{normalizeName(m.name)}</div>
                    <div style={styles.memberMeta}>{tituloCargoUf(m)}</div>
                    <div style={styles.memberEmail}>{m.email}</div>
                    <div style={styles.memberMeta}>
                      Sexo: {m.sexo || "N/A"}
                    </div>
                    {(m.inicio_mandato || m.fim_mandato) && (
                      <div style={styles.memberMeta}>
                        Mandato: {formatarDataBRRobusta(m.inicio_mandato)} — {formatarDataBRRobusta(m.fim_mandato)}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    ...styles.miniBtnRow,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    style={styles.miniBtn}
                    onClick={() => {
                      setModalError("");
                      setCargoConflict(null);
                      setModal({ open: true, mode: "view", member: enrichWithSecondVinculo(m) });
                    }}
                  >
                    Ver
                  </button>

                  <button
                    style={styles.miniBtnPrimary}
                    disabled={!canManageMembers}
                    onClick={() => {
                      setModalError("");
                      setCargoConflict(null);
                      setModal({ open: true, mode: "edit", member: enrichWithSecondVinculo(m) });
                    }}
                  >
                    Editar
                  </button>

                  {canArchive && !archived && (
                    <button
                      style={styles.miniBtn}
                      onClick={() => {
                        setModalError("");
                        setCargoConflict(null);
                        setModal({ open: true, mode: "archive", member: m });
                      }}
                    >
                      Arquivar
                    </button>
                  )}

                  {canArchive && archived && (
                    <button
                      style={styles.miniBtn}
                      disabled={saving}
                      onClick={() => {
                        setModalError("");
                        setCargoConflict(null);
                        setModal({ open: true, mode: "unarchive", member: m });
                      }}
                    >
                      Desarquivar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <MemberModal
        open={modal.open}
        mode={modal.mode}
        member={modal.member}
        currentUserPerfil={currentUserPerfil}
        onClose={closeModal}
        onSave={handleSave}
        saving={saving}
        errorMessage={modalError}
        conflictInfo={cargoConflict}
        onOpenConflict={openConflictOccupant}
      />
    </div>
  );
}
