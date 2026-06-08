import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export interface FamilyMember {
  id: string;
  user_id: string;
  role: 'admin' | 'member';
  email?: string;
  full_name?: string;
}

export interface FamilyGroup {
  id: string;
  name: string;
  members: FamilyMember[];
}

/**
 * Busca a família do usuário logado
 * Retorna o grupo familiar + todos os membros
 */
export function useFamily() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['family', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // 1) Busca a família do usuário
      const { data: memberData, error: memberError } = await supabase
        .from('family_members')
        .select('family_group_id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberError || !memberData) {
        console.log('[FAMILY] Usuário não tem família registrada');
        return null;
      }

      const familyGroupId = memberData.family_group_id;

      // 2) Busca info da família
      const { data: groupData, error: groupError } = await supabase
        .from('family_groups')
        .select('id, name')
        .eq('id', familyGroupId)
        .maybeSingle();

      if (groupError || !groupData) throw groupError;

      // 3) Busca todos os membros da família
      const { data: membersData, error: membersError } = await supabase
        .from('family_members')
        .select('id, user_id, role')
        .eq('family_group_id', familyGroupId);

      if (membersError) throw membersError;

      // 4) Enriquece com dados de auth (email, full_name)
      // Por enquanto, retorna só os IDs
      const members: FamilyMember[] = (membersData ?? []).map(m => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
      }));

      const family: FamilyGroup = {
        id: groupData.id,
        name: groupData.name,
        members,
      };

      return family;
    },
    enabled: !!user?.id,
  });
}
