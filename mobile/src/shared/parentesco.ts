export const PARENTESCO_OPTIONS = [
  { label: 'Cônjuge/Companheiro(a)', value: 'CONJUGE' },
  { label: 'Filho(a)', value: 'FILHO' },
  { label: 'Enteado(a)', value: 'ENTEADO' },
  { label: 'Pai/Mãe', value: 'PAI_MAE' },
  { label: 'Outro', value: 'OUTRO' },
];

export function normalizeParentesco(value: string | null | undefined): string {
  if (!value) return '';
  const v = value.trim().toUpperCase();
  if (v === 'CONJUGE' || v === 'COMPANHEIRO' || v === 'COMPANHEIRA') return 'CONJUGE';
  if (v === 'FILHO' || v === 'FILHA') return 'FILHO';
  if (v === 'ENTEADO' || v === 'ENTEADA') return 'ENTEADO';
  if (v === 'PAI' || v === 'MÃE' || v === 'MAE' || v === 'PAI_MAE') return 'PAI_MAE';
  return 'OUTRO';
}
