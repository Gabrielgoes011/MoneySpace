# Análise e recomendação — módulo de controle da fatura Rico

## Resumo executivo

O foco recomendado é um módulo vertical e restrito ao cartão Rico, usando a infraestrutura multi-tenant e a tabela `conta` já existente, em vez de introduzir agora um segundo modelo genérico de cartões. A primeira entrega deve permitir: selecionar uma competência, importar um CSV Rico uma única vez, revisar/classificar lançamentos, acompanhar a meta da reserva (à vista pago + pendente), visualizar totais por portador/categoria e fechar a competência.

O código atual oferece uma boa base de autenticação, layout mobile-first, HeroUI, Axios, `conta` real com RLS e soft delete. Porém o domínio da fatura ainda não existe: `Dashboard` e `Transacoes` usam mocks, não há tabelas `faturas`/`transacoes_fatura`, nem rotas ou serviços correspondentes. A especificação candidata deve ser adaptada antes de codar: manter os nomes e a segurança do projeto (`id`, `id_familia`, `dt_cadastro`, `NUMERIC(14,2)`), tratar Rico como uma conta de crédito (`tipo = 'CREDITO'`, identificada por instituição/nome), usar usuários da família como portadores quando possível e tornar a importação idempotente.

A recomendação é não implementar neste momento o controle financeiro geral, contas a pagar, receitas, empréstimos, transferências, email, múltiplos emissores ou um motor genérico de parcelamento. O MVP deve resolver o ritual diário/mensal da fatura Rico com o menor modelo novo possível e preservar uma evolução futura para outros cartões.

## Evidências verificadas no repositório

### Documentação e estado declarado

- `agents.md` define Node/Express em ESM, PostgreSQL com SQL nativo, React/Vite/HeroUI, respostas em `utils/httpResponse.js`, SQL somente em repositories e RLS aplicado por rota depois de `verificaToken`.
- `agents.md` registra `MoneySpace-Back/src/modules/conta/` como implementado, e o frontend de contas como consumidor da API real. Registra `Dashboard`, `Transacoes`, `Categorias` e `Usuarios` na estrutura, mas não afirma que os domínios analíticos estejam reais.
- `ROADMAP_DESENVOLVIMENTO.md` ainda organiza o produto como um app financeiro geral: lançamentos à vista na fase 3, parcelamento na fase 4, categorias/relatórios depois. Isso entra em conflito de prioridade com o novo foco exclusivo em fatura Rico e deverá ser revisado quando houver decisão de produto; não foi alterado nesta investigação.
- `escopo_e_arquitetura_app_de_finan_as.md` e `README.md` modelam `compra` + `transacao`, contas de vários tipos, categorias híbridas, usuários como donos de gastos, RLS por família e NUMERIC(14,2). Esse modelo é mais amplo que o fluxo de fatura Rico.
- A busca por `MoneySpace-Back/db/migrations` não encontrou arquivos. A fonte real observada é `MoneySpace-Back/db/script.sql`; qualquer evolução de schema precisa primeiro definir o processo de migration/versionamento, sem assumir que migrations existentes possam ser reutilizadas.

### Banco real

