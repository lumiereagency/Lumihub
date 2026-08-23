# LUMIHUB

Sistema operacional interno da Lumière Agency — centraliza comercial,
clientes, contratos, projetos, financeiro, cobranças, equipe, agenda,
documentos, integrações e inteligência artificial em uma única plataforma.

Veja `ARCHITECTURE.md` para as decisões técnicas e o estado atual do
roadmap de fases.

## Stack

Next.js 16 (App Router) · TypeScript · PostgreSQL 16 · Prisma 7 ·
Tailwind CSS v4.

## Executando localmente

### Pré-requisitos

- Node.js 22+
- PostgreSQL 16+ rodando localmente (ou acessível via `DATABASE_URL`)

### Passos

```bash
npm install

cp .env.example .env
# edite .env: DATABASE_URL, SESSION_SECRET, VAULT_MASTER_KEY (veja comentários no arquivo)

npx prisma migrate deploy   # aplica as migrations no banco
npx prisma generate         # gera o client (roda automaticamente no install)

npm run dev
```

Acesse `http://localhost:3000`. Como ainda não existe nenhuma organização
cadastrada, você será redirecionado para `/setup` — o fluxo de Primeiro
Acesso cria a organização, os perfis padrão (ADMIN, FINANCEIRO, OPERACAO,
COMERCIAL, GESTAO) e o usuário administrador inicial.

### Scripts úteis

- `npm run dev` — servidor de desenvolvimento (Turbopack).
- `npm run build` / `npm run start` — build e execução em modo produção.
- `npm run lint` — ESLint.
- `npx prisma studio` — explorar o banco visualmente.
- `npx prisma migrate dev --name <nome>` — criar uma nova migration a partir
  de mudanças em `prisma/schema.prisma`.
- `npx tsx -r dotenv/config scripts/create-test-user.ts` — cria um usuário de
  teste com perfil COMERCIAL na primeira organização existente (apenas para
  desenvolvimento local; não é o seed de demonstração da Fase 20).
- `npx tsx -r dotenv/config scripts/resync-roles.ts` — reaplica
  `DEFAULT_ROLE_PERMISSIONS` à primeira organização existente; rode após
  alterar permissões padrão em `src/lib/auth/permissions.ts`.

## Estrutura de pastas

```
prisma/schema.prisma        Schema completo do banco (todas as entidades do roadmap)
src/app/(auth)/...          Login, recuperação/redefinição de senha
src/app/setup/              Fluxo de Primeiro Acesso
src/app/(app)/...           Área autenticada (sidebar + todos os módulos)
src/lib/auth/               Sessão, senha, RBAC, rate limiting, bootstrap de organização
src/lib/actions/            Server Actions (auth, perfil, setup)
src/lib/dashboard/          Queries e insights do Dashboard executivo
src/lib/integrations/       Providers de integração (ex.: e-mail — hoje "pendente")
src/components/ui/          Design System (Button, Input, Card, MetricCard, ...)
src/components/layout/      Sidebar, navegação mobile, cabeçalho de página
```

## Variáveis de ambiente

Veja `.env.example` para a lista completa com descrição de cada uma.
`SESSION_SECRET` e `VAULT_MASTER_KEY` são obrigatórias e devem ser geradas
com `openssl rand -base64 32` — nunca use os valores de exemplo em produção.

## Estado do roadmap

