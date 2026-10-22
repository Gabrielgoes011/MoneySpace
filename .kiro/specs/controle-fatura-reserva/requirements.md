# Requisitos — Controle de Fatura & Conferência da Reserva

## Introdução

Este documento define os requisitos para o novo foco central do MoneySpace: um
módulo de **controle de fatura de cartão de crédito com conferência da reserva**,
migrando para o app a lógica que hoje o usuário mantém em uma planilha do Google
Sheets.

O produto continua sendo um app financeiro familiar multi-tenant (uma família =
um tenant isolado por `id_familia` + RLS). A diferença é de **foco**: em vez de
um controle financeiro genérico amplo, a primeira entrega resolve o ritual real
do usuário — importar a fatura do cartão, classificar cada compra entre "pago na
hora" e "no fechamento", conferir se o dinheiro das compras à vista está
realmente guardado na reserva, e analisar os gastos por portador e categoria.

O domínio é **genérico** (cartão → fatura → lançamento → importação), e o cartão
**Rico** é a primeira integração de importação de CSV. Novos emissores (Nubank,
XP) poderão ser adicionados depois sem refazer o modelo.

O foco de uso é **mobile e desktop** com a mesma base de código responsiva
(HeroUI mobile-first).

### Conceito central: a Conferência da Reserva

O usuário usa o cartão de crédito de forma consciente. Cada lançamento tem **um
único campo de status** (`status_liquidacao`), com valores em texto simples
(minúsculas, sem `_`): `pendente`, `na hora`, `no fechamento`, `nao aplicavel`.

Na importação, o status já entra preenchido com a sugestão automática, e o
usuário edita esse mesmo campo quando quiser (não há campo separado de "ajuste"):

- **Compra à vista** (`parcela = "-"`): entra sempre como **`pendente`** (ainda
  não guardei o dinheiro). O usuário muda para **`na hora`** quando confirmar que
  guardou na reserva.
- **Compra parcelada** (`parcela = "X de Y"`): entra como **`no fechamento`**.
- **Pagamento de fatura anterior / estorno**: entra como **`nao aplicavel`** (não
  conta como gasto do mês), mas continua visível na tabela.

A **meta da reserva** = soma de tudo que é à vista da competência, ou seja
`pendente` + `na hora`. O usuário informa quanto realmente tem guardado
(`saldo_reserva_declarado`). O sistema calcula:

```
diferenca = saldo_reserva_declarado - meta_reserva
diferenca >= 0  -> SOBRA / OK
diferenca <  0  -> DÉFICIT (alerta)
```

### Decisões de produto confirmadas com o usuário

1. O app permanece **genérico**; Rico é o primeiro importador, não o dono do modelo.
2. Cada lançamento tem **um único campo de status** (`status_liquidacao`), já
   preenchido na importação pela sugestão automática e editável direto na tela —
   sem campo separado de "ajuste manual".
3. Importação de CSV com **preview antes de salvar** e proteção contra importar
   o mesmo arquivo duas vezes.
4. Regra de importação (Opção B): compra à vista sem parcela entra como
   `pendente`; parcelada como `no fechamento`; pagamento/estorno como
   `nao aplicavel` (mas visível na tabela). O usuário muda à vista para `na hora`
   quando confirmar que guardou.
5. Os valores de listas de seleção (status e outras) ficam em uma **tabela de
   utilitários** genérica (`id`, `tipo`, `valor`), com valores em texto simples
   (minúsculas, sem `_`), para alimentar selects e dropdowns do front.
6. Portadores = usuários da família (Gabriel/Geovana), preservando o nome
   original importado para auditoria.
7. Categorias escolhidas manualmente no MVP, reaproveitando a tabela `categoria`.
8. Fechamento mensal bloqueia a fatura e abre a próxima competência uma única vez.
9. Foco de uso igual em PC e celular.

### Itens fora de escopo nesta fase

Controle financeiro genérico como fluxo principal, receitas/PIX/boletos fora do
cartão, empréstimos e devedores, transferências entre membros, relatórios por
email/SMTP, MFA, cadastro de família, múltiplos emissores na UX, OCR/PDF,
sincronização bancária, gráficos avançados obrigatórios, exclusão física de
faturas/lançamentos e edição irrestrita após o fechamento.

