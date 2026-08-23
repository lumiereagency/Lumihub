# LUMIBASE — Arquitetura Técnica (Fase 0)

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

## 2. Multi-tenancy (Fase 45)

Toda entidade de negócio pertence a uma `Organization`, com dados isolados por
`organizationId` em todas as tabelas — login, permissões, integrações e todos
os módulos de negócio. A implantação suporta múltiplas organizações
independentes: `/setup` cadastra uma nova organização a qualquer momento (não
só na primeira execução), e `User.email` é único globalmente (não mais por
organização) para que o login resolva a conta corretamente mesmo com várias
organizações na mesma base. Cada pessoa pertence a exatamente uma organização
— não há troca entre organizações na mesma conta.

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
- Alterar `DEFAULT_ROLE_PERMISSIONS` no código não afeta organizações já
  provisionadas automaticamente — `ensureDefaultRoles(organizationId)`
  precisa ser executado novamente para reconciliar (script de exemplo em
  `scripts/resync-roles.ts`). Uma futura tela de gestão de permissões
  (Fase 14/`/configuracoes/permissoes`) deve tornar isso administrável.

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

Schema já modela `Integration`, `IntegrationCredential` (LUMIBASE Vault),
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
- ✅ Fase 4 — CRM e Prospecção: pipeline Kanban (Lead → Contato →
  Qualificado → Reunião → Proposta → Negociação → Fechado → Perdido),
  criação/edição de leads, transição rápida de estágio, alerta de
  follow-up (lead sem próximo contato ou com contato atrasado), métricas de
  pipeline (total, ponderado, conversão, novos leads, fechamentos) e
  conversão de lead fechado em cliente real (`src/lib/actions/crm-actions.ts`
  → `convertLeadToClientAction`), cumprindo o princípio de integração entre
  módulos da Fase 26.
- ✅ Fase 5 — Clientes e Contratos: listagem e ficha de cliente (contratos,
  cobranças, histórico/timeline vindo do audit log, margem sinalizada como
  indisponível até a Fase 6 trazer custos de projeto), biblioteca de
  modelos de contrato com placeholders (`{{cliente}}`, `{{valor}}`, ...),
  geração de contrato a partir de um modelo com pré-visualização do texto
  renderizado, e — cumprindo o princípio de integração entre módulos —
  ativar um contrato gera automaticamente a primeira cobrança em Contas a
  Receber (`FinancialMovement` + `AccountReceivable` vinculados ao
  contrato), o que já alimenta o Dashboard da Fase 3 com dados reais.
- ✅ Fase 6 — Projetos, Tarefas, Equipe e Captações: Equipe (funcionários,
  freelancers, prestadores) com vínculo opcional a um usuário do sistema;
  Projetos em Kanban + Lista com equipe alocada (`ProjectTeamMember`, com
  custo por membro) e cálculo de margem (valor − custo estimado − custo de
  equipe); Tarefas em Kanban global e embutidas na ficha do projeto;
  Captações com equipe técnica, equipamentos e status de entrega. Duas
  automações do roadmap (Fase 36) implementadas: definir o prazo de um
  projeto cria/atualiza um evento de entrega na Agenda, e criar uma
  captação cria automaticamente seu evento no calendário — ambas
  verificadas diretamente no banco.
- ✅ Fase 7 — Calendário: agenda integrada com visão em Mês (grade) e Agenda
  (lista cronológica), filtros por cliente/responsável/projeto/tipo, e
  criação manual de eventos (Reunião, Vencimento, Cobrança, Tarefa, Evento
  interno). Eventos gerados automaticamente por outros módulos (Captação,
  Entrega de projeto, Vencimento de contrato) aparecem como somente
  leitura, com link para o módulo de origem — evita que uma edição manual
  diverja da fonte de verdade. Terceira automação de agenda implementada:
  um contrato ativo com data de término mantém um evento de vencimento
  sincronizado (`syncContractExpiryEvent`), junto às duas da Fase 6
  (entrega de projeto e captação).
- ✅ Fase 8 — Financeiro Completo (Visão Financeira): dashboard em
  `/financeiro` com KPIs (saldo, receita/despesa do mês, lucro estimado, a
  receber/pagar, atrasados, compromissos futuros), indicadores (margem,
  ponto de equilíbrio, burn rate, reserva operacional, meses de cobertura)
  e três gráficos (Receita x Despesa últimos 6 meses, Despesas por
  categoria, Receita por cliente), todos computados a partir de
  `FinancialMovement`/`AccountReceivable`/`AccountPayable` reais — o motor
  financeiro central da Fase 27 já em uso, não uma tela solta. CRUD de
  Categorias Financeiras e Centros de Custo, pré-requisito de dados-mestre
  para Contas a Pagar (Fase 10).
  - **Paleta de gráficos**: 8 cores categóricas validadas pelo método da
    skill de dataviz contra a superfície escura do LUMIBASE (`#161618`) —
    ver `src/components/charts/colors.ts`. Séries adicionais além de 8 se
    agrupam em "Outros" em vez de gerar uma nova cor.
  - Indicadores usam **médias de todo o histórico de movimentos pagos**
    (não apenas o mês corrente) para não zerar com poucos dados; "Meses de
    cobertura" mostra "Sem burn rate" em vez de ∞/NaN quando a despesa
    média não supera a receita média.
