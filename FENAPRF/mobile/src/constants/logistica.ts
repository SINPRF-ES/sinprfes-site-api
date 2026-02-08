/**
 * FENAPRF - Constantes do Módulo de Logística (Mobile)
 */

export const CARGOS_CONSELHO = [
  "Presidente",
  "Vice-Presidente",
  "Delegado Representante",
  "Delegado Substituto",
];

export const CONFLICT_GROUPS = [
  ["Presidente", "Vice-Presidente"],
  ["Delegado Representante", "Delegado Substituto"]
];

/**
 * Verifica se dois membros geram alerta de conflito para o mesmo evento.
 * Regra: Mesma UF e cargos equivalentes (ex: Pres + Vice ou DR + DS).
 */
export function checkConflict(cargo1: string | null, uf1: string | null, cargo2: string | null, uf2: string | null): boolean {
  if (!uf1 || !uf2 || uf1.trim().toUpperCase() !== uf2.trim().toUpperCase()) return false;
  if (!cargo1 || !cargo2) return false;

  const c1 = cargo1.trim();
  const c2 = cargo2.trim();

  // Se for o mesmo cargo na mesma UF (Ex: Dois Presidentes)
  if (c1.toUpperCase() === c2.toUpperCase()) return true;

  // Se pertencerem ao mesmo grupo de conflito
  for (const group of CONFLICT_GROUPS) {
    const gUpper = group.map(g => g.toUpperCase());
    if (gUpper.includes(c1.toUpperCase()) && gUpper.includes(c2.toUpperCase())) {
      return true;
    }
  }

  return false;
}