---

## Glossário

- **Competência**: mês de referência da fatura (primeiro dia do mês). Ex.: `2026-10-01` = "Outubro / 2026".
- **Portador**: pessoa responsável pela compra (usuário da família).
- **Status de liquidação**: campo único por lançamento. Valores (texto simples):
  `pendente`, `na hora`, `no fechamento`, `nao aplicavel`.
- **Tabela de utilitários**: lista genérica de opções (`id`, `tipo`, `valor`) que
  alimenta selects/dropdowns do front. Ex.: `tipo = 'status'`, `valor = 'pendente'`.
- **Meta da reserva**: soma das compras à vista (`pendente` + `na hora`) da competência.
- **Saldo declarado**: valor que o usuário informa ter guardado na reserva.
- **Diferença da conferência**: `saldo_declarado - meta_reserva`.
- **Importação (lote)**: um upload de CSV processado e confirmado, com hash para idempotência.

---

## Requisitos

### Requisito 1 — Cadastro e seleção de cartão de crédito

**História:** Como usuário, quero registrar meu cartão de crédito (Rico) e
selecioná-lo, para organizar as faturas por cartão.

#### Critérios de Aceitação

1. QUANDO o usuário abre o módulo de faturas, ENTÃO o sistema DEVE listar as
   contas da família com `tipo = 'CREDITO'` e `ativo = true`.
2. QUANDO não existe nenhuma conta de crédito, ENTÃO o sistema DEVE orientar o
   usuário a criar uma (reaproveitando o fluxo de contas existente) antes de
   permitir importar faturas.
3. O sistema DEVE identificar o cartão por `nome`/instituição (ex.: "Rico") sem
   criar uma tabela `cartoes` separada; a representação do cartão é a tabela
   `conta` existente.
4. QUANDO o usuário seleciona um cartão, ENTÃO todas as operações de fatura
   subsequentes DEVEM ser restritas àquele `id_conta` e à família do usuário.
5. O sistema NÃO DEVE permitir importar fatura para uma conta que não seja
   `CREDITO` ou que não pertença à família do usuário.

### Requisito 2 — Faturas por competência

**História:** Como usuário, quero faturas organizadas por mês, para acompanhar
o histórico sem duplicar planilhas.

#### Critérios de Aceitação

1. O sistema DEVE representar cada fatura por uma competência única por família +
   cartão + mês (`UNIQUE (id_familia, id_conta, competencia)`).
2. QUANDO o usuário seleciona um cartão, ENTÃO o sistema DEVE listar as
   competências existentes com nome de exibição legível (ex.: "Outubro / 2026").
3. QUANDO o usuário troca de competência, ENTÃO o sistema DEVE atualizar o
   resumo e os lançamentos sem recarregar a página.
4. O sistema DEVE permitir criar uma competência vazia para um cartão, definindo
   o primeiro dia do mês como `competencia`.
5. Uma fatura DEVE ter um `status` entre `ABERTA`, `FECHADA` e `PAGA`.
6. QUANDO uma competência não tem lançamentos, ENTÃO o resumo DEVE exibir zeros
   corretamente, sem erro.

### Requisito 3 — Importação de CSV (Rico) com preview

**História:** Como usuário, quero importar o CSV da fatura, para não digitar
lançamento por lançamento.

#### Critérios de Aceitação

1. QUANDO o usuário envia um arquivo CSV, ENTÃO o sistema DEVE primeiro gerar um
   **preview** (sem persistir) mostrando as linhas interpretadas: data,
   estabelecimento, portador, valor, parcela, categoria sugerida e status sugerido.
2. O sistema DEVE normalizar valores no formato brasileiro (`R$ 1.234,56`,
   `1.234,56`, com espaços e sinal) para `NUMERIC(14,2)`.
3. O sistema DEVE normalizar datas (ex.: `AAAA-MM-DD` e `DD/MM/AAAA`) para `DATE`.
4. QUANDO uma linha é inválida (data/valor não interpretáveis), ENTÃO o preview
   DEVE listá-la com número da linha e motivo, SEM impedir as linhas válidas de
   serem exibidas.
