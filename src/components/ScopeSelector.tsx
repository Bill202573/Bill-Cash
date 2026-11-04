import { Building2, Users, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { useFamily } from '@/hooks/useFamily';
import { useEntities } from '@/hooks/useEntities';
import { useAuth } from '@/hooks/useAuth';

export function ScopeSelector() {
  const { scope, setScope, selectedMemberId, setSelectedMemberId, selectedEntityId, setSelectedEntityId, getDisplayName } = useFamilyScope();
  const { data: entities = [] } = useEntities();
  const { user } = useAuth();
  const { data: family, isLoading } = useFamily();

  if (!user) return null;

  const displayName = getDisplayName();
  const memberCount = family?.members.length ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors text-sm max-w-xs w-full justify-start">
          {scope === 'entity' ? (
            <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
          ) : scope === 'personal' ? (
            <User className="h-4 w-4 text-primary flex-shrink-0" />
          ) : (
            <Users className="h-4 w-4 text-primary flex-shrink-0" />
          )}
          <span className="font-medium truncate">{displayName}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        {isLoading ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">Carregando...</div>
        ) : family ? (
          <>
            <div className="px-2 py-1.5 text-sm font-semibold">
              {family.name} ({memberCount})
            </div>
            <DropdownMenuSeparator />

            {/* Opção: Pessoal */}
            <DropdownMenuCheckboxItem
              checked={scope === 'personal'}
              onCheckedChange={() => { setScope('personal'); setSelectedMemberId(null); setSelectedEntityId(null); }}
              className="cursor-pointer"
            >
              <User className="h-4 w-4 mr-2" />
              <span>
                {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Você'}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">(Pessoal)</span>
            </DropdownMenuCheckboxItem>

            {/* Outros membros (se houver) — ver individualmente as despesas de cada um */}
            {family.members.length > 1 && (
              <>
                <DropdownMenuSeparator />
                {family.members
                  .filter(m => m.user_id !== user.id)
                  .map(member => (
                    <DropdownMenuCheckboxItem
                      key={member.id}
                      checked={scope === 'family' && selectedMemberId === member.user_id}
                      onCheckedChange={() => { setScope('family'); setSelectedMemberId(member.user_id); setSelectedEntityId(null); }}
                      className="cursor-pointer"
                    >
                      <User className="h-4 w-4 mr-2" />
                      <span>{member.full_name || member.email?.split('@')[0] || 'Membro'}</span>
                      <span className="ml-auto text-xs text-muted-foreground">(Individual)</span>
                    </DropdownMenuCheckboxItem>
                  ))}
              </>
            )}

            <DropdownMenuSeparator />

            {/* Opção: Família (agregado de todos os membros) */}
            <DropdownMenuCheckboxItem
              checked={scope === 'family' && !selectedMemberId}
              onCheckedChange={() => { setScope('family'); setSelectedMemberId(null); setSelectedEntityId(null); }}
              className="cursor-pointer"
            >
              <Users className="h-4 w-4 mr-2" />
              <span>{family.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">(Família)</span>
            </DropdownMenuCheckboxItem>

            {/* Empresas: perfis separados, fora das somas da família */}
            {entities.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 pt-1 text-[10px] uppercase tracking-wide text-muted-foreground">Empresas (separadas da família)</div>
                {entities.map(en => (
                  <DropdownMenuCheckboxItem
                    key={en.id}
                    checked={scope === 'entity' && selectedEntityId === en.id}
                    onCheckedChange={() => { setScope('entity'); setSelectedMemberId(null); setSelectedEntityId(en.id); }}
                    className="cursor-pointer"
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    <span>{en.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">(PJ)</span>
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            )}

            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {scope === 'entity'
                ? `Mostrando só a empresa ${getDisplayName()}, separada da família`
                : scope === 'personal'
                ? 'Mostrando suas despesas pessoais'
                : selectedMemberId
                  ? `Mostrando despesas de ${getDisplayName()}`
                  : 'Mostrando despesas de toda a família'}
            </div>
          </>
        ) : (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            Nenhuma família encontrada
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
