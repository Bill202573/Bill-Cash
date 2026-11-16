import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { useAuth } from './useAuth';
import { useFamily } from './useFamily';

export const DOC_BUCKET = 'documents';

export const DOC_KIND_LABELS: Record<string, string> = {
  imposto: 'Imposto / Receita',
  parcelamento: 'Parcelamento',
  contrato: 'Contrato',
  fatura: 'Fatura / Boleto',
  comprovante: 'Comprovante',
  recibo: 'Recibo',
  outro: 'Outro',
};

export interface AppDocument {
  id: string;
  user_id: string | null;
  title: string;
  kind: string;
  notes: string | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  linked_type: 'debt' | 'fixed_bill' | null;
  linked_id: string | null;
  doc_date: string | null;
  created_at: string;
}

export function useDocuments() {
  const { scope, getFilterUserId } = useFamilyScope();
  const { user } = useAuth();
  const { data: family } = useFamily();
  const filterUserId = getFilterUserId();

  return useQuery({
    queryKey: ['documents', scope, filterUserId, user?.id, family?.members],
    queryFn: async () => {
      if (!user?.id) return [] as AppDocument[];
      let q = supabase.from('documents').select('*').order('created_at', { ascending: false });
      if (filterUserId) {
        q = q.eq('user_id', filterUserId);
      } else if (scope === 'family' && family?.members) {
        // Família: só documentos dos membros (documentos de empresa ficam no perfil da empresa)
        q = q.in('user_id', family.members.map(m => m.user_id));
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AppDocument[];
    },
    enabled: !!user?.id,
  });
}

export interface UploadDocInput {
  file: File;
  title: string;
  kind: string;
  notes?: string;
  docDate?: string;
  linkedType?: 'debt' | 'fixed_bill' | null;
  linkedId?: string | null;
}

const safeName = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_');

export function useUploadDocument() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { getFilterUserId } = useFamilyScope();

  return useMutation({
    mutationFn: async (input: UploadDocInput) => {
      const owner = getFilterUserId() ?? user?.id;
      if (!owner) throw new Error('Usuário não autenticado');
      const path = `${owner}/${Date.now()}_${safeName(input.file.name)}`;
      const up = await supabase.storage.from(DOC_BUCKET).upload(path, input.file, {
        contentType: input.file.type || undefined, upsert: false,
      });
      if (up.error) throw up.error;
      const { data, error } = await supabase.from('documents').insert([{
        user_id: owner,
        title: input.title.trim(),
        kind: input.kind,
        notes: input.notes?.trim() || null,
        file_path: path,
        file_name: input.file.name,
        mime_type: input.file.type || null,
        size_bytes: input.file.size,
        linked_type: input.linkedId ? input.linkedType ?? null : null,
        linked_id: input.linkedId || null,
        doc_date: input.docDate || null,
      }]).select().single();
      if (error) {
        await supabase.storage.from(DOC_BUCKET).remove([path]); // não deixa arquivo órfão
        throw error;
      }
      return data as AppDocument;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useUpdateDocumentNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; notes?: string | null; kind?: string }) => {
      const { error } = await supabase.from('documents').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: AppDocument) => {
      const rm = await supabase.storage.from(DOC_BUCKET).remove([doc.file_path]);
      if (rm.error) throw rm.error;
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

/** Link temporário (1h) para abrir/baixar o arquivo do bucket privado */
export async function getDocumentUrl(doc: AppDocument): Promise<string> {
  const { data, error } = await supabase.storage.from(DOC_BUCKET).createSignedUrl(doc.file_path, 3600);
  if (error || !data) throw error ?? new Error('Não foi possível gerar o link');
  return data.signedUrl;
}
