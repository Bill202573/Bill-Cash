import { useState, useMemo } from 'react';
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, Tag, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useCategories,
  useDeleteCategory,
  type Category,
} from '@/hooks/useCategories';
import { CategoryForm } from '@/components/CategoryForm';
import { CATEGORY_COLORS } from '@/lib/supabase';
import { toast } from 'sonner';

const TYPE_LABELS = {
  income:  'Receitas',
  expense: 'Despesas',
  both:    'Ambos',
} as const;

const TYPE_COLORS = {
  income:  'text-income',
  expense: 'text-expense',
  both:    'text-primary',
} as const;

export default function Categories() {
  const { data: allCats = [], isLoading } = useCategories();
  const del = useDeleteCategory();

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [addingSubFor, setAddingSubFor] = useState<Category | null>(null);

  const rootCats = useMemo(
    () => allCats.filter(c => c.parent_id === null),
    [allCats],
  );

  const subcatsByParent = useMemo(() => {
    const map = new Map<string, Category[]>();
    allCats.filter(c => c.parent_id).forEach(c => {
      if (!map.has(c.parent_id!)) map.set(c.parent_id!, []);
      map.get(c.parent_id!)!.push(c);
    });
    return map;
  }, [allCats]);

  // Filtra root cats por busca (ou subcats que matchem)
  const visibleRoots = useMemo(() => {
    const lower = search.trim().toLowerCase();
    if (!lower) return rootCats;
    return rootCats.filter(r => {
      if (r.name.toLowerCase().includes(lower)) return true;
      const subs = subcatsByParent.get(r.id) ?? [];
      return subs.some(s => s.name.toLowerCase().includes(lower));
    });
  }, [rootCats, subcatsByParent, search]);

  // Agrupa por tipo
  const grouped = useMemo(() => {
    const byType: Record<'expense' | 'income' | 'both', Category[]> = {
      expense: [],
      income:  [],
      both:    [],
    };
    visibleRoots.forEach(c => byType[c.type as 'expense' | 'income' | 'both']?.push(c));
    return byType;
  }, [visibleRoots]);

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const handleDelete = async (cat: Category) => {
    const subs = subcatsByParent.get(cat.id) ?? [];
    const msg = subs.length > 0
      ? `Esta categoria tem ${subs.length} subcategoria(s). Deletar mesmo assim? (As subcategorias também serão removidas)`
      : `Deletar a categoria "${cat.name}"?\n\nObs: transações que usam esta categoria continuarão existindo, mas sem categoria vinculada na lista.`;
    if (!confirm(msg)) return;
    try {
      // Deleta subcategorias primeiro (FK)
      for (const s of subs) {
        await del.mutateAsync(s.id);
      }
      await del.mutateAsync(cat.id);
      toast.success(`Categoria "${cat.name}" deletada`);
    } catch (e: any) {
      console.error('[DELETE CATEGORY ERROR]', e);
      toast.error('Erro ao deletar: ' + (e?.message ?? String(e)));
    }
  };

  const renderRoot = (cat: Category) => {
    const subs = subcatsByParent.get(cat.id) ?? [];
    const isExpanded = expanded.has(cat.id);
    const color = CATEGORY_COLORS[cat.name] ?? 'hsl(220, 10%, 55%)';

    return (
      <div key={cat.id} className="glass-card rounded-lg overflow-hidden">
        {/* Linha principal */}
        <div className="flex items-center gap-2 p-3 hover:bg-secondary/30 transition-colors">
          <button
            onClick={() => toggleExpand(cat.id)}
            disabled={subs.length === 0}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-1"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />

          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{cat.name}</p>
            <p className="text-xs text-muted-foreground">
              <span className={TYPE_COLORS[cat.type]}>{TYPE_LABELS[cat.type]}</span>
              {subs.length > 0 && ` • ${subs.length} subcategoria(s)`}
            </p>
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => setAddingSubFor(cat)}
              title="Adicionar subcategoria"
              className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setEditing(cat)}
              title="Editar"
              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleDelete(cat)}
              title="Deletar"
              className="p-1.5 rounded hover:bg-expense/10 text-muted-foreground hover:text-expense"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Subcategorias */}
        {isExpanded && subs.length > 0 && (
          <div className="border-t border-border/30 divide-y divide-border/20">
            {subs.map(sub => (
              <div key={sub.id} className="flex items-center gap-2 px-3 py-2 pl-12 hover:bg-secondary/20">
                <span className="text-xs text-muted-foreground">›</span>
                <p className="flex-1 text-sm">{sub.name}</p>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => setEditing(sub)}
                    title="Editar"
                    className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(sub)}
                    title="Deletar"
                    className="p-1 rounded hover:bg-expense/10 text-muted-foreground hover:text-expense"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-display font-bold">Categorias</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {rootCats.length} categoria(s) raiz • {allCats.length - rootCats.length} subcategoria(s)
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova Categoria</span>
        </Button>
      </div>

      {/* Busca */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar categoria ou subcategoria..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="glass-card rounded-lg p-8 text-center text-muted-foreground">
          Carregando...
        </div>
      ) : visibleRoots.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center">
          <Tag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium mb-1">
            {search ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria cadastrada'}
          </p>
          {!search && (
            <Button onClick={() => setShowAdd(true)} className="mt-3 gap-2">
              <Plus className="h-4 w-4" /> Criar primeira categoria
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Despesas */}
          {grouped.expense.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-expense mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-expense rounded-full" />
                Despesas ({grouped.expense.length})
              </h3>
              <div className="space-y-1.5">
                {grouped.expense.map(renderRoot)}
              </div>
            </div>
          )}

          {/* Receitas */}
          {grouped.income.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-income mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-income rounded-full" />
                Receitas ({grouped.income.length})
              </h3>
              <div className="space-y-1.5">
                {grouped.income.map(renderRoot)}
              </div>
            </div>
          )}

          {/* Ambos */}
          {grouped.both.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full" />
                Ambos ({grouped.both.length})
              </h3>
              <div className="space-y-1.5">
                {grouped.both.map(renderRoot)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modais */}
      {showAdd && (
        <CategoryForm open onClose={() => setShowAdd(false)} />
      )}
      {editing && (
        <CategoryForm open onClose={() => setEditing(null)} category={editing} />
      )}
      {addingSubFor && (
        <CategoryForm open onClose={() => setAddingSubFor(null)} parent={addingSubFor} />
      )}
    </div>
  );
}
