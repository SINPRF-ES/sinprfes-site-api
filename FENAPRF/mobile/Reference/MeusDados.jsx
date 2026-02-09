// frontend/src/pages/Dashboard/MeusDados.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

import { styles } from "./styles";
import {
  API_BASE,
  PERFIS,
  PERFIS_CADASTRO_BASE,
  CARGOS_CONSELHO,
  CARGOS_DIRETORIA,
  getBandeiraUF,
  tituloCargoUf,
  onlyDigits,
  normalizeCargo,
} from "./constants";

import { maskCPF, maskPhone, maskCEP } from "../../utils/masks";

function initials(name) {
  const s = (name || "").toString().trim();
  if (!s) return "👤";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0] || "").slice(0, 1).toUpperCase();
  const b = (parts[parts.length - 1] || "").slice(0, 1).toUpperCase();
  return (a + b).trim() || "👤";
}

function maskPhoneSafe(v) {
  const digits = onlyDigits(v);
  if (!digits) return ""; // evita "(" quando vazio
  return maskPhone(digits);
}

function authHeaders() {
  const token = localStorage.getItem("fenaprf_token");
  return { Authorization: `Bearer ${token}` };
}

/**
 * Normaliza possíveis formatos vindos do backend:
 * - "YYYY-MM-DD"
 * - "YYYY-MM-DDTHH:mm:ss.sssZ"
 * - Date object (por segurança)
 * Retorna sempre "YYYY-MM-DD" ou "".
 */
function normalizeIsoDate(input) {
  if (!input) return "";
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }
  const s = String(input).trim();
  // pega YYYY-MM-DD do começo, mesmo que tenha "T..."
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

// YYYY-MM-DD (ou YYYY-MM-DDT...) -> DD/MM/AAAA
function formatDateBRSlash(isoLike) {
  const iso = normalizeIsoDate(isoLike);
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// DD/MM/AAAA (ou DDMMYYYY) -> YYYY-MM-DD (básico)
function parseDateBRSlash(br) {
  const digits = (br || "").toString().replace(/[^\d]/g, "");
  if (digits.length !== 8) return "";
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  return `${yyyy}-${mm}-${dd}`;
}

// máscara DD/MM/AAAA com trava de 8 dígitos (ano nunca passa de 4)
function maskDateBRSlash(value) {
  const d = (value || "").toString().replace(/[^\d]/g, "").slice(0, 8); // trava 8 dígitos
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 4);
  const p3 = d.slice(4, 8);
  let out = p1;
  if (p2) out += "/" + p2;
  if (p3) out += "/" + p3;
  return out;
}

function buildCargoOptions(perfil) {
  const p = (perfil || "").toString().toUpperCase();
  if (p === PERFIS.CONSELHEIRO) return CARGOS_CONSELHO;
  if (p === PERFIS.DIRETORIA) return CARGOS_DIRETORIA;
  // ADMIN também pode escolher cargos (para o próprio cadastro não ficar vazio)
  if (p === PERFIS.ADMIN) return [...CARGOS_DIRETORIA, ...CARGOS_CONSELHO];
  return [];
}

