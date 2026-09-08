// Correção de dívidas pela taxa de rendimento da poupança (Banco Central - série SGS 195).
// A série retorna a taxa mensal vigente em cada dia (mesma taxa se repete durante ~1 mês,
// mudando no dia do "aniversário"), então buscamos o histórico diário completo do período
// e usamos apenas a taxa do dia de aniversário de cada mês para capitalizar.

const BCB_SERIES_POUPANCA = 195;

interface BcbEntry {
  data: string;   // dd/MM/yyyy
  valor: string;  // taxa do período, em % (ex: "0.3994")
}

function toBcbDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function parseBcbDate(brDate: string): Date {
  const [d, m, y] = brDate.split('/').map(Number);
  return new Date(y, m - 1, d);
}

/** Busca a série diária da poupança entre duas datas (YYYY-MM-DD). Tenta 2x — a API do BCB às vezes falha transitoriamente. */
async function fetchPoupancaSeries(startIso: string, endIso: string): Promise<BcbEntry[]> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${BCB_SERIES_POUPANCA}/dados?formato=json&dataInicial=${toBcbDate(startIso)}&dataFinal=${toBcbDate(endIso)}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('status ' + res.status);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('resposta inesperada');
      return data;
    } catch (e) {
      if (attempt === 2) throw new Error('Não foi possível consultar a série da poupança no Banco Central. Tente novamente.');
    }
  }
  return [];
}

export interface SavingsCorrectionResult {
  correctedBalance: number;
  monthsApplied: number;
  totalYieldPercent: number; // quanto o valor cresceu, em %
  breakdown: { month: string; rate: number; balanceAfter: number }[];
}

/**
 * Calcula o saldo corrigido de um valor original pela poupança, mês a mês,
 * desde originDate (YYYY-MM-DD) até hoje.
 */
export async function calculateSavingsCorrection(
  originAmount: number,
  originDate: string,
): Promise<SavingsCorrectionResult> {
  const start = new Date(originDate + 'T12:00:00');
  const today = new Date();

  if (start >= today) {
    return { correctedBalance: originAmount, monthsApplied: 0, totalYieldPercent: 0, breakdown: [] };
  }

  const series = await fetchPoupancaSeries(originDate, today.toISOString().slice(0, 10));
  if (series.length === 0) {
    throw new Error('O Banco Central não retornou dados para esse período.');
  }

  // Mapa data (dd/MM/yyyy) -> taxa, para lookup rápido
  const rateByDate = new Map<string, number>();
  for (const entry of series) rateByDate.set(entry.data, parseFloat(entry.valor));

  // Para achar a taxa vigente numa data que talvez não tenha entrada exata (fins de semana etc.),
  // ordena as datas da série e usa a mais próxima (<=) da data de aniversário.
  const sortedDates = series.map(e => parseBcbDate(e.data)).sort((a, b) => a.getTime() - b.getTime());

  function rateOnOrBefore(target: Date): number | null {
    let found: Date | null = null;
    for (const d of sortedDates) {
      if (d.getTime() <= target.getTime()) found = d;
      else break;
    }
    if (!found) return null;
    const key = `${String(found.getDate()).padStart(2, '0')}/${String(found.getMonth() + 1).padStart(2, '0')}/${found.getFullYear()}`;
    return rateByDate.get(key) ?? null;
  }

  let balance = originAmount;
  const breakdown: SavingsCorrectionResult['breakdown'] = [];

  // Avança mês a mês, no "dia de aniversário" do empréstimo, capitalizando a taxa vigente.
  const cursor = new Date(start);
  let months = 0;
  while (true) {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    if (next > today) break;

    const rate = rateOnOrBefore(next);
    if (rate != null) {
      balance = balance * (1 + rate / 100);
      months++;
      breakdown.push({
        month: `${String(next.getMonth() + 1).padStart(2, '0')}/${next.getFullYear()}`,
        rate,
        balanceAfter: balance,
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return {
    correctedBalance: balance,
    monthsApplied: months,
    totalYieldPercent: originAmount > 0 ? ((balance / originAmount) - 1) * 100 : 0,
    breakdown,
  };
}