- ✅ Fase 9 — Contas a Receber e Cobranças: `/financeiro/receber` (CRUD de
  cobranças manuais além das geradas por contrato, confirmação de
  pagamento com forma de pagamento e link de comprovante, cancelamento) e
  `/financeiro/cobrancas` (LUMI COBRANÇAS — biblioteca de modelos de
  mensagem por gatilho D-7..D+5 e canal, com placeholders `{{nome}}`,
  `{{valor}}`, `{{vencimento}}`, `{{pix}}`).
  - **Régua honesta, não simulada**: criar ou editar uma cobrança gera a
    régua de lembretes (`PaymentReminder`) a partir dos modelos ativos
    (`src/lib/billing/reminders.ts`), a mesma função usada pela ativação de
    contrato da Fase 5. Como não há infraestrutura de cron nesta app, o
    "modo automático" é implementado como um botão **"Processar régua
    agora"** que dispara os lembretes vencidos sob demanda — a UI declara
    isso explicitamente em vez de fingir um agendador em segundo plano.
  - **Canais de envio são de fato verificados**: `sendReminderMessage`
    (`src/lib/integrations/messaging.ts`) só tenta enviar se existir uma
    `Integration` com status `CONECTADO` para WhatsApp Business/SMTP; como
    nenhuma integração está conectada ainda (Fase 14 pendente), o
    processamento marca os lembretes como `FALHOU` com o motivo exato
    ("Nenhum canal conectado") — nunca como enviado com sucesso sem uma
    entrega real.
  - Status "Atrasado" é derivado na UI (pendente + vencimento no passado),
    seguindo a mesma convenção já usada no Dashboard da Fase 3.
- ✅ Fase 10 — Contas a Pagar, Cartões e Investimentos:
  - `/financeiro/pagar` — CRUD de despesas com fornecedor, categoria e
    centro de custo. **Parcelamento real**: informar N parcelas na criação
    gera N registros de `AccountPayable` distintos (um por vencimento
    mensal), cada um com seu próprio `FinancialMovement` vinculado —
    nunca um único registro com "valor total" fictício. **Recorrência sem
    cron**: marcar uma conta recorrente como paga gera reativamente a
    próxima ocorrência (mesmo valor, vencimento um mês à frente),
    replicando a mesma filosofia "automação honesta" da régua de
    cobranças da Fase 9 — não há um agendador rodando em segundo plano
    fingindo previsão futura.
  - `/financeiro/cartoes` — cadastro de cartões (dia de fechamento/dia de
    vencimento) e lançamento de compras com **distribuição automática de
    parcelas nas faturas futuras**: a fatura de cada parcela é calculada a
    partir do dia da compra frente ao dia de fechamento do cartão
    (`purchaseDay > closingDay` empurra a primeira parcela para a fatura
    seguinte), com o vencimento de cada fatura no `dueDay` configurado do
    cartão. Marcar uma parcela como paga atualiza em par o
    `FinancialMovement` vinculado dentro da mesma transação.
  - `/financeiro/investimentos` — registro de investimentos por categoria
    (Equipamentos, Tecnologia, Marketing, Estrutura, Desenvolvimento,
    Expansão, Outros) com objetivo e retorno esperado; cada investimento
    gera um `FinancialMovement` tipo `INVESTIMENTO` já `PAGO`, mantendo o
    motor financeiro central (Fase 27) como única fonte de verdade também
    para essa categoria de saída.
  - Testado ponta a ponta via Playwright (login → criar conta a pagar
    parcelada em 3x → conferir os 3 vencimentos → marcar recorrente como
    paga → conferir geração automática da próxima ocorrência → cadastrar
    cartão → lançar compra parcelada em 3x → conferir distribuição correta
    por fatura conforme fechamento → marcar parcela como paga → registrar
    investimento) e cruzado diretamente no Postgres.