- `MoneySpace-Back/db/script.sql` tem `familia`, `usuario`, `conta`, `categoria`, `contato`, `compra`, `transacao`, notificações e transferências.
- `conta` já aceita `CORRENTE`, `CREDITO` e `CARTEIRA`, com `bandeira`, `final_cartao`, `limite`, `dia_fechamento` e `dia_vencimento`. Portanto uma tabela `cartoes` separada duplicaria parte do domínio. Rico pode ser representado inicialmente por uma conta `CREDITO` chamada Rico, com uma convenção clara para identificar o cartão.
- `categoria` já suporta categorias globais (`padrao_sistema = true`, `id_familia IS NULL`) e categorias da família. Isso é reaproveitável, mas os nomes atuais são singular (`categoria`) e usam `cor`, não `cor_hex`.
- Não existem `faturas`, `transacoes_fatura`, `portadores`, `regras_categorizacao` nem as views analíticas da especificação candidata.
- O schema real usa `dt_cadastro`, `dt_compra`/`dt_transacao`, FKs com `id_` e `NUMERIC(14,2)`, enquanto a DDL candidata usa `criado_em`, `data_transacao`, FKs como `cartao_id`/`fatura_id` e `NUMERIC(12,2)`. A DDL candidata não pode ser aplicada sem adaptação.
- A tabela `usuario` do script tem a coluna `senha`; documentação e exemplos em `README.md`/escopo mencionam `senha_hash`. Essa inconsistência é pré-existente e não deve ser replicada no módulo de fatura.
- As policies de categoria permitem leitura das categorias do sistema e alteração apenas das categorias da família. Qualquer nova tabela de fatura precisa conter `id_familia`, habilitar RLS e ter policy baseada em `current_setting('app.current_familia_id', true)::uuid`.

### Backend

- `MoneySpace-Back/src/modules/app.js` é o app em uso e monta tudo sob `/api`: health, login, conta e família. Não há rota de fatura.
- `MoneySpace-Back/src/modules/conta/conta.routes.js` é o padrão correto: cada endpoint usa `verificaToken`, depois `rlsMiddleware`, depois controller.
- `conta.controller.js`, `conta.service.js` e `conta.repositories.js` mostram a separação controller/service/repository; o controller não tem SQL, o service valida e o repository recebe explicitamente `req.db`.
- `rlsMiddleware.js` abre transação, valida o UUID do JWT, executa `set_config('app.current_familia_id', $1, true)` e anexa o client em `req.db`. O módulo novo deve sempre propagar esse client até o repository; não deve depender somente de `AsyncLocalStorage`.
- `httpResponse.js` padroniza `{ success, message, data }` e oferece `validationError`, `unauthorized`, `forbidden`, `notFound`, `conflict` e `error`. Os endpoints novos devem usar esses métodos.
- `cadFamilia` ainda é esqueleto/inconsistente: `cadFamilia.repositories.js` tem funções incompletas e exemplos com SQL inválido/assinaturas incompatíveis. Não é um padrão confiável para o domínio de fatura; usar `conta` como referência e não misturar essa dívida com o MVP Rico.
- O backend não possui script de testes no `MoneySpace-Back/package.json`; os únicos scripts são `dev` e `start`. A validação backend disponível hoje é smoke test HTTP/integrado quando o banco e ambiente estão configurados.

### Frontend

- `MoneySpace-Front/src/App.jsx` protege as rotas com `AuthProvider`/`useAuth` e monta `Layout`. A nova tela deve ser uma rota protegida dentro desse layout.
- `src/services/api.js` é o cliente Axios central, usa `/api` por padrão, injeta Bearer token, envia cookies e redireciona em 401 fora do login. O serviço de faturas deve usá-lo diretamente, sem fetch paralelo.
- `src/pages/Contas/Contas.jsx` + `ContaFormModal.jsx` demonstram cards para poucos itens heterogêneos, toasts HeroUI e estados de carregamento/vazio. Esse padrão serve para seletor/resumo de faturas, mas não para a tabela de lançamentos.
- `src/pages/Transacoes/Transacoes.jsx` lista dados de `src/mocks/dadosFinanceiros` e ainda apresenta o modelo genérico `tipo/status`; precisa ser substituída ou receber uma tela específica de lançamentos da fatura Rico, sem presumir que os mocks sejam API.
- `src/pages/Dashboard/Dashboard.jsx` calcula tudo de `src/mocks/dadosFinanceiros`; seus cards de resumo, `Card`, `Chip`, `Meter`, privacidade e toasts são reaproveitáveis como linguagem visual, mas as métricas deverão vir do endpoint da fatura.
- `src/components/Layout/Sidebar.jsx` e `BottomNavMobile.jsx` já têm navegação responsiva. O item “Fatura Rico” pode ser adicionado como acesso principal; a escolha de remover/renomear “Transações” depende da decisão de navegação do produto.
- `package.json` do front oferece `npm run build`, mas não possui script de testes. O build é a validação automatizada efetivamente disponível.