5. O sistema DEVE preencher automaticamente o `status_liquidacao` na importação
   (Opção B):
   - parcela válida no padrão "n de m" (com `1 <= n <= m`) → `no fechamento`;
   - estabelecimento identificado como pagamento de fatura/estorno por regra
     verificável → `nao aplicavel`;
   - demais (à vista sem parcela) → `pendente`.
6. QUANDO o usuário confirma o preview, ENTÃO o sistema DEVE persistir todas as
   linhas válidas em **uma única transação** (tudo ou nada).
7. O sistema DEVE registrar o lote de importação com hash do conteúdo do arquivo.
8. QUANDO o mesmo arquivo (mesmo hash) já foi importado para a mesma fatura,
   ENTÃO o sistema DEVE rejeitar com resposta previsível de conflito (409), SEM
   duplicar lançamentos.
9. O upload DEVE validar tipo (CSV/texto) e um limite de tamanho; NÃO DEVE
   confiar no nome do arquivo.
10. QUANDO a fatura está `FECHADA` ou `PAGA`, ENTÃO o sistema NÃO DEVE permitir
    nova importação para ela.

### Requisito 4 — Status de liquidação (campo único editável)

**História:** Como usuário, quero um único campo de status que já venha sugerido
na importação e que eu possa mudar direto na tela, como faço na planilha.

#### Critérios de Aceitação

1. Cada lançamento DEVE ter **um único** campo `status_liquidacao`, sem campos
   separados de "sugestão" e "ajuste".
2. Na importação, `status_liquidacao` DEVE ser preenchido pela regra automática
   do Requisito 3.5.
3. O usuário DEVE poder alterar `status_liquidacao` entre os quatro valores
   válidos (`pendente`, `na hora`, `no fechamento`, `nao aplicavel`) direto na
   tabela, via select/dropdown alimentado pela tabela de utilitários.
4. QUANDO o usuário já alterou o status de um lançamento, ENTÃO uma nova
   importação do mesmo arquivo NÃO DEVE reverter o valor (a importação duplicada
   é rejeitada por hash, conforme Requisito 3.8).
5. QUANDO o status de um lançamento muda, ENTÃO o resumo da fatura DEVE ser
   recalculado e refletir a mudança.
6. Os valores DEVEM ser persistidos em texto simples (minúsculas, sem `_`),
   coerentes com a tabela de utilitários.

### Requisito 4A — Tabela de utilitários para selects/dropdowns

**História:** Como usuário, quero que as opções de listas (como status) venham de
uma tabela única e reutilizável, para alimentar selects e dropdowns do app.

#### Critérios de Aceitação

1. O sistema DEVE ter uma tabela genérica de utilitários com, no mínimo, `id`,
   `tipo` e `valor` (ex.: `tipo = 'status'`, `valor = 'pendente'`).
2. Os valores de `status_liquidacao` DEVEM existir nessa tabela com
   `tipo = 'status'` e os valores `pendente`, `na hora`, `no fechamento`,
   `nao aplicavel` (texto simples, minúsculas, sem `_`).
3. A estrutura DEVE permitir outros `tipo`s no futuro (ex.: tipos de conta,
   categorias de apoio) sem mudança de schema.
4. O front DEVE poder consultar as opções por `tipo` para montar selects/dropdowns,
   em vez de usar listas fixas no código.
5. A tabela DEVE definir claramente se é global (compartilhada por todas as
   famílias) ou por família; no MVP, as opções de `status` são **globais** e
   somente leitura para o usuário (padrão do sistema), seguindo a mesma ideia das
   categorias de sistema. Se for global, NÃO precisa de `id_familia`/RLS; se for
   por família, DEVE ter `id_familia` + RLS.

### Requisito 5 — Resumo da fatura (KPIs)

**História:** Como usuário, quero ver os totais da fatura de forma clara, para
entender minha situação do mês rapidamente.

#### Critérios de Aceitação

1. O resumo DEVE apresentar: total de gastos aplicáveis (exclui `nao aplicavel`),
   total `na hora`, total `pendente`, total `no fechamento`, meta da reserva e
   status da conferência.
