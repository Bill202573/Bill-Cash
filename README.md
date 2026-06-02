# Sistema de Gestão - Clínica Stelle Odontologia

Aplicação web para gerenciar pacientes, agendamentos e fluxo de atendimento da Clínica Stelle Odontologia.

## Funcionalidades

### 👥 Gerenciamento de Pacientes
- Cadastro simplificado com dados essenciais
- Edição e exclusão de pacientes
- Listagem com informações de contato e endereço

### 📅 Agendamentos
- Calendário visual com visualização por semana
- Slots de 15 minutos
- Criação rápida de agendamentos
- Drag-and-drop para mover agendamentos entre horários/dias
- Status dos agendamentos: Agendado, Sala de Espera, Em Atendimento, Finalizado

### ⏱️ Fluxo na Clínica
- Visualização Kanban dos pacientes do dia
- Cronômetro para tempo de espera
- Cronômetro para tempo de atendimento
- Transição rápida entre estados do paciente

## Tecnologia

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: TailwindCSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL)
- **Hospedagem**: Vercel
- **Domínio**: sistema.stelleodontologia.com.br

## Deploy

O sistema faz deploy automático no Vercel a cada push para `main`:

```bash
git push origin main
```

Acesse em: https://sistema.stelleodontologia.com.br

## Começando

### Variáveis de Ambiente

Crie um arquivo `.env.local`:

```env
VITE_SUPABASE_URL=https://kcdmsvtcrddflfojmcvd.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_JN1oX-xvBsevK9lJm6ufaZvA8nNZGlvXSvK3q6pNEh4Wh3JVc5Jc3rKl9wZm7tY5Lk
```

### Desenvolvimento Local

```bash
npm install
npm run dev
```

Acesse em: http://localhost:5173

### Build para Produção

```bash
npm run build
npm run preview
```

## Estrutura do Projeto

```
src/
├── components/       # Componentes reutilizáveis
│   ├── Header.tsx
│   ├── PatientForm.tsx
│   └── AppointmentForm.tsx
├── pages/           # Páginas principais
│   ├── Home.tsx
│   ├── Patients.tsx
│   ├── Appointments.tsx
│   └── ClinicFlow.tsx
├── lib/
│   └── supabase.ts  # Configuração Supabase
├── App.tsx          # Roteamento
└── main.tsx
```

## Próximas Melhorias

- [ ] Integração SMS/WhatsApp para confirmação de consultas
- [ ] Relatórios de agendamentos
- [ ] Histórico clínico do paciente
- [ ] Controle financeiro/recibos
- [ ] Notificações automáticas
- [ ] Backup automático

## Contato

Para dúvidas ou sugestões, entre em contato com a equipe de desenvolvimento.

---

**Última atualização**: Maio 2026