Fases 0–21 (planejamento, fundação/login/segurança, Design
System/Shell, Dashboard executivo, CRM e Prospecção, Propostas,
Clientes e Contratos, Projetos/Tarefas/Equipe/Captações, Calendário,
Financeiro/Visão Financeira, Contas a Receber e Cobranças, Contas a
Pagar/Cartões/Investimentos, Fluxo de Caixa, Metas, Integrações,
Documentos, Lumi AI, Alertas, Relatórios, Usuários e Permissões,
Configurações Gerais, Insights) estão implementadas e testadas de
ponta a ponta (build de produção, fluxo de setup → login → RBAC → CRM
→ proposta comercial que avança o estágio do lead → conversão de lead
em cliente → contrato → cobrança automática com régua de lembretes →
projeto com equipe e margem → tarefas → captação e vencimento de
contrato na Agenda → Visão Financeira com KPIs/indicadores/gráficos
reais → confirmação de pagamento → conta a pagar parcelada e
recorrente → cartão de crédito com distribuição automática de
parcelas nas faturas → investimento vinculado ao motor financeiro →
projeção de fluxo de caixa em 7/30/90 dias e 6/12 meses a partir de
compromissos reais → metas com cenários conservador/realista/
agressivo comparadas ao resultado real → integração real de e-mail
(SMTP)/WhatsApp Business com verificação de conexão ao vivo e
credenciais criptografadas no LUMIHUB Vault → upload, download e
exclusão real de documentos em armazenamento local → assistente Lumi
AI com chamada real a um LLM conectado (Anthropic/OpenAI/Gemini) e
contexto filtrado pelas permissões do usuário → central de alertas
detectando condições reais de risco em seis categorias → relatórios
financeiro/comercial/clientes/projetos/equipe com exportação real em
CSV → convite de usuário por e-mail real com editor de permissões
granular e trava contra autoexclusão de acesso administrativo →
preferência de moeda da organização com efeito real e imediato em
todas as telas financeiras → insights de riscos e oportunidades
gerados por IA a partir dos dados reais, com saída validada por
schema antes de gravar, validado com navegador real). **Não há mais
nenhuma página placeholder no sistema** — todos os 22 módulos do RBAC
(`MODULES` em `src/lib/auth/permissions.ts`) têm implementação
funcional completa. O que resta do roadmap original são itens de
infraestrutura/aprimoramento (OAuth para Google Calendar/Drive/Outlook,
multi-organização, gateway de pagamentos), não novos módulos de
negócio — ver seção "Roadmap restante" abaixo.

## Deploy em produção

Este repositório em si não inclui hospedagem — é só o código-fonte.
Para um deploy real, persistente, você precisa de:

1. **Um host com Node.js 22+** (Vercel, Railway, Render, um VPS
   próprio, etc.) rodando `npm run build && npm run start`.
2. **Um PostgreSQL 16+ gerenciado e persistente** (Railway, Neon,
   Supabase, RDS, ou um Postgres em VPS próprio) — nunca o Postgres
   local de um ambiente de desenvolvimento/sandbox efêmero.
3. **Variáveis de ambiente de produção** (`.env` no host, nunca
   commitadas): `DATABASE_URL` apontando para o Postgres persistente,
   `SESSION_SECRET` e `VAULT_MASTER_KEY` gerados com
   `openssl rand -base64 32` — **únicos para produção**, diferentes dos
   valores usados em qualquer ambiente de teste. Perder o
   `VAULT_MASTER_KEY` depois de conectar integrações torna as
   credenciais salvas no Vault irrecuperáveis (é criptografia real, não
   uma máscara).
4. Rodar `npx prisma migrate deploy` contra o Postgres de produção
   antes do primeiro `npm run start`.

Só depois desse deploy existir é que faz sentido conectar integrações
reais — credenciais conectadas num ambiente efêmero (como uma sessão
de desenvolvimento) somem junto com o container.

## Conectando integrações reais (depois do deploy)

Com o deploy no ar, um usuário com perfil Administrador acessa
`/configuracoes/integracoes` e conecta cada provedor diretamente pela
interface — as credenciais **nunca devem ser coladas em um chat ou
commitadas no código**; o formulário da tela grava direto no LUMIHUB
Vault (AES-256-GCM) e a verificação de conexão é real (Fase 14).

- **Provedor de IA (habilita Lumi AI e Insights)** — escolha um:
  Anthropic (chave em console.anthropic.com → API Keys), OpenAI
  (platform.openai.com → API keys) ou Google Gemini
  (aistudio.google.com/apikey). Cole a chave na categoria "Inteligência
  Artificial"; o sistema testa com uma chamada real ao provedor antes
  de marcar como `CONECTADO`.
