# 🔐 Solução de Importação Segura - Dados de Saúde

**Versão:** 1.0  
**Projeto:** Stelle Odontologia - Sistema de Gestão de Clínica  
**Data:** 2026-08-17  
**Tipo:** Migração de Dados com Segurança Máxima

---

## 📋 Resumo Executivo

Solução completa para importar dados do Controle Odonto para o novo sistema Stelle, com:
- ✅ Validação de CPF (algoritmo de dígitos verificadores)
- ✅ Detecção de duplicatas antes da importação
- ✅ Preview interativo para confirmar dados
- ✅ Edição durante preview (segurança dupla)
- ✅ Log auditável de todas as importações
- ✅ Importação gradual (1 paciente por vez)

---

## 🎯 Mapeamento de Colunas

**Planilha Controle Odonto → Banco Stelle:**

| Controle Odonto | Campo | Tipo | Obrigatório | Validação |
|---|---|---|---|---|
| Nome Completo | name | VARCHAR | ✅ | Não vazio |
| CPF | cpf | VARCHAR | ✅ | Formato + DV |
| Sexo | gender | CHAR(1) | ✅ | M/F |
| Celulares / Telefones | phone | VARCHAR | ⚠️ | Formato telefone |
| Endereço | street | VARCHAR | ⚠️ | Não vazio |
| Número | number | VARCHAR | ⚠️ | Não vazio |
| Bairro | neighborhood | VARCHAR | ⚠️ | Não vazio |
| Data Nascimento | birth_date | DATE | ❌ | Formato data |
| N° Prontuário | source_id | VARCHAR | ❌ | Referência externa |
| Profissão | profession | VARCHAR | ❌ | - |
| RG | rg | VARCHAR | ❌ | - |
| Email | email | VARCHAR | ❌ | Formato email |
| Data Cadastro | created_at | TIMESTAMP | ❌ | - |

---

## 🔍 Validações de Segurança

### 1. **Validação de CPF**
```typescript
// Implementação de Módulo 11 (verificação de dígitos)
const validateCPF = (cpf: string): boolean => {
  const cleaned = cpf.replace(/\D/g, '')
  
  // Regras
  if (cleaned.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cleaned)) return false  // Todos iguais
  
  // Primeiro dígito
  let sum = 0
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleaned[i - 1]) * (11 - i)
  }
  let remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cleaned[9])) return false
  
  // Segundo dígito
  sum = 0
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleaned[i - 1]) * (12 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cleaned[10])) return false
  
  return true
}
```

### 2. **Detecção de Duplicatas**
```typescript
// Buscar CPFs existentes
const { data: existingPatients } = await supabase
  .from('patients')
  .select('cpf')

const existingCPFs = new Set(
  existingPatients?.map(p => p.cpf.replace(/\D/g, ''))
)

// Comparar novo CPF
const isNewCPF = !existingCPFs.has(cleanCPF)
```

### 3. **Avisos de Integridade**
```typescript
// Campos obrigatórios
if (!name) warnings.push('Nome completo não encontrado')
if (!cpfValid) warnings.push('CPF inválido')
if (isDuplicate) warnings.push('CPF já existe no sistema')
if (!phoneValid) warnings.push('Telefone inválido ou ausente')

// Bloqueio de importação
const canImport = cpfValid && !isDuplicate && name && phoneValid
```

---

## 📊 Fluxo de Importação (4 Etapas)

```
┌─────────────────────────────────────────────────────────┐
│ ETAPA 1: UPLOAD & PARSING                               │
├─────────────────────────────────────────────────────────┤
│ 1. Usuário seleciona arquivo Excel/CSV                  │
│ 2. Sistema lê com biblioteca XLSX                       │
│ 3. Valida estrutura (colunas esperadas)                 │
│ 4. Extrai dados em formato JSON                         │
│ Status: ✅ 1 arquivo = N pacientes parseados            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ ETAPA 2: VALIDAÇÃO INDIVIDUAL                           │
├─────────────────────────────────────────────────────────┤
│ Para cada paciente:                                     │
│ 1. Validar CPF (módulo 11)                              │
│ 2. Verificar se já existe (duplicata)                   │
│ 3. Validar telefone                                     │
│ 4. Gerar lista de avisos                                │
│ Status: ✅ Cada paciente tem flags de validação        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ ETAPA 3: PREVIEW & EDIÇÃO                               │
├─────────────────────────────────────────────────────────┤
│ Para cada paciente (um de cada vez):                    │
│ 1. Mostrar dados na tela                                │
│ 2. Mostrar avisos de validação                          │
│ 3. Permitir EDITAR antes de confirmar                   │
│ 4. Opções: Confirmar | Pular | Voltar                   │
│ Status: ✅ Usuário revisa + pode corrigir               │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ ETAPA 4: SALVAR + LOG                                   │
├─────────────────────────────────────────────────────────┤
│ 1. INSERT em patients (Supabase)                        │
│ 2. INSERT em patient_imports (auditoria)                │
│ 3. Mostrar confirmação                                  │
│ 4. Próximo paciente ou finalizar                        │
│ Status: ✅ Registro criado + log de auditoria           │
└─────────────────────────────────────────────────────────┘
```

