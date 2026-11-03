import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Pin, Plus, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  usePriorityNotes, useAddPriorityNote, useUpdatePriorityNote, useDeletePriorityNote,
  type PriorityLevel, type PriorityNote,
} from '@/hooks/usePriorityNotes';

const LEVELS: Record<PriorityLevel, { label: string; rank: number; badge: string; bar: string }> = {
  urgent:    { label: 'Urgente',    rank: 0, badge: 'bg-expense/15 text-expense',   bar: 'bg-expense' },
  important: { label: 'Importante', rank: 1, badge: 'bg-warning/15 text-warning',   bar: 'bg-warning' },
  normal:    { label: 'Normal',     rank: 2, badge: 'bg-secondary text-muted-foreground', bar: 'bg-border' },
};
const NEXT_LEVEL: Record<PriorityLevel, PriorityLevel> = { urgent: 'important', important: 'normal', normal: 'urgent' };

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const daysUntil = (date: string) =>
  Math.round((new Date(date + 'T12:00:00').getTime() - new Date(todayStr() + 'T12:00:00').getTime()) / 86_400_000);

function dueChip(date: string): { text: string; cls: string } {
  const d = daysUntil(date);
  const short = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (d < 0) return { text: `atrasado ${-d}d (${short})`, cls: 'bg-expense/15 text-expense' };
  if (d === 0) return { text: 'hoje', cls: 'bg-expense/15 text-expense' };
  if (d <= 3) return { text: `em ${d}d (${short})`, cls: 'bg-warning/15 text-warning' };
  return { text: short, cls: 'bg-secondary text-muted-foreground' };
}

/** Quadro de avisos: itens importantes para o usuário priorizar. Pessoal, não depende do escopo família. */
export function PriorityBoard() {
  const { data: notes = [], isLoading } = usePriorityNotes();
  const add = useAddPriorityNote();
  const update = useUpdatePriorityNote();
  const remove = useDeletePriorityNote();

  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<PriorityLevel>('important');
  const [dueDate, setDueDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showDone, setShowDone] = useState(false);

  const { open, done } = useMemo(() => {
    const sorted = [...notes].sort((a, b) =>
      LEVELS[a.level].rank - LEVELS[b.level].rank
      || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
      || b.created_at.localeCompare(a.created_at));
    return { open: sorted.filter(n => !n.done), done: notes.filter(n => n.done) };
  }, [notes]);

  const onError = (e: unknown) => toast.error((e as Error).message ?? 'Erro ao salvar');

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    add.mutate({ title: t, level, due_date: dueDate || null }, {
      onSuccess: () => { setTitle(''); setDueDate(''); },
      onError,
    });
  };

  const saveEdit = (n: PriorityNote) => {
    const t = editText.trim();
    setEditingId(null);
    if (t && t !== n.title) update.mutate({ id: n.id, title: t }, { onError });
  };

  return (
    <div className="glass-card rounded-lg p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Pin className="h-5 w-5 text-primary" />
        <h3 className="font-display font-semibold text-lg">Quadro de avisos</h3>
        {open.length > 0 && <span className="text-xs text-muted-foreground">{open.length} em aberto</span>}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="O que é prioridade agora? (ex.: negociar a dívida com a Lucia)"
          className="h-9 flex-1"
          maxLength={200}
        />
        <div className="flex gap-2">
          <Select value={level} onValueChange={v => setLevel(v as PriorityLevel)}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(LEVELS) as PriorityLevel[]).map(l => <SelectItem key={l} value={l}>{LEVELS[l].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 w-36" title="Prazo (opcional)" />
          <Button size="sm" className="h-9 gap-1" onClick={submit} disabled={!title.trim() || add.isPending}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Adicionar</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : open.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum aviso em aberto. Anote aqui o que não pode ser esquecido.</p>
      ) : (
        <ul className="space-y-1.5">
          {open.map(n => {
            const chip = n.due_date ? dueChip(n.due_date) : null;
            return (
              <li key={n.id} className="group flex items-center gap-2.5 rounded-md bg-secondary/30 pl-0 pr-2 py-1.5 overflow-hidden">
                <span className={`self-stretch w-1 shrink-0 ${LEVELS[n.level].bar}`} />
                <button
                  onClick={() => update.mutate({ id: n.id, done: true, done_at: new Date().toISOString() }, { onError })}
                  className="h-5 w-5 shrink-0 rounded border border-border hover:border-primary hover:bg-primary/10 flex items-center justify-center"
                  title="Marcar como concluído"
                >
                  <Check className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60" />
                </button>
                {editingId === n.id ? (
                  <Input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onBlur={() => saveEdit(n)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(n); if (e.key === 'Escape') setEditingId(null); }}
                    className="h-7 flex-1 text-sm"
                    maxLength={200}
                  />
                ) : (
                  <span
                    className="flex-1 text-sm cursor-text min-w-0 break-words"
                    onClick={() => { setEditingId(n.id); setEditText(n.title); }}
                    title="Clique para editar"
                  >
                    {n.title}
                  </span>
                )}
                {chip && <span className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${chip.cls}`}>{chip.text}</span>}
                <button
                  onClick={() => update.mutate({ id: n.id, level: NEXT_LEVEL[n.level] }, { onError })}
                  className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${LEVELS[n.level].badge}`}
                  title="Clique para trocar a prioridade"
                >
                  {LEVELS[n.level].label}
                </button>
                <button
                  onClick={() => remove.mutate(n.id, { onError })}
                  className="p-1 text-muted-foreground hover:text-expense sm:opacity-0 sm:group-hover:opacity-100"
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {done.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowDone(s => !s)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            {showDone ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Concluídos ({done.length})
          </button>
          {showDone && (
            <ul className="mt-1.5 space-y-1">
              {done.map(n => (
                <li key={n.id} className="group flex items-center gap-2 text-sm text-muted-foreground px-1">
                  <span className="flex-1 line-through break-words">{n.title}</span>
                  <button onClick={() => update.mutate({ id: n.id, done: false, done_at: null }, { onError })} className="p-1 hover:text-foreground" title="Reabrir">
                    <Undo2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove.mutate(n.id, { onError })} className="p-1 hover:text-expense" title="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