## O que pode ser reaproveitado sem alteração

1. Autenticação/JWT, `AuthContext`, `verificaToken`, `api.js`, cookies e tratamento de 401.
2. RLS por transação e o contrato operacional `verificaToken -> rlsMiddleware -> controller`; não usar RLS global.
3. Estrutura controller/service/repository e o padrão de passar `req.db` explicitamente, tomando `src/modules/conta` como referência.
4. `httpResponse.js`, `pgErrorHandler.js`, UUID, `id_familia`, `dt_cadastro`, `usuario_cadastro`, snake_case e `NUMERIC(14,2)`.
5. Tabela `conta` para representar o cartão Rico e a funcionalidade de arquivar; não criar `cartoes` no MVP sem necessidade real.
6. Categorias globais/familiares existentes, desde que o contrato use a tabela real `categoria` e as regras de RLS atuais.
7. Layout, `useIsMobile`, `PrivacyContext`, formatadores pt-BR e componentes HeroUI já usados nas páginas atuais.
8. Toasts, estados de carregamento/vazio e o padrão de cards da tela de contas.

## O que precisa ser adaptado

- Criar módulo backend próprio, por exemplo `src/modules/fatura/`, com routes/controller/service/repositories, e registrá-lo em `src/modules/app.js`.
- Criar schema incremental para fatura/importação/lançamento alinhado a `id`, `id_familia`, `id_conta`, `dt_*`; não copiar nomes da DDL candidata literalmente.
- Trocar o conceito candidato `portadores` por uma decisão explícita: no MVP, mapear `Portador` do CSV a `usuario` da família por nome normalizado, com tratamento para “não identificado”. Uma tabela de portadores só é necessária se o cartão tiver portadores que não são usuários autenticados.
- Reaproveitar `categoria`, adicionando apenas regra/endpoint de escolha ou de autocategorização se isso for indispensável. `regras_categorizacao` pode ficar para uma fase posterior; o primeiro importador pode apenas deixar categoria nula ou aplicar um conjunto inicial confirmado.
- Fazer o frontend consumir API real e remover a dependência de mock apenas da área Rico, sem tentar converter todo o dashboard financeiro geral de uma vez.
- Definir uma tela de fatura dedicada, com seletor de competência e tabela real; a tabela deve usar `Table`/`Table.ScrollContainer` do HeroUI, com seleção/sort/filtros e ações, conforme `agents.md`.

## Inconsistências e riscos da especificação candidata

### Multi-tenant e autorização

A DDL candidata não inclui `id_familia` em suas tabelas novas, não define policies RLS nem explica como categorias/portadores são isolados. Isso permitiria cruzamento de famílias se aplicado literalmente. Todas as tabelas de domínio da fatura devem possuir `id_familia`, FKs coerentes e policies; leituras e escritas devem ocorrer na transação de `req.db`. O cartão Rico não deve ser identificado somente por nome sem verificar que pertence à família.

Também não basta esconder botões: atualização de lançamento, saldo da reserva, importação e fechamento precisam de autorização no backend. A pendência registrada em `agents.md` sobre `is_master`/`role` continua separada do MVP, mas o módulo deve ao menos exigir usuário autenticado e definir se qualquer membro ou apenas `ADMIN` pode fechar/importar.

### Nomenclatura e schema

`cartao_id`, `fatura_id`, `portador_id`, `data_transacao` e `criado_em` violam a convenção observada (`id_cartao`/`id_fatura`/`id_portador`, `dt_transacao`, `dt_cadastro`). `status_fatura` como enum pode ser válido, mas o projeto atual usa strings/checks; escolher uma estratégia e documentá-la. A recomendação é `VARCHAR` + `CHECK` no primeiro incremento para facilitar evolução, mantendo valores em maiúsculas.

