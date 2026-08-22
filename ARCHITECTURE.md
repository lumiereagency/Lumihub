# LUMIHUB — Arquitetura Técnica (Fase 0)

Sistema operacional interno da Lumière Agency. Este documento registra as
decisões de arquitetura tomadas antes da implementação e é atualizado a cada
fase concluída do roadmap.

## 1. Stack

| Camada | Escolha | Motivo |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, React 19) | Full-stack em um único projeto: Server Components, Server Actions, rotas de API e middleware/proxy no mesmo runtime Node.js, sem precisar de um backend separado. |
| Linguagem | TypeScript | Tipagem ponta a ponta entre schema de banco, validação e UI. |
| Banco de dados | PostgreSQL 16 | Relacional, transacional, maduro para dados financeiros. |
| ORM | Prisma 7 (driver adapter `@prisma/adapter-pg`) | Migrations versionadas, client tipado a partir do schema. |
| Estilo | Tailwind CSS v4 (tokens CSS-first) | Implementa o Design System (paleta, tipografia, espaçamento) diretamente como variáveis de tema. |
| Validação | Zod | Validação de input em toda Server Action, nunca confiar em dado vindo do cliente. |
| Autenticação | Sessão própria (cookie httpOnly + tabela `sessions` no Postgres) | Controle total sobre sessões ativas, revogação, auditoria e RBAC — requisitos explícitos da Fase 1 que soluções prontas (NextAuth/Auth.js) tornam mais difíceis de expor (listagem/revogação de sessão com Credentials provider é limitada). |
| Senhas | bcrypt (bcryptjs), custo 12 | Hash seguro, sem dependências nativas de compilação. |

## 2. Multi-tenancy preparada (Fase 45)

Toda entidade de negócio pertence a uma `Organization`. Hoje existe apenas uma
organização (Lumière Agency), criada pelo fluxo de Primeiro Acesso, mas o
schema já isola dados por `organizationId` em todas as tabelas — login,
permissões, integrações e todos os módulos de negócio. Isso permite evoluir
para múltiplas organizações no futuro sem redesenhar o banco.

## 3. Autenticação e sessão

- Login por e-mail/senha via Server Action (`src/lib/actions/auth-actions.ts`).
- Sessão: token aleatório de 256 bits gerado no login, armazenado como
  cookie `httpOnly`/`secure`/`sameSite=lax`; apenas o **hash SHA-256** do
  token é persistido na tabela `sessions` — um vazamento do banco não expõe
  sessões ativas.
- Sessão "lembrar" dura 30 dias; sessão padrão, 12 horas.
- Página de perfil lista todas as sessões ativas do usuário (IP, user agent,
  última atividade) com opção de encerrar individualmente — Fase 1.1.
- Rate limiting de login por e-mail e por IP usando a tabela `login_attempts`
  (janela de 15 min) — proteção contra brute force sem depender de Redis.
- Recuperação de senha: token de uso único (hash armazenado, expira em 1h),
  mensagem de resposta **idêntica** exista ou não a conta, para não vazar
  quais e-mails estão cadastrados.
- Trocar a senha revoga todas as outras sessões ativas do usuário.

## 4. RBAC

- Catálogo de permissões granulares `<MODULO>_<ACAO>` (ex.: `FINANCE_VIEW`,
  `MANAGE_INTEGRATIONS`) gerado a partir de `src/lib/auth/permissions.ts` —
  22 módulos × 6 ações (`VIEW`, `CREATE`, `EDIT`, `DELETE`, `EXPORT`,
  `MANAGE`).
- Perfis padrão (`ADMIN`, `FINANCEIRO`, `OPERACAO`, `COMERCIAL`, `GESTAO`)
  recebem um conjunto de permissões pré-definido; perfis `CUSTOM` podem ser
  criados por organização (schema já suporta, UI de gestão de permissões é
  fase futura).
- Toda página autenticada chama `requirePermission(...)`, que redireciona
  para `/acesso-negado` sem revelar se o recurso existe.
- A navegação (sidebar/menu mobile) é filtrada pelas permissões efetivas do
  usuário — módulos sem `VIEW` simplesmente não aparecem.

