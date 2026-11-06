import { useEffect, useState } from 'react';
import { CheckCircle2, Link2, Loader2, MessageCircle, QrCode, Save, Send, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';

interface Contact { id: string; phone: string; label: string; user_id: string; can_launch: boolean }
interface Cfg { url: string; hasKey: boolean; instance: string; webhookUrl: string | null; contacts: Contact[] }

const PEOPLE = [
  { label: 'William', user_id: '5a2e9e85-839a-4057-9655-2a0c0e6638c5' },
  { label: 'Késya', user_id: 'fb57cc01-a770-4d16-aeb5-e0e90a2ef7ee' },
];

async function errText(err: unknown): Promise<string> {
  const ctx = (err as { context?: Response }).context;
  if (ctx && typeof ctx.text === 'function') {
    try { return await ctx.text(); } catch { /* ignora */ }
  }
  return (err as Error).message ?? String(err);
}

async function call<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const res = await supabase.functions.invoke('whatsapp-admin', { body });
  if (res.error) {
    const t = await errText(res.error);
    try { throw new Error(JSON.parse(t).error ?? t); } catch (e) { throw e instanceof Error ? e : new Error(t); }
  }
  const data = res.data as T & { error?: string };
  if (data?.error) throw new Error(data.error);
  return data;
}

const STATE_LABEL: Record<string, { text: string; cls: string }> = {
  open: { text: 'Conectado', cls: 'bg-emerald-500/15 text-emerald-600' },
  connecting: { text: 'Aguardando leitura do QR code', cls: 'bg-amber-500/15 text-amber-600' },
  close: { text: 'Desconectado', cls: 'bg-red-500/15 text-red-600' },
  inexistente: { text: 'Instância ainda não criada', cls: 'bg-secondary text-muted-foreground' },
};