### Rico versus app genérico

A especificação candidata introduz um sistema de cartões genérico enquanto a decisão atual é Rico apenas. O MVP deve ter `id_conta` apontando para `conta.tipo = 'CREDITO'` e uma validação de que a conta é Rico. Se futuramente houver Nubank/XP, a mesma abstração pode ser generalizada; não antecipar views/UX para múltiplos emissores agora.

### Importação duplicada e consistência

Reimportar o mesmo CSV não pode criar lançamentos duplicados. O arquivo não fornece necessariamente um ID estável; uma combinação ingênua de data, estabelecimento, portador, valor e parcela também pode colidir em duas compras legítimas iguais. Recomenda-se registrar uma tabela de lote/importação com hash do arquivo, tamanho e timestamps, e uma impressão digital determinística por linha dentro do lote. O service deve aceitar o mesmo hash como idempotente, rejeitar arquivo já processado ou oferecer preview antes da confirmação. A escolha entre rejeitar e mesclar precisa ser confirmada; para o MVP, rejeitar o mesmo hash é mais seguro.

A importação deve ser transacional: validar todo o CSV e as referências antes de inserir, ou fazer rollback completo. O upload precisa ter limite de tamanho, exigir CSV/texto e não confiar em nomes de arquivos.

### Sinais e normalização de valores

O requisito diz que o valor brasileiro precisa ser normalizado, mas não define se o CSV Rico usa compra positiva, débito negativo, estorno negativo ou sinais mistos. A regra de negócio deve separar `valor_original`/sinal (se necessário) de `valor` normalizado e documentar o tratamento. O MVP deve aceitar `R$ 1.234,56`, `1.234,56`, espaços e sinal explícito; rejeitar ambiguidade e linhas inválidas com relatório de linha. Pagamento de fatura e estorno precisam ser reconhecidos por regra verificável (estabelecimento/descrição), não por substring ampla que classifique uma compra normal como pagamento.

### Parcelas e competência

A regra “contendo `de`” é frágil: pode aceitar texto malformado ou confundir estabelecimento/coluna errada. Validar padrão de parcela (`n de m`, com `1 <= n <= m`) e manter o texto original. A decisão de competência deve ser explícita: competência do arquivo/fatura, data de fechamento, vencimento ou mês da transação. Para o caso Rico, a fatura importada deve definir a competência e as linhas devem pertencer a ela, sem recalcular silenciosamente outra fatura.

### Fechamento

Fechar uma fatura não deve ser apenas alterar um texto: precisa impedir novas importações/edições incompatíveis e registrar `fechada_em`/usuário. É necessário decidir se lançamentos ainda podem ser corrigidos após fechamento por uma ação de reabertura auditável. A abertura da próxima competência deve ser idempotente e não deve duplicar a fatura; idealmente cria somente o cabeçalho vazio quando solicitado, sem copiar transações.

### Categorias e portadores

A especificação usa `portadores` independentes, mas o app já tem `usuario` e o relatório conceitual trabalha por usuário. Duplicar Gabriel/Geovana em outra tabela pode gerar nomes divergentes e perda de integridade. Mapear por `id_usuario` é preferível para o MVP; manter `nome_portador_importado` para auditoria e lidar explicitamente com “não mapeado”. Categorias também devem referenciar `categoria`, preservando as categorias globais e a separação por família.

### Reserva

`saldo_reserva_declarado` por fatura e `meta_reserva` derivada de status são conceitos bons, mas o status precisa estar em cada lançamento e ter origem/sugestão versus ajuste manual. A diferença é `saldo_declarado - meta`, com `NUMERIC`, e o frontend nunca deve calcular com strings sem conversão. Definir se “NA_HORA_PAGO” significa confirmado pelo usuário ou inferido automaticamente; recomendar: importação sugere, usuário confirma/edita, e o fechamento exige que pendências sejam conscientemente aceitas.