- **E-mail (SMTP)** — habilita convite de usuário e lembretes de
  cobrança por e-mail. Dados necessários: host, porta, usuário, senha
  e endereço de remetente do seu provedor SMTP (Gmail com senha de
  app, SendGrid, Resend, Amazon SES, etc.). O sistema testa com
  `nodemailer.verify()` de verdade.
- **WhatsApp Business API** — habilita lembretes de cobrança por
  WhatsApp. Requer uma conta Meta for Developers com o produto
  WhatsApp Business configurado: `Phone Number ID` e um `Access
  Token` permanente (não o token temporário de 24h). O sistema testa
  com uma chamada real à Cloud API.

Cada uma dessas integrações já tem o fluxo de conexão, verificação e
armazenamento cifrado prontos desde a Fase 14 — conectar é uma ação
operacional (colar a credencial real na tela), não uma tarefa de
código.

### Google Calendar, Google Drive e Outlook Calendar (OAuth)

Esses três usam login/consentimento OAuth de verdade (Fases 32–34) em
vez de uma chave colada na tela — passos:

1. Abra a integração em `/configuracoes/integracoes` **antes** de criar
   o app no console do provedor: a tela mostra o **Redirect URI exato**
   que precisa ser cadastrado lá (baseado em `APP_URL`, ex.:
   `https://seu-dominio.com/api/integrations/oauth/GOOGLE_CALENDAR/callback`).
2. Crie as credenciais OAuth no console do provedor com esse Redirect
   URI:
   - **Google** (Calendar e Drive): [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
     → criar credencial "ID do cliente OAuth" tipo "Aplicativo da Web".
   - **Outlook**: [Azure Portal](https://portal.azure.com) → Microsoft
     Entra ID → Registros de aplicativo → Nova credencial de cliente.
3. Cole o Client ID e o Client Secret gerados na tela do LUMIHUB e
   salve (fica `Pendente`).
4. Clique em "Conectar com o provedor" — você é levado à tela real de
   login/consentimento do Google ou da Microsoft; ao autorizar, o
   LUMIHUB troca o código por um token de acesso e um refresh token
   (guardados cifrados no Vault) e a integração vira `Conectado`, com a
   conta autorizada exibida.

Uma recusa de autorização, um Redirect URI que não bate exatamente com
o cadastrado, ou um Client Secret errado voltam como erro honesto na
tela — nunca uma conexão fingida. O refresh do token é renovado sob
demanda no primeiro uso após expirar, sem depender de um agendador em
segundo plano.

## Multi-organização

A implantação suporta múltiplas organizações isoladas (Fase 45):
`/setup` cadastra uma nova organização a qualquer momento, não só na
primeira execução — só fica indisponível para quem já está logado
(evita criar uma segunda organização por engano a partir de uma
sessão ativa). Cada organização tem seus próprios usuários, perfis e
dados, totalmente isolados por `organizationId`; o e-mail de um
usuário é único em toda a implantação (não por organização), já que o
login resolve a conta só pelo e-mail. Não há troca entre organizações
na mesma conta — cada pessoa pertence a exatamente uma.

## Roadmap restante

Todo o roadmap de módulos de negócio (Fases 0–21), multi-organização
(Fase 45) e OAuth de Google/Outlook (Fases 32–34) estão implementados.
Restam apenas:

- **Gateway de pagamentos** (Asaas/Stripe/Mercado Pago) — descartado
  por ora: cobrança é via Pix manual (chave/QR compartilhado +
  confirmação manual em Contas a Receber), já coberto pela Fase 9.
- **Internacionalização real** (idioma/fuso são salvos desde a Fase
  20, mas a interface só existe em português e as datas seguem o fuso
  do servidor).

## Integrações externas necessárias (ainda não configuradas)

Nenhuma credencial externa é necessária para rodar o sistema hoje —
todas as áreas que dependem de um provedor externo (e-mail, WhatsApp,
IA, calendário OAuth, pagamentos) funcionam e avisam honestamente
quando o provedor correspondente não está `CONECTADO` em
`/configuracoes/integracoes`, em vez de simular sucesso.