## 5. Auditoria

Tabela `audit_logs` (organização, usuário, ação, entidade, metadados, IP,
user agent, timestamp). Eventos já registrados: login, falha de login,
logout, troca de senha, solicitação/conclusão de redefinição de senha,
revogação de sessão, conclusão do setup inicial. Novas ações (financeiro,
contratos, permissões) são adicionadas conforme cada módulo é implementado.

## 6. Design System

Tokens de tema definidos em `src/app/globals.css` (`@theme inline`) seguindo
a paleta, tipografia (Inter) e espaçamento especificados: fundo `#09090B`,
cards `#161618`, dourado `#C9A45C` como destaque, textos em três níveis de
contraste. Componentes reutilizáveis em `src/components/ui/*`
(Button, Input, Card, Badge, MetricCard, EmptyState, Skeleton, Avatar,
FormMessage) e `src/components/layout/*` (Sidebar, MobileNav, PageHeader,
ModulePlaceholder).

## 7. Armazenamento de arquivos

Abstração planejada: campo `storageProvider` em `Document` já existe no
schema (Fase 15). Nenhum provedor externo (S3, Google Drive, Dropbox) está
conectado ainda — a implementação de upload real entra na fase de Documentos,
com um driver local como padrão e adaptadores plugáveis para provedores
externos, seguindo o mesmo padrão de `IntegrationProvider` (Fase 14).

## 8. Camada de integrações (arquitetura, Fase 14)

Schema já modela `Integration`, `IntegrationCredential` (LUMIHUB Vault),
`IntegrationWebhook` e `IntegrationLog`. Nenhuma integração externa está
conectada nesta fase — a UI de Configurações → Integrações e os providers
concretos (Google Calendar, WhatsApp Business, OpenAI/Anthropic, Asaas,
etc.) serão implementados na Fase 14, cada um explicitamente marcado como
"Integração pendente" até receber credenciais reais.

## 9. Camada de IA (arquitetura, Fase 16)

`AiConversation`, `AiMessage` e `AiInsight` já estão no schema. Os insights
exibidos no Dashboard (Fase 3) são **determinísticos**, calculados a partir
de dados reais do banco (`src/lib/dashboard/insights.ts`) — não usam um
modelo de linguagem. A Lumi AI conversacional (chat com contexto real do
sistema, respeitando RBAC) é implementada na Fase 16, quando um provedor de
IA for conectado via Integrações.

## 10. Estratégia de auditoria de segurança

- Zod em toda entrada de Server Action.
- Server Actions fazem sua própria checagem de permissão (não confiam
  apenas na UI escondida).
- `proxy.ts` (antigo `middleware.ts` no Next 16) faz uma checagem leve de
  presença do cookie de sessão (runtime Edge, sem acesso a banco); a
  validação completa de sessão + RBAC acontece nos Server Components/Actions
  em runtime Node.js, com acesso ao Postgres via `@prisma/adapter-pg`.
- Páginas cujo conteúdo depende de sessão/estado do banco são marcadas
  `export const dynamic = "force-dynamic"` — necessário porque o Next.js
  pré-renderiza estaticamente por padrão quando nenhuma API dinâmica é
  chamada incondicionalmente antes de um `redirect()`, o que criaria um
  cache incorreto e "congelado" das decisões de autenticação.

## 11. Roadmap (estado atual)

- ✅ Fase 0 — Planejamento técnico (este documento).
- ✅ Fase 1 — Fundação, login e segurança.
- ✅ Fase 2 — Design System e Shell da aplicação.
- ✅ Fase 3 — Dashboard executivo (dados reais, estados vazios corretos).
- ⏳ Fases 4–24 — Módulos de negócio completos (CRM, Clientes, Contratos,
  Projetos, Financeiro, Cobranças, Integrações, Lumi AI, etc.). A navegação,
  o RBAC e o schema de banco para **todos** esses módulos já existem; as
  páginas hoje são placeholders explícitos ("Módulo em construção") até
  receberem sua implementação funcional completa, fase a fase.

Consulte o `README.md` para instruções de execução local.