/** Conexão do WhatsApp (Evolution API): configurar, ler o QR code e escolher quem pode lançar por mensagem */
export function WhatsAppPanel() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [url, setUrl] = useState('');
  const [apikey, setApikey] = useState('');
  const [instance, setInstance] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [pairing, setPairing] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [person, setPerson] = useState(PEOPLE[0].label);

  const load = async () => {
    try {
      const c = await call<Cfg>({ action: 'get' });
      setCfg(c); setUrl(c.url ?? ''); setInstance(c.instance ?? '');
    } catch (e) { toast.error('Não consegui carregar o WhatsApp: ' + (e as Error).message); }
  };
  useEffect(() => { void load(); }, []);

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  const save = () => run('save', async () => {
    await call({ action: 'save', url, apikey, instance });
    setApikey('');
    toast.success('Configuração salva');
    await load();
  });
  const connect = () => run('connect', async () => {
    await call({ action: 'save', url, apikey, instance });
    setApikey('');
    const r = await call<{ state: string; qr: string | null; pairing: string | null; webhookOk: boolean; webhookDetail?: string }>({ action: 'connect' });
    setState(r.state); setQr(r.qr); setPairing(r.pairing);
    if (!r.webhookOk) toast.error('Instância ok, mas não consegui registrar o webhook: ' + (r.webhookDetail ?? ''));
    else if (r.state === 'open') toast.success('WhatsApp já está conectado e pronto para receber mensagens');
    else toast.success('Leia o QR code com o WhatsApp do número que vai receber as mensagens');
    await load();
  });
  const refreshStatus = () => run('status', async () => {
    const r = await call<{ state: string }>({ action: 'status' });
    setState(r.state);
    if (r.state === 'open') setQr(null);
  });
  const test = (p: string) => run('test' + p, async () => {
    await call({ action: 'test', phone: p });
    toast.success('Mensagem de teste enviada');
  });
  const addContact = () => run('contact', async () => {
    const who = PEOPLE.find((x) => x.label === person)!;
    await call({ action: 'contact_save', phone, label: who.label, user_id: who.user_id, can_launch: true });
    setPhone('');
    await load();
  });
  const delContact = (id: string) => run('del' + id, async () => { await call({ action: 'contact_delete', id }); await load(); });

  const st = state ? STATE_LABEL[state] ?? { text: state, cls: 'bg-secondary text-muted-foreground' } : null;

  return (
    <div className="glass-card rounded-xl p-6 mt-4">
      <div className="flex items-center gap-2 mb-1">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h3 className="font-display font-semibold text-lg">WhatsApp</h3>
        {st && <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.text}</span>}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Conecte um número de WhatsApp (via Evolution API) para lançar receitas e despesas por mensagem.
        Só os números cadastrados abaixo são atendidos, e nada é gravado sem você responder SIM.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="wa-url">URL da Evolution API</Label>
          <Input id="wa-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://sua-evolution.exemplo.com" />
          <p className="text-xs text-muted-foreground">Onde ela está rodando.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-key">Chave (apikey)</Label>
          <Input id="wa-key" type="password" value={apikey} onChange={(e) => setApikey(e.target.value)} placeholder={cfg?.hasKey ? '••••••••••••' : 'cole a chave'} autoComplete="off" />
          <p className="text-xs text-muted-foreground">{cfg?.hasKey ? 'Já configurada. Deixe em branco para manter.' : 'Ainda não configurada.'}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-inst">Nome da instância</Label>
          <Input id="wa-inst" value={instance} onChange={(e) => setInstance(e.target.value)} placeholder="billcash" />
          <p className="text-xs text-muted-foreground">Criada automaticamente se não existir.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <Button variant="outline" size="sm" className="gap-2" onClick={save} disabled={!!busy}>
          {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
        </Button>
        <Button size="sm" className="gap-2" onClick={connect} disabled={!!busy || !url || !instance || (!cfg?.hasKey && !apikey)}>
          {busy === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Conectar / mostrar QR code
        </Button>
        <Button variant="ghost" size="sm" className="gap-2" onClick={refreshStatus} disabled={!!busy || !cfg?.hasKey}>
          {busy === 'status' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Verificar conexão
        </Button>
      </div>

      {qr && (
        <div className="mt-4 flex flex-col sm:flex-row items-start gap-4 p-4 rounded-lg bg-secondary/30 border border-border/40">
          <img src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`} alt="QR code do WhatsApp" className="w-48 h-48 bg-white rounded-md p-1" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="flex items-center gap-1.5 text-foreground font-medium"><QrCode className="h-4 w-4" /> Como conectar</p>
            <p>No celular do número escolhido: WhatsApp → Aparelhos conectados → Conectar um aparelho → leia este QR code.</p>
            {pairing && <p>Ou use o código de pareamento: <span className="font-mono text-foreground">{pairing}</span></p>}
            <p>Depois clique em “Verificar conexão”.</p>
          </div>
        </div>
      )}

      {/* Contatos autorizados */}
      <div className="mt-6">
        <h4 className="font-medium text-sm mb-2">Quem pode falar com o Bill Cash</h4>
        <div className="space-y-2">
          {(cfg?.contacts ?? []).map((c) => (
            <div key={c.id} className="flex items-center gap-3 text-sm p-2.5 rounded-lg bg-secondary/20">
              <span className="font-medium w-20">{c.label}</span>
              <span className="font-mono text-muted-foreground">+{c.phone}</span>
              <Button variant="ghost" size="sm" className="ml-auto gap-1.5 h-8" onClick={() => test(c.phone)} disabled={!!busy || !cfg?.hasKey}>
                {busy === 'test' + c.phone ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Teste
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => delContact(c.id)} disabled={!!busy} aria-label={`Remover ${c.label}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {cfg && cfg.contacts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum número cadastrado.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5521999999999" className="w-48" inputMode="numeric" />
          <select value={person} onChange={(e) => setPerson(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {PEOPLE.map((p) => <option key={p.label}>{p.label}</option>)}
          </select>
          <Button variant="outline" size="sm" className="gap-2" onClick={addContact} disabled={!!busy || phone.replace(/\D/g, '').length < 10}>
            <UserPlus className="h-4 w-4" /> Adicionar número
          </Button>
        </div>
      </div>

      <div className="mt-5 text-xs text-muted-foreground space-y-1">
        <p><span className="text-foreground font-medium">Exemplos de mensagem:</span> “Késya recebeu 500 em dinheiro hoje”, “paguei 80 de gasolina”, “gastei 35,90 no mercado ontem”.</p>
        <p>O app responde com o resumo e só grava depois do seu SIM. Cada pessoa lança apenas nas próprias contas.</p>
      </div>
    </div>
  );
}
