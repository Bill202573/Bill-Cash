import { useState, useMemo } from 'react';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCardExpenses, useProjectInstallments } from '@/hooks/useCardExpenses';
import { parseParcela } from '@/lib/parcelas';
import { toast } from 'sonner';
import type { CreditCard, CardBill } from '@/lib/supabase';

interface Props {
  card:        CreditCard;
  currentBill: CardBill;
}

/**
 * Botão retroativo: detecta parcelas em despesas já importadas (na fatura
 * selecionada) e projeta as parcelas futuras nas próximas faturas.
 *
 * Ignora despesas que já tenham purchase_group_id (já foram projetadas).
 */
export function CardProjectParcelasButton({ card, currentBill }: Props) {
  const [working, setWorking] = useState(false);
  const { data: expenses = [] } = useCardExpenses({ cardId: card.id });
  const project = useProjectInstallments();

  // Candidatas: despesas nesta fatura, que parecem parcela, sem grupo ainda
  const candidates = useMemo(() => {
    const inBill = expenses.filter(e => e.bill_id === currentBill.id);
    return inBill
      .map(e => ({ exp: e, parcela: parseParcela(e.description) }))
      .filter(item => item.parcela && !item.exp.purchase_group_id && item.parcela.current < item.parcela.total);
  }, [expenses, currentBill.id]);

  if (candidates.length === 0) return null;

  const handleProject = async () => {
    if (!confirm(
      `Detectei ${candidates.length} compra(s) parcelada(s) nesta fatura sem projeção. ` +
      `Vou criar as parcelas restantes nas faturas dos próximos meses. Continuar?`,
    )) return;

    setWorking(true);
    let projected = 0;
    const errs: string[] = [];

    for (const { exp, parcela } of candidates) {
      try {
        const result = await project.mutateAsync({
          cardId:              card.id,
          closingDay:          card.closing_day,
          dueDay:              card.due_day,
          currentBillMonthRef: currentBill.month_ref,
          baseDescription:     parcela!.baseDescription,
          installmentAmount:   Number(exp.amount),
          currentInstallment:  parcela!.current,
          totalInstallments:   parcela!.total,
          purchaseDate:        exp.purchase_date,
          category:            exp.category ?? undefined,
          subcategory:         exp.subcategory ?? undefined,
        });
        // -1 porque a parcela atual já existia (mas o useProjectInstallments
        // sobrescreve com o mesmo conteúdo — não cria duplicata)
        projected += Math.max(0, result.expenses.length - 1);
      } catch (e: any) {
        console.error('[RETRO PROJECT ERROR]', e);
        errs.push(e?.message ?? String(e));
      }
    }

    setWorking(false);
    if (errs.length === 0) {
      toast.success(`${projected} parcela(s) futura(s) projetada(s) nas próximas faturas`);
    } else {
      toast.warning(`${projected} projetadas, ${errs.length} com erro: ${errs[0]}`);
    }
  };

  return (
    <Button
      onClick={handleProject}
      disabled={working}
      size="sm"
      variant="outline"
      className="gap-2 text-primary border-primary/30"
    >
      <Layers className="h-4 w-4" />
      {working ? 'Projetando...' : `Projetar parcelas futuras (${candidates.length})`}
    </Button>
  );
}
