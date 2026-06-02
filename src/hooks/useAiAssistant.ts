import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  tool_calls?: unknown[];
}

export function useAiAssistant() {
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [loading, setLoading]           = useState(false);
  const [responseId, setResponseId]     = useState<string | undefined>();

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
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method:  'POST',
          headers,
          body:    JSON.stringify({ message: text, previous_response_id: responseId }),
        },
      );

      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setResponseId(json.response_id);

      const assistantMsg: ChatMessage = {
        id:         crypto.randomUUID(),
        role:       'assistant',
        content:    json.reply,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      const errMsg: ChatMessage = {
        id:         crypto.randomUUID(),
        role:       'assistant',
        content:    `Erro ao conectar com o assistente: ${String(e)}`,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [responseId]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setResponseId(undefined);
  }, []);

  return { messages, loading, sendMessage, clearConversation };
}