### Precisão, concorrência e auditoria

`pg` retorna `NUMERIC` como string. Repositories podem retornar strings cruas para valores monetários, mas services devem converter para cálculo com `Number` ou usar cálculo SQL; a API deve ter contrato consistente. Atualização da reserva, edição de status e fechamento precisam respeitar estado da fatura e concorrência. Registrar `id_usuario`/`usuario_cadastro` e timestamps das alterações ajuda a explicar divergências; evitar float na persistência.

## Modelo de dados/migrations recomendado

Usar migrations numeradas no padrão que o projeto documenta (`migration-NN-descricao.sql`); como nenhuma pasta foi encontrada, a primeira etapa de implementação deve criar o mecanismo/diretório e definir como aplicar migrations sem reexecutar `script.sql` destrutivamente. Não alterar o `script.sql` de forma ambígua sem decidir se ele continua sendo schema completo de instalação.

### Migração inicial recomendada do domínio Rico

1. **`fatura_rico`/cabeçalho de fatura** (nome final a confirmar; recomendação: `fatura`):
   - `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`;
   - `id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE`;
   - `id_conta UUID NOT NULL REFERENCES conta(id)`;
   - `competencia DATE NOT NULL` (primeiro dia do mês, regra única);
   - `nome_exibicao VARCHAR(50) NOT NULL`;
   - `status VARCHAR(20) NOT NULL DEFAULT 'ABERTA'` com check `ABERTA/FECHADA/PAGA`;
   - `saldo_reserva_declarado NUMERIC(14,2) NOT NULL DEFAULT 0`;
   - `fechada_em TIMESTAMP`, `fechada_por UUID REFERENCES usuario(id)`, `dt_cadastro TIMESTAMP DEFAULT NOW()`;
   - `UNIQUE (id_familia, id_conta, competencia)`;
   - index por `(id_familia, id_conta, competencia)`.

2. **`fatura_importacao`**: lote por fatura com `id`, `id_familia`, `id_fatura`, hash do arquivo, nome/tamanho opcional, quantidade, `dt_cadastro`, `usuario_cadastro`; unique `(id_fatura, hash_arquivo)`. Isso dá idempotência sem fingir que uma linha igual é sempre a mesma compra.

3. **`fatura_transacao`** (ou `transacao_fatura`, se essa nomenclatura for decidida):
   - `id`, `id_familia`, `id_fatura`, `id_importacao`;
   - `id_usuario_portador UUID NULL REFERENCES usuario(id)` e `portador_nome_importado` para auditoria/mapeamento;
   - `id_categoria UUID NULL REFERENCES categoria(id)`, permitindo categoria global ou da família conforme policy;
   - `dt_compra DATE`, `estabelecimento VARCHAR(255)`, `valor NUMERIC(14,2)`, `valor_original VARCHAR(100)` se o sinal textual precisar ser preservado;
   - `parcela_texto VARCHAR(20)`, `numero_parcela`, `total_parcelas` opcionais;
   - `sugestao_liquidacao VARCHAR(30) NOT NULL`, `ajuste_liquidacao VARCHAR(30)`, `status_liquidacao` calculado no service/query como coalesce, com check para `NA_HORA_PAGO`, `NA_HORA_PENDENTE`, `NO_FECHAMENTO`, `NAO_APLICAVEL`;
   - `fingerprint_linha` e unique `(id_importacao, fingerprint_linha)`;
   - `usuario_cadastro`, `dt_cadastro`, `dt_atualizacao`.

Views analíticas só depois do primeiro fluxo funcionando. Preferir queries/repositories do dashboard no MVP para controlar conversões e filtros; uma view pode vir depois para `total_fatura`, totais por status, `meta_reserva`, `diferenca_reserva` e `status_conferencia`. Se criada, deve expor `id_familia` indiretamente via fatura e nunca substituir as policies.

### Regras de criação/classificação

