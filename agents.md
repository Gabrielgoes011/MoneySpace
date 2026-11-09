# AGENTS.md — Documento de trabalho da IA (MoneySpace)

Não é documento de marketing. É contexto técnico denso para a IA ler no início de
cada sessão, entender o projeto e codar no padrão sem revasculhar tudo.

## Divisão de trabalho (acordo com o Gabriel)
- FRONTEND: a IA implementa completo (telas, componentes HeroUI, toasts, chamadas à API).
- BACKEND: o GABRIEL escreve as funções. A IA pode criar o ESQUELETO dos arquivos
  (controller/service/repository/routes) com assinaturas + comentários `// implementar: ...`,
  mas NÃO implementa a lógica das funções do backend. A IA apoia: alinha contrato de API,
  mostra o padrão existente, revisa e tira dúvida pontual. Mão no código do back = Gabriel.

## Regras de manutenção deste arquivo (para a IA)
- Ler este arquivo ANTES de codar. Seguir os padrões da seção CONVENÇÕES à risca.
- Manter atualizado SEMPRE que algo mudar. Em especial:
  - Concluiu/avançou item do roadmap -> atualizar ESTADO + LOG aqui e marcar no `ROADMAP_DESENVOLVIMENTO.md`.
  - Tomou decisão de arquitetura/padrão -> registrar em CONVENÇÕES ou DECISÕES.
  - Criou/moveu/removeu arquivo relevante -> ajustar ESTRUTURA.
  - Abriu/resolveu dívida técnica -> ajustar DÍVIDAS.
- Preferir fatos, caminhos de arquivo exatos e exemplos curtos. Sem enfeite, sem repetição.
- Se algo neste arquivo divergir do código real, o CÓDIGO vence: corrija o arquivo.

## O QUE É
App financeiro familiar multi-tenant. Cada `familia` = 1 tenant isolado no mesmo
banco via RLS do PostgreSQL por `id_familia`. Uso interno hoje; alvo futuro SaaS.

Fontes da verdade:
- `escopo_e_arquitetura_app_de_finan_as.md` — regras de negócio completas.
- `ROADMAP_DESENVOLVIMENTO.md` — ordem de implementação por fases.
- `MoneySpace-Back/db/script.sql` — schema do banco (fonte da verdade).
- `MoneySpace-Back/db/migrations/` — migrations numeradas `migration-NN-descricao.sql`.

## STACK
- Backend: Node.js, JS puro, ESM (`import`/`export`), Express 4.
- Banco: PostgreSQL (Neon serverless), driver `pg`, SQL nativo, sem ORM.
- Frontend: React 19 + Vite + HeroUI v3 + Tailwind (fallback só).
- Auth: JWT (access + refresh em cookie httpOnly), bcrypt, 2FA TOTP (`speakeasy`).
- Env: backend `.env.development`; frontend `.env.local` (`VITE_API_URL`).

## CONVENÇÕES (obrigatórias)

### Banco
- snake_case em tudo. PK = `id` UUID (`uuid_generate_v4()`). FK = prefixo `id_`.
- Dinheiro: `NUMERIC(14,2)`. `pg` devolve NUMERIC como STRING -> `Number(valor)` ao calcular.
- Data do fato em `DATE` (`dt_compra`); criação em `TIMESTAMP` (`dt_cadastro`).
- `usuario_cadastro` = nome (snapshot) de quem lançou, p/ evitar JOIN.
- Sem DTO, sem ORM. Validação manual simples.

### Backend: 3 camadas por domínio em `src/modules/<dominio>/`
- `*.controller.js` — req/res e status HTTP. Sem SQL.
- `*.service.js` — regra de negócio. Orquestra repo + libs. Não toca req/res.
- `*.repositories.js` — ÚNICO lugar com SQL. Usa `openDb()` de `config/configDb.js`.
- `*.routes.js` — liga endpoint->controller; aplica middleware (auth, rate limit).

