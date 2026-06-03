import type { Transaction } from './supabase';

export type ParsedRow = Omit<Transaction, 'id' | 'created_at'> & { _raw?: string };

// ─── Auto-categorização ───────────────────────────────────────────────────────

const CATEGORY_RULES: Array<{ patterns: string[]; category: string }> = [
  // Transporte
  { patterns: ['uber', '99pop', '99 taxi', 'cabify', 'indriver', 'taxi', 'transporte'], category: 'Transporte' },
  { patterns: ['shell', 'ipiranga', 'br petro', 'posto', 'gasolina', 'combustivel', 'etanol', 'petrobras'], category: 'Transporte' },
  { patterns: ['metro', 'bilhete unico', 'sptrans', 'brt', 'vlt', 'passagem', 'pedagio', 'sem parar', 'veloe'], category: 'Transporte' },
  // Alimentação
  { patterns: ['ifood', 'rappi', 'uber eats', 'james delivery', 'loggi'], category: 'Alimentação' },
  { patterns: ['mcdonalds', 'burger king', 'kfc', 'subway', 'giraffas', "bobs ", 'bob\'s', 'outback', 'coxinha', 'hot dog'], category: 'Alimentação' },
  { patterns: ['restaurante', 'lanchonete', 'pizzaria', 'sushi', 'japonês', 'japones', 'churrascaria', 'buffet', 'bistrô'], category: 'Alimentação' },
  { patterns: ['extra hipermercado', 'pao de acucar', 'pão de açúcar', 'carrefour', 'walmart', 'atacadao', 'atacadão', 'assai', 'assaí', 'makro', 'tenda atacado'], category: 'Alimentação' },
  { patterns: ['mercado', 'supermercado', 'hortifruti', 'padaria', 'panificadora', 'empório', 'emporio', 'quitanda', 'feira'], category: 'Alimentação' },
  // Moradia
  { patterns: ['aluguel', 'condominio', 'condomínio', 'iptu', 'sindico'], category: 'Moradia' },
  { patterns: ['light ', 'enel ', 'cpfl', 'elektro', 'cemig', 'coelba', 'energisa', 'celpe', 'coelce', 'energia eletrica'], category: 'Moradia' },
  { patterns: ['sabesp', 'cedae', 'sanepar', 'embasa', 'cagece', 'agua e esgoto', 'saneamento'], category: 'Moradia' },
  { patterns: ['tim ', 'claro ', 'vivo ', ' oi ', 'sky ', 'net ', 'nextel', 'internet', 'fibra optica', 'banda larga', 'wifi'], category: 'Moradia' },
  // Saúde
  { patterns: ['farmacia', 'farmácia', 'drogaria', 'drogasil', 'ultrafarma', 'droga raia', 'pacheco', 'sao joao farm', 'drogal'], category: 'Saúde' },
  { patterns: ['hospital', 'clinica', 'clínica', 'laboratorio', 'laboratorio', 'exame', 'consulta', 'medico', 'médico', 'dentista', 'odonto', 'ortopedista', 'dermatol'], category: 'Saúde' },
  { patterns: ['unimed', 'bradesco saude', 'amil', 'sulamerica', 'notredame', 'hapvida', 'plano saude', 'plano de saude'], category: 'Saúde' },
  // Lazer
  { patterns: ['netflix', 'spotify', 'amazon prime', 'disney', 'hbo max', 'hbomax', 'paramount', 'globoplay', 'apple tv', 'apple music', 'deezer', 'youtube premium'], category: 'Lazer' },
  { patterns: ['steam', 'playstation', 'xbox', 'nintendo', 'nuuvem', 'epic games', 'riot games'], category: 'Lazer' },
  { patterns: ['cinema', 'teatro', 'show ', 'ingresso', 'ticketmaster', 'eventim', 'sympla', 'shopingressos'], category: 'Lazer' },
  { patterns: ['academia', 'crossfit', 'smart fit', 'bluefit', 'gym', 'palestra', 'piscina', 'esporte clube'], category: 'Lazer' },
  // Educação
  { patterns: ['escola', 'faculdade', 'universidade', 'curso', 'udemy', 'alura', 'coursera', 'descomplica', 'stoodi', 'khan'], category: 'Educação' },
  { patterns: ['livro', 'amazon livro', 'kindle', 'submarino', 'saraiva livraria', 'cultura livros'], category: 'Educação' },
  // Vestuário
  { patterns: ['renner', 'riachuelo', 'c&a', 'zara', 'h&m', ' hm ', 'amaro', 'shein', 'centauro', 'decathlon', 'netshoes', 'dafiti'], category: 'Vestuário' },
  // Serviços
  { patterns: ['amazon', 'mercado livre', 'mercadolivre', 'shopee', 'americanas', 'magazine luiza', 'magalu', 'casas bahia', 'extra.com'], category: 'Serviços' },
  // Receitas
  { patterns: ['salario', 'salário', 'folha pagamento', 'pagamento empregador', 'remuneracao', 'remuneração'], category: 'Salário' },
  { patterns: ['freelance', 'honorario', 'honorário', 'servico prestado', 'serviço prestado', 'pix recebido'], category: 'Freelance' },
  { patterns: ['dividendo', 'rendimento', 'cdb', 'tesouro', 'fundo investimento', 'lci', 'lca', 'cri', 'cra', 'aplicacao', 'aplicação'], category: 'Investimentos' },
];

