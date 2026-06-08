import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFamily } from '@/hooks/useFamily';

export type ScopeType = 'personal' | 'family';

interface FamilyScopeContextType {
  scope: ScopeType;
  setScope: (scope: ScopeType) => void;
  selectedMemberId: string | null; // UUID do membro selecionado
  setSelectedMemberId: (id: string | null) => void;
  // Helper: retorna o UUID do usuário a usar (current user ou spouse)
  getFilterUserId: () => string | null;
  // Helper: retorna quem está sendo visualizado
  getDisplayName: () => string;
}

const FamilyScopeContext = createContext<FamilyScopeContextType | undefined>(undefined);

export function FamilyScopeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { data: family } = useFamily();
  const [scope, setScope] = useState<ScopeType>('personal');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Reset ao fazer logout
  useEffect(() => {
    if (!user) {
      setScope('personal');
      setSelectedMemberId(null);
    }
  }, [user?.id]);

  const getFilterUserId = (): string | null => {
    if (scope === 'personal') {
      return user?.id ?? null;
    }
    // family scope: retorna null (significa "mostrar de toda a família")
    return null;
  };

  const getDisplayName = (): string => {
    if (scope === 'personal') {
      return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Você';
    }
    return family?.name || 'Família';
  };

  const value: FamilyScopeContextType = {
    scope,
    setScope,
    selectedMemberId,
    setSelectedMemberId,
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
