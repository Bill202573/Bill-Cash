import { useState } from 'react';
import { Copy, Landmark, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

interface Conn {
  key: string;
  label: string;
  itemId: string;
  appAccount: string;
  from: string;
  ownerUserId?: string;
  userLabel?: string;
  cardName?: string;
  closingDay?: number;
  dueDay?: number;
  fromMonth?: string;
}

const CONNECTIONS: Conn[] = [
  {
    key: 'william', label: 'Nubank William (PF)', itemId: '416a7475-8377-4325-956a-ccc582906a29', appAccount: 'Nubank William', from: '2026-10-01',
    cardName: 'Nubank William', closingDay: 28, dueDay: 4, fromMonth: '2026-01',
  },
  {
    key: 'wn', label: 'Nubank WN (PJ)', itemId: 'd7f6e808-146e-4954-9636-836f9111bca9', appAccount: 'Nubank WN', from: '2026-10-01',
    cardName: 'Nubank WN', closingDay: 28, dueDay: 4, fromMonth: '2026-01',
  },
  {
    key: 'kesya', label: 'Nubank Késya', itemId: '940e0afb-50ce-4cbc-9893-1c51a727272e', appAccount: 'Nubank Késya', from: '2026-09-01',
    ownerUserId: 'fb57cc01-a770-4d16-aeb5-e0e90a2ef7ee', userLabel: 'Késya', cardName: 'Nubank Késya',
  },
];

async function errText(err: unknown): Promise<string> {
  const ctx = (err as { context?: Response }).context;
  if (ctx && typeof ctx.text === 'function') {
    try { return await ctx.text(); } catch { /* ignora */ }
  }
  return (err as Error).message ?? String(err);
}

/** Sincronização Pluggy: simula (não grava) e grava só depois de confirmação. */
export function PluggyTestPanel() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [output, setOutput] = useState('');
  const [simulated, setSimulated] = useState<string | null>(null);

  const run = async (c: Conn, apply: boolean) => {
    setBusy(c.key + (apply ? ':apply' : ':sim'));
    setOutput('');
    try {
      const acc = await supabase.functions.invoke('pluggy-sync', { body: { action: 'accounts', itemId: c.itemId } });
      if (acc.error) throw new Error(await errText(acc.error));
      const bank = (acc.data?.accounts ?? []).find((a: { type: string }) => a.type === 'BANK');
      if (!bank) throw new Error('Nenhuma conta corrente nessa conexão: ' + JSON.stringify(acc.data));
      const res = await supabase.functions.invoke('pluggy-sync', {
        body: {
          action: 'sync', itemId: c.itemId, accountId: bank.id, appAccount: c.appAccount, from: c.from, apply,
          ownerUserId: c.ownerUserId, userLabel: c.userLabel,
        },
      });
      if (res.error) throw new Error(await errText(res.error));
      setOutput(JSON.stringify(res.data, null, 2));
      if (apply) {
        setSimulated(null);
        qc.invalidateQueries();
      } else {
        setSimulated(c.key);
      }
    } catch (e) {
      setOutput('ERRO: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  /** Somente leitura: lista o(s) cartão(ões) da conexão e as compras (inclui parcelas futuras) */
  const readCard = async (c: Conn) => {
    setBusy(c.key + ':card');
    setOutput('');
    try {
      const res = await supabase.functions.invoke('pluggy-card-read', { body: { itemId: c.itemId } });
      if (res.error) throw new Error(await errText(res.error));
      setOutput(JSON.stringify(res.data, null, 2));
    } catch (e) {
      setOutput('ERRO: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  /** Cartão: simula (não grava) ou grava faturas e compras do cartão da conexão */
  const runCard = async (c: Conn, apply: boolean) => {
    setBusy(c.key + (apply ? ':capply' : ':csim'));
    setOutput('');
    try {
      const res = await supabase.functions.invoke('pluggy-card-sync', {
        body: {
          itemId: c.itemId, cardName: c.cardName, ownerUserId: c.ownerUserId, apply,
          closingDay: c.closingDay, dueDay: c.dueDay, fromMonth: c.fromMonth,
        },
      });
      if (res.error) throw new Error(await errText(res.error));
      setOutput(JSON.stringify(res.data, null, 2));
      setSimulated(apply ? null : c.key + ':card');
      if (apply) qc.invalidateQueries();
    } catch (e) {
      setOutput('ERRO: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  /** Diagnóstico do cartão: lista item a item o que compõe fatura aberta e parcelas futuras (somente leitura) */
  const debugCard = async (c: Conn) => {
    setBusy(c.key + ':cdebug');
    setOutput('');
    try {
      const res = await supabase.functions.invoke('pluggy-card-debug2', { body: { itemId: c.itemId } });
      if (res.error) throw new Error(await errText(res.error));
      setOutput(JSON.stringify(res.data, null, 2));
    } catch (e) {
      setOutput('ERRO: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const confirmCardApply = (c: Conn) => {
    if (confirm(`Gravar o cartão "${c.cardName}" (faturas e compras) no app? Confira o resumo da simulação antes.`)) runCard(c, true);
  };

  const confirmApply = (c: Conn) => {
    if (confirm(`Gravar as transações novas de "${c.label}" no app? Confira o resumo da simulação antes.`)) run(c, true);
  };

  return (
    <div className="glass-card rounded-xl p-6 mt-4">
      <div className="flex items-center gap-2 mb-1">
        <Landmark className="h-5 w-5 text-primary" />
        <h3 className="font-display font-semibold text-lg">Sincronização bancária (Pluggy)</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Primeiro clique em <strong>Simular</strong> (não grava nada). Se o resumo estiver certo, clique em <strong>Gravar</strong>.
      </p>
      <div className="space-y-2 mb-3">
        {CONNECTIONS.map(c => (
          <div key={c.key} className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium w-44">{c.label}</span>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run(c, false)} className="gap-2">
              {busy === c.key + ':sim' && <Loader2 className="h-4 w-4 animate-spin" />}
              Simular
            </Button>
            <Button size="sm" disabled={!!busy || simulated !== c.key} onClick={() => confirmApply(c)} className="gap-2">
              {busy === c.key + ':apply' && <Loader2 className="h-4 w-4 animate-spin" />}
              Gravar
            </Button>
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => readCard(c)} className="gap-2">
              {busy === c.key + ':card' && <Loader2 className="h-4 w-4 animate-spin" />}
              Ler cartão
            </Button>
            {c.cardName && (
              <>
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => runCard(c, false)} className="gap-2">
                  {busy === c.key + ':csim' && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simular cartão
                </Button>
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => debugCard(c)} className="gap-2">
                  {busy === c.key + ':cdebug' && <Loader2 className="h-4 w-4 animate-spin" />}
                  Diagnóstico cartão
                </Button>
                <Button size="sm" disabled={!!busy || simulated !== c.key + ':card'} onClick={() => confirmCardApply(c)} className="gap-2">
                  {busy === c.key + ':capply' && <Loader2 className="h-4 w-4 animate-spin" />}
                  Gravar cartão
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
      {output && (
        <>
          <div className="flex justify-end mb-1">
            <Button
              size="sm" variant="ghost" className="gap-1 h-7 text-xs"
              onClick={async () => {
                try { await navigator.clipboard.writeText(output); toast.success('Resultado copiado'); }
                catch { toast.error('Não foi possível copiar'); }
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copiar resultado
            </Button>
          </div>
          <pre className="text-xs bg-secondary/30 rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap">{output}</pre>
        </>
      )}
    </div>
  );
}
