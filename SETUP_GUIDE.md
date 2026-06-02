# Setup Guide - Ads Manager

## 🔧 Configuração Inicial

### 1. Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Supabase
REACT_APP_SUPABASE_URL=https://seu-projeto.supabase.co
REACT_APP_SUPABASE_ANON_KEY=seu-anon-key

# Claude API
REACT_APP_CLAUDE_API_KEY=sk-ant-xxx

# Meta Ads (OAuth)
REACT_APP_META_APP_ID=seu-app-id
REACT_APP_META_APP_SECRET=seu-app-secret

# Google Ads API
REACT_APP_GOOGLE_ADS_DEVELOPER_TOKEN=seu-developer-token
REACT_APP_GOOGLE_CLIENT_ID=seu-client-id
REACT_APP_GOOGLE_CLIENT_SECRET=seu-client-secret
```

### 2. Setup Supabase

#### 2.1 Criar Projeto Supabase
1. Acesse [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Copie URL e ANON_KEY para `.env.local`

#### 2.2 Executar Migrations
```bash
# Copiar o conteúdo de migrations/001_create_ads_manager_schema.sql
# Ir para Supabase Dashboard > SQL Editor
# Colar e executar as migrations
```

#### 2.3 Configurar RLS (Row Level Security)
As policies já estão no SQL, apenas execute.

### 3. Meta Ads - Configurar OAuth

#### 3.1 Criar Meta App
1. Acesse [developers.facebook.com](https://developers.facebook.com)
2. Crie nova aplicação
3. Adicione produto "Marketing API"
4. Configure redirect URIs:
   - Dev: `http://localhost:5173/auth/callback/meta`
   - Prod: `https://seu-dominio.com/auth/callback/meta`

#### 3.2 Gerar Access Token (Temporário)
1. Acesse Marketing API > Tools
2. Gere um token de acesso para testes
3. Use para testar a integração

#### 3.3 Implementar OAuth Flow (Próximo Passo)
- Criar componente `MetaAdsConnect.tsx`
- Implementar fluxo de autenticação
- Armazenar tokens criptografados no Supabase

### 4. Google Ads - Configurar OAuth

#### 4.1 Criar Google Cloud Project
1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie novo projeto
3. Ative "Google Ads API"
4. Crie credenciais OAuth 2.0

#### 4.2 Configurar Redirect URIs
- Dev: `http://localhost:5173/auth/callback/google`
- Prod: `https://seu-dominio.com/auth/callback/google`

#### 4.3 Gerar Developer Token
1. Acesse Google Ads API dashboard
2. Solicite developer token (pode levar alguns dias)
3. Adicione token ao `.env.local`

### 5. Claude API - Setup

1. Crie conta em [anthropic.com](https://anthropic.com)
2. Acesse API keys
3. Gere nova API key
4. Adicione a `.env.local`

---

## 📋 Checklist de Implementação - Etapa 1

- [ ] Supabase Schema criado
- [ ] RLS Policies ativadas
- [ ] Meta Ads credentials configurados
- [ ] Google Ads credentials configurados
- [ ] Claude API key configurada
- [ ] Componente MetaAdsConnect
- [ ] Componente GoogleAdsConnect
- [ ] Dashboard inicial
- [ ] Testes de integração

---

## 🚀 Próximos Passos

1. **Componentes de Conectividade**
   - Botões para conectar Meta/Google
   - Fluxo OAuth
   - Validação de tokens

2. **Dashboard Base**
   - Listagem de campanhas
   - Métricas gerais
   - Gráficos simples

3. **Background Jobs**
   - Sync automático de dados
   - Geração automática de insights
   - Cron jobs

4. **Análise com Claude**
   - Interpretação de métricas
   - Recomendações automáticas
   - Alertas de problemas

---

## 🔗 Recursos Úteis

- [Meta Graph API Docs](https://developers.facebook.com/docs/graph-api)
- [Google Ads API Docs](https://developers.google.com/google-ads/api/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Claude API Docs](https://anthropic.com/docs)
