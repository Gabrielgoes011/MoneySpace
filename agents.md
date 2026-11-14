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
  (`CODIGO_UNIQUE_VIOLATION` exportado dali: `23505` -> 409 nos controllers de usuários e categorias).
- RLS POR ROTA: `router.get('/x', verificaToken, rlsMiddleware, controller)`; `rlsMiddleware` é export
  NOMEADO de `middleware/rlsMiddleware.js`. Passar `req.db` ao repository. INSERT usa
  `current_setting('app.current_familia_id', true)::uuid`. Além do RLS, filtrar `id_familia` na query.
- O JWT carrega só `id, id_familia, familia_nome, nome, email` (sem role): autorização lê o papel no banco.
- DECISÃO (Gabriel, 2026-11-09): o projeto é SEMPRE 2 camadas (controller + repository). NÃO criar `service`,
  mesmo que o `api-Node` (fii-track-back) use 4 arquivos por módulo. Do `api-Node` herda-se só o PADRÃO DE ESCRITA abaixo.
### Backend — padrão de ESCRITA (herdado do api-Node/fii-track-back)
- ORGANIZAÇÃO: quem abre o arquivo entende o que está sendo feito. Ordem fixa: imports, constantes,
  regiões de funções (`//#region`), exportação no fim. Uma responsabilidade por função.
- SIMPLICIDADE: não criar complexidade onde não há. Sem abstração "por precaução", sem camada extra.
  Se um trecho fica claro em 5 linhas, não o divida em 3 funções.
- NOMES SUGESTIVOS em português e completos: `usuarioEncontrado`, `senhaCriptografada`, `totalFundos`.
  Proibido `u`, `x`, `tmp`, `data2`, `res2`.
- PADRONIZAÇÃO: todo módulo novo segue o mesmo formato. Referência: `cadastros/usuario/` (`cadUsuario.*`).
- COMENTÁRIOS SEMPRE: todo passo tem comentário curto em minúscula acima; todo grupo de funções tem `//#region`.
  Sem comentário, o código não está pronto.
- ALIAS DE TABELA NO SQL: só uma letra, na ordem: 1ª tabela = `a`, 2ª = `b`, 3ª = `c`, 4ª = `d`, 5ª = `e`.
  A contagem é por query, e subquery usa a próxima letra livre (não recomeça em `a`). Ex.: `FROM cartao a INNER JOIN usuario b ON b.id = a.id_usuario`.
  Coluna sempre com o alias: `a.nome`, nunca `nome` solto em query com JOIN.
- BODY: sempre desestruturado num objeto `dados` com campos explícitos, lido de `req.body`. Não usar `req.body`
  espalhado pelo código nem `req.body ?? {}`. Campo não enviado fica `undefined` (usado para "não alterar").
  Exemplo: `const dados = { nome: req.body.nome, cpf: req.body.cpf };` e depois só `dados.nome`, `dados.cpf`.
- REGRA DE NEGÓCIO NÃO É HELPER: if que decide (permissão, validação de campo, bloqueio, estado) fica DENTRO
  da função do controller, mesmo que repita. NUNCA `_verificaX()` com regra de negócio dentro.
  Exemplo: checar se é ADMIN e validar o e-mail ficam escritos dentro de `criarUsuario`.
- HELPERS (`_nome`, não exportados) são só transformação técnica (ex.: calcular dígito). Onde ficam:
  - Usado só em um arquivo: fica DENTRO desse arquivo, com `_`. Ex.: `_calcularDigitoVerificador` em `utils/cpf.js`.
  - Função técnica genérica, sem conhecer o domínio (usada em 1 ou mais módulos): `src/utils/` com arquivo próprio
    (ex.: `httpResponse`, `pgErrorHandler`, `cpf.js` com `validarCpf`).
    Quando for utilitário de DOMÍNIO compartilhado, vira arquivo próprio em `utils/` com nome do assunto.
  - NÃO criar pasta `helpers/`. Uma pasta a mais só esconde código. Só separar em `<assunto>.helpers.js` dentro
    do módulo se o arquivo passar de ~300 linhas e os helpers forem usados pelo controller E pelo repository.
  - Helper de uso único não existe como arquivo: fica no lugar onde é usado, dentro da função ou do arquivo.
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
- SQL NUNCA é montado por concatenação/interpolação (`${...}`, `+`, variável dentro da query), nem para valor fixo
  tipo `current_setting`. Query 100% literal com `$1, $2`.
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
  (no MoneySpace: `GET /usuarios`, `POST /usuarios` (cadastrar), `POST /usuarios/editar/:id`; ver regra de POST abaixo).