- Validar que `id_conta` pertence ao tenant, está ativa, é `CREDITO` e representa Rico.
- Normalizar CSV no service: cabeçalho exato/aliases aprovados, UTF-8, delimitador detectado apenas se seguro, datas pt-BR, valor pt-BR, trim e relatório de erros por linha.
- Pagamento de fatura/estorno vira `NAO_APLICAVEL` somente por regra confirmada; parcela válida vira `NO_FECHAMENTO`; compra sem parcela vira sugestão `NA_HORA_PAGO`.
- A sugestão nunca deve apagar o ajuste manual em reprocessamento/edição.
- Valores de pagamento/estorno podem exigir sinal inverso ou exclusão do total; isso deve ser confirmado antes da migration/view final.

## Contrato de API recomendado

Todos os endpoints abaixo ficam sob `/api`, exigem `verificaToken` e `rlsMiddleware`, usam `req.db` e retornam `{ success, message, data }`.

- `GET /faturas?conta_id=:id&competencia=YYYY-MM` — lista cabeçalhos Rico da família; resposta `{ data: { faturas } }`. Recomenda-se `id_conta` no contrato final para alinhar snake_case.
- `GET /faturas/:id` — cabeçalho + resumo calculado; resposta `{ data: { fatura, resumo } }`.
- `GET /faturas/:id/dashboard` — KPIs, `meta_reserva`, `saldo_reserva_declarado`, `diferenca_reserva`, diagnóstico, totais por status, portador e categoria.
- `PATCH /faturas/:id/reserva` body `{ saldo_reserva_declarado }` — valida escala/faixa, retorna fatura/resumo recalculado.
- `POST /faturas/:id/importacoes/preview` multipart CSV — parse/validação sem persistir, retorna linhas válidas, erros, sugestões e duplicidade detectada.
- `POST /faturas/:id/importacoes` multipart CSV ou confirmação com hash/preview — persiste atomicamente e retorna `{ importacao, resumo }`. O formato final depende do middleware de multipart que ainda não existe.
- `GET /faturas/:id/transacoes` — filtros `status_liquidacao`, `id_usuario_portador`, `id_categoria`, busca, paginação e ordenação; resposta `{ data: { transacoes, pagination } }`.
- `PATCH /faturas/:id/transacoes/:transacao_id` — atualiza categoria, portador mapeado e `ajuste_liquidacao`; não permitir alterar linha de fatura fechada sem decisão de reabertura.
- `POST /faturas/:id/fechamento` — fecha somente se regra de pendências for atendida; retorna cabeçalho/resumo.
- `POST /faturas/:id/reabrir` — deixar fora do primeiro MVP ou proteger por papel ADMIN e auditoria, conforme decisão confirmada.

Status sugeridos: 200 leitura/edição, 201 importação/criação, 400 validação/estado inválido, 401 sem sessão, 403 sem permissão, 404 tenant/recurso inexistente, 409 competência/hash duplicado ou fatura fechada, 422 apenas se a equipe adotar esse status; manter 400/409 para alinhar `httpResponse.js` atual.

## Telas e componentes frontend recomendados

