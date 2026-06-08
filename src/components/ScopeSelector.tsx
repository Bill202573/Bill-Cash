import { Users, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { useFamilyScope } from '@/contexts/FamilyContext';
import { useFamily } from '@/hooks/useFamily';
import { useAuth } from '@/hooks/useAuth';

export function ScopeSelector() {
  const { scope, setScope, getDisplayName } = useFamilyScope();
  const { user } = useAuth();
  const { data: family } = useFamily();

  if (!user || !family) return null;

  const displayName = getDisplayName();
  const memberCount = family.members.length;

  return (
    <DropdownMenu>
      <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors text-sm max-w-xs">
        {scope === 'personal' ? (
          <User className="h-4 w-4 text-primary flex-shrink-0" />
        ) : (
          <Users className="h-4 w-4 text-primary flex-shrink-0" />
        )}
        <span className="font-medium truncate">{displayName}</span>
      </button>

      <DropdownMenuContent align="start" className="w-56">
        <div className="px-2 py-1.5 text-sm font-semibold">
          {family.name} ({memberCount})
        </div>
        <DropdownMenuSeparator />

        {/* Opção: Pessoal */}
        <DropdownMenuCheckboxItem
          checked={scope === 'personal'}
          onCheckedChange={() => setScope('personal')}
          className="cursor-pointer"
        >
          <User className="h-4 w-4 mr-2" />
          <span>
            {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Você'}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">(Pessoal)</span>
        </DropdownMenuCheckboxItem>

        {/* Outros membros (se houver) */}
        {family.members.length > 1 && (
          <>
            <DropdownMenuSeparator />
            {family.members
              .filter(m => m.user_id !== user.id)
              .map(member => (
                <DropdownMenuCheckboxItem
                  key={member.id}
                  checked={scope === 'personal' && false} // Outros membros não são selecionáveis por enquanto
                  disabled
                  className="cursor-not-allowed opacity-50"
                >
                  <User className="h-4 w-4 mr-2" />
                  <span>{member.user_id}</span>
                  <span className="ml-auto text-xs text-muted-foreground">(Em breve)</span>
                </DropdownMenuCheckboxItem>
              ))}
          </>
        )}

        <DropdownMenuSeparator />

        {/* Opção: Família */}
        <DropdownMenuCheckboxItem
          checked={scope === 'family'}
          onCheckedChange={() => setScope('family')}
          className="cursor-pointer"
        >
          <Users className="h-4 w-4 mr-2" />
          <span>{family.name}</span>
          <span className="ml-auto text-xs text-muted-foreground">(Família)</span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {scope === 'personal'
            ? 'Mostrando suas despesas pessoais'
            : 'Mostrando despesas da família'}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