- ✅ Fase 11 — Fluxo de Caixa: `/financeiro/fluxo-de-caixa` fecha o bloco
  do motor financeiro central iniciado na Fase 8 (comentário no schema
  agrupa as Fases 8, 9, 10 e 11 sob "MOTOR FINANCEIRO CENTRAL"). Projeta
  o saldo em 7, 30, 90 dias, 6 e 12 meses somando ao saldo atual (mesmo
  cálculo da Visão Financeira) todos os eventos futuros já lançados:
  contas a receber e a pagar pendentes/atrasadas e parcelas de cartão não
  pagas (com a data de cada parcela derivada do mês da fatura + dia de
  vencimento do cartão, igual à Fase 10). **Nunca uma extrapolação
  estatística fictícia** — se não há compromisso lançado além de um
  horizonte, o saldo projetado simplesmente se mantém estável até o
  próximo evento real.
  - Gráfico de linha/área (`src/components/charts/line-area-chart.tsx`,
    novo tipo de gráfico) mostrando a curva do saldo projetado mês a mês
    até 12 meses, reutilizando a paleta categórica já validada na Fase 8
    (`src/components/charts/colors.ts`) — só a primeira cor da paleta é
    usada, já que é uma série única.
  - Ponto de equilíbrio e reserva operacional exibidos com a mesma
    fórmula da Visão Financeira (`getFinanceOverview`), e uma tabela de
    "Próximos compromissos (90 dias)" lista cada entrada/saída individual
    que compõe a projeção, para transparência total do cálculo.
  - Validado matematicamente: lançadas duas contas a pagar de teste (uma
    dentro de 90 dias, outra além de 6 meses) e uma conta a receber real
    já existente, os 5 saldos projetados exibidos na tela bateram com o
    cálculo manual esperado antes da limpeza dos dados de teste.
- ✅ Fase 13 — Metas: `/metas` permite cadastrar metas de Faturamento,
  Novos clientes, Prospecção, Projetos concluídos, Margem e Recebimentos,
  cada uma com até três cenários (Conservador, Realista, Agressivo) para
  o mesmo tipo e período — o schema original (`Goal`) só tinha um
  `targetValue` por registro, então a Fase 13 estendeu o modelo com o
  enum `GoalScenario` e uma constraint única
  `[organizationId, type, periodStart, periodEnd, scenario]` (migração
  `20260823032138_add_goal_scenario`), permitindo três metas paralelas
  sem duplicar tipo/período.
  - **Progresso sempre real, nunca digitado**: o valor "realizado" de
    cada meta é calculado a partir dos dados já existentes no sistema
    para o período exato da meta — nunca um campo que o usuário
    preenche manualmente (`src/lib/goals/queries.ts`):
    Faturamento/Recebimentos somam `FinancialMovement`/
    `AccountReceivable` pagos no período; Novos clientes e Prospecção
    contam `Client`/`Lead` criados no período; Projetos concluídos conta
    `Project` com status `CONCLUIDO` atualizado no período; Margem
    recalcula (receita − despesa) / receita apenas com os movimentos
    pagos dentro do período (mesma fórmula da Visão Financeira, mas
    escopada à meta em vez do histórico completo).
  - Cada cenário tem sua própria barra de progresso e pode ser editado
    (novo valor-alvo) ou excluído individualmente, sem afetar os demais
    cenários do mesmo grupo tipo+período.
  - Testado ponta a ponta: criação de duas metas de Faturamento
    (Realista e Agressivo) para o mesmo período, uma meta de Novos
    clientes, rejeição correta de uma meta duplicada (mesmo tipo +
    cenário + período), edição do valor-alvo persistida no banco — e o
    valor "realizado" exibido bateu com os dados reais da organização
    antes da limpeza dos dados de teste.
- ✅ Fase 12 — Propostas: `/propostas` traz um Kanban por status
  (Rascunho → Enviada → Em negociação → Aceita/Recusada/Expirada),
  espelhando o padrão visual já usado no board de Leads da Fase 4. O
  modelo `Proposal` original não tinha campo de observações; estendido
  com `notes` (migração `20260823044519_add_proposal_notes`) para
  registrar o escopo da proposta.
  - **Integração Fase 26 sem sobre-inferência**: enviar uma proposta
    (`ENVIADA`) ou movê-la para negociação (`EM_NEGOCIACAO`) avança
    automaticamente o estágio do lead vinculado para `PROPOSTA` ou
    `NEGOCIACAO`, respectivamente — mas só para frente, nunca reduz o
    estágio nem marca o lead como perdido a partir de uma proposta
    recusada, já que um lead pode ter mais de uma proposta em aberto.
  - Status "Expirada" é derivado na UI (proposta enviada/em negociação
    com `validUntil` no passado), mesma convenção de "Atrasado" usada em
    Contas a Pagar/Receber — nunca escrito automaticamente no banco.
  - Testado ponta a ponta: criação de proposta vinculada a um lead em
    estágio `LEAD`, mudança de status para `ENVIADA` e confirmação direta
    no Postgres de que o lead avançou para `PROPOSTA`.
