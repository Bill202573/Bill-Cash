import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Trash2, Loader2, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAiAssistant } from '@/hooks/useAiAssistant';

const QUICK_ACTIONS = [
  { label: '📊 Resumo do mês',        prompt: 'Como estão minhas finanças neste mês?' },
  { label: '💳 Status das dívidas',   prompt: 'Quais são minhas dívidas atuais e qual a melhor estratégia para quitá-las?' },
  { label: '📋 Contas fixas',         prompt: 'Quais contas fixas estão pendentes ou atrasadas este mês?' },
  { label: '🎯 Criar objetivo',       prompt: 'Quero criar um objetivo financeiro. Me ajude a estruturar.' },
  { label: '📈 Estratégia poupança',  prompt: 'Com base nas minhas receitas e despesas, quanto consigo poupar por mês e como devo priorizar?' },
  { label: '🧾 Lançar transação',     prompt: 'Quero lançar uma nova transação.' },
];

function MessageBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user';

  // Renderizar markdown básico (negrito, itálico, listas)
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Negrito **texto**
      const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Itálico *texto*
      const italic = bold.replace(/\*(.*?)\*/g, '<em>$1</em>');
      // Lista com -
      if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
        return (
          <li key={i} className="ml-4 list-disc"
            dangerouslySetInnerHTML={{ __html: italic.replace(/^[-•]\s*/, '') }} />
        );
      }
      if (line.trim() === '') return <br key={i} />;
      return (
        <p key={i} dangerouslySetInnerHTML={{ __html: italic }} />
      );
    });
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
      }`}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed space-y-1 ${
        isUser
          ? 'bg-primary text-primary-foreground rounded-tr-sm'
          : 'bg-secondary/60 text-foreground rounded-tl-sm'
      }`}>
        {renderContent(content)}
      </div>
    </div>
  );
}

export default function Assistente() {
  const [input, setInput] = useState('');
  const { messages, loading, sendMessage, clearConversation } = useAiAssistant();
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    await sendMessage(text);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-h-[900px]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold">Assistente IA</h2>
            <p className="text-sm text-muted-foreground">Seu consultor financeiro pessoal</p>
          </div>
        </div>

        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearConversation}
            className="gap-2 text-muted-foreground hover:text-foreground">
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Limpar conversa</span>
          </Button>
        )}
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 glass-card rounded-xl overflow-hidden flex flex-col">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-display font-semibold text-lg mb-1">Olá! Como posso ajudar?</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Posso analisar suas finanças, lançar transações, criar objetivos e sugerir estratégias personalizadas.
                </p>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-lg">
                {QUICK_ACTIONS.map(({ label, prompt }) => (
                  <button
                    key={label}
                    onClick={() => sendMessage(prompt)}
                    disabled={loading}
                    className="text-left px-3 py-2.5 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/60 transition-colors text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
            ))
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="bg-secondary/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Analisando seus dados...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Input area ── */}
        <div className="border-t border-border/30 p-3 flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte algo ou peça para lançar uma transação... (Enter para enviar)"
            className="flex-1 min-h-[44px] max-h-32 resize-none bg-secondary/30 border-border/40 text-sm"
            rows={1}
            disabled={loading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-11 w-11 shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Quick actions inline (quando já tem mensagens) */}
      {messages.length > 0 && !loading && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {QUICK_ACTIONS.slice(0, 4).map(({ label, prompt }) => (
            <button
              key={label}
              onClick={() => sendMessage(prompt)}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-border/50 bg-secondary/30 hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground font-medium"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