- MÉTODO HTTP: SEMPRE prefira POST para escrever (cadastrar, editar, deletar), mesmo quando REST sugeriria PUT/PATCH/DELETE.
  GET só para ler. Paths de ação em português: `/recurso/cadastrar`, `/recurso/editar/:id`, `/recurso/deletar/:id`.
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
  src/modules/cadastros/cartao/           cadCartao.{controller,Repositories,routes}.js (IMPLEMENTADO: GET /cartoes, POST /cartoes/cadastrar, POST /cartoes/deletar/:id)
  src/modules/dashboard/                  dashboard.{controller,Repositories,routes}.js (IMPLEMENTADO: GET /dashboard)
  src/modules/fatura/                     fatura.{controller,Repositories,routes}.js (IMPLEMENTADO: GET /faturas, GET /faturas/listar, POST /faturas/cadastrar, /saldo/:id, /fechar/:id, /abrir/:id, /lancamentos/cadastrar, /lancamentos/editar/:id, /lancamentos/deletar/:id, /lancamentos/status/:id)
  src/modules/relatorios/                 relatorios.{controller,Repositories,routes}.js (IMPLEMENTADO: GET /relatorios/fatura, /relatorios/semanal, /relatorios/pendencias ?faturaId=)
  src/modules/rateio/                     rateio.{controller,Repositories,routes}.js (IMPLEMENTADO: GET /rateio?lancamentoId=, POST /rateio/partes/{cadastrar,editar/:id,deletar/:id,pagar/:id,absorver/:id}, POST /rateio/pagamentos/deletar/:id)
  src/utils/{httpResponse,pgErrorHandler,crypto,cpf}.js