### Backend: respostas HTTP sempre via `utils/httpResponse.js` (nunca `res.json` cru)
`success(res,msg,data,200)` · `validationError(res,msg)` 400 · `unauthorized(res)` 401 ·
`forbidden(res)` 403 · `notFound(res,msg)` 404 · `conflict(res,msg)` 409 · `error(res,msg,500)`.
Saída: `{ success, message, data }`.

### Backend: erros de banco via `utils/pgErrorHandler.js`
No catch, erro com `.code` (Postgres) -> `pgErrorHandler(error, fallback)` (não vaza schema).
Erro de regra de negócio = `throw new Error('msg')` no service, usa a própria msg.

### Frontend
- UI: HeroUI PRIMEIRO, SEMPRE — inclui grid, layout, espaçamento, container.
  NÃO recriar com Tailwind o que o HeroUI já faz. Tailwind só p/ ajuste que o HeroUI não cobre.
- Doc componentes: https://heroui.com/en/docs/react/components — consultar antes de montar tela.
- Categorias HeroUI (buscar nesta ordem): Layout, Forms, Data Display, Collections,
  Navigation, Overlays, Feedback, Buttons, Controls, Pickers, Date and Time, Media,
  Typography, Colors, Utilities.
- API composta (dot notation): `Card.Header/Title/Content`, `InputGroup.Input/Prefix`. Seguir.
- Padrão lista x tabela:
  - Poucos itens heterogêneos (ex.: Minhas Contas, 2.1) -> lista de CARDS vertical (melhor no mobile).
  - Muitos itens tabulares (ex.: Transações/Lançamentos, fase 3) -> `Table` do HeroUI
    com `Table.ScrollContainer` (scroll horizontal no mobile), seleção, sort e célula de ações.
    Ref. do componente escolhido para a fase 3: https://heroui.com/en/docs/react/components/table
- HeroUI = React Aria + Tailwind v4 -> acessível por padrão. Preservar (`aria-label` quando a doc pedir).
- Mobile-first: hook `useIsMobile` (`src/hooks/`) p/ BottomNav(mobile) vs Sidebar(desktop);
  preferir responsividade nativa do HeroUI.
- HTTP sempre via `src/services/api.js` (axios: injeta JWT no `Authorization`, trata 401).
- Auth global via `AuthContext` (`src/context/AuthContext.jsx`): `useAuth()` ->
  `user, token, login(), logout(), isAuthenticated, loading`.
- Feedback via `toast` do HeroUI (`toast.promise`, `toast.success`...).
- Páginas: `src/pages/<Nome>/<Nome>.jsx`.

## DECISÕES (domínio de fatura — spec controle-fatura-reserva)
- Domínio GENÉRICO: cartão -> fatura -> lançamento -> importação. Rico é só o 1º importador
  (parser plugável via `importadores/index.js`, seleção por emissor).
- Cartão = conta tipo `CREDITO` (NÃO existe tabela `cartoes`). Portador = `usuario` da família
  (a importação preserva o nome importado).
- `status_liquidacao` é CAMPO ÚNICO em texto simples (minúsculas, sem `_`):
  `pendente` | `na hora` | `no fechamento` | `nao aplicavel`. NÃO são duas colunas.
  As opções vêm da tabela GLOBAL `utilitario` (`tipo='status'`), SEM RLS — padrão do sistema,
  como as categorias de sistema (visível a todos, editável por ninguém).
- Importação: preview NÃO persiste; a confirmação persiste em transação ÚNICA.
  Idempotência por `sha256` do arquivo (`uq_importacao_hash` -> 409) e `fingerprint` por linha
  (`uq_transacao_fingerprint`). Regra pagamento/estorno: valor negativo OU
  `estabelecimento == 'Pagamento de fatura'` (IGUALDADE exata, não substring).
- Migrations são aplicadas MANUALMENTE no SQL Editor do Neon (sem ferramenta automatizada);
  validar com `db/migrations/validate-migration-03.(sql|mjs)`. `db/script.sql` = fonte da verdade.

## ESTRUTURA