1. **`src/pages/Faturas/Faturas.jsx`** (nome recomendado): tela principal Rico, com seletor de competência/cartão, botão Importar CSV, resumo de status e links para detalhes. Usar `Card`, `Select`, `ListBox`, `Button`, `Chip`, `toast` e estados de loading/error/empty do HeroUI.
2. **`FaturaResumo`**: cards para total de compras aplicáveis, à vista pago, à vista pendente, parcelado/no fechamento, saldo declarado, meta e diferença. Reutilizar `PrivacyContext` e `formatarDinheiroPrivado`; diferença positiva/negativa deve ser visual e semanticamente distinta.
3. **`ImportarFaturaModal`**: `Modal`/`Dialog` HeroUI, input de arquivo, preview, erros por linha, confirmação e toast.promise. Não enviar arquivo diretamente a endpoint sem preview se a decisão de segurança/idempotência ainda não estiver fechada.
4. **`FaturaTransacoesTable`**: `Table` com `Table.ScrollContainer`, colunas data, estabelecimento, portador, categoria, parcela, valor, status final e ação editar. Filtros por status/portador/categoria e ordenação; no mobile permitir scroll horizontal, não converter muitos itens em cards.
5. **`ReservaCard`/`ReservaForm`**: input monetário pt-BR, atualização via `PATCH`, feedback otimista somente após resposta, e diagnóstico SOBRA/OK ou DÉFICIT.
6. **Análises por portador/categoria**: inicialmente tabelas/cards agregados dentro da tela da fatura; não introduzir biblioteca de gráficos sem necessidade. Usar `categoria.cor` quando disponível.
7. **Navegação**: adicionar rota protegida em `App.jsx` e item “Fatura Rico” em `Sidebar.jsx`/`BottomNavMobile.jsx`, ou substituir “Transações” somente após confirmar a estratégia de navegação.

## MVP recomendado por fases, priorizado para uso diário

### Fase 0 — decisões e contrato

Confirmar formato real do CSV Rico, competência, sinais, nomes dos portadores, regra de pagamento/estorno, permissões e política de fechamento. Definir migrations, nomes finais e o comportamento de arquivo repetido antes de persistir dados.

### Fase 1 — fundação da fatura

Criar migrations de fatura, importação e transações com RLS; criar conta Rico/validar conta existente; implementar listagem/detalhe, dashboard/resumo, atualização da reserva e smoke tests de tenant. Entrega: visualizar uma competência vazia e seus KPIs.

### Fase 2 — importação segura

Implementar preview/parser Rico, normalização de datas/valores, classificação sugerida, lote/hash e persistência transacional. Entrega: importar o CSV sem duplicar e visualizar erros sem corromper a fatura.

### Fase 3 — conferência diária

Implementar tabela, filtros, edição de categoria/portador/status, saldo da reserva e atualização do resumo após cada alteração. Entrega: Gabriel/Geovana conseguem corrigir e acompanhar o que já foi guardado.

### Fase 4 — fechamento mensal

Implementar fechamento, bloqueio de mutações, auditoria e abertura idempotente da próxima competência. Entrega: ritual mensal repetível, com histórico preservado.

### Fase 5 — refinamentos posteriores

Autocategorização por regras, gráficos mais ricos, reabertura auditável, suporte a outros cartões, reconciliação com contas e exportação. Só iniciar após observar uso do Rico no dia a dia.

## Explicitamente fora de escopo agora

- Contas correntes/carteira e saldo financeiro geral como fluxo principal.
- Lançamento de receitas, PIX, boletos, despesas fora do cartão Rico e geração automática de compras/parcelas do app geral.
- Suporte a Nubank, XP ou múltiplos emissores na UX inicial.
- Empréstimos, contatos/devedores, transferências entre membros.
- Relatórios por email, SMTP, jobs agendados.
- MFA, roles e cadastro de família como parte desta feature; são pendências de fundação independentes, embora autorização de endpoint não possa ser ignorada.
- Motor de regras de categorização sofisticado, OCR, PDF, sincronização bancária e gráficos avançados.
- Exclusão física de fatura/transações e edição irrestrita depois do fechamento.

## Critérios de aceite da primeira entrega

