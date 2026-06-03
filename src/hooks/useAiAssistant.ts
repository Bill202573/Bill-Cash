import { useState, useCallback } from 'react';

const SUPABASE_URL      = 'https://jzonnecthimbvdeutsft.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GFCKtO3G2YwiweQ3S5mKaQ_Dioakamh';

export interface ChatMessage {
  id:         string;
  role:       'user' | 'assistant';
  content:    string;
  created_at: string;
}

// Internal history format for the API
interface ApiMessage {
  role:    string;
  content: string;
  tool_calls?:  unknown[];
  tool_call_id?: string;
}

export function useAiAssistant() {
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [apiHistory, setApiHistory] = useState<ApiMessage[]>([]);
  const [loading,   setLoading]   = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id:         crypto.randomUUID(),
      role:       'user',
      content:    text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ message: text, history: apiHistory }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Erro ${res.status}: ${err}`);
      }

      const json = await res.json();
      if (json.error) throw new Error(json.error);

      // Update history for next turn
      setApiHistory(json.history ?? []);

      const assistantMsg: ChatMessage = {
        id:         crypto.randomUUID(),
        role:       'assistant',
        content:    json.reply || '(sem resposta)',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);

    } catch (e) {
      setMessages(prev => [...prev, {
        id:         crypto.randomUUID(),
        role:       'assistant',
        content:    `Erro ao conectar com o assistente: ${String(e)}`,
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [apiHistory]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setApiHistory([]);
  }, []);

  return { messages, loading, sendMessage, clearConversation };
}