```
MoneySpace-Back/
  server.js                     entrypoint: carrega env, sobe Express na PORT
  db/script.sql                 schema completo (fonte da verdade)
  db/migrations/                migrations numeradas
  db/migrations/migration-03-controle-fatura.sql   fatura/fatura_importacao/fatura_transacao + utilitario
  db/migrations/validate-migration-03.(sql|mjs)    validação da migration 03 (PGlite)
  db/migrations/README.md       como aplicar migrations MANUALMENTE no SQL Editor do Neon
  db/smoke-fatura.(http|mjs|md) smoke test do backend de fatura (aguarda implementação do back)
  db/smoke-fatura-exemplo-rico.csv   CSV de exemplo p/ smoke test de importação
  src/config/env.js             carrega .env.{NODE_ENV}; importar ANTES de usar process.env
  src/config/configDb.js        Pool pg + openDb() + contexto RLS (AsyncLocalStorage)
  src/middleware/auth/verificaToken.js   valida JWT (Bearer ou cookie 'token') -> req.user
  src/middleware/rateLimiter.js          loginLimiter, twoFactorLimiter, refreshLimiter
  src/middleware/rlsMiddleware.js        transação + SET app.current_familia_id; anexa req.db.
                                         Usar POR ROTA depois do verificaToken (não é global)
  src/middleware/upload.js      multer em memória p/ CSV (IMPLEMENTADO; uploadCsvSingle trata erro->400)
  src/modules/app.js            APP EXPRESS EM USO (CORS, parsers, rotas; RLS é por rota)
  src/modules/login/            login/2FA (controller, service, repositories, routes)
  src/modules/conta/            CRUD de contas (IMPLEMENTADO: controller/service/repo/routes)
  src/modules/fatura/           Fatura & Reserva (IMPLEMENTADO: controller/service/repo/routes +
                                importadores/rico.parser.js + importadores/index.js)
  src/modules/cadastros/familia/ família (ESQUELETO: criar ok; listar/atualizar pendentes)
  src/routes/health.routes.js   health check
  src/utils/httpResponse.js     respostas padronizadas
  src/utils/pgErrorHandler.js   tradutor de erro do Postgres
  src/utils/crypto.js           AES-256-GCM p/ cifrar segredo do 2FA

MoneySpace-Front/
  src/App.jsx                   rotas + providers; protege rotas por isAuthenticated
  src/services/api.js           axios central
  src/services/faturaService.js consumo da API de fatura (sem mock)
  src/context/                  AuthContext, ThemeContext, PrivacyContext
  src/hooks/useIsMobile.js
  src/components/Layout/        Header, Sidebar, BottomNavMobile, MenuLateral, Layout
  src/pages/                    Login, Dashboard, Transacoes, Contas, Categorias, Usuarios, Faturas
  src/pages/Faturas/            Faturas.jsx (seletor cartão/competência) + componentes/:
                                FaturaResumo, ReservaCard, ImportarFaturaModal,
                                FaturaTransacoesTable, AnalisePortador, AnaliseCategoria
```

ARMADILHA: `server.js` usa `src/modules/app.js` (completo). O `src/app.js` legado
(só com `/health`, não usado) FOI REMOVIDO (reversível via git). Editar sempre o de `modules/`.

## AUTH & AUTORIZAÇÃO

Login em uso:
- Endpoint real `POST /login` (em `src/modules/login/login.routes.js`).
  Também: `POST /login/2fa`, `GET /me` (protegida), `POST /auth/refresh`, `POST /logout`.
- `login.service.js`: valida senha com `bcrypt.compare`, emite JWT.
- JWT access carrega HOJE: `id, id_familia, familia_nome, nome, email`.
  (PENDENTE incluir `is_master` e `role`.)
- Token vai em cookie httpOnly E no corpo; front guarda no localStorage.
- Logout: `POST /logout` (público, idempotente) limpa cookies `token` e `refreshToken`.
  clearCookie usa os MESMOS atributos do set (refreshToken com `path:'/auth/refresh'`),
  senão o browser não remove. Front: `AuthContext.logout()` chama o endpoint e sempre
  limpa o localStorage (resiliente a falha de rede). `api.js` usa `withCredentials:true`.

