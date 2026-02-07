export const API_BASE =
  import.meta.env.MODE === "development"
    ? "http://localhost:3001"
    : "https://fenaprf-api.onrender.com";

/* =========================
   Perfis
========================= */

export const PERFIS = {
  ADMIN: "ADMIN",
  COLABORADOR: "COLABORADOR",
  CONSELHEIRO: "CONSELHEIRO",
  DIRETORIA: "DIRETORIA",
};

export const PERFIS_CADASTRO_BASE = [
  PERFIS.CONSELHEIRO,
  PERFIS.DIRETORIA,
  PERFIS.COLABORADOR,
];

/* =========================
   UFs
========================= */

export const UFS_DETALHADAS = [
  { sigla: "BR", nome: "Brasil"},
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

export const UF_NOME = Object.fromEntries(
  UFS_DETALHADAS.map((u) => [u.sigla, u.nome])
);

export function getBandeiraUF(ufSigla) {
  const uf = (ufSigla || "").toString().trim().toLowerCase();
  if (!uf || uf.length !== 2) return "";
  return `https://atlasescolar.ibge.gov.br/images/bandeiras/ufs/${uf}.png`;
}

/* =========================
   Cargos
========================= */

export const CARGOS_CONSELHO = [
  "Presidente",
  "Vice-Presidente",
  "Delegado Representante",
  "Delegado Substituto",
];

export const CARGOS_DIRETORIA = [
  "Presidente da FENAPRF",
  "Vice-Presidente da FENAPRF",
  "Diretor de Secretaria",
  "Diretor de Secretaria Substituto",
  "Diretor de Finanças",
  "Diretor de Finanças Substituto",
  "Diretor de Relações de Trabalho e e Formação Sindical",
  "Diretor de Relações de Trabalho e e Formação Sindical Substituto",
  "Diretor Jurídico",
  "Diretor Jurídico Substituto",
  "Diretor de Assuntos Institucionais",
  "Diretor de Assuntos Institucionais Substituto",
  "Diretor de Comunicação e Divulgação",
  "Diretor de Comunicação e Divulgação Substituto",
  "Diretor de Direitos Humanos e Políticas Sociais",
  "Diretor de Direitos Humanos e Políticas Sociais Substituto",
];

/* =========================
   Filtros da página Membros
========================= */

export const FILTROS_MEMBROS = [
  { value: "PADRAO", label: "Exibição padrão (Diretoria + Conselheiros por UF)" },
  { value: "DIRETORIA", label: "Apenas Diretoria" },
  { value: "PRESIDENTES", label: "Apenas Presidentes" },
  { value: "VICES", label: "Apenas Vices" },
  { value: "DR", label: "Delegados Representantes (DR)" },
  { value: "DS", label: "Delegados Substitutos (DS)" },
  { value: "UF", label: "Filtrar por UF" },
  { value: "ADMIN_COLAB", label: "Admin/Colaborador" },
];

/* =========================
   Utilidades
========================= */

export function normalizeCargo(raw) {
  const s = (raw || "").toString().trim();
  if (!s) return "";
  const lower = s.toLowerCase();

  const map = new Map([
    ["presidente", "Presidente"],
    ["vice-presidente", "Vice-Presidente"],
    ["delegado representante", "Delegado Representante"],
    ["delegado substituto", "Delegado Substituto"],
  ]);

  return map.get(lower) || s;
}

export function tituloCargoUf({ perfil_acesso, cargo, uf }) {
  const perfil = (perfil_acesso || "").toUpperCase();
  const c = normalizeCargo(cargo);
  const ufSigla = (uf || "").toUpperCase();
  const ufNome = UF_NOME[ufSigla] || ufSigla || "—";

  if (perfil === PERFIS.CONSELHEIRO) {
    return c
      ? `${c} do Sindicato de ${ufNome}`
      : `Conselheiro do Sindicato de ${ufNome}`;
  }
  if (perfil === PERFIS.DIRETORIA) return c || "Diretoria";
  if (perfil === PERFIS.COLABORADOR) return "Colaborador";
  if (perfil === PERFIS.ADMIN) return c || "Administrador";
  return c || "Membro";
}

export function onlyDigits(v) {
  return (v || "").toString().replace(/\D/g, "");
}


/* =========================
   Ordenação da lista (Dashboard/Membros)
   - Mantém o padrão do projeto:
     Diretoria em cima (hierarquia) + Conselheiros por UF (alfabético)
   - ADMIN/COLABORADOR ficam no final (e, por padrão, o frontend pode ocultar).
========================= */

export function cargoRankDiretoria(cargo) {
  const c = normalizeCargo(cargo);
  const idx = CARGOS_DIRETORIA.findIndex((x) => x.toLowerCase() === String(c || "").toLowerCase());
  return idx === -1 ? 999 : idx;
}

export function cargoRankConselho(cargo) {
  const c = normalizeCargo(cargo);
  const idx = CARGOS_CONSELHO.findIndex((x) => x.toLowerCase() === String(c || "").toLowerCase());
  return idx === -1 ? 999 : idx;
}

function byName(a, b) {
  return String(a?.name || "").localeCompare(String(b?.name || ""), "pt-BR", { sensitivity: "base" });
}

export function ordenarMembrosTodos(membros) {
  const list = Array.isArray(membros) ? [...membros] : [];

  const diretoria = list
    .filter((m) => String(m?.perfil_acesso || "").toUpperCase() === PERFIS.DIRETORIA)
    .sort((a, b) => {
      const ra = cargoRankDiretoria(a?.cargo);
      const rb = cargoRankDiretoria(b?.cargo);
      if (ra !== rb) return ra - rb;
      return byName(a, b);
    });

  const conselheiros = list
    .filter((m) => String(m?.perfil_acesso || "").toUpperCase() === PERFIS.CONSELHEIRO)
    .sort((a, b) => {
      const ufa = String(a?.uf || "").toUpperCase();
      const ufb = String(b?.uf || "").toUpperCase();
      if (ufa !== ufb) return ufa.localeCompare(ufb, "pt-BR");
      const ra = cargoRankConselho(a?.cargo);
      const rb = cargoRankConselho(b?.cargo);
      if (ra !== rb) return ra - rb;
      return byName(a, b);
    });

  const adminColab = list
    .filter((m) => ["ADMIN", "COLABORADOR"].includes(String(m?.perfil_acesso || "").toUpperCase()))
    .sort(byName);

  const outros = list
    .filter(
      (m) =>
        ![PERFIS.DIRETORIA, PERFIS.CONSELHEIRO, PERFIS.ADMIN, PERFIS.COLABORADOR].includes(
          String(m?.perfil_acesso || "").toUpperCase()
        )
    )
    .sort(byName);

  return [...diretoria, ...conselheiros, ...adminColab, ...outros];
}