---

## 💾 Schema do Banco de Dados

### Tabela: `patient_imports` (Auditoria)
```sql
CREATE TABLE patient_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  patient_name VARCHAR NOT NULL,
  patient_cpf VARCHAR NOT NULL,
  source_id VARCHAR,                    -- N° Prontuário do CO
  source_system VARCHAR DEFAULT 'controle_odonto',
  import_type VARCHAR,                  -- 'cadastro', 'agendamentos', 'notas'
  import_date TIMESTAMP DEFAULT NOW(),
  imported_by UUID,                     -- Usuário que fez import
  status VARCHAR DEFAULT 'success',     -- 'success', 'error', 'warning'
  error_message TEXT,
  original_data JSONB,                  -- Dados antes da limpeza
  final_data JSONB,                     -- Dados salvos
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_patient_imports_patient_id ON patient_imports(patient_id);
CREATE INDEX idx_patient_imports_import_date ON patient_imports(import_date);
CREATE INDEX idx_patient_imports_status ON patient_imports(status);
```

---

## 🛠️ Componentes React Necessários

### 1. **ImportData.tsx** (Página Principal)
- Gerencia fluxo de 4 etapas
- Estado: upload → preview → confirm → success
- Props: nenhuma (acessa Supabase direto)

### 2. **ImportForm.tsx** (Upload + Parsing)
- Input type=file aceita .xlsx, .xls, .csv
- Faz parse com biblioteca XLSX
- Valida estrutura de colunas
- Props: `onFileUploaded(data: ImportedData[])`

### 3. **ImportPreview.tsx** (Review + Edição)
- Mostra 1 paciente de cada vez (progress bar)
- Exibe avisos de validação (amarelo/vermelho)
- Permite editar campos antes de confirmar
- Botões: Editar | Confirmar | Pular
- Props: `data`, `currentIndex`, `totalCount`, `onConfirm`, `onSkip`, `onEdit`, `onBack`

### 4. **ImportHistory.tsx** (Opcional - Futura)
- Lista de importações realizadas
- Filtro por data, paciente, status
- Opção de reverter importação
- Link para log detalhado

---

## 📦 Tipos TypeScript

```typescript
interface ImportedData {
  name: string
  cpf: string
  phone: string
  street: string
  number: string
  neighborhood: string
  gender: string
  birthDate?: string
  profession?: string
  rg?: string
  email?: string
  source_id?: string              // N° Prontuário
  
  validations: {
    cpfValid: boolean             // CPF formato válido?
    duplicateCPF: boolean         // CPF já existe?
    phoneValid: boolean           // Telefone válido?
    warnings: string[]            // Lista de avisos
  }
}

interface ImportLog {
  id: string
  patient_id: string
  patient_name: string
  patient_cpf: string
  source_id: string
  import_type: 'cadastro' | 'agendamentos' | 'notas'
  import_date: Date
  imported_by: string
  status: 'success' | 'error' | 'warning'
  error_message?: string
  original_data: any
  final_data: any
}
```

---

## 🚀 Instalação & Setup

### Passo 1: Instalar Dependência
```bash
npm install xlsx
```

### Passo 2: Copiar Componentes
```
src/pages/ImportData.tsx
src/components/ImportForm.tsx
src/components/ImportPreview.tsx
```

### Passo 3: Adicionar Rota
```typescript
// App.tsx
import ImportData from '@/pages/ImportData'

<Route path="/importacao" element={<ImportData />} />
```