2. A **meta da reserva** DEVE ser a soma de `na hora` + `pendente`.
3. Todos os cálculos monetários DEVEM usar `NUMERIC`/`Number`, nunca concatenação
   de string, preservando 2 casas decimais.
4. QUANDO a competência está vazia, ENTÃO todos os totais DEVEM ser `0,00`.
5. Os KPIs DEVEM respeitar o `PrivacyContext` (ocultar valores quando o modo
   privacidade está ativo).

### Requisito 6 — Conferência da reserva

**História:** Como usuário, quero informar quanto tenho guardado e ver se estou
coberto, para saber se preciso transferir mais dinheiro.

#### Critérios de Aceitação

1. O usuário DEVE poder informar o `saldo_reserva_declarado` da competência.
2. O sistema DEVE calcular `diferenca = saldo_declarado - meta_reserva`.
3. QUANDO `diferenca >= 0`, ENTÃO o sistema DEVE exibir "SOBRA / OK" com o valor
   de sobra.
4. QUANDO `diferenca < 0`, ENTÃO o sistema DEVE exibir "DÉFICIT" com um alerta
   informando o valor que falta.
5. QUANDO o usuário altera o saldo declarado, ENTÃO o sistema DEVE persistir
   (PATCH) e recalcular a diferença, atualizando a UI somente após a resposta.
6. O saldo declarado DEVE ser validado (não negativo, escala de 2 casas).

### Requisito 7 — Lançamentos: listagem, filtros e edição

**História:** Como usuário, quero navegar e corrigir os lançamentos com
facilidade, melhor do que na planilha.

#### Critérios de Aceitação

1. O sistema DEVE listar os lançamentos da competência em uma `Table` do HeroUI
   com `Table.ScrollContainer` (scroll horizontal no mobile).
2. As colunas DEVEM incluir: data, estabelecimento, portador (chip), valor,
   parcela (badge), categoria e status (badge colorida por status).
3. O sistema DEVE permitir busca por estabelecimento e filtros por portador,
   categoria e status.
4. O sistema DEVE permitir ordenação por data e por valor.
5. O usuário DEVE poder editar, por lançamento: categoria, portador mapeado e
   `status_liquidacao` (via select alimentado pela tabela de utilitários).
6. A tabela NÃO DEVE depender de dados mockados; DEVE consumir a API real.
7. QUANDO a fatura está `FECHADA`/`PAGA`, ENTÃO a edição de lançamentos DEVE ser
   bloqueada (salvo reabertura, se existir).

### Requisito 8 — Análise por portador e por categoria

**História:** Como usuário, quero ver quem gastou mais e onde, para transparência
no casal.

#### Critérios de Aceitação

1. O sistema DEVE apresentar, por portador: total gasto, percentual da fatura e
   quantidade de compras (excluindo `NAO_APLICAVEL`).
2. O sistema DEVE apresentar, por categoria: total gasto, percentual e quantidade
   de compras (excluindo `NAO_APLICAVEL`).
3. As análises DEVEM usar as cores de categoria/portador quando disponíveis.
4. As análises DEVEM funcionar em mobile (listas/cards) sem exigir biblioteca de
   gráficos; um gráfico é opcional.

### Requisito 9 — Fechamento mensal

**História:** Como usuário, quero fechar a fatura do mês, para manter histórico e
começar a próxima competência limpa.

#### Critérios de Aceitação

1. QUANDO o usuário fecha a fatura, ENTÃO o sistema DEVE mudar o status para
   `FECHADA`, registrar `fechada_em` e o usuário que fechou.
2. QUANDO a fatura está fechada, ENTÃO o sistema NÃO DEVE permitir importações ou
   edições incompatíveis de lançamentos.
3. O fechamento DEVE abrir a próxima competência (mês + 1) no máximo uma vez
   (operação idempotente), criando apenas o cabeçalho vazio, sem copiar
   lançamentos.
4. A reabertura de uma fatura fechada, se existir, DEVE ser uma ação auditável e
   fica fora do primeiro MVP salvo decisão contrária.

### Requisito 10 — Multi-tenant, segurança e padrões do projeto

