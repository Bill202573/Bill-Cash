# Sistema de Gestão - Clínica Stelle Odontologia

## Visão Geral
Sistema web simples para gestão de uma clínica odontológica com 1 dentista. Foco em cadastro de pacientes e agendamentos com fluxo simplificado.

---

## 1. FUNCIONALIDADES PRINCIPAIS

### 1.1 Cadastro de Paciente (Simplificado)
- Uma tela única com dados essenciais:
  - **Dados Básicos**: Nome completo, sexo, data nascimento, CPF
  - **Contato**: Telefone(s), e-mail
  - **Endereço**: CEP, endereço, número, complemento, cidade, estado
  - **Informações Adicionais**: Foto (opcional), profissão
- Ações: Novo, Editar, Excluir, Visualizar

### 1.2 Agendamentos
- **Calendário**: Visual por semana, slots de 15 min
- **Criar Agendamento**: 
  - Escolher dia + horário
  - Selecionar paciente (busca/novo)
  - Tipo de consulta (Consulta, Avaliação, Limpeza)
  - Duração (15, 30, 45, 60 min)
  - Observações
- **Arrastar**: Mover agendamentos entre horários/dias
- **Fluxo do Dia**:
  - Agendados para hoje
  - Sala de espera (com cronômetro)
  - Consultório (com cronômetro)
  - Finalizado

---

## 2. MODELO DE DADOS (Supabase Existente)

### Tabela: `patients`
```
id (UUID, PK)
name (varchar) - Nome completo
cpf (varchar, unique)
rg (varchar)
gender (varchar) - M/F
marital_status (varchar) - Solteiro, Casado, etc
profession (varchar)
street (varchar) - Rua
number (varchar) - Número
complement (varchar) - Apto, complemento
neighborhood (varchar) - Bairro
allergies (text)
chronic_diseases (text)
medications (text)
pregnancy_status (boolean)
phone (varchar)
created_at (timestamp)
```

### Tabela: `appointments`
```
id (UUID, PK)
patient_id (UUID, FK → patients)
professional_id (UUID, FK → professionals)
appointment_date (date)
appointment_time (time)
duration_minutes (integer) - 15, 30, 45, 60
procedure (varchar) - Obturação, Consulta, Limpeza, etc
status (varchar) - scheduled, completed, cancelled
observations (text)
whatsapp_confirmed (boolean)
created_at (timestamp)
```

### Tabela: `professionals`
```
id (UUID, PK)
name (varchar)
specialty (varchar)
phone (varchar)
email (varchar)
created_at (timestamp)
```

**Status dos agendamentos:**
- `scheduled` - Agendado
- `checked_in` - Paciente chegou (sala de espera)
- `in_progress` - Em atendimento
- `completed` - Finalizado
- `cancelled` - Cancelado

---

## 3. FLUXOS

### Fluxo de Novo Agendamento
1. Ir para Agendamentos
2. Escolher dia + horário no calendário
3. Selecionar paciente (existente ou novo)
4. Definir tipo e duração
5. Salvar

### Fluxo do Paciente no Dia
```
[Agendado] 
  ↓ (Paciente chega, clica "Registrar Chegada")
[Sala de Espera] ⏱️ (cronômetro)
  ↓ (Dentista chama)
[Consultório] ⏱️ (cronômetro zera, começa novo)
  ↓ (Termina atendimento)
[Finalizado]
```

---

## 4. TECNOLOGIA

- **Frontend**: Next.js + React + TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + APIs)
- **UI**: Componentes customizados/TailwindCSS
- **Hospedagem**: Vercel (Frontend) + Supabase (Backend)

---

## 5. PLANO DE DESENVOLVIMENTO (MVP)

### Fase 1: Setup
- [x] Supabase pronto (projeto existente)
- [ ] Next.js + TypeScript
- [ ] Variáveis de ambiente (.env.local)
- [ ] Conexão com Supabase (supabase-js)

### Fase 2: Páginas Principais
- [ ] Dashboard/Home
- [ ] Lista de Pacientes
- [ ] Nova Consulta / Editar Paciente
- [ ] Calendário de Agendamentos
- [ ] Fluxo do Dia (Agendados → Esperando → Atendendo)

### Fase 3: Funcionalidades
- [ ] CRUD Pacientes (Create, Read, Update, Delete)
- [ ] CRUD Agendamentos
- [ ] Drag & drop de agendamentos
- [ ] Cronômetro de espera/atendimento
- [ ] Transição de status (Agendado → Chegou → Atendendo → Finalizado)

### Fase 4: Próximos Passos (Fora do Escopo Inicial)
- [ ] Integração WhatsApp/SMS para confirmação
- [ ] Relatórios de agendamentos
- [ ] Histórico clínico do paciente
- [ ] Financeiro/Recibos
- [ ] Dark mode / Temas