- ✅ Fase 14 — Integrações: `/configuracoes/integracoes` cobre os 19
  provedores do catálogo (`IntegrationProviderKey`) em 7 categorias, com
  o **LUMIBASE Vault** de verdade — `src/lib/integrations/vault.ts`
  criptografa cada credencial com AES-256-GCM (chave derivada de
  `VAULT_MASTER_KEY` via SHA-256) antes de gravar em
  `IntegrationCredential`; nenhum segredo toca o banco em texto puro, e a
  UI nunca reexibe o valor salvo, só um `maskedPreview` (`••••1234`).
  - **Verificação real, não simulada**: ao conectar, `src/lib/integrations/verifiers.ts`
    tenta uma checagem de verdade sempre que possível — SMTP via
    `nodemailer.verify()`, WhatsApp Cloud API/OpenAI/Anthropic/Gemini/
    Stripe/Mercado Pago/Asaas/Resend/Dropbox via uma chamada autenticada
    real ao provedor, e automações por webhook (n8n/Make/Zapier/Webhook
    customizado/API customizada) por uma checagem de alcançabilidade
    HTTP real. O status só vira `CONECTADO` se a chamada de verdade tiver
    sucesso; uma credencial errada gera `ERRO` com a mensagem real da
    falha (ex: `getaddrinfo ENOTFOUND ...`), nunca um sucesso fingido.
  - **Provedores OAuth não são fingidos**: Google Calendar, Outlook
    Calendar e Google Drive aceitam salvar Client ID/Secret no Vault, mas
    ficam sempre em `PENDENTE` — o fluxo completo de login/consentimento
    OAuth é uma fase futura, e a UI declara isso explicitamente em vez de
    marcar como conectado sem ter validado nada.
  - **Paga a dívida da Fase 9**: `src/lib/integrations/email.ts` e
    `whatsapp.ts`, que só registravam "pendente" em log, agora enviam de
    verdade (SMTP via nodemailer / WhatsApp via Cloud API) quando existe
    uma Integration `EMAIL_SMTP`/`WHATSAPP_BUSINESS` com status
    `CONECTADO` — a régua de cobrança da Fase 9 passa a entregar
    mensagens reais assim que uma dessas integrações é conectada, sem
    qualquer mudança no código da régua.
  - Testado ponta a ponta: SMTP com credenciais inválidas gerou `ERRO`
    com a falha de DNS real; Google Calendar (OAuth) ficou `PENDENTE`
    mesmo após salvar credenciais; um Webhook customizado com URL real
    ficou `CONECTADO` via checagem HTTP de verdade; desconectar limpou as
    credenciais e voltou o status para `DESCONECTADO` — tudo confirmado
    direto no Postgres, incluindo que o valor armazenado é de fato
    ciphertext (não o texto original) e que descriptografa corretamente
    com a `VAULT_MASTER_KEY` real.
- ✅ Fase 15 — Documentos: `/documentos` implementa upload, listagem
  (busca + filtro por categoria), edição de metadados, download e
  exclusão de arquivos reais — a primeira feature de upload de arquivo
  do LUMIBASE, sem precedente de código a reaproveitar.
  - **Armazenamento local real** (`src/lib/storage/local.ts`,
    `storageProvider = "local"` já previsto no schema): arquivos ficam
    em `storage/documents/<organizationId>/<uuid+ext>`, fora de
    `public/` para nunca serem servidos diretamente. `storageKey` é
    sempre gerado no servidor (nunca a partir de input do usuário), o
    que evita path traversal por construção. Fases futuras (32/33/34)
    podem trocar por Google Drive/Dropbox sem mudar o contrato do
    `Document`.
  - **Download autenticado**: `/api/documentos/[id]` (primeiro Route
    Handler do LUMIBASE) valida sessão e a permissão `DOCUMENTS_VIEW`
    antes de ler o arquivo do disco e servi-lo com o `Content-Type` e
    nome reais — a checagem de cookie do `proxy.ts` (nome do arquivo de
    middleware no Next.js 16) já barra requisições sem sessão antes
    mesmo de chegar na rota, e o Route Handler faz uma segunda checagem
    de sessão/permissão como camada extra de defesa.
  - Testado ponta a ponta: upload de um arquivo real, download com
    comparação byte a byte confirmando que o conteúdo baixado é
    idêntico ao original, edição de nome/categoria/vínculo persistida,
    e exclusão removendo tanto a linha no Postgres quanto o arquivo em
    disco (confirmado que nenhum dos dois sobra órfão).
