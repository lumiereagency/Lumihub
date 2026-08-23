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

Fases 0–13 (planejamento, fundação/login/segurança, Design
System/Shell, Dashboard executivo, CRM e Prospecção, Propostas,
Clientes e Contratos, Projetos/Tarefas/Equipe/Captações, Calendário,
Financeiro/Visão Financeira, Contas a Receber e Cobranças, Contas a
Pagar/Cartões/Investimentos, Fluxo de Caixa, Metas) estão implementadas
e testadas de ponta a ponta (build de produção, fluxo de setup → login
→ RBAC → CRM → proposta comercial que avança o estágio do lead →
conversão de lead em cliente → contrato → cobrança automática com régua
de lembretes → projeto com equipe e margem → tarefas → captação e
vencimento de contrato na Agenda → Visão Financeira com
KPIs/indicadores/gráficos reais → confirmação de pagamento → conta a
pagar parcelada e recorrente → cartão de crédito com distribuição
automática de parcelas nas faturas → investimento vinculado ao motor
financeiro → projeção de fluxo de caixa em 7/30/90 dias e 6/12 meses a
partir de compromissos reais → metas com cenários conservador/realista/
agressivo comparadas ao resultado real, validado com navegador real). As
Fases 14–24 (Integrações, Lumi AI, etc.) têm o schema de
banco, RBAC e navegação já prontos; as telas hoje são placeholders
explícitos ("Módulo em construção") até receberem a
implementação funcional completa, uma fase por vez — nenhum dado
fictício é exibido como se fosse real.

## Integrações externas necessárias (ainda não configuradas)

Nenhuma credencial externa é necessária para rodar o Fase 0–3. Fases
futuras vão requerer, quando implementadas: um provedor de e-mail
(SMTP ou Resend) para envio real de e-mails transacionais, e — conforme
cada integração for construída — Google Calendar, WhatsApp Business API,
um provedor de IA (OpenAI/Anthropic/Gemini) e um gateway de pagamentos
(Asaas/Stripe/Mercado Pago). Até lá, essas áreas aparecem como
"Integração pendente" na interface.