MoneySpace-Front/
  index.html (meta iOS/PWA) · public/{manifest.webmanifest,sw.js,icons/*}
  src/App.jsx                             providers (Auth, Theme) + rotas
  src/context/                            AuthContext, ThemeContext
  src/services/{api,usuarioService,faturaService}.js
  src/hooks/useIsMobile.js · src/utils/formatar.js (moeda, %, data, cpfMascara, dataHora, iniciais, gerarCompetencias)
  src/utils/statusFatura.js               STATUS (chave da tela <-> valor do banco: 'na_hora' <-> 'na hora')
  src/components/Seletor.jsx              Select {id,nome}
  src/components/Layout/{AppLayout,MenuNavegacao,navegacao.js}
  src/pages/{Login,Welcome(/perfil),EmBreve,Cadastros(hub),Dashboard,Faturas,Usuarios}
```
Rotas do front: `/login` · `/dashboard` (padrão) · `/faturas` · `/cadastros` (hub) ·
`/cadastros/usuarios` · `/cadastros/contas` e `/cadastros/categorias` (EmBreve) · `/perfil`.
Rotas do back: `/login`, `/login/2fa`, `/me`, `/auth/refresh`, `/logout`, `/2fa/*`, `/familias`, `/usuarios`, `/categorias`, `/cartoes`, `/dashboard`, health.

## ESTADO
- Login/2FA/logout: funcionando. NÃO existe desativar usuário (colunas `ativo`/`ultimo_acesso` não existem no Neon; decisão do Gabriel: por enquanto não quer).
- Layout: topbar (3 linhas: PC = clique recolhe/mostra a lateral, hover abre painel preto com busca,
  grupos fechados, usuário/família/tema; celular = toque abre painel), lateral recolhível animada,
  grupo Cadastros com submenu animado, barra inferior no celular.
- Dashboard BACK (`GET /dashboard?competencia=AAAA-MM&cartaoId=<uuid>|todos`, 2026-11-10): SÓ LEITURA. Devolve
  `{ competencia, cartoes, resumo {pago,pendente,fechamento,total,saldoReserva}, portadores[], categorias[], semCategoria }`.
  Todas as listas vêm com os cadastros inteiros (quem tem 0 aparece com 0). Testado com PGlite (28 cenários).
  DECISÃO TEMPORÁRIA: `fatura_transacao.portador` é o NOME do CSV, então "quem gasta" casa por nome (sem diferença de
  maiúsculas). Trocar por `id_usuario` na fatura quando o módulo de fatura for construído.
  Lançamento de pagamento (`estabelecimento = 'Pagamento de fatura'`) e valor <= 0 ficam FORA dos gastos.
  Sem `cartaoId`, usa o cartão `principal = true` (ou todos se não houver); a resposta traz `cartaoId` escolhido.
  `saldoReserva` soma só as faturas da competência pedida. Período dos gastos = COMPETÊNCIA da fatura
  (`fatura_corpo.competencia`), igual à tela de Faturas; a data da compra não filtra.
  Sem `competencia`, usa a fatura MAIS RECENTE do cartão (sem fatura = mês atual); a resposta traz `competencias[]`
  (só as que têm fatura). Conferido contra o Neon (Out/2026, Rico: total 4.986,70 = soma direta da fatura).
- Início (`/dashboard`, 2026-11-10): consome SÓ `GET /dashboard` (`services/dashboardService.js`). Abre no cartão
  principal e na fatura mais recente; seletor de competência = só meses com fatura. Trocar cartão volta para a
  fatura mais recente dele. NÃO testado no navegador.
- RELATÓRIOS (2026-11-10): aba `/relatorios` (menu). Escolhe cartão e fatura, "Gerar relatório" mostra o resumo,
  e os botões: "Compartilhar (WhatsApp)" (folha de compartilhar do aparelho; sem suporte, baixa o PDF), "Baixar PDF"
  e "Copiar resumo" (texto para colar no grupo). PDF gerado NO APARELHO com jsPDF + jspdf-autotable
  (`src/utils/relatorioFatura.js`), sem servidor. Dados: `GET /relatorios/fatura` (cabeçalho, resumo por status,
  por pessoa, por categoria e todos os lançamentos). Testado com PGlite (20 cenários). PDF NÃO visto
  visualmente (sem renderizador no ambiente de teste); só texto e paginação conferidos.
  Aba "Por semana" (`GET /relatorios/semanal?faturaId=`): semanas segunda a domingo com o total e o total por
  categoria, mais os lançamentos de cada categoria (recolhíveis na tela e no PDF). Mesmos botões de compartilhar,
  baixar e copiar. Testado com PGlite (12 cenários da semana; soma das semanas = total da fatura).
  REGRA DE PARCELA (2026-11-11): parcela "N de M" com N > 1 NÃO é gasto da semana (é cobrança de compra antiga).
  Ela vai para o bloco `parcelasAnteriores` no final (total e lançamentos). Só "1 de M" e "-" entram nas semanas e
  nas categorias. Soma das semanas + parcelas anteriores = total da fatura.
  Formato "Resumido" (para compartilhar sem detalhes): só totais das semanas e de cada categoria, sem lançamentos.
  Formato "Completo": também os lançamentos de cada categoria (recolhíveis na tela e no PDF).
  PENDÊNCIAS (2026-11-12): aba "Pendências" em `/relatorios`. `GET /relatorios/pendencias?faturaId=` devolve
  `{ cabecalho, totalPendente, quantidadePendente, porPessoa[], lancamentos[] }`. Pendente = lançamento com status `pendente`
  (não entra "na hora" nem "no fechamento"). Traz total para pagar, vencimento, "Resumo por usuário" (`porPessoa[]`:
  quanto cada um tem pendente) e a lista item a item do que falta pagar (`lancamentos[]`, do mais antigo).
  Uma conta só: a lista de itens não mostra quem comprou. Mesmos botões de WhatsApp, baixar e copiar.
  Escopo = a fatura escolhida (não todas as faturas).
  RATEIO NO COPIAR (2026-11-14): cada item rachado traz `rateio[]` (nome, previsto, pago, falta, absorvido) e o total traz `aReceber`
  (o que os outros ainda devem). O TEXTO COPIADO/WhatsApp mostra, por compra, o total da linha e, para cada pessoa, "pagou X, falta Y"
  (ou "absorvido"), e no topo "Total pendente" + "Falta receber do rateio". PDF e tela ainda não mostram as partes no texto do PDF.
  Testado com PGlite (testa_relatorio: 5 cenários de pendências, TUDO OK). PDF e tela NÃO vistos visualmente.
- DÍVIDA TÉCNICA: controllers usam `Promise.all` no mesmo `req.db` (client da transação). O `pg` enfileira, mas avisa
  que isso será removido no pg@9. Trocar por `await` em sequência quando atualizar o `pg`.
- FATURAS (2026-11-10): SEM MOCK, lê e grava no banco. Cabeçalho (`fatura_corpo`) tem `id_cartao`, `competencia`
  (AAAA-MM), `data_fechamento`, `data_vencimento`; 1 fatura por cartão e competência (índice único). Sem fatura no mês,
  o cabeçalho mostra "Criar fatura" (confirmação; fechamento/vencimento saem dos dias do cartão: fecha no mês da
  competência; vence no mesmo mês se o dia for depois do fechamento, senão no seguinte). "Lançar gasto" manual
  (data real, valor > 0, categoria só do cadastro, portador = nome do usuário, status padrão `pendente`).
  Fatura FECHADA bloqueia saldo, lançamento e troca de status (409). Qualquer membro opera (decisão de contrato).
  Front: `services/faturaService.js`, `pages/Faturas/Faturas.jsx` + `componentes/{CriarFaturaModal,LancamentoFormModal}`.
  Testado com PGlite (39 cenários). EXIGE `migration-002` e `migration-003` aplicadas no Neon (ainda NÃO aplicadas
  pelo Gabriel). CSV ainda não existe (botão removido até lá). Seletor "Fatura" lista só as faturas que JÁ EXISTEM
  do cartão (`GET /faturas/listar?cartaoId=`, nome = título, mais recente primeiro); criar mês novo = modal com campo mês.
  Status na API: `pendente` | `na hora` | `no fechamento` | `nao aplicavel` (o front converte).
  Tabela de lançamentos (`TransacoesLista.jsx`, tudo no front): UMA pesquisa (sem acento) que aceita texto livre e
  `Coluna: valor` separados por `;`. Desktop: título da coluna abre menu (filtrar, que grava `Coluna: valor` na
  pesquisa, e ordenar). Celular: select "Ordenar". Paginação compacta com "…" (celular: "3 de 13");
  itens por página = select 10/25/50/100/200.
  Conferência da reserva (PC) recolhe pelo botão «« ao lado de "Lançamentos": sobe e some, depois a coluna fecha e o
  grid cresce para a esquerda (abrir = inverso). Estado lembrado em `localStorage` (`faturas:conferencia`). Categoria e status são dropdown na linha.
  Ações por linha: editar (`POST /faturas/lancamentos/editar/:id`, campo não enviado fica como está; `idUsuario: ''` e
  `categoria: ''` tiram portador/categoria) e excluir (`POST /faturas/lancamentos/deletar/:id`). Ambas só com fatura aberta.
  Testado com PGlite (fatura: 60 cenários).
- Usuários (`/cadastros/usuarios`): família + lista (Table com custom cells; cards no celular), criar/editar
  (modal). Back: `GET /usuarios`, `POST /usuarios`, `POST /usuarios/editar/:id`.
  Regras: listar = qualquer membro; criar/editar = ADMIN ou is_master; só master edita master; não pode
  rebaixar a si mesmo; CPF validado (dígitos) e gravado só com números; senha bcrypt, mín. 6;
  e-mail/CPF duplicado -> 409. Resposta do GET: `{ familia, usuarios, pode_editar }`.
- MINHA CONTA (`/perfil`, 2026-11-14; link "Minha conta" no bloco do usuário do menu do topo). Tela `pages/Conta/Conta.jsx`
  com 3 blocos, todos do PRÓPRIO usuário (qualquer membro):
  - Dados pessoais: `GET /usuarios/minha-conta` -> `{ usuario }`; `POST /usuarios/minha-conta` body `{ nome, email, cpf }`
    (nome mín. 2, e-mail válido, CPF válido gravado só com números, e-mail/CPF de outro membro -> 409). Perfil (role) não muda.
  - Senha: `POST /usuarios/trocar-senha` body `{ senhaAtual, senhaNova }`. Nova com mín. 8 (mais que os 6 do cadastro),
    diferente da atual. Senha atual errada -> 400 (NÃO 401: o front derruba a sessão com 401). Rate limit = loginLimiter.
  - 2FA: `/2fa/iniciar` (QR), `/2fa/confirmar` (liga), `/2fa/desativar` body `{ codigo }`. DESATIVAR EXIGE o código TOTP
    atual (antes qualquer sessão desligava o 2FA; corrigido em 2026-11-14).
  Testado com PGlite: `testa_troca_senha` (13 cenários) e `testa_minha_conta` (9 cenários), TUDO OK.
  NÃO testado no navegador nem o 2FA ponta a ponta (depende do app autenticador).
- RATEIO (2026-11-14): compra rachada entre várias pessoas (da família ou de fora, só o NOME). EXIGE `db/migrations/migration-005-rateio.sql`
  aplicada no Neon (ainda NÃO aplicada; o Gabriel aplica no SQL Editor). Sem ela, a fatura inteira quebra (`fatura_transacao.rateado`).
  - Tabelas: `rateio_pessoa` (nomes por família, único sem diferença de maiúsculas), `fatura_rateio` (parte de uma pessoa em um
    lançamento: `valor_previsto`, `absorvido`), `fatura_rateio_pagamento` (cada pagamento). `fatura_transacao.rateado` = flag.
  - O valor pago de uma parte NÃO é coluna: é a SOMA dos pagamentos. Pode pagar em várias vezes e pagar a MAIS que o previsto.
  - As partes NÃO precisam somar o valor da compra (grava mesmo assim; a tela mostra "faltam/sobram"). O que não foi rateado fica
    com quem adiantou (portador do lançamento). Absorver = quem adiantou assume o que falta; sai do "a cobrar"; dá para desfazer.
  - Situação da parte (calculada no back): pendente | parcial | pago | pagou a mais | absorvido. "A cobrar" soma só o que falta nas
    partes não absorvidas (pagar a mais não abate as dívidas dos outros).
  - Rateio é controle da família, não do cartão: o total da fatura e o status do lançamento NÃO mudam, e o rateio edita mesmo com
    a fatura FECHADA. Editar o valor previsto vale mesmo com pagamentos. Remover parte só sem pagamentos (apague o pagamento antes).
  - Travas na fatura: não dá para desligar a flag `rateado` com partes cadastradas (409) nem excluir lançamento com pagamento de
    rateio (409). A flag liga sozinha ao incluir a 1ª parte, ou no formulário do lançamento ("Racha esta compra entre pessoas").
  - Front: linha rateada destacada + botão "Rateio" (também na marca "Rateio" da linha) abre `RateioModal` (janela no PC, tela cheia
    no celular). Escritas só confirmam; a tela busca o rateio de novo (GET).
  - JÁ RECEBIDO DO RATEIO (2026-11-14, corrigido): cada lançamento traz `recebido` = o que as OUTRAS pessoas já pagaram (partes NÃO
    absorvidas). Dinheiro que já está com quem adiantou sai do pendente: `pendente líquido = pendente bruto − recebido` (só compras
    "pendente"). Vale nos cards da fatura (`calculos.js`: Pendente líquido, "já recebido do rateio" embaixo), no dashboard
    (`resumo.pendente` já vem líquido + `resumo.recebidoRateio`) e no relatório geral (`resumo.recebidoRateio`, `metaReserva`).
    Meta = na hora + pendente líquido. Total da fatura continua o bruto (é o que o cartão cobra).
  - PENDÊNCIAS: `totalPendente` = líquido (igual aos cards); `porPessoa` = líquido por portador; cada linha traz `valor` (cheio),
    `recebido` e `valorLiquido`. `aReceber` continua sendo o que os outros AINDA devem (falta), só aparece se > 0.
    Texto/tela: "falta" da pessoa só aparece se > 0 (`descreverParteRateio`): "pagou X (quitado)", "pagou X, falta Y", "falta Y", "absorvido".
  - Testado com PGlite: `testa_rateio` + `testa_relatorio` + `testa_fatura` (com a 005). NÃO testado no navegador.
  - Fora do escopo por enquanto: relatório "quem me deve" por pessoa; rateio no dashboard.
- Categorias (`/cadastros/categorias`, 2026-11-09): linhas da tabela GLOBAL `utilitario` com tipo `'categoria'`
  (sem id_familia/RLS, vale para todas as famílias). Back: `GET /categorias` -> `{ categorias, pode_editar }`;
  `POST /categorias` body `{ valor }` (só is_master; valor trim + espaços colapsados + minúsculo; `ordem` = MAX+1;
  duplicata -> 409). Front: `pages/Categorias`, `services/categoriaService.js`. SEM editar/excluir (ver DÍVIDAS).
- PWA: manifest + service worker (só em produção; nunca cacheia `/api`) + ícones verdes (rascunho).
- Cartões (back, 2026-11-10): `GET /cartoes` -> `{ cartoes, pode_cadastrar }` (qualquer membro; principal primeiro;
  sem arquivados); `POST /cartoes/cadastrar` body `{ nome, final, idUsuario, limite?, diaFechamento?, diaVencimento?, principal? }`
  SÓ ADMIN da família (ou dono do app). Regras: `final` = 4 dígitos; dono precisa ser da mesma família; `principal`
  desmarca o anterior na mesma transação; nome repetido na família -> 409. `usuario_cadastro` = `req.user.nome`.
  Testado com PGlite (17 cenários). A tabela `cartao` JÁ EXISTE no Neon (checado em 2026-11-10, com 1 linha).
  Front `/cadastros/cartoes` (lista, cadastrar e excluir): feito, build OK, NÃO testado no navegador.
- EXCLUIR CARTÃO (2026-11-10): `POST /cartoes/deletar/:id`, SÓ ADMIN. Só exclui se NÃO houver lançamento
  (`fatura_transacao`) nas faturas do cartão; faturas vazias do cartão são apagadas junto. Sem lançamento -> 200;
  com lançamento -> 409; cartão de outra família -> 404. Front: botão lixeira (só admin) + confirmação.
  Depende da `migration-002-fatura-cartao.sql` (adiciona `fatura_corpo.id_cartao`, FK ON DELETE RESTRICT).
  Testado com PGlite (16 cenários). Migration 002 ainda NÃO aplicada no Neon.
- NÃO EXISTEM ainda: `conta` corrente/carteira, módulo `fatura` no back (só o SQL), importador de CSV.

## DECISÕES EM ABERTO (backend da fatura — Gabriel vai pensar)
- Schema tem `fatura_corpo`/`fatura_transacao`; o mock assume cartão -> fatura (competência) -> lançamentos,
  CARTÃO É TABELA PRÓPRIA `cartao` (decisão 2026-11-10, substitui "cartão = conta CREDITO"): dono (`id_usuario`),
  apelido, últimos 4 dígitos, limite, dias de fechamento/vencimento, `principal` (só 1 por família, índice único
  parcial; é o que carrega no dashboard) e `arquivado`. Migration: `db/migrations/migration-001-cartao.sql`
  (validada em PGlite, ainda NÃO aplicada no Neon). Conta corrente/carteira: ainda não modelada.
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
- `fatura_corpo` ainda tem `UNIQUE (id_familia, titulo)`: com 2 cartões, o título "Out/2026" de um cartão bloqueia o do outro.
  Trocar para `UNIQUE (id_cartao, titulo)` quando o módulo de fatura for construído.
- Categorias/usuários/módulo novo ainda NÃO testados contra o banco real (só carga dos módulos e build do front).
- CONFERÊNCIA DO CSV DO BANCO: REMOVIDA (2026-11-12, pedido do usuário). Não existe mais `POST /faturas/importacao/analisar`,
  nem o botão "Analisar extrato", nem `utils/csvFatura.js`. Se voltar, começar do zero.
- DADO A CORRIGIR: o `dia_fechamento` do cartão Rico no Neon está 9 (o correto é 25), e por isso
  `fatura_corpo.data_fechamento` de outubro está 09/10. Corrigir o cadastro e recalcular a fatura (precisa de autorização).