- ✅ Fase 16 — Lumi AI: `/ai` implementa o assistente conversacional real
  — múltiplas conversas por usuário (`AiConversation`/`AiMessage`, já
  previstos no schema), com histórico persistido e resposta gerada por
  um LLM de verdade, nunca uma simulação.
  - **Reaproveita o Vault da Fase 14**: `src/lib/ai/providers.ts`
    procura, em ordem de preferência (Anthropic → OpenAI → Google
    Gemini), a primeira `Integration` de IA com status `CONECTADO` e
    descriptografa sua API key do LUMIBASE Vault. Sem nenhum provedor
    conectado, a Lumi AI desativa o campo de mensagem e aponta o
    caminho até Integrações, em vez de simular uma resposta.
  - **Chamada real ao provedor** (`src/lib/ai/chat.ts`): a cada
    mensagem, uma requisição HTTP de verdade é feita à API do provedor
    conectado (Anthropic `/v1/messages`, OpenAI `/v1/chat/completions`
    ou Google Gemini `generateContent`). Uma falha da API (chave
    inválida, limite excedido, indisponibilidade) vira um erro honesto
    mostrado ao usuário — a mensagem do usuário já enviada permanece
    salva mesmo quando a resposta falha, nunca inventando uma réplica.
  - **Contexto real, filtrado por permissão** (`src/lib/ai/context.ts`):
    o prompt de sistema inclui um retrato atual da organização (saldo,
    receita/despesa do mês, pipeline de CRM, contagem de clientes e
    projetos por status, metas, cobranças em atraso) — mas cada seção só
    entra no contexto se o usuário tiver a permissão de `VIEW` do módulo
    correspondente, para que a IA nunca revele ao usuário um dado que
    ele não veria na própria interface.
  - Testado ponta a ponta com uma chamada de rede real: com um provedor
    Anthropic marcado como `CONECTADO` mas com uma chave inválida, o
    envio de mensagem contatou a API real da Anthropic e recebeu de
    volta um HTTP 401 genuíno ("API key is invalid"), exibido tal qual
    ao usuário — prova de que a integração é de fato uma chamada de rede
    e não uma resposta fabricada. Não há credenciais reais de IA neste
    ambiente de desenvolvimento para validar uma resposta bem-sucedida
    completa, mas o caminho de sucesso usa o mesmo código testado no
    caminho de erro, trocando apenas a validade da chave.
- ✅ Fase 17 — Alertas: `/alertas` detecta condições de risco reais em
  seis categorias (Financeiro, Comercial, Operação, Clientes, Contratos,
  Equipe — o próprio `AlertCategory` do schema) e nunca insere um alerta
  fictício ou de exemplo.
  - **Detecção sob demanda, mesmo princípio da régua da Fase 9**: sem
    infraestrutura de cron, `src/lib/alerts/rules.ts` roda a cada
    carregamento da página, verificando o estado atual do banco —
    contas a pagar/receber atrasadas, leads sem próximo contato em dia,
    projetos com status `ATRASADO`, clientes `INADIMPLENTE`, contratos
    `ATIVO` vencidos ou vencendo em 30 dias, e projetos sem nenhum
    membro de equipe alocado com prazo em até 7 dias. Cada alerta vem de
    uma consulta real; a categoria "Oportunidade" não tem nenhuma regra
    ainda, então honestamente nunca aparece um alerta desse tipo em vez
    de forçar uma categoria vazia a parecer preenchida.
  - **Sem duplicar a cada visita**: antes de criar um alerta, o
    sincronizador verifica se já existe algum `Alert` (de qualquer
    status) para a mesma entidade + categoria — evitando recriar um
    alerta idêntico só porque a página foi recarregada, e sem apagar o
    histórico de alertas já resolvidos/dispensados pelo usuário.
  - Resolver/Dispensar ficam liberados com a permissão `ALERTS_VIEW` (a
    única concedida a qualquer perfil não-admin no RBAC — o mesmo
    raciocínio usado para a Lumi AI na Fase 16), já que são ações de
    triagem pessoal, não de configuração do módulo.
  - Testado ponta a ponta: seis condições reais foram inseridas
    cobrindo as seis categorias (conta a pagar atrasada, lead sem
    follow-up, projeto atrasado, cliente inadimplente, contrato vencido,
    projeto sem equipe), todas detectadas corretamente com a severidade
    esperada ao abrir a página, e a ação de Resolver persistiu
    `status=RESOLVIDO` e `resolvedAt` no Postgres.
