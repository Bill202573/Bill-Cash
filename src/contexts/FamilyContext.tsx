import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFamily } from '@/hooks/useFamily';
import { useEntities } from '@/hooks/useEntities';

export type ScopeType = 'personal' | 'family' | 'entity';

interface FamilyScopeContextType {
  scope: ScopeType;
  setScope: (scope: ScopeType) => void;
  selectedMemberId: string | null; // UUID do membro selecionado
  setSelectedMemberId: (id: string | null) => void;
  /** Perfil de empresa selecionado (scope 'entity'): dados separados da família */
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
  // Helper: retorna o UUID do usuário a usar (current user ou spouse)
  getFilterUserId: () => string | null;
  // Helper: retorna quem está sendo visualizado
  getDisplayName: () => string;
}

const FamilyScopeContext = createContext<FamilyScopeContextType | undefined>(undefined);

export function FamilyScopeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: family } = useFamily();
  const { data: entities = [] } = useEntities();
  const [scope, setScope] = useState<ScopeType>('personal');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Reset ao fazer logout
  useEffect(() => {
    if (!user) {
      setScope('personal');
      setSelectedMemberId(null);
      setSelectedEntityId(null);
    }
  }, [user?.id]);

  const getFilterUserId = (): string | null => {
    // Empresa: os dados dela ficam sob o id da entidade (nunca entram nas somas da família)
    if (scope === 'entity') return selectedEntityId;
    if (scope === 'personal') {
      return user?.id ?? null;
    }
    // family scope: um membro específico selecionado → filtra só ele.
    // Nenhum selecionado → retorna null (significa "mostrar de toda a família")
    if (selectedMemberId) return selectedMemberId;
    return null;
  };

  const getDisplayName = (): string => {
    if (scope === 'entity') return entities.find(e => e.id === selectedEntityId)?.name ?? 'Empresa';
    if (scope === 'personal') {
      return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Você';
    }
    if (selectedMemberId) {
      const member = family?.members.find(m => m.user_id === selectedMemberId);
      return member?.full_name || member?.email?.split('@')[0] || 'Membro';
    }
    return family?.name || 'Família';
  };

  const value: FamilyScopeContextType = {
    scope,
    setScope,
    selectedMemberId,
    setSelectedMemberId,
    selectedEntityId,
    setSelectedEntityId,
    getFilterUserId,
    getDisplayName,
  };

  return (
    <FamilyScopeContext.Provider value={value}>
      {children}
    </FamilyScopeContext.Provider>
  );
}

export function useFamilyScope() {
  const context = useContext(FamilyScopeContext);
  if (!context) {
    throw new Error('useFamilyScope deve ser usado dentro de <FamilyScopeProvider>');
  }
  return context;
}