**História:** Como responsável pelos dados, quero garantir que cada família só
acesse o que é seu e que o código siga o padrão do projeto.

#### Critérios de Aceitação

1. Todas as novas tabelas DEVEM ter `id_familia`, RLS habilitada e policy baseada
   em `current_setting('app.current_familia_id', true)::uuid`.
2. Toda rota que toca o banco DEVE aplicar `verificaToken` e depois
   `rlsMiddleware`, nessa ordem, e propagar `req.db` até o repository.
3. QUANDO um usuário tenta acessar uma fatura/lançamento de outra família, ENTÃO
   o sistema DEVE retornar vazio/404 sem vazar dados.
4. O backend DEVE seguir a separação controller/service/repository, com SQL
   apenas nos repositories.
5. As respostas HTTP DEVEM usar `utils/httpResponse.js` (`{ success, message, data }`)
   e erros de Postgres DEVEM passar por `utils/pgErrorHandler.js`.
6. Operações sensíveis (importar, editar, fechar, alterar reserva) DEVEM exigir
   usuário autenticado; a autorização por papel (`ADMIN`) pode ser aprimorada
   depois, mas a proteção de sessão NÃO pode ser ignorada.
7. Valores monetários vindos do `pg` (string) DEVEM ser convertidos no service
   para cálculo; a API DEVE ter contrato consistente de tipos.

### Requisito 11 — Experiência mobile e desktop

**História:** Como usuário, quero usar o app confortavelmente no celular e no PC.

#### Critérios de Aceitação

1. A UI DEVE priorizar componentes HeroUI (layout, grid, espaçamento) antes de
   Tailwind manual.
2. O módulo DEVE ser responsivo usando o padrão existente (`useIsMobile`,
   BottomNav no mobile, Sidebar no desktop).
3. Em mobile, a tabela de lançamentos DEVE permitir scroll horizontal ou abertura
   de detalhes em modal, sem quebrar o layout.
4. Feedbacks de ação DEVEM usar `toast` do HeroUI.
5. A navegação DEVE incluir um item de acesso ao módulo de fatura; a decisão de
   substituir ou manter a tela "Transações" atual é tratada no design.

### Requisito 12 — Ajuste e limpeza do banco e do código legado

**História:** Como desenvolvedor, quero um banco e um código coerentes com o novo
foco, sem resíduos não usados que confundam.

#### Critérios de Aceitação

1. O sistema DEVE ganhar as novas tabelas de fatura via **migration numerada**
   (`migration-NN-descricao.sql`), sem reexecutar `script.sql` de forma destrutiva.
2. O `script.sql` DEVE ser atualizado para refletir o schema final (fonte da verdade).
3. QUANDO houver tabela/coluna/arquivo legado comprovadamente não utilizado e
   conflitante com o novo foco, ENTÃO o design DEVE listá-lo e o plano DEVE
   gerar um **script de ajuste reversível** — nenhuma remoção destrutiva de dados
   sem confirmação explícita do usuário.
4. As migrations DEVEM ser aplicáveis no Neon e testáveis em banco descartável.
5. A documentação do projeto (`agents.md`, `ROADMAP_DESENVOLVIMENTO.md`) DEVE ser
   atualizada para refletir o novo foco ao final.

---

## Decisões pendentes (a confirmar durante o design/implementação)

Estas não bloqueiam o spec, mas serão fixadas antes da implementação das fases
correspondentes:

1. Layout exato do CSV Rico (delimitador, encoding, nomes das colunas, exemplos
   reais de pagamento/estorno e sinal dos valores).
2. Regra de identificação de "pagamento de fatura"/"estorno" sem falso positivo.
3. Se estorno deve reduzir o total da fatura, aparecer negativo ou apenas ser
   `nao aplicavel`.
4. Como tratar um CSV corrigido da mesma competência (novo hash) — acrescentar,
   substituir ou abrir novo lote.
5. Se o fechamento exige zero lançamentos pendentes de classificação.
6. Se qualquer membro pode importar/fechar ou apenas `ADMIN`.
7. Ferramenta/comando aceito para aplicar migrations no Neon.