- ✅ Fase 18 — Relatórios: `/relatorios` cobre as cinco áreas do
  placeholder original (Financeiro, Comercial, Clientes, Projetos,
  Equipe e margem) como abas, cada uma com exportação real em CSV — sem
  modelo de banco próprio, já que um relatório é sempre uma agregação
  de dados que já existem em outros módulos.
  - `src/lib/reports/queries.ts` centraliza as agregações: financeiro
    por categoria (reaproveitando `INCOME_TYPES` da Fase 8), pipeline
    comercial por estágio, receita total por cliente (soma de
    `FinancialMovement` pagos), e projetos/equipe com a **mesma fórmula
    de margem já usada na ficha de projeto da Fase 6**
    (`valor − custo estimado − custo de equipe`), agora centralizada em
    vez de duplicada.
  - **Exportação real**: `/api/relatorios/[type]` (novo Route Handler)
    gera um CSV de verdade a partir da mesma consulta usada na tela —
    nunca um arquivo de exemplo —, com BOM UTF-8 para acentuação correta
    e números em formato decimal puro (sem símbolo de moeda) para
    importação direta em planilha. Gate por `REPORTS_EXPORT`,
    independente de `REPORTS_VIEW`, espelhando a distinção `RO_EXPORT`
    já definida no RBAC.
  - Testado ponta a ponta: as cinco abas navegadas com dados reais da
    organização, e o CSV de Projetos baixado e comparado byte a byte
    com a tabela em tela — mesmos valores de margem, mesmo cliente,
    inclusive cruzado com o custo total alocado mostrado na aba Equipe
    para o mesmo membro de equipe.
- ✅ Fase 19 — Usuários e Permissões: `/configuracoes/usuarios` fecha
  uma lacuna real da Fase 1 — o motor de RBAC (Role, Permission,
  RolePermission) já existia desde o bootstrap, mas **não havia nenhuma
  tela para convidar, editar ou gerenciar usuários e perfis depois do
  primeiro acesso**; a única forma de existir um segundo usuário era
  inserir direto no banco.
  - **Convite real por e-mail, não senha exibida em tela**: criar um
    usuário nunca mostra ou transmite uma senha — gera um
    `PasswordResetToken` (o mesmo mecanismo do "Esqueci minha senha" da
    Fase 1) e envia um e-mail real de boas-vindas via
    `sendEmail` (Fase 14). Sem provedor de e-mail conectado, o usuário é
    criado normalmente mas a tela avisa honestamente que o convite não
    foi enviado, com um botão "Reenviar convite" para depois de conectar
    um provedor — nunca finge um envio que não aconteceu.
  - **Editor de permissões granular**: perfis `CUSTOM` podem ser
    criados com uma grade de checkboxes Módulo × Ação (22 módulos × 6
    ações = 132 combinações, o mesmo catálogo `ALL_PERMISSIONS` usado
    pelo RBAC desde a Fase 1) e editados depois; perfis padrão do
    sistema (`isSystem = true`) são somente leitura na UI para não
    divergirem da configuração original documentada em
    `DEFAULT_ROLE_PERMISSIONS`.
  - **Trava contra autoexclusão de acesso**: remover o perfil Admin ou
    desativar/excluir o último usuário Administrador ativo da
    organização é bloqueado com uma mensagem clara, evitando que a
    organização perca acesso administrativo por engano.
  - Testado ponta a ponta: usuário criado (com aviso honesto de convite
    não enviado, sem provedor de e-mail conectado), editado e
    desativado; tentativa de remover o único Administrador
    corretamente bloqueada; perfil personalizado criado com permissões
    específicas, editado e excluído; todas as ações confirmadas via
    audit log no Postgres.
- ✅ Fase 20 — Configurações Gerais: `/configuracoes` edita nome,
  fuso horário, moeda e idioma da organização (`Organization.timezone/
  currency/locale`, campos que já existiam no schema desde o bootstrap
  mas nunca tinham uma tela para editá-los depois da criação).
  - **Moeda com efeito real e imediato**: como `currency` já era lido
    dinamicamente por `formatCurrency` em todas as telas financeiras
    desde a Fase 8, mudar a moeda aqui muda de verdade a exibição em
    todo o sistema — validado ao vivo: trocar para USD fez a Visão
    Financeira inteira (KPIs, gráfico, listas) passar a mostrar "US$"
    em vez de "R$", sem nenhuma mudança de código além da preferência
    salva.
  - **Honestidade sobre o que ainda não está implementado**: fuso
    horário e idioma são salvos de verdade, mas a interface só existe
    em português e as datas seguem o fuso do servidor — a tela declara
    isso explicitamente em vez de fingir suporte a i18n completo que
    exigiria reescrever a formatação de data em dezenas de arquivos,
    fora do escopo desta fase.
  - Testado ponta a ponta com navegador real: nome/moeda/fuso/idioma
    carregados corretamente do banco, moeda alterada para USD com
    propagação confirmada na Visão Financeira, e revertida para BRL ao
    final para não alterar o estado da organização de demonstração.
