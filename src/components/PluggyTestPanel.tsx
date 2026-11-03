import { useState } from 'react';
import { Landmark, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';

const DEFAULT_ITEM_ID = '4cd09a75-9c61-4013-8063-f876fc7aa125';

/** Teste somente-leitura da integração Pluggy (não grava nada no banco). */
export function PluggyTestPanel() {
  const [itemId, setItemId] = useState(DEFAULT_ITEM_ID);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');

  const run = async () => {
    setLoading(true);
    setOutput('');
    try {
      const acc = await supabase.functions.invoke('pluggy-sync', { body: { action: 'accounts', itemId } });
      if (acc.error) throw new Error(await errText(acc.error));
      const accounts: { id: string }[] = Array.isArray(acc.data?.accounts) ? acc.data.accounts : [];
      const result: unknown[] = [{ conexao: { authOk: acc.data?.authOk, item: acc.data?.item, accountsHttpStatus: acc.data?.accountsHttpStatus, totalContas: accounts.length } }];
      for (const a of accounts) {
        const prev = await supabase.functions.invoke('pluggy-sync', {
          body: { action: 'preview', accountId: a.id, from: '2026-10-01' },
        });
        result.push({ account: a, preview: prev.error ? { error: await errText(prev.error) } : prev.data });
      }
      setOutput(JSON.stringify(result, null, 2));
    } catch (e) {
      setOutput('ERRO: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 mt-4">
      <div className="flex items-center gap-2 mb-1">
        <Landmark className="h-5 w-5 text-primary" />
        <h3 className="font-display font-semibold text-lg">Teste Pluggy (somente leitura)</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Busca as contas da conexão e um resumo das transações de outubro. Não grava nada.
      </p>
      <div className="flex gap-2 mb-3">
        <Input value={itemId} onChange={e => setItemId(e.target.value)} className="font-mono text-xs" />
        <Button onClick={run} disabled={loading || !itemId} className="gap-2 shrink-0">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Testar Pluggy
        </Button>
      </div>
      {output && (
        <pre className="text-xs bg-secondary/30 rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap">{output}</pre>
      )}
    </div>
  );
}

async function errText(err: unknown): Promise<string> {
  const ctx = (err as { context?: Response }).context;
  if (ctx && typeof ctx.text === 'function') {
    try { return await ctx.text(); } catch { /* ignora */ }
  }
  return (err as Error).message ?? String(err);
}
