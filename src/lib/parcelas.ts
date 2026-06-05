/**
 * Detecta padrão de parcela no texto da descrição.
 *
 * Aceita formatos comuns dos bancos brasileiros:
 *   - "iPhone (1/12)"
 *   - "iPhone 1/12"
 *   - "iPhone Parcela 1 de 12"
 *   - "iPhone Parc 1/12"
 *   - "iPhone 1 de 12"
 *
 * Retorna a info da parcela e a descrição "base" (sem o sufixo de parcela),
 * útil para matching entre faturas.
 */
export interface ParcelaInfo {
  current:          number;     // parcela atual (1..total)
  total:            number;     // total de parcelas
  baseDescription:  string;     // descrição limpa, sem "(X/Y)"
}

const PARCELA_REGEXES: Array<RegExp> = [
  // "(1/12)" ou "(01/12)"
  /\s*\(\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\)\s*$/i,
  // "1/12" no final
  /\s+(\d{1,2})\s*\/\s*(\d{1,2})\s*$/i,
  // "Parcela 1 de 12", "Parc 1 de 12"
  /\s+parc(?:ela)?\.?\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/i,
  /\s+parc(?:ela)?\.?\s*(\d{1,2})\s+de\s+(\d{1,2})\s*$/i,
  // "1 de 12" no final
  /\s+(\d{1,2})\s+de\s+(\d{1,2})\s*$/i,
];

export function parseParcela(description: string): ParcelaInfo | null {
  const desc = description.trim();
  for (const re of PARCELA_REGEXES) {
    const m = desc.match(re);
    if (m) {
      const current = parseInt(m[1], 10);
      const total   = parseInt(m[2], 10);
      if (current >= 1 && total >= 2 && current <= total && total <= 60) {
        return {
          current,
          total,
          baseDescription: desc.slice(0, m.index).trim(),
        };
      }
    }
  }
  return null;
}

/** Gera o sufixo "(X/Y)" padrão para descrições de parcela */
export function parcelaSuffix(current: number, total: number): string {
  return `(${current}/${total})`;
}

/** Avança um YYYY-MM em N meses (preservando o dia quando possível) */
export function addMonthsToYYYYMM(monthRef: string, n: number): string {
  const [y, m] = monthRef.split('-').map(Number);
  const idx = (y * 12 + (m - 1)) + n;
  const newY = Math.floor(idx / 12);
  const newM = (idx % 12) + 1;
  return `${newY}-${String(newM).padStart(2, '0')}`;
}

/** Avança uma data YYYY-MM-DD em N meses (clamp no último dia do mês) */
export function addMonthsToDate(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const idx = (y * 12 + (m - 1)) + n;
  const newY = Math.floor(idx / 12);
  const newM = (idx % 12) + 1;
  const lastDay = new Date(newY, newM, 0).getDate();
  const newD = Math.min(d, lastDay);
  return `${newY}-${String(newM).padStart(2, '0')}-${String(newD).padStart(2, '0')}`;
}