- ✅ Fase 21 — Insights: `/insights` fecha o bloco Lumi AI (comentário no
  schema agrupa `AiInsight` sob "LUMI AI — Fase 16, 30, 31" junto de
  `AiConversation`/`AiMessage`), gerando riscos, oportunidades e
  recomendações a partir de uma análise real do LLM conectado — não um
  conjunto de regras fixas como os Alertas da Fase 17, e sim texto
  sintetizado pela IA a partir dos dados.
  - **Reaproveita toda a infraestrutura da Fase 16**: mesmo
    `getConnectedAiProvider` (Vault), mesmo `callAiProvider`, mesmo
    `buildSystemContext` filtrado por permissão — mais a tendência real
    de receita/despesa dos últimos 6 meses (`getFinanceOverview`) para
    dar à IA sinal suficiente para detectar padrões como margem em
    queda. Sem provedor conectado, o botão "Gerar novos insights" fica
    desabilitado com o mesmo aviso da Fase 16.
  - **Saída estruturada validada, nunca confiada às cegas**: o prompt
    pede um array JSON `[{type, title, description, severity}]`; a
    resposta é extraída, `JSON.parse`ada e validada com Zod
    (`severity` precisa bater exatamente com um dos 4 valores de
    `AlertSeverity`) antes de qualquer `AiInsight` ser gravado no banco
    — uma resposta malformada vira um erro honesto para o usuário
    ("A IA retornou insights em um formato inesperado"), nunca uma
    linha fabricada ou uma tentativa de adivinhar o que a IA quis dizer.
  - Testado ponta a ponta com uma chamada de rede real: com um provedor
    Anthropic `CONECTADO` mas com chave inválida, gerar insights
    contatou a API real e recebeu de volta um HTTP 401 genuíno, exibido
    tal qual — e confirmado que nenhuma linha de `AiInsight` foi criada
    a partir da falha. A exibição e o botão de dispensar insight foram
    validados com registros inseridos diretamente simulando uma geração
    bem-sucedida, já que não há credencial real de IA neste ambiente.
- ✅ Nenhuma página placeholder restante — verificado buscando por
  `ModulePlaceholder` em todo `src/app/(app)`: zero ocorrências. Os 22
  módulos do RBAC (`MODULES` em `src/lib/auth/permissions.ts`) têm
  todos implementação funcional completa. A numeração sequencial usada
  nesta sessão ("Fase 22, 23, 24...") presumia a existência de módulos
  de negócio ainda não escopados; a investigação mostrou que não há
  mais nenhum.
