import { useMemo, useRef, useState } from 'react';
import { FileText, Upload, Trash2, Download, Search, Link2, Loader2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useDocuments, useUploadDocument, useDeleteDocument, useUpdateDocumentNotes, getDocumentUrl,
  DOC_KIND_LABELS, type AppDocument,
} from '@/hooks/useDocuments';
import { useDebts } from '@/hooks/useDebts';
import { useFixedBills } from '@/hooks/useFixedBills';
import { toast } from 'sonner';

const SELECT_CLS = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
const MAX_MB = 25;

const fmtSize = (b: number | null) => (b == null ? '' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtDate = (d: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');

export default function Documents() {
  const { data: docs = [], isLoading } = useDocuments();
  const { data: debts = [] } = useDebts();
  const { data: bills = [] } = useFixedBills();
  const upload = useUploadDocument();
  const del = useDeleteDocument();
  const updateDoc = useUpdateDocumentNotes();

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('imposto');
  const [notes, setNotes] = useState('');
  const [docDate, setDocDate] = useState('');
  const [link, setLink] = useState(''); // 'debt:<id>' | 'fixed_bill:<id>' | ''
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');

  const linkName = useMemo(() => {
    const m = new Map<string, string>();
    debts.forEach(d => m.set(`debt:${d.id}`, `Dívida: ${d.name}`));
    bills.forEach(b => m.set(`fixed_bill:${b.id}`, `Conta fixa: ${b.name}`));
    return m;
  }, [debts, bills]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter(d =>
      (!kindFilter || d.kind === kindFilter) &&
      (!q || `${d.title} ${d.notes ?? ''} ${d.file_name}`.toLowerCase().includes(q)),
    );
  }, [docs, search, kindFilter]);

  const onPick = (f: File | null) => {
    if (f && f.size > MAX_MB * 1048576) { toast.error(`Arquivo acima de ${MAX_MB} MB`); return; }
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const submit = async () => {
    if (!file) { toast.error('Escolha um arquivo'); return; }
    if (!title.trim()) { toast.error('Dê um título ao documento'); return; }
    const [lt, lid] = link ? link.split(':') : [null, null];
    try {
      await upload.mutateAsync({
        file, title, kind, notes, docDate: docDate || undefined,
        linkedType: (lt as 'debt' | 'fixed_bill' | null), linkedId: lid,
      });
      toast.success('Documento guardado');
      setFile(null); setTitle(''); setNotes(''); setDocDate(''); setLink('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      toast.error('Não consegui enviar: ' + String((e as Error).message ?? e));
    }
  };

  const open = async (d: AppDocument) => {
    try { window.open(await getDocumentUrl(d), '_blank', 'noopener'); }
    catch (e) { toast.error('Não consegui abrir: ' + String((e as Error).message ?? e)); }
  };

  const remove = async (d: AppDocument) => {
    if (!confirm(`Excluir "${d.title}"? O arquivo será apagado e isso não pode ser desfeito.`)) return;
    try { await del.mutateAsync(d); toast.success('Documento excluído'); }
    catch (e) { toast.error('Não consegui excluir: ' + String((e as Error).message ?? e)); }
  };

  const saveNotes = async (d: AppDocument) => {
    try { await updateDoc.mutateAsync({ id: d.id, notes: editNotes.trim() || null }); setEditingId(null); }
    catch (e) { toast.error('Não consegui salvar: ' + String((e as Error).message ?? e)); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display font-bold text-2xl">Documentos</h1>
        <p className="text-sm text-muted-foreground">
          Guarde recibos, parcelamentos, contratos e faturas com uma explicação do que se trata, para não confundir pagamentos depois.
          Os documentos ficam no perfil selecionado (Família, pessoa ou empresa).
        </p>
      </div>

      {/* Envio */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <h3 className="font-display font-semibold flex items-center gap-2"><Upload className="h-4 w-4" /> Guardar documento</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Arquivo (PDF, imagem... até {MAX_MB} MB)</Label>
            <Input ref={fileRef} type="file" onChange={e => onPick(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Parcelamento Simples Nacional (PARCSN)" />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <select className={SELECT_CLS} value={kind} onChange={e => setKind(e.target.value)}>
              {Object.entries(DOC_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Data do documento (opcional)</Label>
            <Input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Ligar a uma dívida ou conta fixa (opcional)</Label>
            <select className={SELECT_CLS} value={link} onChange={e => setLink(e.target.value)}>
              <option value="">Nenhuma</option>
              {debts.length > 0 && <optgroup label="Dívidas">
                {debts.map(d => <option key={d.id} value={`debt:${d.id}`}>{d.name}</option>)}
              </optgroup>}
              {bills.length > 0 && <optgroup label="Contas fixas">
                {bills.map(b => <option key={b.id} value={`fixed_bill:${b.id}`}>{b.name}</option>)}
              </optgroup>}
            </select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>O que é e como funciona (anotações)</Label>
            <textarea
              className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ex.: 7 parcelas de R$ 320,23 pagas por DAS do parcelamento (não é a DAS mensal). 1ª parcela paga em 30/10/2026."
            />
          </div>
        </div>
        <Button onClick={submit} disabled={upload.isPending}>
          {upload.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Guardar
        </Button>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por título, anotação ou nome do arquivo" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className={SELECT_CLS + ' sm:w-56'} value={kindFilter} onChange={e => setKindFilter(e.target.value)}>
            <option value="">Todos os tipos</option>
            {Object.entries(DOC_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center text-sm text-muted-foreground">
            {docs.length === 0 ? 'Nenhum documento neste perfil ainda.' : 'Nada encontrado com esse filtro.'}
          </div>
        ) : filtered.map(d => {
          const ln = d.linked_type && d.linked_id ? linkName.get(`${d.linked_type}:${d.linked_id}`) : null;
          return (
            <div key={d.id} className="glass-card rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold flex items-center gap-2 break-words"><FileText className="h-4 w-4 shrink-0 text-primary" />{d.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {DOC_KIND_LABELS[d.kind] ?? d.kind}
                    {d.doc_date ? ` · ${fmtDate(d.doc_date)}` : ''}
                    {` · ${d.file_name}`}{d.size_bytes ? ` (${fmtSize(d.size_bytes)})` : ''}
                    {` · enviado em ${fmtDate(d.created_at)}`}
                  </p>
                  {ln && <p className="text-xs text-primary mt-0.5 flex items-center gap-1"><Link2 className="h-3 w-3" />{ln}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => open(d)}><Download className="h-4 w-4 mr-1" />Abrir</Button>
                  <Button size="sm" variant="ghost" title="Editar anotações" onClick={() => { setEditingId(d.id); setEditNotes(d.notes ?? ''); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-expense" title="Excluir" onClick={() => remove(d)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              {editingId === d.id ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveNotes(d)}><Check className="h-4 w-4 mr-1" />Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4 mr-1" />Cancelar</Button>
                  </div>
                </div>
              ) : d.notes ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{d.notes}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