Papéis (migration 02 aplicada; schema pronto, lógica de autorização PENDENTE):
- `usuario.is_master` BOOLEAN, GLOBAL = dono do app (super admin); só ele cria famílias.
- `usuario.role` VARCHAR por família = `ADMIN` (responsável) | `MEMBRO` (comum). CHECK no banco.
- `is_master` é global; `role` é por família (dimensões separadas de propósito).
- `usuario.id_familia` segue NOT NULL (master tem família própria no uso interno).
- Autorização real = backend (middleware). Front esconder botão = só UX.
  Promover/rebaixar é sensível: só `is_master` cria master; só `ADMIN` mexe em `MEMBRO` da família.

RLS: `rlsMiddleware` abre transação por request e seta `app.current_familia_id` (UUID do JWT);
policies filtram por esse contexto. Categoria do sistema (`padrao_sistema=true`, `id_familia=NULL`)
é visível a todos e editável por ninguém.

### PADRÃO RLS por rota (OBRIGATÓRIO em rotas que tocam o banco por família)
Decisão fechada ao implementar 2.1 (ver LOG 2026-10-10). Siga EXATAMENTE isto:
- O `rlsMiddleware` NÃO é global no `app.js`. Ele depende de `req.user`, que só existe
  DEPOIS do `verificaToken`. Aplicar por rota, nesta ordem:
  `router.get('/x', verificaToken, rlsMiddleware, controller)`.
- O middleware anexa a transação em `req.db`. NÃO confie no `AsyncLocalStorage`/`openDb()`
  para pegar o contexto (a propagação quebra no pipeline async do Express).
- PASSE `req.db` explicitamente pela cadeia: controller -> service(db, ...) -> repo(db, ...).
  Toda query usa esse `db` (o client da transação), senão o contexto RLS fica vazio.
- No INSERT, preencha a coluna da família com
  `current_setting('app.current_familia_id', true)::uuid` (o `true` = missing_ok;
  sem ele o Postgres lança `unrecognized configuration parameter`).
- Referência pronta: `src/modules/conta/` (routes + controller + service + repositories).

## COMANDOS
- Backend (porta 3000): `cd MoneySpace-Back && npm run dev` (= `node --watch server.js`).
- Frontend dev: `cd MoneySpace-Front && npm run dev`.
- Frontend build (valida produção): `cd MoneySpace-Front && npm run build`.

## ESTADO

### Foco atual: módulo "Controle de Fatura & Conferência da Reserva" (spec controle-fatura-reserva)
Domínio genérico cartão -> fatura -> lançamento -> importação; Rico é o 1º importador.
- Banco: `migration-03-controle-fatura.sql` ESCRITA e VALIDADA (27/27 em PGlite: constraints,
  uniques, RLS, conversão `NUMERIC`). `script.sql` ATUALIZADO (fonte da verdade) com
  `fatura` / `fatura_importacao` / `fatura_transacao` (com RLS) + `utilitario` (GLOBAL, seed de
  status, sem RLS). Decisão de schema: `status_liquidacao` é CAMPO ÚNICO em texto simples
  (`pendente`/`na hora`/`no fechamento`/`nao aplicavel`), NÃO duas colunas (ver DECISÕES).
- Backend: `src/modules/fatura/` IMPLEMENTADO (repository SQL real; service com cálculos/
  idempotência por hash/fingerprint/fechamento; controller com httpResponse+pgErrorHandler; routes
  com RLS por rota + `uploadCsvSingle`). `importadores/rico.parser.js` + `importadores/index.js`
  implementados. `multer` já estava no package.json e instalado. EXCEÇÃO ao acordo: a pedido do
  Gabriel, a IA implementou o backend (igual ao módulo `conta`). Validado: parser (3 linhas do
  CSV exemplo) + 16 testes de lógica do service (db mockado). Contrato de API no design.md.