1. Usuário autenticado só lista e altera faturas/transações da própria família; uma tentativa com UUID de outra família retorna vazio/404 sem vazamento.
2. Uma conta `CREDITO` Rico pode ser selecionada e uma competência é única por família/cartão/mês.
3. CSV Rico válido mostra preview com data, estabelecimento, portador, valor e parcela; valor pt-BR e datas são normalizados corretamente.
4. Pagamento/estorno e parcelamento seguem regras explicitamente documentadas; linha inválida aparece com número e motivo, sem inserir parcialmente.
5. A confirmação de um CSV persiste todas as linhas em uma transação; repetir o mesmo arquivo não duplica dados e produz resposta previsível de conflito/idempotência.
6. O resumo calcula total aplicável, subtotais de liquidação, meta da reserva, diferença `saldo declarado - meta` e diagnóstico corretamente, inclusive com zero linhas.
7. O usuário altera saldo declarado, categoria/portador/status permitido e vê o resumo atualizado; valores monetários preservam duas casas.
8. A tabela é utilizável em mobile com scroll horizontal, filtros e ações acessíveis; toasts informam sucesso/erro e a tela não depende de mock.
9. Fechamento registra data/usuário, impede edição/importação incompatível e abre a próxima competência no máximo uma vez.
10. Backend segue controller/service/repository, `httpResponse`, `pgErrorHandler`, `req.db` e rotas na ordem de middleware documentada.

## Validação recomendada

- Frontend: `cd MoneySpace-Front && npm run build` — deve concluir o build de produção sem erros.
- Backend: como `MoneySpace-Back/package.json` não possui testes automatizados, executar smoke tests HTTP autenticados contra banco de desenvolvimento: listar/criar competência, preview, importar, repetir hash, atualizar reserva, editar transação, fechar e tentar mutar fechada; confirmar respostas/status e isolamento entre duas famílias.
- Banco: aplicar as migrations em banco descartável/de desenvolvimento e testar RLS dentro da transação criada por `rlsMiddleware`; conferir constraints, unique de competência/importação, rollback de CSV inválido e conversões `NUMERIC`.
- Frontend manual: abrir em viewport móvel e desktop, selecionar competência, importar arquivo válido/inválido/duplicado, editar status, declarar reserva, verificar sobra/déficit, fechar e navegar de volta sem refresh inesperado.

## Perguntas e decisões que precisam ser confirmadas

1. Qual é o layout real do CSV Rico (delimitador, encoding, nomes exatos, exemplos de pagamento/estorno e sinal)?
2. A competência é o mês da fatura/fechamento, o mês da compra ou o mês do vencimento? Como tratar compras após o fechamento?
3. O valor no CSV de uma compra é sempre positivo? Estorno deve reduzir a fatura, ser exibido como negativo ou apenas ficar `NAO_APLICAVEL`?
4. Pagamento de fatura anterior será importado como linha para histórico ou excluído dos KPIs? Como identificá-lo sem falso positivo?
5. Gabriel e Geovana já existem como usuários da mesma família? Pode haver portador externo/não autenticado? O que fazer quando o nome não mapeia?
6. Categorias serão escolhidas manualmente no MVP? Quais categorias iniciais devem existir e quem pode criá-las/editar?
7. Qualquer membro pode importar/editar/fechar ou apenas `ADMIN`? A implementação de `role` pendente será pré-requisito?
8. O mesmo arquivo deve ser rejeitado com 409, retornado como idempotente ou mesclado? Como lidar com um CSV corrigido da mesma competência?
9. Fechar exige zero linhas pendentes de classificação, ou permite pendências? Haverá reabertura; quem poderá fazê-la?
10. “NA_HORA_PAGO” será uma sugestão automática ou confirmação do usuário? Deve existir histórico de quem mudou o status?
11. A próxima competência é criada automaticamente no fechamento ou apenas quando o usuário clicar?
12. A tela principal substitui “Transações” ou “Fatura Rico” será uma área adicional no menu?
13. O processo de migrations será criado agora e qual ferramenta/comando o time aceita para aplicar migrations no Neon?

## Conclusão

O caminho mais seguro é entregar primeiro uma vertical Rico sobre `conta`/`categoria` existentes, com três tabelas novas e RLS completo, sem adaptar o domínio financeiro geral inteiro. A maior dependência não é HeroUI nem roteamento: é fechar o contrato do CSV, sinais, competência, portadores, duplicidade e estado de fechamento. Sem essas decisões, qualquer implementação corre risco de importar valores errados ou tornar a reserva historicamente inconsistente.