export default function MeusDados({ value, onChange, onSubmit, onCancel, mode, permissions }) {
  const [status, setStatus] = useState({ tipo: "", msg: "" });
  const [avatarPreview, setAvatarPreview] = useState("");
  const fileInputRef = useRef(null);

  // estado local para digitação
  const [dobInput, setDobInput] = useState("");

  // sincroniza quando trocar usuário / recarregar dados
  useEffect(() => {
    setDobInput(formatDateBRSlash(value?.data_nascimento));
  }, [value?.id, value?.data_nascimento]);

  const buscarCep = async () => {
    const cepLimpo = onlyDigits(value?.cep);
    if (cepLimpo.length !== 8) return;
    try {
      const res = await axios.get(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      if (res.data?.erro) return;
      onChange({
        logradouro: res.data.logradouro || "",
        bairro: res.data.bairro || "",
        cidade: res.data.localidade || "",
        uf: (res.data.uf || "").toUpperCase(),
      });
    } catch {
      setStatus({ tipo: "erro", msg: "Não foi possível buscar o CEP no momento." });
      setTimeout(() => setStatus({ tipo: "", msg: "" }), 2500);
    }
  };

  useEffect(() => {
    setStatus({ tipo: "", msg: "" });
    setAvatarPreview("");
  }, [value?.id]);

  const perfilUpper = (value?.perfil_acesso || "").toString().toUpperCase();
  const isColaborador = perfilUpper === PERFIS.COLABORADOR;

  const cargoOptions = useMemo(() => buildCargoOptions(perfilUpper), [perfilUpper]);

  const titulo = useMemo(() => tituloCargoUf(value || {}), [value]);
  const flagUrl = useMemo(() => getBandeiraUF(value?.uf), [value?.uf]);
  const vinculos = useMemo(() => (Array.isArray(value?.vinculos) ? value.vinculos : []), [value]);

  const readOnly = permissions?.readOnly === true || mode === "view";

  // Self profile: the user can edit their own personal data (except CPF/perfil/cargo)
  const canEditName = !readOnly && (mode === "self" || permissions?.canManage === true);
  const canEditCpf = !readOnly && (permissions?.canEditCpf ?? permissions?.isAdmin === true);
  const canEditPerfil = !readOnly && (permissions?.isAdmin === true);
  const canEditCargo = !readOnly && (permissions?.canEditCargo ?? permissions?.canManage === true);

  const perfisParaSelect = useMemo(() => {
    if (!canEditPerfil) return PERFIS_CADASTRO_BASE;
    return [PERFIS.ADMIN, ...PERFIS_CADASTRO_BASE];
  }, [canEditPerfil]);

  useEffect(() => {
    if (isColaborador && value?.cargo) onChange({ cargo: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isColaborador]);

  // Avatar upload
  const handleAvatarPick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    try {
      const form = new FormData();
      form.append("avatar", file);

      // ✅ ALTERAÇÃO MÍNIMA: não forçar Content-Type multipart/form-data
      // (o Axios define o boundary automaticamente)
      const res = await axios.post(`${API_BASE}/auth/avatar`, form, {
        headers: {
          ...authHeaders(),
        },
      });

      const newUrl = res.data?.avatar_url || "";
      if (newUrl) {
        onChange({ avatar_url: newUrl });
        setStatus({ tipo: "sucesso", msg: "Avatar atualizado!" });
      } else {
        setStatus({ tipo: "erro", msg: "Upload concluído, mas sem URL retornada." });
      }
    } catch (err) {
      console.error("Erro upload avatar:", err?.response?.data || err);
      setStatus({ tipo: "erro", msg: err?.response?.data?.error || "Erro ao enviar avatar." });
    } finally {
      setTimeout(() => setStatus({ tipo: "", msg: "" }), 2500);
      e.target.value = "";
    }
  };

  /**
   * ✅ garante que o value.data_nascimento esteja preenchido no momento do submit,
   * mesmo que o estado pai esteja “um passo atrás”.
   */
  const handleSubmitLocal = (e) => {
    e.preventDefault();

    if (readOnly) return;

    const digits = (dobInput || "").replace(/[^\d]/g, "");
    if (digits.length === 0) {
      onChange({ data_nascimento: "" });
    } else if (digits.length === 8) {
      onChange({ data_nascimento: parseDateBRSlash(dobInput) });
    }
    // chama o submit real
    onSubmit(e);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {status.msg && (
        <div
          style={{
            ...styles.alert,
            backgroundColor: status.tipo === "erro" ? "#fff1f0" : "#f6ffed",
            borderColor: status.tipo === "erro" ? "#ffa39e" : "#b7eb8f",
            color: status.tipo === "erro" ? "#a8071a" : "#135200",
          }}
        >
          {status.msg}
        </div>
      )}

      {/* CARD SUPERIOR */}
      <div style={styles.card}>
        <div style={styles.profileHeaderRow}>
          <div style={styles.profileHeader}>
            <div style={styles.avatarWrap}>
              {value?.avatar_url ? (
                <img src={avatarPreview || value.avatar_url} alt="Avatar" style={styles.avatarLg} />
              ) : (
                <div style={styles.avatarFallback} aria-label="Avatar">
                  {initials(value?.name)}
                </div>
              )}

              <button
                type="button"
                style={readOnly ? { ...styles.avatarEditBtn, opacity: 0.5, cursor: "not-allowed" } : styles.avatarEditBtn}
                onClick={() => !readOnly && handleAvatarPick()}
                disabled={readOnly}
                title={readOnly ? "Somente leitura" : "Alterar avatar"}
              >
                ✎
              </button>

              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
            </div>

            <div style={styles.profileText}>
              <div style={styles.name}>{value?.name || "—"}</div>
              <div style={styles.subtitle}>
                <span>{titulo}</span>
                <span style={styles.rolePill}>{(value?.perfil_acesso || "—").toString().toUpperCase()}</span>
                {value?.situacao && (
                  <span
                    style={{
                      ...styles.rolePill,
                      backgroundColor: "rgba(2,132,199,0.18)",
                      borderColor: "rgba(2,132,199,0.35)",
                    }}
                  >
                    {value.situacao}
                  </span>
                )}
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

          {flagUrl ? <img src={flagUrl} alt="" style={styles.ufFlagBig} /> : null}
        </div>
      </div>

      <form onSubmit={handleSubmitLocal} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* IDENTIFICAÇÃO */}
        <div style={styles.card}>
          <div style={styles.cardTitleRow}>
            <div>
              <div style={styles.h2}>Identificação</div>
              <div style={styles.muted}>Dados cadastrais e perfil</div>
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
                style={canEditName ? styles.input : styles.inputDisabled}
                value={value?.name || ""}
                onChange={(e) => onChange({ name: e.target.value })}
                disabled={!canEditName}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>CPF</label>
              <input
                style={canEditCpf ? styles.input : styles.inputDisabled}
                value={maskCPF(onlyDigits(value?.cpf))}
                onChange={(e) => onChange({ cpf: onlyDigits(e.target.value) })}
                disabled={!canEditCpf}
                maxLength={14}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>E-mail</label>
              <input style={styles.input} value={value?.email || ""} onChange={(e) => onChange({ email: e.target.value })} />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Perfil</label>
              <select
                style={canEditPerfil ? styles.select : styles.inputDisabled}
                disabled={!canEditPerfil}
                value={(value?.perfil_acesso || "").toString().toUpperCase()}
                onChange={(e) => onChange({ perfil_acesso: e.target.value })}
              >
                {perfisParaSelect.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Cargo</label>
              {isColaborador ? (
                <input style={styles.inputDisabled} value="—" disabled />
              ) : (
                <select
                  style={canEditCargo ? styles.select : styles.inputDisabled}
                  disabled={!canEditCargo}
                  value={normalizeCargo(value?.cargo) || ""}
                  onChange={(e) => onChange({ cargo: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {cargoOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>UF</label>
              <input style={styles.inputDisabled} value={(value?.uf || "").toString().toUpperCase()} disabled />
              <div style={styles.muted}>A UF é preenchida automaticamente pelo Busca CEP.</div>
            </div>
          </div>
        </div>

        {/* CONTATO */}
        <div style={styles.card}>
          <div style={styles.cardTitleRow}>
            <div>
              <div style={styles.h2}>Contato</div>
              <div style={styles.muted}>Telefone e dados pessoais</div>
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Telefone 1</label>
              <input
                style={styles.input}
                value={maskPhoneSafe(value?.telefone1)}
                onChange={(e) => onChange({ telefone1: onlyDigits(e.target.value) })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Telefone 2</label>
              <input
                style={styles.input}
                value={maskPhoneSafe(value?.telefone2)}
                onChange={(e) => onChange({ telefone2: onlyDigits(e.target.value) })}
                placeholder="(00) 00000-0000"
              />
            </div>

            {/* DATA EDITÁVEL */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Data de nascimento (DD/MM/AAAA)</label>
              <input
                style={styles.input}
                value={dobInput}
                onChange={(e) => {
                  const masked = maskDateBRSlash(e.target.value);
                  setDobInput(masked);

                  const digits = masked.replace(/[^\d]/g, "");
                  if (digits.length === 0) {
                    onChange({ data_nascimento: "" });
                    return;
                  }
                  if (digits.length === 8) {
                    const iso = parseDateBRSlash(masked);
                    onChange({ data_nascimento: iso });
                  }
                }}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                inputMode="numeric"
              />
              <div style={styles.muted}>A máscara impede ano com mais de 4 dígitos.</div>
            </div>
          </div>
        </div>

        {/* ENDEREÇO */}
        <div style={styles.card}>
          <div style={styles.cardTitleRow}>
            <div>
              <div style={styles.h2}>Endereço</div>
              <div style={styles.muted}>CEP (busca automática) e complemento</div>
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>CEP</label>
              <input
                style={styles.input}
                value={maskCEP(onlyDigits(value?.cep))}
                onChange={(e) => onChange({ cep: onlyDigits(e.target.value) })}
                onBlur={buscarCep}
                placeholder="00000-000"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Logradouro</label>
              <input style={styles.inputDisabled} value={value?.logradouro || ""} disabled />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Bairro</label>
              <input style={styles.inputDisabled} value={value?.bairro || ""} disabled />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Cidade</label>
              <input style={styles.inputDisabled} value={value?.cidade || ""} disabled />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Número</label>
              <input
                style={readOnly ? styles.inputDisabled : styles.input}
                value={value?.numero || ""}
                onChange={(e) => onChange({ numero: e.target.value })}
                disabled={readOnly}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Complemento</label>
              <input
                style={readOnly ? styles.inputDisabled : styles.input}
                value={value?.complemento || ""}
                onChange={(e) => onChange({ complemento: e.target.value })}
                placeholder="Apto, bloco, etc."
                disabled={readOnly}
              />
            </div>
          </div>
        </div>

        <div style={styles.actionsRow}>
          {readOnly ? (
            <button type="button" style={styles.secondaryBtn} onClick={() => onCancel?.()}>
              Fechar
            </button>
          ) : (
            <>
              {onCancel && (
                <button type="button" style={styles.secondaryBtn} onClick={onCancel}>
                  Cancelar
                </button>
              )}
              <button type="submit" style={styles.primaryBtn}>
                {mode === "create" ? "Criar membro" : "Salvar alterações"}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
