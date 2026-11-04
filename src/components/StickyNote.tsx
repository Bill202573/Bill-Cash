import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Minus, Plus, StickyNote as StickyNoteIcon } from 'lucide-react';
import { toast } from 'sonner';
import { usePriorityNotes, useAddPriorityNote, useUpdatePriorityNote, type PriorityLevel } from '@/hooks/usePriorityNotes';
import { dueChip } from '@/components/PriorityBoard';

const STORAGE_KEY = 'billcash.stickyNote.open';
const RANK: Record<PriorityLevel, number> = { urgent: 0, important: 1, normal: 2 };
const MAX_VISIBLE = 6;

function initialOpen(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return saved === 'true';
  } catch { /* storage indisponível */ }
  return typeof window !== 'undefined' && window.innerWidth >= 1024; // em tela pequena começa recolhido
}

/** Post-it amarelo flutuante, visível em todas as telas, com os avisos em aberto do Quadro de avisos */
export function StickyNote() {
  const navigate = useNavigate();
  const { data: notes = [] } = usePriorityNotes();
  const add = useAddPriorityNote();
  const update = useUpdatePriorityNote();
  const [open, setOpen] = useState(initialOpen);
  const [text, setText] = useState('');

  const items = useMemo(
    () => notes
      .filter(n => !n.done)
      .sort((a, b) =>
        RANK[a.level] - RANK[b.level]
        || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
        || b.created_at.localeCompare(a.created_at)),
    [notes],
  );

  const setOpenPersist = (v: boolean) => {
    setOpen(v);
    try { localStorage.setItem(STORAGE_KEY, String(v)); } catch { /* ignora */ }
  };

  const onError = (e: unknown) => toast.error((e as Error).message ?? 'Erro ao salvar');

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    add.mutate({ title: t, level: 'normal', due_date: null }, { onSuccess: () => setText(''), onError });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpenPersist(true)}
        title="Abrir lembretes"
        className="print:hidden fixed bottom-4 right-4 z-[60] h-12 w-12 rounded-md bg-yellow-200 text-yellow-900 shadow-lg shadow-black/30 rotate-3 hover:rotate-0 transition-transform flex items-center justify-center"
      >
        <StickyNoteIcon className="h-6 w-6" />
        {items.length > 0 && (
          <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
            {items.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="print:hidden fixed bottom-4 right-4 z-[60] w-72 max-w-[calc(100vw-2rem)] -rotate-1 text-yellow-950">
      {/* fita adesiva */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-20 bg-yellow-50/70 rotate-2 shadow-sm" />
      <div className="bg-yellow-200 rounded-sm shadow-xl shadow-black/40 px-3 pt-4 pb-3 border-b-4 border-r-2 border-yellow-300">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-sm font-bold tracking-wide">📌 Lembretes{items.length > 0 && <span className="font-normal opacity-70"> ({items.length})</span>}</p>
          <button onClick={() => setOpenPersist(false)} title="Recolher" className="p-0.5 rounded hover:bg-yellow-300">
            <Minus className="h-4 w-4" />
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-xs opacity-70 py-1">Nada pendente. Escreva abaixo o que não pode esquecer.</p>
        ) : (
          <ul className="max-h-64 overflow-y-auto space-y-1.5 pr-0.5">
            {items.slice(0, MAX_VISIBLE).map(n => {
              const chip = n.due_date ? dueChip(n.due_date) : null;
              return (
                <li key={n.id} className="flex items-start gap-2 text-[13px] leading-snug">
                  <button
                    onClick={() => update.mutate({ id: n.id, done: true, done_at: new Date().toISOString() }, { onError })}
                    title="Concluir"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-yellow-800/60 hover:bg-yellow-400 flex items-center justify-center group"
                  >
                    <Check className="h-3 w-3 opacity-0 group-hover:opacity-80" />
                  </button>
                  <span className="min-w-0 break-words">
                    {n.level === 'urgent' && <span className="font-bold text-red-700">! </span>}
                    {n.title}
                    {chip && <span className="ml-1 text-[11px] font-semibold text-red-800">({chip.text})</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {items.length > MAX_VISIBLE && (
          <button onClick={() => navigate('/')} className="mt-1 text-xs underline opacity-80 hover:opacity-100">
            + {items.length - MAX_VISIBLE} no quadro de avisos
          </button>
        )}

        <div className="mt-2 flex items-center gap-1">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            maxLength={200}
            placeholder="Novo lembrete..."
            className="flex-1 min-w-0 h-7 px-2 text-xs rounded-sm bg-yellow-100 border border-yellow-400 placeholder:text-yellow-800/50 focus:outline-none focus:border-yellow-600"
          />
          <button onClick={submit} disabled={!text.trim() || add.isPending} title="Adicionar" className="h-7 w-7 rounded-sm bg-yellow-300 hover:bg-yellow-400 disabled:opacity-40 flex items-center justify-center">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