- Frontend: IMPLEMENTADO COMPLETO pela IA — `services/faturaService.js` (sem mock), rota
  `/faturas` + navegação (`Sidebar`/`BottomNavMobile`), `pages/Faturas/Faturas.jsx` (seletor
  cartão/competência) + componentes `FaturaResumo`, `ReservaCard`, `ImportarFaturaModal`,
  `FaturaTransacoesTable`, `AnalisePortador`, `AnaliseCategoria`. Build do front OK.
  Edição/importação BLOQUEADAS quando a fatura está `FECHADA`/`PAGA`.
- Legado: `src/app.js` legado REMOVIDO (reversível via git); `src/modules/app.js` é o app em uso.
- PENDÊNCIAS do módulo fatura (operacional, com o Gabriel):
  - Aplicar `migration-03` no Neon (SQL Editor) — a IA não tem acesso ao banco.
  - Rodar o smoke test (`db/smoke-fatura.*`) + checklist manual do design.md contra o Neon dev.
- PRÓXIMO: aplicar `migration-03` no Neon + rodar smoke/manual ponta a ponta; seguir p/ 2.2
  (saldos no Dashboard) e 1.2 (criar família + 1º usuário).
- Contrato da API de fatura: consumido pelo front em `services/faturaService.js`; detalhado em
  `.kiro/specs/controle-fatura-reserva/design.md` ("## Contrato de API").

### Fases anteriores
- Fase 1 concluída em parte: 1.1 Login e 1.4 Logout (testados).
- Fase 2: 2.1 Contas e 2.3 Arquivar CONCLUÍDAS (front + BACKEND implementado e testado
  ponta a ponta). EXCEÇÃO ao acordo: a pedido explícito do Gabriel, a IA implementou o
  backend do módulo `conta` (não ficou só esqueleto). Validado via HTTP: criar CARTEIRA/
  CREDITO (201), listar (200), atualizar (200), arquivar (200), tipo inválido (400).
- Roles: migration 02 aplicada no Neon; conta do dono = `is_master=true, role='ADMIN'`.
- PENDÊNCIAS BACKEND (Gabriel) — anteriores:
  - Ligar `is_master`/`role` no JWT (`login.service.js`) + middlewares `exigirMaster`/`exigirAdmin`.
  - Módulo `cadastros/familia/` ainda é esqueleto (listar/atualizar com `// implementar`).
- Contrato da API de contas (consumido pelo front em `services/contaService.js`, SEM mock):
  GET `/contas` -> `{data:{contas:[...]}}`; POST `/contas`; PUT `/contas/:id`; DELETE `/contas/:id`.

## LOG
- 2026-10-08:
  - `env.development` -> `.env.development` (corrigiu `DATABASE_URL ausente`).
  - 1.1 Login concluída: criado `.env.local` no front; `AuthContext` persiste user+token,
    reidrata via `/me`, só desloga em 401/403.
  - Migration 02 (roles `is_master`+`role`) criada e aplicada; `script.sql` atualizado.
  - Dívidas zeradas: removida rota órfã `src/routes/login.routes.js`; confirmado que
    `env.development` nunca foi commitado (sem rotação necessária); warning SSL do `pg`
    resolvido em `configDb.js` via `uselibpqcompat=true`.
  - 1.4 Logout concluída: `POST /logout` no backend limpa cookies httpOnly (validado:
    Set-Cookie com Expires 1970 nos dois cookies); `AuthContext.logout()` async chama o
    endpoint + limpa localStorage; `api.js` com `withCredentials:true`; Header e MenuLateral
    redirecionam p/ `/login` após sair.
  - 2.1 Contas (front): tela "Minhas Contas" (`src/pages/Contas/Contas.jsx`) com cards +
    `ContaFormModal.jsx` (criar/editar; campos mudam por tipo CORRENTE/CARTEIRA/CREDITO).
    `services/contaService.js` consome a API com fallback p/ mocks + toast em DEV.
    Backend `src/modules/conta/` criado só como ESQUELETO (Gabriel implementa); rotas já
    registradas em `modules/app.js`. Build do front OK. Nota: `react-icons/fi` NÃO tem
    `FiWallet` -> usar `FiPocket` p/ carteira.
