# AGENTS.md — Documento de trabalho da IA (MoneySpace)

Contexto técnico para a IA ler no início de cada sessão. Se algo aqui divergir do
código real, o CÓDIGO vence: corrija este arquivo.
(Reescrito em 2026-11-09 e atualizado em 2026-11-09 após Usuários/PWA/tema verde.)

## Divisão de trabalho (acordo com o Gabriel)
- FRONTEND: a IA implementa completo (telas, componentes HeroUI, toasts).
- BACKEND: o GABRIEL escreve a lógica. A IA pode criar esqueleto, alinhar contrato, revisar.
  Exceção: quando ele AUTORIZA explicitamente (foi o caso do módulo de usuários, 2026-11-09).

## Regras de manutenção
- Ler antes de codar. Atualizar ESTADO/ESTRUTURA/DÍVIDAS sempre que algo mudar.
- Fatos e caminhos exatos, sem enfeite.

## O QUE É
App financeiro familiar multi-tenant (1 `familia` = 1 tenant, RLS do PostgreSQL por
`id_familia`). Uso interno hoje; alvo futuro SaaS. Roda no PC e no celular (PWA instalável).

## STACK
- Backend: Node.js ESM, Express 4, PostgreSQL (Neon) via `pg`, SQL nativo, sem ORM.
- Auth: JWT (cookie httpOnly + corpo), bcrypt, 2FA TOTP (`speakeasy`, `qrcode`).
- Frontend: React 19 + Vite 8 + HeroUI v3 (`@heroui/react` 3.2.x) + Tailwind v4.
- Env: back `.env.development`; front `.env.local` (`VITE_API_URL`). Deploy: Discloud (`DEPLOY_DISCLOUD.md`).
  O back serve `MoneySpace-Front/dist` (commitado de propósito): recompilar o front antes de subir.

## CONVENÇÕES
### Banco
- snake_case; PK `id` UUID; FK `id_*`; dinheiro `NUMERIC(14,2)` (o `pg` devolve STRING -> `Number()`).
- `db/script.sql` é a fonte da verdade do schema. Sem pasta de migrations: quando precisar, começam em `001`.
- ATENÇÃO: o banco do Neon pode estar DEFASADO em relação ao script (ex.: `usuario` NÃO tem `ativo` nem `ultimo_acesso`). Conferir `information_schema.columns` antes de usar coluna do script.
### Backend — padrão REAL em uso: 2 camadas (controller + repository), SEM service
- `*.controller.js`: req/res + lógica/validação. `*.Repositories.js`: único com SQL. `*.routes.js`.
- Respostas via `utils/httpResponse.js`. Erros do Postgres via `utils/pgErrorHandler.js`
  (23505 tratado à parte no controller de usuários -> 409).
- RLS POR ROTA: `router.get('/x', verificaToken, rlsMiddleware, controller)`; `rlsMiddleware` é export
  NOMEADO de `middleware/rlsMiddleware.js`. Passar `req.db` ao repository. INSERT usa
  `current_setting('app.current_familia_id', true)::uuid`. Além do RLS, filtrar `id_familia` na query.
- O JWT carrega só `id, id_familia, familia_nome, nome, email` (sem role): autorização lê o papel no banco.
- DECISÃO (Gabriel, 2026-11-09): o projeto é SEMPRE 2 camadas (controller + repository). NÃO criar `service`,
  mesmo que o `api-Node` (fii-track-back) use 4 arquivos por módulo. Do `api-Node` herda-se só o PADRÃO DE ESCRITA abaixo.
### Backend — padrão de ESCRITA (herdado do api-Node/fii-track-back)
- NÃO criar helper/constante para uso único: validação e normalização de uma função ficam DENTRO dela.
  Helper (ou util em `utils/`) só quando for repetir em 2+ lugares.
- NUNCA alinhar código com espaços extras (colunas de `:`/`=`, chaves de objeto, imports). Um espaço só, sem linhas em branco soltas.
- Comentários e mensagens em português. Comentário curto em minúscula acima de cada passo
  (`//abre a conexão`, `//executa a consulta`, `//retorna o resultado`). Explicar o PORQUÊ do passo, não repetir o código.
- Cada bloco de função (ou grupo de funções do mesmo assunto) dentro de região:
  `//#region => descrição` ... `//#endregion`. Passos dependentes numerados: `//1º passo: ...`, `//2º passo: ...`.
- Funções com nome em português que diz o que fazem: `listarFundos`, `cadastrarFundos`, `deletarFundo`.
  No repository o sufixo `Repository` quando houver risco de colisão (`listarFundosRepository`).
- `function` declarada (`async function x() {}`), sem arrow function para handlers/queries.
- Exports NOMEADOS agrupados no FIM do arquivo, dentro de `//#region => exportação das funções`
  (`export { a, b, c }`). Só a rota usa `export default router`. Helper interno começa com `_` e não é exportado.