- ✅ Fase 45 — Multi-organização: a implantação passa a suportar mais
  de uma organização isolada, não só a criada no primeiro acesso.
  - **`User.email` único globalmente, não mais por organização**
    (migração `20260823152850_add_multi_organization_global_email`,
    trocando `@@unique([organizationId, email])` por `email @unique`)
    — necessário porque o login (`loginAction`) sempre resolveu a
    conta só pelo e-mail, sem pedir a organização; com múltiplas
    organizações na mesma implantação, duas contas com o mesmo e-mail
    em organizações diferentes colidiriam de forma não determinística
    nessa busca. Cada pessoa continua pertencente a exatamente uma
    organização — não há troca entre organizações na mesma conta,
    escopo deliberadamente fora desta fase.
  - **`/setup` deixa de ser um bootstrap de uso único**: antes,
    `hasAnyOrganization()` bloqueava a tela permanentemente assim que
    qualquer organização existia no banco. Agora qualquer visitante
    sem sessão ativa pode cadastrar uma nova organização a qualquer
    momento — só quem já está logado é redirecionado (para
    `/dashboard`, não pode criar uma segunda organização a partir de
    uma sessão existente). `setupOrganizationAction` valida o e-mail
    do administrador contra a base inteira antes de criar a
    organização, com erro honesto ("Já existe uma conta com este
    e-mail") em vez de deixar a constraint do banco vazar um erro
    técnico.
  - **Convite de usuário (Fase 19) também valida globalmente**:
    `createUserAction` trocou a checagem de duplicidade de
    `{organizationId, email}` para `{email}` em todo o sistema,
    coerente com a nova constraint.
  - Testado ponta a ponta com navegador real: `/setup` continuou
    acessível com a Lumière Agency já cadastrada; uma segunda
    organização ("Estúdio Aurora") foi criada com sucesso, logada
    automaticamente e isolada dos dados da primeira (confirmado
    listando usuários por organização direto no Postgres); tentar
    cadastrar uma terceira organização com o mesmo e-mail da segunda
    foi corretamente rejeitada; o login da Lumière Agency continuou
    funcionando normalmente sem enxergar nada da nova organização; um
    usuário já logado que acessa `/setup` foi redirecionado direto
    para `/dashboard`. Organização de teste removida ao final
    (`ON DELETE CASCADE` limpou usuário/perfis em cascata, confirmado
    no Postgres).
- ✅ Fases 32–34 — OAuth real para Google Calendar, Google Drive e
  Outlook Calendar: os três provedores `oauthOnly` do catálogo de
  Integrações, travados em `PENDENTE` desde a Fase 14, agora completam
  o fluxo real de autorização (Authorization Code + PKCE).
  - **Fluxo completo em duas rotas novas**
    (`src/app/api/integrations/oauth/[provider]/{start,callback}/route.ts`):
    `/start` monta a URL de autorização real do provedor (Google:
    `accounts.google.com`; Microsoft: `login.microsoftonline.com`) com
    `client_id`/`redirect_uri` lidos da integração salva, PKCE
    (`code_challenge` S256) e um `state` assinado (HMAC-SHA256 com
    `SESSION_SECRET` — primeiro uso real desse segredo no código, antes
    só documentado) guardado num cookie `httpOnly` de 10 minutos;
    `/callback` valida esse estado contra o cookie (proteção CSRF),
    troca o código por tokens com uma chamada `POST` real ao token
    endpoint do provedor, busca a conta conectada (e-mail) para exibir
    na UI, e só então marca `CONECTADO`.
  - **Nunca finge sucesso**: cancelamento pelo usuário no provedor
    (`error=access_denied`), estado inválido/expirado, ou uma troca de
    código recusada pelo provedor viram erro honesto (`status=ERRO`,
    `IntegrationLog` com a mensagem real) — nunca uma integração
    fictícia. Refresh de token (`src/lib/integrations/oauth-tokens.ts`
    → `getValidOAuthAccessToken`) segue o mesmo princípio "sem cron"
    já usado na régua de cobrança (Fase 9) e nos alertas (Fase 17):
    renovado sob demanda no momento do uso, nunca em segundo plano: se
    o refresh falhar (token revogado pelo usuário no provedor), a
    integração vira `EXPIRADO` com o motivo real em vez de continuar
    sinalizando `CONECTADO` com um token inválido.
  - **Escopo desta fase é só a conexão**, não o consumo — sincronizar
    eventos do Google Calendar/Outlook ou armazenar documentos no
    Google Drive usando o token já obtido fica para quando esses
    módulos consumirem `getValidOAuthAccessToken`; não construído
    agora para não expandir o escopo além do que estava descrito como
    faltante ("fluxo completo de login/consentimento").
  - Testado ponta a ponta com navegador real e chamadas de rede reais:
    `/start` sem credenciais salvas rejeitado honestamente; Redirect
    URI exibido corretamente na UI; credenciais de teste salvas
    (status `PENDENTE`); `/start` redirecionou de fato para
    `accounts.google.com/o/oauth2/v2/auth` com todos os parâmetros
    corretos (`client_id`, `redirect_uri`, PKCE, `access_type=offline`
    para garantir `refresh_token`); a troca de um código forjado por
    token contatou a API real do Google e foi recusada com o erro
    genuíno "The OAuth client was not found" — confirmado no Postgres
    que a integração ficou `ERRO`, só a credencial `clientSecret`
    permaneceu salva, nenhum `accessToken`/`refreshToken` fictício foi
    gravado; um `state` adulterado foi rejeitado antes de qualquer
    chamada de rede (proteção CSRF). Dados de teste removidos ao
    final.
- ⏳ Itens de infraestrutura ainda pendentes:
  - Gateway de pagamentos (Asaas/Stripe/Mercado Pago) — descartado por
    ora: o fluxo de cobrança é Pix manual (chave/QR + confirmação
    manual), já coberto pela Fase 9.
  - Internacionalização real da interface (idioma/fuso já são salvos
    desde a Fase 20, mas a UI só existe em português).

### Nota técnica — `formData.get()` retorna `null`, não `""`, para campos ausentes

Um bug real foi encontrado e corrigido durante a Fase 6: o helper
`emptyToUndefined` usado nos schemas Zod (`src/lib/validation/*.ts`) só
tratava string vazia (`""`). Formulários que omitem completamente um campo
opcional do DOM (em vez de renderizá-lo vazio) fazem `formData.get(...)`
retornar `null`, que `z.optional()` rejeita (só aceita `undefined`) — a
validação falhava silenciosamente sempre que o componente não exibia o
erro retornado pela action. Corrigido em todos os arquivos de validação
para tratar `""` e `null` da mesma forma. Ao criar um novo formulário
"enxuto" (poucos campos visíveis para um schema com mais campos opcionais),
sempre renderizar `<FormMessage error={state.error} />` para que qualquer
regressão semelhante apareça imediatamente na UI em vez de falhar em
silêncio.

Consulte o `README.md` para instruções de execução local.