### Passo 4: Criar Tabela no Supabase
```sql
-- Executar no console SQL do Supabase
CREATE TABLE patient_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  patient_name VARCHAR NOT NULL,
  patient_cpf VARCHAR NOT NULL,
  source_id VARCHAR,
  source_system VARCHAR DEFAULT 'controle_odonto',
  import_type VARCHAR,
  import_date TIMESTAMP DEFAULT NOW(),
  imported_by UUID,
  status VARCHAR DEFAULT 'success',
  error_message TEXT,
  original_data JSONB,
  final_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## ⚠️ Considerações de Segurança

1. **Dados de Saúde**: CPF é PII (Personally Identifiable Information)
   - ✅ Nunca armazenar em logs de browser
   - ✅ Usar HTTPS (Vercel faz automaticamente)
   - ✅ Log auditável no BD

2. **Validação Dupla**
   - ✅ Frontend: validação imediata para UX
   - ✅ Backend: validação antes de INSERT (Supabase RLS)

3. **Rollback Seguro**
   - ✅ Guardar dados originais em `original_data`
   - ✅ Permitir reversão se necessário
   - ✅ Log de quem fez cada ação

4. **LGPD Compliance**
   - ✅ Registrar consentimento de importação
   - ✅ Permissão de usuário autenticado
   - ✅ Auditoria completa de acesso

---

## 📝 Teste Manual

**Caso 1: Importação Válida**
```
1. Upload: ControleODONTO - Pacientes.xlsx
2. Preview: Dados aparecem corretos
3. Validação: ✅ CPF, ✅ Sem duplicata
4. Confirmar: Paciente criado
5. Verificar: Apareça em /pacientes
```

**Caso 2: Duplicata**
```
1. Upload: Mesmo arquivo 2x
2. Preview: Primeiro paciente importado
3. Segundo paciente:
   - ⚠️ "CPF já existe no sistema"
   - Botão "Confirmar" desabilitado
4. Opção: Pular ou Editar CPF
```

**Caso 3: Dados Inválidos**
```
1. Upload: Arquivo com CPF inválido
2. Preview: Campo em vermelho
   - "CPF inválido"
3. Edição: Usuário pode corrigir
4. Confirmação: Após corrigir, salva OK
```

---

## 📞 Suporte & Troubleshooting

**Erro: "Erro ao processar arquivo"**
- Verificar formato: .xlsx, .xls ou .csv
- Verificar se não está corrompido
- Tentar em outro navegador

**Erro: "CPF já existe"**
- Verificar se paciente não foi importado antes
- Opção de editar CPF e tentar novamente
- Ou pular e continuar com próximo

**Erro: "Telefone inválido"**
- Sistema aceita: (11) 99999-9999 ou 11999999999
- Sem telefone = aviso, mas pode prosseguir

---

## 🔄 Fluxo Completo (Exemplo Real)

```
Usuário: Importar dados do Controle Odonto

1️⃣ ETAPA 1 - Upload
   Usuário seleciona: "ControleODONTO - Pacientes (1).xlsx"
   Sistema parseou: 8 pacientes encontrados

2️⃣ ETAPA 2 - Validação
   Paciente 1/8: Andreia
   ✅ CPF válido (069.311.797-48)
   ✅ Sem duplicata
   ⚠️  Telefone tem formato estranho
   Dados: Nome, CPF, Bairro, Telefone OK

3️⃣ ETAPA 3 - Preview & Edição
   Mostra: Andreia | 069.311.797-48 | Taquara
   [✏️ Editar] [✅ Confirmar] [⏭️ Pular]
   
   Usuário clica: ✅ Confirmar
   Salvo! Próximo paciente...

4️⃣ PRÓXIMOS PACIENTES (2/8, 3/8, ...)
   Mesmo fluxo para cada um

5️⃣ FINALIZAR
   Todos 8 pacientes importados
   ✅ Log auditável criado
   Link: Ver todos em /pacientes
```

---

## 📊 Próximos Dados a Importar (Fases)

### Fase 1: Cadastro (✅ ESSA)
- Dados básicos do paciente

### Fase 2: Agendamentos
- Datas, horários de consultas realizadas
- Status (concluído, cancelado, etc)
- Procedimentos

### Fase 3: Anotações/Notas
- Histórico clínico
- Observações de consultas
- Alergias, medicamentos

### Fase 4: Orçamentos
- Serviços propostos
- Valores
- Status de pagamento

---

## ✅ Checklist de Implementação

- [ ] Instalar XLSX: `npm install xlsx`
- [ ] Criar tabela `patient_imports` no Supabase
- [ ] Copiar 3 componentes (ImportData, ImportForm, ImportPreview)
- [ ] Adicionar rota `/importacao` ao App.tsx
- [ ] Adicionar link na navegação (opcional)
- [ ] Testar com arquivo real do CO
- [ ] Verificar logs em Supabase
- [ ] Documentar processo para o time

---

**Fim do Documento**

Pronto para implementação! 🚀
