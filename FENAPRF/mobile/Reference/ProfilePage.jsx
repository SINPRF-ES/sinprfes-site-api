import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

import { styles } from "./styles";
import {
  API_BASE,
  PERFIS,
  PERFIS_CADASTRO_BASE,
  CARGOS_CONSELHO,
  CARGOS_DIRETORIA,
  UFS_DETALHADAS,
  getBandeiraUF,
  tituloCargoUf,
  onlyDigits,
  normalizeCargo,
} from "./constants";

import { maskCPF, maskPhone, maskCEP } from "../../utils/masks";

/* =========================
   Utils locais
========================= */

function safeUpper(v) {
  return (v ?? "").toString().toUpperCase();
}

function initials(name) {
  const s = (name || "").toString().trim();
  if (!s) return "👤";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0] || "").slice(0, 1).toUpperCase();
  const b = (parts[parts.length - 1] || "").slice(0, 1).toUpperCase();
  return (a + b).trim() || "👤";
}

function authHeaders() {
  const token = localStorage.getItem("fenaprf_token");
  return { Authorization: `Bearer ${token}` };
}

function normalizeIsoDate(input) {
  if (!input) return "";
  const s = String(input);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function formatDateBR(iso) {
  const n = normalizeIsoDate(iso);
  if (!n) return "";
  const [y, m, d] = n.split("-");
  return `${d}/${m}/${y}`;
}

function parseDateBR(v) {
  const d = (v || "").replace(/[^\d]/g, "");
  if (d.length !== 8) return "";
  return `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}

function maskDateBR(v) {
  const d = (v || "").replace(/[^\d]/g, "").slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length > 2) out += "/" + d.slice(2, 4);
  if (d.length > 4) out += "/" + d.slice(4);
  return out;
}

/* =========================
   ViaCEP
========================= */

async function fetchViaCEP(cepDigits) {
  const cep = (cepDigits || "").toString().replace(/\D/g, "");
  if (cep.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  const data = await res.json();
  if (data?.erro) return null;
  return data;
}

/* =========================
   ProfilePage
========================= */

export default function ProfilePage({
  user,
  onChange,
  onSubmit,
  onCancel,
  mode = "self",
  permissions = {},
}) {
  const [status, setStatus] = useState({ tipo: "", msg: "" });
  const [avatarPreview, setAvatarPreview] = useState("");
  const [dobInput, setDobInput] = useState("");

  const fileInputRef = useRef(null);
  const cepTimerRef = useRef(null);

  useEffect(() => {
    setDobInput(formatDateBR(user?.data_nascimento));
    setAvatarPreview("");
    setStatus({ tipo: "", msg: "" });
  }, [user?.id, user?.data_nascimento]);

  const perfilUpper = safeUpper(user?.perfil_acesso);

  const cargoOptions = useMemo(() => {
    if (perfilUpper === PERFIS.CONSELHEIRO) return CARGOS_CONSELHO;
    if (perfilUpper === PERFIS.DIRETORIA) return CARGOS_DIRETORIA;
    if (perfilUpper === PERFIS.ADMIN) return [...CARGOS_DIRETORIA, ...CARGOS_CONSELHO];
    return [];
  }, [perfilUpper]);

  const titulo = tituloCargoUf(user || {});
  const flagUrl =
    perfilUpper === PERFIS.DIRETORIA || perfilUpper === PERFIS.COLABORADOR
      ? null
      : getBandeiraUF(user?.uf);

  const vinculos = useMemo(() => (Array.isArray(user?.vinculos) ? user.vinculos : []), [user]);

  const readOnly = permissions.readOnly === true || mode === "view";

  // Sensíveis (mandato/UF institucional)
  const canEditCpf = permissions.isAdmin === true;
  const canEditPerfil = permissions.isAdmin === true;
  const canEditCargo = permissions.canManage === true;
  const canEditUfMandato = permissions.canManage === true;

  // Regra que você definiu:
  // Conselheiro pode editar contato + (CEP, número, complemento). Endereço restante vem do ViaCEP (read-only).
  const canEditContacts = !readOnly; // conselheiro pode
  const canEditEnderecoBasico = !readOnly; // conselheiro pode (mas limitamos campos abaixo)

  const canEditLogradouroBairroCidadeUfEndereco = permissions.canManage === true && !readOnly;

  /* =========================
     Avatar
  ========================= */

  const handleAvatarPick = () => {
    if (!readOnly) fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarPreview(URL.createObjectURL(file));

    try {
      const form = new FormData();
      form.append("avatar", file);

      const res = await axios.post(`${API_BASE}/auth/avatar`, form, {
        headers: authHeaders(),
      });

      if (res.data?.avatar_url) {
        onChange({ avatar_url: res.data.avatar_url });
        setStatus({ tipo: "sucesso", msg: "Avatar atualizado." });
      }
    } catch {
      setStatus({ tipo: "erro", msg: "Erro ao enviar avatar." });
    } finally {
      setTimeout(() => setStatus({ tipo: "", msg: "" }), 2500);
      e.target.value = "";
    }
  };

  /* =========================
     CEP -> ViaCEP (com debounce)
  ========================= */

  const handleCepChange = (raw) => {
    const digits = onlyDigits(raw).slice(0, 8);
    onChange({ cep: digits });

    if (cepTimerRef.current) clearTimeout(cepTimerRef.current);

    if (digits.length === 8) {
      cepTimerRef.current = setTimeout(async () => {
        const data = await fetchViaCEP(digits);
        if (!data) return;

        // Preenche endereço a partir do ViaCEP
        // Nota: uf_endereco é um NOVO campo pro seu backend/sua tabela users
        onChange({
          logradouro: data.logradouro || "",
          bairro: data.bairro || "",
          cidade: data.localidade || "",
          uf_endereco: safeUpper(data.uf || ""),
        });
      }, 350);
    }
  };

  const handleSubmitLocal = (e) => {
    e.preventDefault();
    if (readOnly) return;

    const d = dobInput.replace(/[^\d]/g, "");
    if (d.length === 8) {
      onChange({ data_nascimento: parseDateBR(dobInput) });
    }

    onSubmit(e);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {status.msg && (
        <div
          style={{
            ...styles.alert,
            backgroundColor: status.tipo === "erro" ? "#fff1f0" : "#f6ffed",
          }}
        >
          {status.msg}
        </div>
      )}

      {/* HEADER */}
      <div style={styles.card}>
        <div style={styles.profileHeaderRow}>
          <div style={styles.profileHeader}>
            <div style={styles.avatarWrap}>
              {user?.avatar_url ? (
                <img src={avatarPreview || user.avatar_url} alt="Avatar" style={styles.avatarLg} />
              ) : (
                <div style={styles.avatarFallback}>{initials(user?.name)}</div>
              )}

              <button
                type="button"
                style={styles.avatarEditBtn}
                onClick={handleAvatarPick}
                disabled={readOnly}
              >
                ✎
              </button>

              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
            </div>

            <div style={styles.profileText}>
              <div style={styles.name}>{user?.name}</div>
              <div style={styles.subtitle}>
                <span>{titulo}</span>
                <span style={styles.rolePill}>{perfilUpper}</span>
              </div>
              {vinculos.length > 1 && (
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {vinculos.map((v, idx) => (
                    <span
                      key={`${String(v?.perfil_acesso || "")}-${String(v?.cargo || "")}-${String(v?.uf || "")}-${idx}`}
                      style={{
                        ...styles.rolePill,
                        backgroundColor: "rgba(15,23,42,0.04)",
                        borderColor: "rgba(15,23,42,0.16)",
                        fontWeight: 900,
                      }}
                      title="Vínculo"
                    >
                      {String(v?.perfil_acesso || "—").toUpperCase()}
                      {" • "}
                      {v?.cargo || "—"}
                      {v?.uf ? ` • ${String(v.uf).toUpperCase()}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {flagUrl && <img src={flagUrl} alt="" style={styles.ufFlagBig} />}
        </div>
      </div>

      {/* FORM */}
      <form onSubmit={handleSubmitLocal} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* IDENTIFICAÇÃO */}
        <div style={styles.card}>
          <div style={styles.cardTitleRow}>
            <div>
              <div style={styles.h2}>Meus dados</div>
              <div style={styles.muted}>Identificação e contatos</div>
            </div>
            {onCancel && (
              <button type="button" onClick={onCancel} style={styles.secondaryBtn}>
                Voltar
              </button>
            )}
          </div>

          <div style={styles.grid3}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Nome</label>
              <input
                style={readOnly ? styles.inputDisabled : styles.input}
                value={user?.name || ""}
                disabled={readOnly}
                onChange={(e) => onChange({ name: e.target.value })}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>CPF</label>
              <input
                style={readOnly || !canEditCpf ? styles.inputDisabled : styles.input}
                value={maskCPF(onlyDigits(user?.cpf))}
                disabled={readOnly || !canEditCpf}
                onChange={(e) => onChange({ cpf: onlyDigits(e.target.value) })}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>E-mail</label>
              <input
                style={!canEditContacts ? styles.inputDisabled : styles.input}
                value={user?.email || ""}
                disabled={!canEditContacts}
                onChange={(e) => onChange({ email: e.target.value })}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Telefone</label>
              <input
                style={!canEditContacts ? styles.inputDisabled : styles.input}
                value={maskPhone(((user?.telefone1 ?? user?.telefone) || "").toString())}
                disabled={!canEditContacts}
                onChange={(e) => onChange({ telefone1: e.target.value.replace(/\D/g, "") })}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Telefone 2</label>
              <input
                style={!canEditContacts ? styles.inputDisabled : styles.input}
                value={maskPhone((user?.telefone2 || "").toString())}
                disabled={!canEditContacts}
                onChange={(e) => onChange({ telefone2: e.target.value.replace(/\D/g, "") })}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Data de nascimento</label>
              <input
                style={readOnly ? styles.inputDisabled : styles.input}
                value={maskDateBR(dobInput)}
                disabled={readOnly}
                onChange={(e) => setDobInput(e.target.value)}
                placeholder="DD/MM/AAAA"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Perfil</label>
              <select
                style={readOnly || !canEditPerfil ? styles.inputDisabled : styles.select}
                disabled={readOnly || !canEditPerfil}
                value={perfilUpper}
                onChange={(e) => onChange({ perfil_acesso: e.target.value })}
              >
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
                style={readOnly || !canEditCargo ? styles.inputDisabled : styles.select}
                disabled={readOnly || !canEditCargo}
                value={normalizeCargo(user?.cargo) || ""}
                onChange={(e) => onChange({ cargo: e.target.value })}
              >
                <option value="">Selecione…</option>
                {cargoOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* UF do Mandato (gestor define) */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>UF do Mandato</label>
              <select
                style={readOnly || !canEditUfMandato ? styles.inputDisabled : styles.select}
                disabled={readOnly || !canEditUfMandato}
                value={safeUpper(user?.uf) || ""}
                onChange={(e) => onChange({ uf: e.target.value })}
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
        </div>

        {/* ENDEREÇO */}
        <div style={styles.card}>
          <div style={styles.cardTitleRow}>
            <div>
              <div style={styles.h2}>Endereço</div>
              <div style={styles.muted}>
                UF do endereço é derivada do CEP (pode divergir da UF do mandato)
              </div>
            </div>
          </div>

          <div style={styles.grid3}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>CEP</label>
              <input
                style={!canEditEnderecoBasico ? styles.inputDisabled : styles.input}
                value={maskCEP((user?.cep || "").toString())}
                disabled={!canEditEnderecoBasico}
                onChange={(e) => handleCepChange(e.target.value)}
              />
            </div>

            {/* UF do endereço (ViaCEP) */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>UF do Endereço (ViaCEP)</label>
              <input
                style={styles.inputDisabled}
                value={safeUpper(user?.uf_endereco) || ""}
                disabled
                placeholder="—"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Logradouro</label>
              <input
                style={
                  canEditLogradouroBairroCidadeUfEndereco ? styles.input : styles.inputDisabled
                }
                value={user?.logradouro || ""}
                disabled={!canEditLogradouroBairroCidadeUfEndereco}
                onChange={(e) => onChange({ logradouro: e.target.value })}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Número</label>
              <input
                style={!canEditEnderecoBasico ? styles.inputDisabled : styles.input}
                value={user?.numero || ""}
                disabled={!canEditEnderecoBasico}
                onChange={(e) => onChange({ numero: e.target.value })}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Complemento</label>
              <input
                style={!canEditEnderecoBasico ? styles.inputDisabled : styles.input}
                value={user?.complemento || ""}
                disabled={!canEditEnderecoBasico}
                onChange={(e) => onChange({ complemento: e.target.value })}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Bairro</label>
              <input
                style={
                  canEditLogradouroBairroCidadeUfEndereco ? styles.input : styles.inputDisabled
                }
                value={user?.bairro || ""}
                disabled={!canEditLogradouroBairroCidadeUfEndereco}
                onChange={(e) => onChange({ bairro: e.target.value })}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Cidade</label>
              <input
                style={
                  canEditLogradouroBairroCidadeUfEndereco ? styles.input : styles.inputDisabled
                }
                value={user?.cidade || ""}
                disabled={!canEditLogradouroBairroCidadeUfEndereco}
                onChange={(e) => onChange({ cidade: e.target.value })}
              />
            </div>
          </div>
        </div>

        {!readOnly && (
          <div style={styles.actionsRow}>
            <button type="submit" style={styles.primaryBtn}>
              Salvar alterações
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