export function detectCategory(description: string): string {
  const lower = description.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some(p => lower.includes(p.normalize('NFD').replace(/[̀-ͯ]/g, '')))) {
      return rule.category;
    }
  }
  return 'Outros';
}

// Detecta se é potencialmente uma transferência interna
export function isLikelyInternalTransfer(description: string): boolean {
  const lower = description.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const patterns = [
    'transferencia',
    'transferência',
    'ted ',
    'doc ',
    'tei',
    'pix ',
    'transf ',
    'trans ',
  ];
  return patterns.some(p => lower.includes(p));
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function parseOFXDate(raw: string): string {
  // 20260305000000[-3:BRT] → 2026-03-05
  const clean = raw.replace(/\[.*\]/, '').trim();
  const y = clean.slice(0, 4);
  const m = clean.slice(4, 6);
  const d = clean.slice(6, 8);
  return `${y}-${m}-${d}`;
}

function getTag(block: string, tag: string): string {
  // XML format: <TAG>value</TAG>
  const xmlRe = new RegExp(`<${tag}>([^<]+)<\\/${tag}>`, 'i');
  const xmlM = block.match(xmlRe);
  if (xmlM) return xmlM[1].trim();
  // SGML format: <TAG>value\n
  const sgmlRe = new RegExp(`<${tag}>([^\\n\\r<]+)`, 'i');
  const sgmlM = block.match(sgmlRe);
  return sgmlM ? sgmlM[1].trim() : '';
}

// ─── OFX Parser ───────────────────────────────────────────────────────────────

export function parseOFX(content: string, account = ''): ParsedRow[] {
  const rows: ParsedRow[] = [];

  // Find all transaction blocks (STMTTRN or inside INVSTMTTRN)
  const blockRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>|<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|<\/INVBANKTRANLIST>)/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(content)) !== null) {
    const block = match[1] || match[2] || '';
    if (!block.trim()) continue;

    const trntype = getTag(block, 'TRNTYPE').toUpperCase();
    const dtposted = getTag(block, 'DTPOSTED');
    const trnamt = parseFloat(getTag(block, 'TRNAMT').replace(',', '.'));
    const memo = getTag(block, 'MEMO') || getTag(block, 'NAME') || getTag(block, 'FITID');

    if (!dtposted || isNaN(trnamt) || !memo) continue;

    const amount = Math.abs(trnamt);
    // OFX: positive = credit/income, negative = debit/expense
    // TRNTYPE: CREDIT, DEP, INT, DIV → income; DEBIT, CHECK, PAYMENT → expense
    const incomeTypes = ['CREDIT', 'DEP', 'INT', 'DIV', 'DIRECTDEP', 'OTHER'];
    const type = trnamt > 0 || incomeTypes.includes(trntype) ? 'income' : 'expense';

    rows.push({
      description: memo,
      amount,
      type,
      category: detectCategory(memo),
      date: parseOFXDate(dtposted),
      account,
      user: 'Você',
      _raw: block,
    });
  }

  return rows;
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function detectSeparator(line: string): string {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of line) {
    if (ch in counts) counts[ch as keyof typeof counts]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseLine(line: string, sep: string): string[] {
  const cols: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === sep && !inQuote) { cols.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

function parseDate(raw: string): string | null {
  // Formats: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, MM/DD/YYYY
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmyRe = /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/;
  const dmy = s.match(dmyRe);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const mdyRe = /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/;
  const mdy = s.match(mdyRe);
  if (mdy) return `${mdy[3]}-${mdy[1]}-${mdy[2]}`;
  return null;
}

function parseAmount(raw: string): number {
  // Remove currency symbols, spaces; handle Brazilian format (1.234,56)
  let s = raw.replace(/[R$\s]/g, '').trim();
  // If both . and ,: detect which is decimal
  if (s.includes('.') && s.includes(',')) {
    // Brazilian: 1.234,56
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // Could be Brazilian decimal: 234,56
    s = s.replace(',', '.');
  }
  return parseFloat(s);
}

export function parseCSV(content: string, account = ''): ParsedRow[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const sep = detectSeparator(lines[0]);
  const header = parseLine(lines[0], sep).map(h => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));

  // Detect bank format by header
  const isNubankCard = header.some(h => h.includes('title') || h.includes('category'));
  const isNubankAccount = header.some(h => h.includes('descricao') || h.includes('lancamento'));

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i], sep);
    if (cols.length < 2) continue;

    try {
      let date = '';
      let description = '';
      let amount = 0;
      let type: 'income' | 'expense' = 'expense';

      if (isNubankCard) {
        // Nubank credit card: date,category,title,amount
        const di = header.findIndex(h => h.includes('date') || h.includes('data'));
        const ti = header.findIndex(h => h.includes('title') || h.includes('descri'));
        const ai = header.findIndex(h => h.includes('amount') || h.includes('valor'));
        date = parseDate(cols[di] ?? cols[0]) ?? '';
        description = cols[ti] ?? cols[2] ?? '';
        amount = Math.abs(parseAmount(cols[ai] ?? cols[3] ?? '0'));
        // Nubank card: positive = expense (purchase), negative = payment/credit
        const rawAmt = parseAmount(cols[ai] ?? cols[3] ?? '0');
        type = rawAmt >= 0 ? 'expense' : 'income';
      } else {
        // Generic: find columns by header name
        const colMap = {
          date: ['data', 'date', 'dt', 'lancamento', 'lançamento', 'data lancamento'],
          desc: ['descricao', 'descrição', 'description', 'historico', 'histórico', 'memo', 'title', 'nome', 'estabelecimento'],
          amount: ['valor', 'amount', 'value', 'montante', 'credito', 'debito', 'crédito', 'débito'],
          type: ['tipo', 'type', 'natureza'],
        };

        const findCol = (keys: string[]) => {
          for (const key of keys) {
            const i = header.findIndex(h => h.includes(key));
            if (i >= 0) return i;
          }
          return -1;
        };

        const di = findCol(colMap.date);
        const desi = findCol(colMap.desc);
        const ai = findCol(colMap.amount);

        if (di < 0 || desi < 0 || ai < 0) {
          // Last resort: assume first col = date, second = desc, last = amount
          date = parseDate(cols[0]) ?? '';
          description = cols[1] ?? '';
          amount = Math.abs(parseAmount(cols[cols.length - 1] ?? '0'));
          const rawAmt = parseAmount(cols[cols.length - 1] ?? '0');
          type = rawAmt >= 0 ? 'expense' : 'income';
        } else {
          date = parseDate(cols[di] ?? '') ?? '';
          description = cols[desi] ?? '';
          const rawAmt = parseAmount(cols[ai] ?? '0');
          amount = Math.abs(rawAmt);

          // Detect credit/debit columns
          const creditCol = header.findIndex(h => h.includes('credito') || h.includes('crédito'));
          const debitCol = header.findIndex(h => h.includes('debito') || h.includes('débito'));

          if (creditCol >= 0 && debitCol >= 0) {
            const creditVal = parseAmount(cols[creditCol] ?? '0');
            const debitVal = parseAmount(cols[debitCol] ?? '0');
            if (!isNaN(creditVal) && creditVal > 0) {
              amount = creditVal;
              type = 'income';
            } else if (!isNaN(debitVal) && debitVal > 0) {
              amount = debitVal;
              type = 'expense';
            }
          } else {
            type = rawAmt >= 0 ? 'expense' : 'income';
          }
        }
      }

      if (!date || !description || isNaN(amount) || amount === 0) continue;

      rows.push({
        description: description.trim(),
        amount,
        type,
        category: detectCategory(description),
        date,
        account,
        user: 'Você',
        _raw: lines[i],
      });
    } catch {
      continue;
    }
  }

  return rows;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function parseFile(file: File, account = ''): Promise<ParsedRow[]> {
  const content = await file.text();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'ofx' || ext === 'qfx' || content.includes('<OFX>') || content.includes('OFXHEADER')) {
    return parseOFX(content, account);
  }

  if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
    return parseCSV(content, account);
  }

  // Try to detect by content
  if (content.trim().startsWith('<') || content.includes('STMTTRN')) {
    return parseOFX(content, account);
  }

  return parseCSV(content, account);
}
