import { useState, useEffect } from 'react';
import { Settings, Bot, Save, RotateCcw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAiConfig, useUpdateAiConfig } from '@/hooks/useAiConfig';
import { toast } from 'sonner';

const DEFAULT_PROMPT = `Você é o assistente financeiro pessoal do Bill Cash, app de controle financeiro de William Nogueira.

Você tem acesso completo aos dados financeiros do usuário: transações, dívidas, cartões de crédito, contas fixas e metas.

Responda sempre em português brasileiro de forma direta, prática e amigável.

Quando o usuário pedir para lançar dados, criar metas ou fazer ajustes, use as ferramentas disponíveis para executar as ações imediatamente.

Ao sugerir estratégias financeiras, use sempre os dados reais do usuário — nunca dados fictícios.

Hoje é: {{TODAY}}.`;

export default function Configuracoes() {
  const { data: savedPrompt, isLoading } = useAiConfig('system_prompt');
  const update = useUpdateAiConfig();
  const [prompt, setPrompt] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (savedPrompt !== undefined) {
      setPrompt(savedPrompt);
      setDirty(false);
    }
  }, [savedPrompt]);

  const handleSave = async () => {
    try {
      await update.mutateAsync({ key: 'system_prompt', value: prompt });
      toast.success('Prompt salvo! O assistente já usa o novo contexto.');
      setDirty(false);
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  const handleReset = () => {
    setPrompt(DEFAULT_PROMPT);
    setDirty(true);
  };

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
          <Settings className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold">Configurações</h2>
          <p className="text-sm text-muted-foreground">Personalize o comportamento do app</p>
        </div>
      </div>

      {/* AI Prompt */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold text-lg">Prompt do Assistente IA</h3>
          {dirty && (
            <span className="ml-auto text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full font-medium">
              Não salvo
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Este é o contexto que o assistente recebe em toda conversa. Adicione informações sobre
          sua situação financeira, metas de vida, preferências e qualquer contexto relevante.
        </p>

        {/* Tips */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/15 mb-4">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p><span className="text-foreground font-medium">Dicas para um prompt poderoso:</span></p>
            <p>• Descreva sua situação financeira atual (renda, dívidas principais)</p>
            <p>• Liste suas metas de curto e longo prazo</p>
            <p>• Defina o tom que prefere (mais formal, mais direto, etc.)</p>
            <p>• A tag <code className="bg-secondary px-1 rounded">{"{{TODAY}}"}</code> é substituída pela data de hoje automaticamente</p>
          </div>
        </div>

        <Textarea
          value={isLoading ? 'Carregando...' : prompt}
          onChange={e => { setPrompt(e.target.value); setDirty(true); }}
          disabled={isLoading}
          rows={16}
          className="font-mono text-sm resize-none bg-secondary/20 border-border/40"
          placeholder="Digite o contexto do assistente..."
        />

        <div className="flex gap-3 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-2 text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar padrão
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dirty || update.isPending}
            className="gap-2 ml-auto"
          >
            <Save className="h-4 w-4" />
            {update.isPending ? 'Salvando...' : 'Salvar prompt'}
          </Button>
        </div>
      </div>

      {/* Placeholder for future settings */}
      <div className="glass-card rounded-xl p-6 mt-4 opacity-50">
        <h3 className="font-display font-semibold mb-1">Mais configurações em breve</h3>
        <p className="text-sm text-muted-foreground">Tema, moeda, usuários, backup de dados...</p>
      </div>
    </div>
  );
}