- Imports no topo: libs, depois `utils`, depois o arquivo do módulo; extensão `.js` sempre.
- SQL NUNCA é montado por concatenação/interpolação (`${...}` dentro da query). Query 100% literal com `$1, $2`.
  Update parcial = `COALESCE($1, coluna)` (passa `null` no que não mudou), não `SET` montado em loop.
  Colunas repetidas são escritas por extenso em cada query.
- Valores de texto de cadastro (ex.: categoria) são gravados em MINÚSCULO no banco. O front exibe em Proper Case
  (`properCase` de `utils/formatar.js`) e NÃO avisa o usuário de como o back grava: isso é detalhe interno do back.
- Controller: um `try/catch` por handler. No `catch`: `console.error('Erro ao <ação> na etapa do controller:', error)`,
  `const secureMessage = pgErrorHandler(error, 'Erro ao <ação>.')` e `return httpResponse.error(res, secureMessage)`.
  Sucesso: `httpResponse.success(res, 'Mensagem no passado!', dados, status)` (201 criar, 200 demais).
  Regra de negócio inválida: `throw new Error('mensagem')` / `httpResponse.validationError` / `conflict` / `notFound` / `forbidden`.
- Repository: SQL em template string, sempre parametrizado (`$1, $2`), colunas alinhadas uma por linha,
  palavras-chave SQL em maiúsculas. Retorna `resultado.rows` (lista), `rows[0]` (um) ou `rowCount` (delete).
  Aqui usa-se `req.db` recebido por parâmetro (RLS), não `openDb()`.
- Rotas: `export default router`, um comentário abaixo de cada rota dizendo o que vai em body/params.
  Nome dos paths em português: `/recurso`, `/recurso/contar`, `/recurso/cadastrar`, `/recurso/editar/:id`, `/recurso/deletar/:id`
  (no MoneySpace os usuários seguem REST: `GET/POST /usuarios`, `PUT /usuarios/:id`; manter o que já existe).
- Cabeçalho de arquivo grande: bloco `// ====` com `CONTROLLER: <assunto>` e as regras de autorização, como em `cadUsuario.controller.js`.
### Frontend
- HeroUI v3 PRIMEIRO. API composta (`Card.Header`, `Select.Trigger`, `Table.ScrollContainer`,
  `Modal.Backdrop/Container/Dialog`, `Pagination.*`, `Avatar.Fallback`). `Chip variant="soft"` (não existe `flat`/`primary`).
- Modal: `const modal = useOverlayState()`; `<Modal state={modal}>`; formulário em componente interno com `key` p/ resetar.
- Tokens de cor: `text-muted`, `text-accent`, `bg-accent/10`, `border-separator`, `bg-default`.
- COR DA MARCA: verde estilo Spotify via override de `--accent` no fim de `src/index.css`
  (claro `#14873b`, escuro `#1db954`). Não usar azul/`primary`.
- HTTP só por `src/services/*.js` (usam `api.js`). Auth por `useAuth()`. Feedback com `toast.promise`.
- Mobile-first: `useIsMobile` troca Table por cards, Sidebar por barra inferior. Respeitar safe-area (`env(safe-area-inset-*)`).
- Páginas em `src/pages/<Nome>/<Nome>.jsx`; subcomponentes em `src/pages/<Nome>/componentes/`.
- Sem backend: `VITE_MODO_DEMO=true npm run dev` libera rotas e usa mocks (fatura e usuários).

## ESTRUTURA (real)
```
MoneySpace-Back/
  server.js · db/script.sql (familia, usuario c/ is_master+role+ativo, utilitario, fatura_corpo, fatura_transacao)
  src/config/{env,configDb}.js · src/middleware/{auth/verificaToken,rateLimiter,rlsMiddleware}.js
  src/modules/app.js                      app Express (monta /api)
  src/modules/login/                      controller, repositories, routes
  src/modules/cadastros/familia/          cadFamilia.* (esqueleto parcial)
  src/modules/cadastros/usuario/          cadUsuario.{controller,Repositories,routes}.js  (IMPLEMENTADO)
  src/modules/cadastros/categoria/        cadCategoria.{controller,Repositories,routes}.js (IMPLEMENTADO: GET/POST /categorias)
  src/utils/{httpResponse,pgErrorHandler,crypto}.js
MoneySpace-Front/
  index.html (meta iOS/PWA) · public/{manifest.webmanifest,sw.js,icons/*}
  src/App.jsx                             providers (Auth, Theme, Fatura) + rotas
  src/context/                            AuthContext, ThemeContext, FaturaContext (mock compartilhado)
  src/services/{api,usuarioService}.js
  src/hooks/useIsMobile.js · src/utils/formatar.js (moeda, %, data, cpfMascara, dataHora, iniciais)
  src/mocks/faturaMock.js
  src/components/Seletor.jsx              Select {id,nome}
  src/components/Layout/{AppLayout,MenuNavegacao,navegacao.js}
  src/pages/{Login,Welcome(/perfil),EmBreve,Cadastros(hub),Dashboard,Faturas,Usuarios}
```
Rotas do front: `/login` · `/dashboard` (padrão) · `/faturas` · `/cadastros` (hub) ·
`/cadastros/usuarios` · `/cadastros/contas` e `/cadastros/categorias` (EmBreve) · `/perfil`.
Rotas do back: `/login`, `/login/2fa`, `/me`, `/auth/refresh`, `/logout`, `/2fa/*`, `/familias`, `/usuarios`, health.