- 2026-10-10:
  - 2.1/2.3 Contas CONCLUÍDAS (back + front), a pedido do Gabriel (IA implementou o back).
  - Backend `src/modules/conta/` implementado: repository (SQL real), service (validação
    por tipo: dias 1-31, limite>=0, saldo p/ CORRENTE/CARTEIRA), controller (4 endpoints,
    `usuario_cadastro` = `req.user.nome`, erro de negócio=400 e Postgres via pgErrorHandler).
  - BUG RLS corrigido (ver convenção "PADRÃO RLS por rota"): `rlsMiddleware` era global e
    rodava ANTES do `verificaToken` -> `req.user` indefinido -> `app.current_familia_id`
    vazio -> `id_familia` NULL no INSERT. Correções: (a) RLS por rota, DEPOIS do
    verificaToken, em `conta.routes.js`; (b) `req.db` passado pela cadeia controller->
    service->repo; (c) INSERT usa `current_setting('app.current_familia_id', true)`;
    (d) removido `app.use(rlsMiddleware)` global do `app.js`.
  - Front de contas migrado p/ API real: removidos fallbacks de mock do `contaService.js`;
    adicionado botão Arquivar (DELETE) com confirmação; removido `usoLimite` mock da tela
    (cartão mostra "Limite" + dias). Build OK.
  - Proxy do Vite corrigido: `vite.config.js` apontava p/ `:8080`, backend roda em `:3000`
    (causava ECONNREFUSED no `/api/login`). Ajustado p/ `http://localhost:3000`.
  - Operacional: senha do usuário `gabrielgoes20@gmail.com` foi redefinida p/ `123456`
    durante os testes (avisar/trocar se necessário).
- 2026-10-11:
  - Spec `controle-fatura-reserva`: criado o módulo "Controle de Fatura & Conferência da
    Reserva" (domínio genérico cartão -> fatura -> lançamento -> importação; Rico = 1º importador).
  - Banco: `migration-03-controle-fatura.sql` (fatura/fatura_importacao/fatura_transacao com RLS +
    `utilitario` global com seed de status) VALIDADA (27/27 em PGlite: constraints, uniques, RLS,
    `NUMERIC`); `db/script.sql` atualizado como fonte da verdade. Validadores em
    `db/migrations/validate-migration-03.(sql|mjs)` + `db/migrations/README.md` (aplicação MANUAL
    no SQL Editor do Neon). Decisão: `status_liquidacao` = campo único em texto simples.
  - Backend (ESQUELETO, Gabriel implementa): `src/modules/fatura/` (routes/controller/service/
    repositories) + `importadores/rico.parser.js` + `importadores/index.js` + `src/middleware/upload.js`
    (multer em memória). `multer` ainda PENDENTE de `npm install`. Contrato de API documentado no design.md.
  - Frontend COMPLETO (IA): `services/faturaService.js` (sem mock); rota `/faturas` + navegação
    (`Sidebar`/`BottomNavMobile`); `pages/Faturas/Faturas.jsx` (seletor cartão/competência) +
    6 componentes (`FaturaResumo`, `ReservaCard`, `ImportarFaturaModal`, `FaturaTransacoesTable`,
    `AnalisePortador`, `AnaliseCategoria`). Build OK. Bloqueio de edição/importação em FECHADA/PAGA.
  - Legado: `src/app.js` legado REMOVIDO (reversível via git); `src/modules/app.js` segue em uso.
  - Smoke test preparado (`db/smoke-fatura.http/.mjs/.md` + `db/smoke-fatura-exemplo-rico.csv`),
    AGUARDANDO o backend de fatura ser implementado e a migration-03 aplicada no Neon.

## DÍVIDAS
- `migration-03` ainda NÃO aplicada no Neon (manual, SQL Editor) — operacional do Gabriel.
- Smoke test ponta a ponta (`db/smoke-fatura.*`) ainda não rodado contra o Neon (depende da migration).
- Autorização por papel no módulo fatura: hoje qualquer membro da família opera (decisão de
  contrato); endurecer p/ `ADMIN` depende de ligar `is_master`/`role` no JWT (pendência anterior).