## ESTADO
- Login/2FA/logout: funcionando. NÃO existe desativar usuário (colunas `ativo`/`ultimo_acesso` não existem no Neon; decisão do Gabriel: por enquanto não quer).
- Layout: topbar (3 linhas: PC = clique recolhe/mostra a lateral, hover abre painel preto com busca,
  grupos fechados, usuário/família/tema; celular = toque abre painel), lateral recolhível animada,
  grupo Cadastros com submenu animado, barra inferior no celular.
- Início (`/dashboard`): filtros cartão/competência + resumo + portadores + categorias (MOCK).
- Faturas (`/faturas`): conferência da reserva + tabela paginada (10 por página, campo "itens por página",
  máx. 200). Status é CAMPO ÚNICO: `pendente` (padrão de todo lançamento novo) | `na_hora` | `no_fechamento` |
  `pagamento` (não editável). Meta da reserva = na_hora + pendente. Tudo MOCK, sem API.
- Usuários (`/cadastros/usuarios`): família + lista (Table com custom cells; cards no celular), criar/editar
  (modal). Back: `GET/POST /usuarios`, `PUT /usuarios/:id`.
  Regras: listar = qualquer membro; criar/editar = ADMIN ou is_master; só master edita master; não pode
  rebaixar a si mesmo; CPF validado (dígitos) e gravado só com números; senha bcrypt, mín. 6;
  e-mail/CPF duplicado -> 409. Resposta do GET: `{ familia, usuarios, pode_editar }`.
- Categorias (`/cadastros/categorias`, 2026-11-09): linhas da tabela GLOBAL `utilitario` com tipo `'categoria'`
  (sem id_familia/RLS, vale para todas as famílias). Back: `GET /categorias` -> `{ categorias, pode_editar }`;
  `POST /categorias` body `{ valor }` (só is_master; valor trim + espaços colapsados + minúsculo; `ordem` = MAX+1;
  duplicata -> 409). Front: `pages/Categorias`, `services/categoriaService.js`. SEM editar/excluir (ver DÍVIDAS).
- PWA: manifest + service worker (só em produção; nunca cacheia `/api`) + ícones verdes (rascunho).
- NÃO EXISTEM ainda: `conta`, `categoria`, módulo `fatura` no back, migrations, importador de CSV.

## DECISÕES EM ABERTO (backend da fatura — Gabriel vai pensar)
- Schema tem `fatura_corpo`/`fatura_transacao`; o mock assume cartão -> fatura (competência) -> lançamentos,
  cartão = conta tipo CREDITO (tabela `conta` ainda não existe).
- Importação CSV (Rico 1º emissor): preview sem persistir, confirmar em transação única, idempotência por hash;
  todo lançamento importado nasce `pendente`.
- Contrato do mock: `{status, fechamento, vencimento, saldoReserva, transacoes:[{id,data,estabelecimento,portador,valor,parcela,categoria,status}]}`.

## COMANDOS
- Back: `cd MoneySpace-Back && npm run dev` (3000). Front: `cd MoneySpace-Front && npm run dev` (5173; proxy `/api`->3000).
- Build do front: `npm run build` (gera `dist`, que o back serve).

## DÍVIDAS
- Módulo de usuários ainda NÃO testado ponta a ponta contra o banco (só carga dos módulos + validação de CPF).
- `README.md`, `MoneySpace-Back/Readme.md`, `MoneySpace-Front/README.md`, `DEPLOY_DISCLOUD.md` não revisados.
- JWT sem `role`/`is_master`; autorização por papel só no módulo de usuários (consulta ao banco).
- Edição de família (`PUT /familias/:id`) e listagem de famílias não checam papel.
- Ícones do PWA são provisórios.
- Categorias: seed do `script.sql` está com maiúsculas/acentos ("Alimentação & Mercado") e a unique é por `(tipo, valor)`,
  então "outros" e "Outros" coexistem. Falta normalizar o seed/banco para minúsculo (e o `fatura_transacao.categoria`, que guarda o texto).
- Categorias sem editar/excluir: renomear/apagar deixaria `fatura_transacao.categoria` (texto) órfão. Decidir antes de implementar.
- Categorias/usuários/módulo novo ainda NÃO testados contra o banco real (só carga dos módulos e build do front).
