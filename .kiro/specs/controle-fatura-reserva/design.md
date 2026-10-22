# Design — Controle de Fatura & Conferência da Reserva

## Visão geral

Este design descreve como implementar o módulo de fatura/reserva sobre a base
atual do MoneySpace, mantendo o domínio **genérico** (cartão → fatura →
lançamento → importação) e usando o CSV **Rico** como primeiro adaptador.

Princípios:

- Reaproveitar o máximo da infraestrutura existente: auth/JWT, `AuthContext`,
  RLS por rota, `conta` (tipo `CREDITO`), `categoria`, HeroUI, `api.js`.
- Não criar tabela `cartoes`: o cartão é uma `conta` do tipo `CREDITO`.
- Não duplicar usuários em "portadores": o portador é um `usuario` da família,
  preservando o nome importado para auditoria/mapeamento.
- Novo domínio em 3 tabelas: `fatura`, `fatura_importacao`, `fatura_transacao`.
- Seguir à risca: controller/service/repository, `httpResponse`, `pgErrorHandler`,
  `req.db` propagado, RLS por rota (`verificaToken → rlsMiddleware → controller`).

### Diagrama de domínio

```
familia (tenant)
  └── conta (tipo = 'CREDITO')            <- o "cartão" (ex.: Rico)
        └── fatura (por competência)       <- cabeçalho mensal + saldo declarado
              ├── fatura_importacao (lote CSV, hash idempotente)
              └── fatura_transacao (lançamentos)
                    ├── id_usuario_portador -> usuario (portador mapeado)
                    └── id_categoria        -> categoria (global ou da família)
```

### Fluxo de importação (Rico)

```
CSV (upload) 
   → parser Rico (normaliza data/valor, detecta parcela, classifica)
      → PREVIEW (não persiste): linhas válidas + erros + sugestões + duplicidade
         → confirmação do usuário
            → persistência transacional (lote + linhas) com hash idempotente
```

---

## Arquitetura backend

### Novo módulo: `MoneySpace-Back/src/modules/fatura/`

Seguindo o padrão de `src/modules/conta/`:

```
src/modules/fatura/
  fatura.routes.js         liga endpoints -> controller; aplica verificaToken + rlsMiddleware
  fatura.controller.js     req/res, status HTTP; sem SQL
  fatura.service.js        regra de negócio, cálculos, validações
  fatura.repositories.js   ÚNICO lugar com SQL; recebe req.db explicitamente
```

Integrações de importação isoladas em um subdiretório, para manter o domínio
genérico e permitir novos emissores:

```
src/modules/fatura/importadores/
  rico.parser.js           parse + normalização + classificação do CSV Rico
  index.js                 registro/seleção de parser por emissor (hoje só 'RICO')
```

Registro em `src/modules/app.js` (o app em uso), montando as rotas sob `/api`.

### Middleware de upload

Hoje não existe middleware de multipart no projeto. O design adota `multer` em
memória (sem gravar em disco), com:

- limite de tamanho (ex.: 2 MB);
- aceitar apenas `text/csv`/`text/plain`/`application/vnd.ms-excel` + checagem de
  conteúdo;
- o buffer é processado em memória pelo parser; nada é salvo em disco.

O hash de idempotência é `sha256` do buffer do arquivo.

---

## Modelo de dados

Migrations numeradas em `MoneySpace-Back/db/migrations/`. Como a pasta existe mas
não tinha migrations de fatura, criamos `migration-03-controle-fatura.sql` (e
`migration-04-ajustes-legado.sql` para a limpeza — ver seção de limpeza).

Convenções respeitadas: `id` UUID, FKs `id_`, `dt_cadastro` TIMESTAMP, datas do
fato em `DATE`, dinheiro `NUMERIC(14,2)`, snake_case, status em `VARCHAR` + `CHECK`
(coerente com o restante do projeto, em vez de `ENUM`).

### Tabela `fatura`

```sql
CREATE TABLE fatura (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    id_conta UUID NOT NULL REFERENCES conta(id),          -- cartão (tipo CREDITO)
    competencia DATE NOT NULL,                             -- 1º dia do mês
    nome_exibicao VARCHAR(50) NOT NULL,                    -- "Outubro / 2026"
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTA',
    saldo_reserva_declarado NUMERIC(14,2) NOT NULL DEFAULT 0,
    fechada_em TIMESTAMP,
    fechada_por UUID REFERENCES usuario(id),
    usuario_cadastro VARCHAR(100),
    dt_cadastro TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_fatura_status CHECK (status IN ('ABERTA','FECHADA','PAGA')),
    CONSTRAINT uq_fatura_competencia UNIQUE (id_familia, id_conta, competencia)
);
```

### Tabela `fatura_importacao`

```sql
CREATE TABLE fatura_importacao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    id_fatura UUID NOT NULL REFERENCES fatura(id) ON DELETE CASCADE,
    emissor VARCHAR(30) NOT NULL DEFAULT 'RICO',           -- origem do parser
    hash_arquivo CHAR(64) NOT NULL,                        -- sha256 do conteúdo
    nome_arquivo VARCHAR(255),
    tamanho_bytes INTEGER,
    qtd_linhas INTEGER NOT NULL DEFAULT 0,
    usuario_cadastro VARCHAR(100),
    dt_cadastro TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_importacao_hash UNIQUE (id_fatura, hash_arquivo)
);
```

### Tabela `fatura_transacao`

```sql
CREATE TABLE fatura_transacao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    id_fatura UUID NOT NULL REFERENCES fatura(id) ON DELETE CASCADE,
    id_importacao UUID REFERENCES fatura_importacao(id) ON DELETE SET NULL,

    id_usuario_portador UUID REFERENCES usuario(id),       -- portador mapeado (opcional)
    portador_nome_importado VARCHAR(120),                  -- nome bruto do CSV (auditoria)
    id_categoria UUID REFERENCES categoria(id),            -- global ou da família

    dt_compra DATE NOT NULL,
    estabelecimento VARCHAR(255) NOT NULL,
    valor NUMERIC(14,2) NOT NULL,                          -- valor normalizado (positivo)
    valor_original VARCHAR(100),                           -- texto bruto do CSV (auditoria)

    parcela_texto VARCHAR(20) DEFAULT '-',                 -- "-" ou "3 de 10"
    numero_parcela SMALLINT,
    total_parcelas SMALLINT,

    status_liquidacao VARCHAR(20) NOT NULL,                -- campo ÚNICO (texto simples)

    fingerprint_linha CHAR(64) NOT NULL,                   -- determinístico por linha no lote
    usuario_cadastro VARCHAR(100),
    dt_cadastro TIMESTAMP DEFAULT NOW(),
    dt_atualizacao TIMESTAMP DEFAULT NOW(),

    CONSTRAINT chk_status_liquidacao CHECK (status_liquidacao IN
        ('pendente','na hora','no fechamento','nao aplicavel')),
    CONSTRAINT uq_transacao_fingerprint UNIQUE (id_importacao, fingerprint_linha)
);
```

Observações:

- `status_liquidacao` é um **único** campo físico em texto simples (minúsculas,
  sem `_`), já preenchido na importação pela sugestão automática e editável
  direto na tela. NÃO há campos separados de "sugestão" e "ajuste" (coerente com
  o Requisito 4 e com a tabela de utilitários, que alimenta o select com os
  valores `tipo = 'status'`).
- `fingerprint_linha` = `sha256(dt_compra | estabelecimento | portador | valor | parcela | ordem_no_arquivo)`.
  Inclui a ordem para não colidir compras legítimas idênticas no mesmo arquivo.

### Tabela `utilitario` (opções de selects/dropdowns — Requisito 4A)

Tabela genérica que alimenta selects do front por `tipo` (ex.: `status`). No MVP
as opções de `status` são **globais** e somente leitura (padrão do sistema, como
as categorias de sistema): por isso a tabela **não tem `id_familia` nem RLS**.
Um `UNIQUE (tipo, valor)` evita duplicatas.

```sql
CREATE TABLE utilitario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(40) NOT NULL,                             -- ex.: 'status'
    valor VARCHAR(60) NOT NULL,                            -- ex.: 'pendente'
    ordem SMALLINT DEFAULT 0,                              -- ordenação no select (opcional)
    dt_cadastro TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_utilitario_tipo_valor UNIQUE (tipo, valor)
);
```

Seed inicial (`tipo = 'status'`, texto simples, minúsculas, sem `_`):
`pendente`, `na hora`, `no fechamento`, `nao aplicavel`.

### RLS das novas tabelas

```sql
ALTER TABLE fatura             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatura_importacao  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fatura_transacao   ENABLE ROW LEVEL SECURITY;

CREATE POLICY acesso_fatura ON fatura
  FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);
CREATE POLICY acesso_fatura_importacao ON fatura_importacao
  FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);
CREATE POLICY acesso_fatura_transacao ON fatura_transacao
  FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);
```

### Índices

```sql
CREATE INDEX idx_fatura_familia      ON fatura(id_familia);
CREATE INDEX idx_fatura_conta        ON fatura(id_conta);
CREATE INDEX idx_fatura_competencia  ON fatura(id_familia, id_conta, competencia);
CREATE INDEX idx_fat_imp_fatura      ON fatura_importacao(id_fatura);
CREATE INDEX idx_fat_trans_fatura    ON fatura_transacao(id_fatura);
CREATE INDEX idx_fat_trans_portador  ON fatura_transacao(id_usuario_portador);
CREATE INDEX idx_fat_trans_categoria ON fatura_transacao(id_categoria);
CREATE INDEX idx_fat_trans_data      ON fatura_transacao(dt_compra);
```

### INSERT com contexto RLS

Nos inserts, a coluna da família usa o contexto da transação:

```sql
INSERT INTO fatura (id_familia, id_conta, competencia, ...)
VALUES (current_setting('app.current_familia_id', true)::uuid, $1, $2, ...);
```

(o `true` = missing_ok, evita erro quando o parâmetro não está setado).

---

## Contrato de API

Todos sob `/api`, com `verificaToken` + `rlsMiddleware`, usando `req.db`, e
retorno `{ success, message, data }`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/faturas?id_conta=:id` | Lista cabeçalhos de fatura do cartão da família |
| POST | `/faturas` | Cria competência vazia `{ id_conta, competencia }` |
| GET | `/faturas/:id` | Cabeçalho + resumo calculado |
| GET | `/faturas/:id/dashboard` | KPIs + meta/saldo/diferença + totais por portador e categoria |
| PATCH | `/faturas/:id/reserva` | Atualiza `{ saldo_reserva_declarado }` |
| POST | `/faturas/:id/importacoes/preview` | Multipart CSV; parse/validação sem persistir |
| POST | `/faturas/:id/importacoes` | Multipart CSV; persiste atomicamente (idempotente por hash) |
| GET | `/faturas/:id/transacoes` | Lista com filtros (status, portador, categoria), busca, sort, paginação |
| PATCH | `/faturas/:id/transacoes/:id_transacao` | Atualiza categoria, portador, `status_liquidacao` |
| POST | `/faturas/:id/fechamento` | Fecha e abre próxima competência (idempotente) |

Status HTTP: 200 leitura/edição; 201 criação/importação; 400 validação/estado;
401 sem sessão; 403 sem permissão; 404 recurso/tenant inexistente; 409
competência/hash duplicado ou fatura fechada.

> **Onde mora este contrato (decisão da Task 7).** Optei por expandir esta seção
> do `design.md` em vez de criar um arquivo separado (`CONTRATO.md`): o design já
> é a fonte da verdade do módulo, o front e o esqueleto do back já apontam para
> "ver design.md", e manter um único documento evita que o contrato e as regras
> de cálculo/liquidação divirjam. O detalhe por endpoint abaixo é a referência
> única para o front (que a IA implementa) e para o back (que o Gabriel
> implementa).

### Convenções do contrato (valem para todos os endpoints)

- **Prefixo e montagem:** todas as rotas ficam sob `/api` (registradas em
  `src/modules/app.js`). Os caminhos abaixo omitem o `/api` por brevidade
  (ex.: `GET /faturas` = `GET /api/faturas`).
- **Autenticação (todas as rotas):** `verificaToken → rlsMiddleware → controller`,
  nessa ordem. Sem sessão válida → **401** (`httpResponse.unauthorized`). O
  `rlsMiddleware` abre a transação e anexa `req.db`; o RLS filtra por
  `id_familia`, então um recurso de outra família simplesmente "não existe" no
  contexto e resulta em **404** (nunca vaza dados de outro tenant — Req 10.3).
- **Envelope de resposta:** sempre `{ success, message, data }` via
  `utils/httpResponse.js`. Nunca `res.json` cru. Em erro: `{ success:false, message }`
  (sem `data`), exceto `validationError`/`error` que podem anexar `data`.
- **Dinheiro é string.** O `pg` entrega `NUMERIC(14,2)` como **string**
  (ex.: `"1900.00"`). A API repassa string; o service converte com `Number()`
  só para calcular; o front formata com os utilitários pt-BR. O cliente deve
  tratar valores monetários como string na serialização.
- **`status_liquidacao`** usa os quatro valores em texto simples (minúsculas, sem
  `_`): `pendente`, `na hora`, `no fechamento`, `nao aplicavel`.
- **Tratamento de erro no controller (padrão `conta`):** erro de regra de negócio
  no service = `throw new Error('msg')` → o controller devolve **400** com a
  própria mensagem (`httpResponse.error(res, msg, 400)`); erro com `.code` do
  Postgres → `pgErrorHandler(error)` e **500** (não vaza schema); "não encontrada"
  → **404** (`httpResponse.notFound`); duplicidade/estado inválido (hash repetido,
  fatura fechada) → **409** (`httpResponse.conflict`).
- **Erros comuns a todas as rotas** (omitidos nas tabelas por endpoint):
  **401** sem sessão; **404** quando `:id`/`:id_transacao` não existe no tenant;
  **500** erro inesperado/Postgres via `pgErrorHandler`.

---

### 1) `GET /faturas?id_conta=:id` — listar cabeçalhos de fatura do cartão

Lista as faturas (competências) de um cartão (conta `CREDITO`) da família, mais
recentes primeiro. _(Req 2, 10)_

- **Auth:** `verificaToken` + `rlsMiddleware`.
- **Query params:** `id_conta` (UUID, **obrigatório**) — a conta do tipo `CREDITO`.
- **Body:** nenhum.
- **Sucesso (200):** `message: "Faturas listadas com sucesso"`

```json
{
  "success": true,
  "message": "Faturas listadas com sucesso",
  "data": {
    "faturas": [
      {
        "id": "7c1e...-uuid",
        "id_conta": "a3b2...-uuid",
        "competencia": "2026-10-01",
        "nome_exibicao": "Outubro / 2026",
        "status": "ABERTA",
        "saldo_reserva_declarado": "1900.00",
        "fechada_em": null,
        "fechada_por": null,
        "dt_cadastro": "2026-10-10T13:40:00.000Z"
      }
    ]
  }
}
```

- **Erros:** **400** `id_conta` ausente/UUID inválido.

---

### 2) `POST /faturas` — criar competência vazia

Cria o cabeçalho de uma competência (sem lançamentos) para o cartão. _(Req 2)_

- **Auth:** `verificaToken` + `rlsMiddleware`.
- **Body:**

```json
{ "id_conta": "a3b2...-uuid", "competencia": "2026-11-01" }
```

  - `id_conta` (UUID, obrigatório; precisa ser uma conta `CREDITO` da família).
  - `competencia` (DATE no 1º dia do mês, `AAAA-MM-01`, obrigatório). O backend
    deriva `nome_exibicao` (ex.: `"Novembro / 2026"`) e grava `status='ABERTA'` e
    `usuario_cadastro = req.user.nome`.
- **Sucesso (201):** `message: "Fatura criada com sucesso"`

```json
{
  "success": true,
  "message": "Fatura criada com sucesso",
  "data": {
    "fatura": {
      "id": "9f0a...-uuid",
      "id_conta": "a3b2...-uuid",
      "competencia": "2026-11-01",
      "nome_exibicao": "Novembro / 2026",
      "status": "ABERTA",
      "saldo_reserva_declarado": "0.00",
      "dt_cadastro": "2026-10-10T13:41:00.000Z"
    }
  }
}
```

- **Erros:** **400** `id_conta`/`competencia` ausente ou formato inválido, ou
  conta não é `CREDITO`; **409** competência já existe para esse cartão
  (`uq_fatura_competencia` → `pgErrorHandler`).

---

### 3) `GET /faturas/:id` — cabeçalho + resumo calculado

Retorna o cabeçalho e o resumo de KPIs da fatura. _(Req 5, 6)_

- **Auth:** `verificaToken` + `rlsMiddleware`.
- **Path params:** `id` (UUID da fatura).
- **Body:** nenhum.
- **Sucesso (200):** `message: "Fatura obtida com sucesso"`. `data` contém
  `fatura` (cabeçalho) e `resumo` (ver "Formato do resumo/dashboard" adiante;
  aqui sem `por_portador`/`por_categoria`).

```json
{
  "success": true,
  "message": "Fatura obtida com sucesso",
  "data": {
    "fatura": {
      "id": "7c1e...-uuid",
      "nome_exibicao": "Outubro / 2026",
      "status": "ABERTA",
      "saldo_reserva_declarado": "1900.00"
    },
    "resumo": {
      "total_fatura": "2627.34",
      "total_na_hora": "1967.53",
      "total_pendente": "0.00",
      "total_no_fechamento": "659.81",
      "meta_reserva": "1967.53",
      "diferenca_reserva": "-67.53",
      "status_conferencia": "DEFICIT"
    }
  }
}
```

- Competência vazia → todos os totais `"0.00"` (Req 5.4).
- **Erros:** **404** `Fatura não encontrada.`

---

### 4) `GET /faturas/:id/dashboard` — KPIs + reserva + totais por portador/categoria

Igual ao resumo, acrescido das agregações por portador e por categoria. _(Req 5, 6, 8)_

- **Auth:** `verificaToken` + `rlsMiddleware`.
- **Path params:** `id` (UUID da fatura).
- **Body:** nenhum.
- **Sucesso (200):** `message: "Dashboard da fatura"`. `data` = `{ fatura, resumo,
  por_portador[], por_categoria[] }` exatamente no formato da seção "Formato do
  resumo/dashboard" abaixo. Linhas `nao aplicavel` entram só na lista de
  transações, **não** nos KPIs nem nas agregações.
- **Erros:** **404** `Fatura não encontrada.`

---

### 5) `PATCH /faturas/:id/reserva` — atualizar saldo declarado

Atualiza o `saldo_reserva_declarado` da competência e recalcula a diferença. _(Req 6)_

- **Auth:** `verificaToken` + `rlsMiddleware`.
- **Path params:** `id` (UUID da fatura).
- **Body:**

```json
{ "saldo_reserva_declarado": "1900.00" }
```

  - Número/`string` numérica **não negativa**, escala de 2 casas (Req 6.6). Pode
    chegar como número ou string; o backend valida e normaliza.
- **Sucesso (200):** `message: "Reserva atualizada com sucesso"`. Retorna a
  `fatura` atualizada (útil o front reconsultar o dashboard para a nova
  `diferenca_reserva`/`status_conferencia`).

```json
{
  "success": true,
  "message": "Reserva atualizada com sucesso",
  "data": {
    "fatura": {
      "id": "7c1e...-uuid",
      "saldo_reserva_declarado": "1900.00",
      "status": "ABERTA"
    }
  }
}
```

- **Erros:** **400** valor ausente, negativo ou não numérico; **404** fatura
  inexistente; **409** fatura `FECHADA`/`PAGA` (mutação bloqueada — Req 9.2).

---

### 6) `POST /faturas/:id/importacoes/preview` — prévia do CSV (sem persistir)

Faz upload multipart do CSV e devolve a prévia (linhas válidas, erros por linha e
hash) **sem gravar nada**. _(Req 3)_

- **Auth:** `verificaToken` + `rlsMiddleware` + `uploadCsv.single('arquivo')`
  (multer em memória, Task 8).
- **Path params:** `id` (UUID da fatura).
- **Request:** `multipart/form-data` com o campo de arquivo **`arquivo`**
  (CSV do Rico separado por TAB). Buffer chega em `req.file.buffer`.
- **Sucesso (200):** `message: "Prévia gerada com sucesso"`

```json
{
  "success": true,
  "message": "Prévia gerada com sucesso",
  "data": {
    "hash": "a1b2c3...64hex",
    "linhas_validas": [
      {
        "dt_compra": "2026-10-08",
        "estabelecimento": "SUPERMERCAD TRES IRMAO",
        "portador_nome_importado": "GABRIEL GOES",
        "valor": "19.75",
        "valor_original": "R$ 19,75",
        "parcela_texto": "-",
        "numero_parcela": null,
        "total_parcelas": null,
        "status_liquidacao": "pendente"
      }
    ],
    "erros": [
      { "linha": 14, "motivo": "Valor inválido: 'R$ --'" }
    ]
  }
}
```

- **Erros:** **400** arquivo ausente, tipo/tamanho inválido, ou CSV sem cabeçalho
  reconhecível; **404** fatura inexistente; **409** fatura `FECHADA`/`PAGA`.

---

### 7) `POST /faturas/:id/importacoes` — confirmar importação (atômica, idempotente)

Persiste o lote em uma única transação, idempotente por hash do arquivo. _(Req 3, 4)_

- **Auth:** `verificaToken` + `rlsMiddleware` + `uploadCsv.single('arquivo')`.
- **Path params:** `id` (UUID da fatura).
- **Request:** `multipart/form-data`, campo **`arquivo`** (mesmo CSV do preview).
- **Sucesso (201):** `message: "Importação concluída com sucesso"`

```json
{
  "success": true,
  "message": "Importação concluída com sucesso",
  "data": {
    "importacao": {
      "id": "d4e5...-uuid",
      "id_fatura": "7c1e...-uuid",
      "emissor": "RICO",
      "hash_arquivo": "a1b2c3...64hex",
      "nome_arquivo": "fatura-rico-out2026.csv",
      "qtd_linhas": 42,
      "dt_cadastro": "2026-10-10T13:50:00.000Z"
    }
  }
}
```

- **Erros:** **400** arquivo ausente/inválido ou alguma linha falha na
  persistência (rollback total — nada é gravado); **404** fatura inexistente;
  **409** hash já importado nesta fatura (`uq_importacao_hash`,
  `message: "Este arquivo já foi importado."`) ou fatura `FECHADA`/`PAGA`.
  Observação de produto: um arquivo **diferente** para uma fatura que já tem
  lançamentos é avisado/rejeitado (não duplica) — ver "CSV corrigido" nas
  decisões de contrato.

---

### 8) `GET /faturas/:id/transacoes` — listar lançamentos (filtros/busca/sort/paginação)

Lista as transações da competência com filtros, busca, ordenação e paginação. _(Req 7)_

- **Auth:** `verificaToken` + `rlsMiddleware`.
- **Path params:** `id` (UUID da fatura).
- **Query params** (todos opcionais):
  - `status` — um dos `status_liquidacao` (`pendente` | `na hora` | `no fechamento` | `nao aplicavel`).
  - `portador` — UUID do `id_usuario_portador`.
  - `categoria` — UUID do `id_categoria`.
  - `busca` — texto livre casado contra `estabelecimento`.
  - `sort` — campo+direção; aceitos: `dt_compra` e `valor`
    (ex.: `dt_compra:desc`, `valor:asc`). Default: `dt_compra:desc`.
  - `page` — página (1-based, default 1). `page_size` opcional (default sugerido 50).
- **Sucesso (200):** `message: "Transações listadas com sucesso"`

```json
{
  "success": true,
  "message": "Transações listadas com sucesso",
  "data": {
    "transacoes": [
      {
        "id": "11aa...-uuid",
        "dt_compra": "2026-10-01",
        "estabelecimento": "SILVIA REGINA DA",
        "id_usuario_portador": "22bb...-uuid",
        "portador_nome": "GEOVANA TAVARES",
        "portador_nome_importado": "GEOVANA TAVARES",
        "id_categoria": "33cc...-uuid",
        "categoria_nome": "Alimentação & Mercado",
        "categoria_cor": "#F59E0B",
        "valor": "170.00",
        "valor_original": "R$ 170,00",
        "parcela_texto": "2 de 2",
        "numero_parcela": 2,
        "total_parcelas": 2,
        "status_liquidacao": "no fechamento"
      }
    ],
    "total": 42,
    "page": 1,
    "page_size": 50
  }
}
```

- **Erros:** **400** valor de filtro/sort inválido; **404** fatura inexistente.

---

### 9) `PATCH /faturas/:id/transacoes/:id_transacao` — editar lançamento

Atualiza categoria, portador mapeado e/ou `status_liquidacao` de um lançamento. _(Req 7, 4)_

- **Auth:** `verificaToken` + `rlsMiddleware`.
- **Path params:** `id` (UUID da fatura), `id_transacao` (UUID da transação).
- **Body** (todos opcionais; envie só o que muda):

```json
{
  "id_categoria": "33cc...-uuid",
  "id_usuario_portador": "22bb...-uuid",
  "status_liquidacao": "na hora"
}
```

  - `id_categoria` — UUID de categoria global ou da família (ou `null` para limpar).
  - `id_usuario_portador` — UUID de usuário da família (ou `null`).
  - `status_liquidacao` — um dos quatro valores em texto simples.
- **Sucesso (200):** `message: "Transação atualizada com sucesso"`, `data.transacao`
  com a linha atualizada (mesmo shape do item em `transacoes` acima).
- **Erros:** **400** `status_liquidacao` fora do domínio ou UUID inválido;
  **404** `Transação não encontrada.`; **409** fatura `FECHADA`/`PAGA` (edição
  bloqueada — Req 7.7 / 9.2).

---

### 10) `POST /faturas/:id/fechamento` — fechar e abrir próxima competência

Fecha a fatura e cria (idempotente) o cabeçalho da competência seguinte. _(Req 9)_

- **Auth:** `verificaToken` + `rlsMiddleware`.
- **Path params:** `id` (UUID da fatura).
- **Body:** nenhum.
- **Comportamento:** muda `status` para `FECHADA`, grava `fechada_em = NOW()` e
  `fechada_por = req.user.id`; abre a competência `mês+1` no máximo uma vez (não
  duplica se já existir). Fechar com lançamentos `pendente` é permitido — o front
  apenas avisa (não bloqueia). Idempotente: refechar uma fatura já fechada não
  reabre nem recria a próxima.
- **Sucesso (200):** `message: "Fatura fechada com sucesso"`

```json
{
  "success": true,
  "message": "Fatura fechada com sucesso",
  "data": {
    "fatura": {
      "id": "7c1e...-uuid",
      "status": "FECHADA",
      "fechada_em": "2026-11-05T12:00:00.000Z",
      "fechada_por": "55ee...-uuid"
    },
    "proxima": {
      "id": "88ff...-uuid",
      "competencia": "2026-11-01",
      "nome_exibicao": "Novembro / 2026",
      "status": "ABERTA"
    }
  }
}
```

- **Erros:** **404** `Fatura não encontrada.` (**200** idempotente se já fechada;
  o `data.proxima` reflete a competência existente, sem recriar).

---

### Formato do resumo/dashboard (exemplo)

```json
{
  "success": true,
  "message": "Resumo da fatura",
  "data": {
    "fatura": {
      "id": "...", "nome_exibicao": "Outubro / 2026", "status": "ABERTA",
      "saldo_reserva_declarado": "1900.00"
    },
    "resumo": {
      "total_fatura": "2627.34",
      "total_na_hora": "1967.53",
      "total_pendente": "0.00",
      "total_no_fechamento": "659.81",
      "meta_reserva": "1967.53",
      "diferenca_reserva": "-67.53",
      "status_conferencia": "DEFICIT"
    },
    "por_portador": [
      { "id_usuario": "...", "nome": "GABRIEL GOES", "total": "1704.82", "percentual": "64.9", "qtd": 31 }
    ],
    "por_categoria": [
      { "id_categoria": "...", "nome": "Alimentação & Mercado", "cor": "#...", "total": "422.17", "percentual": "16.1", "qtd": 10 }
    ]
  }
}
```

Os valores monetários trafegam como string (como o `pg` entrega), e o service faz
`Number()` para cálculos; o front formata com os utilitários pt-BR existentes.

---

## Parser Rico (importador)

`rico.parser.js` expõe funções puras e testáveis:

- `parseCsvRico(buffer)` → `{ linhasValidas, erros }`
- `normalizarValor(texto)` → número (positivo), aceitando `R$`, pontos de milhar,
  vírgula decimal, espaços e sinal.
- `normalizarData(texto)` → `YYYY-MM-DD`, aceitando `DD/MM/AAAA` e `AAAA-MM-DD`.
- `parseParcela(texto)` → `{ numero, total }` quando bate o padrão `n de m` com
  `1 <= n <= m`; caso contrário trata como à vista (`"-"`).
- `classificar(linha)` → `status_liquidacao`:
  - pagamento de fatura/estorno (regra verificável) → `nao aplicavel`;
  - parcela válida → `no fechamento`;
  - caso contrário (à vista) → `pendente`.

Colunas candidatas (a confirmar com CSV real): Data, Estabelecimento,
Responsável/Portador, Valor, Parcela, Categoria. O parser detecta o cabeçalho e
aceita aliases aprovados; encoding UTF-8; delimitador detectado apenas de forma
segura. Linhas inválidas entram em `erros` com índice e motivo.

A regra de "pagamento/estorno" fica centralizada e configurável para evitar
falso positivo (não usar `includes` amplo que capture compra normal).

---

## Frontend

### Rotas e navegação

- Nova rota protegida em `App.jsx`: `/faturas` → `pages/Faturas/Faturas.jsx`.
- Item "Fatura" na `Sidebar.jsx` (desktop) e `BottomNavMobile.jsx` (mobile).
- A tela atual `Transacoes` (mock) permanece por ora; decisão de aposentá-la ou
  renomeá-la é registrada nas tarefas e confirmada com o usuário antes de remover.

### Páginas e componentes (HeroUI primeiro)

```
src/pages/Faturas/
  Faturas.jsx              tela principal: seletor cartão/competência, resumo, ações
  componentes/
    FaturaResumo.jsx       cards de KPIs (total, pago, pendente, fechamento, meta, status)
    ReservaCard.jsx        input do saldo declarado + diferença + diagnóstico
    ImportarFaturaModal.jsx  upload + preview (erros por linha) + confirmação
    FaturaTransacoesTable.jsx  Table + ScrollContainer, filtros, edição inline
    AnalisePortador.jsx    tabela/cards por portador
    AnaliseCategoria.jsx   tabela/cards por categoria
```

- `FaturaResumo` e `ReservaCard` respeitam `PrivacyContext` e usam
  `formatarDinheiroPrivado`. Diferença positiva/negativa com cores e semântica
  distintas.
- `FaturaTransacoesTable` usa `Table`/`Table.ScrollContainer` do HeroUI (muitos
  itens tabulares), com seleção/sort/filtros e célula de ações; no mobile, scroll
  horizontal ou modal de detalhes.
- `ImportarFaturaModal` usa `Modal`/`Dialog`, input de arquivo, exibe o preview
  retornado pela API e só confirma após o usuário revisar; usa `toast.promise`.

### Serviço HTTP

```
src/services/faturaService.js   consome api.js (sem fetch paralelo, sem mock)
```

Métodos: `listarFaturas(idConta)`, `criarFatura(payload)`, `obterDashboard(idFatura)`,
`atualizarReserva(idFatura, valor)`, `previewImportacao(idFatura, file)`,
`confirmarImportacao(idFatura, file)`, `listarTransacoes(idFatura, filtros)`,
`atualizarTransacao(idFatura, idTransacao, payload)`, `fecharFatura(idFatura)`.

---

## Cálculos (fonte única)

A regra de cálculo fica no **service**/SQL do backend (fonte única de verdade); o
front apenas formata. Para o resumo:

```
total_fatura        = Σ valor onde status_liquidacao <> 'nao aplicavel'
total_na_hora       = Σ valor onde status_liquidacao = 'na hora'
total_pendente      = Σ valor onde status_liquidacao = 'pendente'
total_no_fechamento = Σ valor onde status_liquidacao = 'no fechamento'
meta_reserva        = Σ valor onde status_liquidacao IN ('pendente','na hora')
diferenca_reserva   = saldo_reserva_declarado - meta_reserva
status_conferencia  = diferenca_reserva >= 0 ? 'OK' : 'DEFICIT'
```

A meta da reserva é a soma das compras à vista da competência (`pendente` +
`na hora`), conforme o Requisito 5.2 / 6. O campo `status_liquidacao` é lido
diretamente (não há mais `COALESCE` de duas colunas).

---

## Tratamento de erros

- Validação de negócio no service → `throw new Error('msg')` → controller devolve
  400 com a própria mensagem.
- Erro com `.code` do Postgres → `pgErrorHandler(error, fallback)` (não vaza schema).
- CSV inválido → preview com lista de erros por linha; importação transacional faz
  rollback total se qualquer linha falhar na persistência.
- Importar hash repetido → 409 previsível.
- Operar fatura fechada → 409.
- Acesso cross-tenant → RLS garante vazio; controller devolve 404 quando o recurso
  não existe no contexto da família.

---

## Limpeza de legado (não destrutiva)

A análise identificou resíduos e inconsistências. O design trata assim:

1. **`src/app.js` legado** (só `/health`, não usado; o app em uso é
   `src/modules/app.js`): candidato a remoção. Como é código (não dados), a
   remoção é reversível via git; será confirmada antes de apagar.
2. **`src/routes/health.routes.js`**: manter (health check é útil).
3. **Mocks do front** (`src/mocks/dadosFinanceiros`): permanecem enquanto
   `Dashboard`/`Transacoes` legados existirem; a área de fatura NÃO usa mock.
4. **Inconsistência `senha` vs `senha_hash`**: pré-existente; NÃO será replicada
   no módulo de fatura e fica fora do escopo de alteração aqui (mexer em auth é
   sensível).
5. **Tabelas do financeiro genérico ainda não usadas** (`compra`, `transacao`,
   `contato`, `transferencia`, `preferencia_notificacao`, `email_destinatario`):
   **NÃO serão removidas**. O foco mudou, mas o app segue genérico e elas podem
   ser usadas depois. Qualquer remoção seria destrutiva de schema e exige
   confirmação explícita; por padrão, mantemos.

Toda alteração de schema vai por migration numerada e reversível (um bloco de
rollback comentado no mesmo arquivo), e o `script.sql` é atualizado como fonte da
verdade ao final.

---

## Estratégia de testes/validação

Não há framework de testes configurado no projeto. A validação do MVP será:

- **Parser Rico**: funções puras testadas com casos de valor/data/parcela/
  classificação (um pequeno runner Node pode ser adicionado sem framework pesado,
  ou validação manual documentada).
- **Backend**: smoke tests HTTP autenticados contra banco de desenvolvimento —
  criar competência, preview, importar, repetir hash (409), atualizar reserva,
  editar transação, fechar, tentar mutar fechada (409), e teste de isolamento
  entre duas famílias.
- **Banco**: aplicar migrations em banco descartável; validar constraints, uniques,
  RLS dentro da transação do `rlsMiddleware`, rollback de CSV inválido e conversão
  `NUMERIC`.
- **Frontend**: `cd MoneySpace-Front && npm run build` deve concluir sem erros;
  verificação manual em viewport mobile e desktop.

---

## Decisões de contrato confirmadas (Task 1 — 2026-10)

As decisões abaixo foram fechadas com o usuário e substituem as "Decisões
pendentes" dos requisitos e as "Decisões de design em aberto" deste documento.
São a fonte da verdade para as fases seguintes.

### CSV do Rico (layout real)

- **Exportação**: arquivo de texto **separado por TAB** (`\t`), não vírgula/ponto
  e vírgula.
- **Cabeçalho (nesta ordem)**: `Data`, `Estabelecimento`,
  `Responsável / Portador`, `Valor (R$)`, `Parcela`.
  - O parser deve tolerar o alias do portador aparecer como `Portador` ou
    `Responsável / Portador` (ambos observados nos exports).
  - **Não há coluna de categoria** no CSV → categoria é escolhida manualmente no
    app (coerente com o Requisito 7.5 / decisão de produto 7).
- **Encoding**: tratar como UTF-8 na leitura; o parser deve ser tolerante a
  acento em "Responsável" (fazer trim e normalizar o nome do cabeçalho).
- **`Data`**: formato brasileiro `DD/MM/AAAA` (ex.: `01/10/2026`). Normalizar para
  `AAAA-MM-DD` (coluna `DATE`).
- **`Valor (R$)`**: vem com prefixo `R$ `, milhar com ponto e decimal com vírgula
  (ex.: `R$ 170,00`, `R$ 4.118,13`). **Compras são positivas.**
  **Pagamento de fatura/estorno vem com sinal negativo** (ex.: `-R$ 4.118,13`).
  - `valor` persistido é o **valor absoluto normalizado** (`NUMERIC(14,2)`,
    sempre positivo). O texto bruto (com sinal e `R$`) é preservado em
    `valor_original` para auditoria.
- **`Parcela`**:
  - À vista: `-` (um traço).
  - Parcelada: `N de M` (ex.: `2 de 2`, `3 de 10`), com `1 <= N <= M`.
  - Pagamento/estorno: aparece **malformada**, como `" de 1"` (espaço inicial,
    sem número antes de "de") — NÃO é parcela válida.

Exemplos reais fornecidos (anonimizáveis):

```
Data        Estabelecimento          Responsável / Portador   Valor (R$)     Parcela
01/10/2026  SILVIA REGINA DA         GEOVANA TAVARES          R$ 170,00      2 de 2
08/10/2026  SUPERMERCAD TRES IRMAO   GABRIEL GOES             R$ 19,75       -
08/10/2026  SAHARA. COMIDA ARABE     GEOVANA TAVARES          R$ 28,97       -
11/10/2026  Pagamento de fatura      GABRIEL GOES             -R$ 4.118,13    de 1
```

### Regra de pagamento de fatura / estorno (`nao aplicavel`) — verificável

Uma linha é classificada como **`nao aplicavel`** quando QUALQUER uma destas
condições verificáveis for verdadeira (evitando `includes` amplo que capture
compra legítima):

1. **Valor negativo** no CSV (sinal `-` antes do valor) — é o sinal mais
   confiável de pagamento/estorno; OU
2. **Estabelecimento igual a `Pagamento de fatura`** (comparação por igualdade
   após `trim`/normalização de caixa, não `substring`).

Linha `nao aplicavel` continua **visível** na tabela, mas é **excluída dos KPIs**
(não entra no total da fatura nem na meta da reserva).

### Classificação automática na importação (campo único)

Os requisitos definem **um único** campo `status_liquidacao` com valores em texto
simples (`pendente`, `na hora`, `no fechamento`, `nao aplicavel`). O DDL da
`migration-03` já reflete esse modelo (coluna única + `chk_status_liquidacao`), e
as regras de importação abaixo o seguem:

- Valor negativo OU `Estabelecimento = "Pagamento de fatura"` → **`nao aplicavel`**.
- Parcela válida no padrão `N de M` (`1 <= N <= M`) → **`no fechamento`**.
- Demais (à vista, parcela `-`) → **`pendente`** (usuário muda para `na hora`
  quando confirmar que guardou o dinheiro na reserva).

### Competência

- A **competência é escolhida pelo usuário no momento da importação** (ex.:
  "Outubro / 2026"); todas as linhas do CSV entram nessa fatura. O sistema NÃO
  recalcula/redistribui linhas para outra competência automaticamente.

### CSV corrigido da mesma competência (hash diferente)

- Política do MVP: **rejeitar/avisar** e manter os lançamentos já existentes. Não
  substitui nem acrescenta automaticamente. (Reimportar o **mesmo** arquivo já é
  bloqueado por hash → 409; um arquivo diferente para uma fatura com lançamentos
  deve exibir aviso e não duplicar.)

### Fechamento mensal

- O fechamento **pode ocorrer mesmo com lançamentos `pendente`**; o sistema
  apenas **avisa** (não bloqueia). Mantém os Requisitos 9.1–9.3 (status `FECHADA`,
  `fechada_em`/`fechada_por`, abre a próxima competência de forma idempotente).

### Permissões

- MVP: **qualquer membro autenticado da família** pode importar, editar
  lançamentos, alterar a reserva e fechar a fatura. Toda rota continua exigindo
  `verificaToken` + `rlsMiddleware`. A autorização por papel (`ADMIN`) fica para
  depois, quando `is_master`/`role` estiver ligado no JWT (pendência de backend
  já registrada no `agents.md`).

### Ferramenta de migration (Neon)

- As migrations `db/migrations/migration-NN-*.sql` são aplicadas **manualmente no
  SQL Editor do painel do Neon** (copiar/colar o conteúdo do arquivo). Não há
  ferramenta de migration automatizada no projeto no MVP. O `script.sql`
  permanece como fonte da verdade e é atualizado ao final.

### Schema de liquidação — resolvido (Task 3)

Decisão fechada e aplicada no DDL: `fatura_transacao` tem **uma única** coluna
`status_liquidacao VARCHAR(20)` com `CONSTRAINT chk_status_liquidacao` para os
quatro valores em texto simples (`pendente`, `na hora`, `no fechamento`,
`nao aplicavel`). Não existem mais as colunas `sugestao_liquidacao`/
`ajuste_liquidacao` nem valores em MAIÚSCULAS. As opções do select vêm da tabela
global `utilitario` (`tipo = 'status'`), populada pelo seed da `migration-03`.
O `## Modelo de dados` e o `## Cálculos` acima já refletem esse modelo.

## Validação (Task 21)

### Build de produção

`cd MoneySpace-Front && npm run build` concluído com **exit code 0, sem erros**.
Único aviso: chunk JS > 500 kB (`index-*.js` ~833 kB / 250 kB gzip) — advisory
pré-existente do Vite sobre code-splitting, **não é falha**. Não há script de
lint no `package.json`, então o passo de lint foi dispensado.

### Checklist de verificação manual (mobile + desktop)

Requer backend rodando (`cd MoneySpace-Back && npm run dev`) e navegador — fazer
manualmente com o Gabriel. Testar cada fluxo **tanto no desktop quanto no mobile**:

**Importação**
- [ ] Importar CSV válido: o preview mostra as linhas + status de liquidação
      sugeridos; confirmar persiste os lançamentos na fatura.
- [ ] Importar CSV inválido: erros por linha aparecem no preview; as linhas
      válidas continuam listadas (não bloqueia tudo).
- [ ] Importar o mesmo arquivo de novo: retorna 409 "já importado"; não duplica
      lançamentos.

**Lançamentos**
- [ ] Editar `status_liquidacao` de um lançamento: KPIs e meta recalculam.
- [ ] Editar categoria e portador inline: persiste e reflete nas análises.

**Reserva / conferência**
- [ ] Declarar reserva (saldo declarado): PATCH envia; diferença e diagnóstico
      só atualizam **após** a resposta do backend.
- [ ] Verificar diagnóstico **SOBRA** (declarado > necessário) vs **DÉFICIT**
      (declarado < necessário).

**Fechamento**
- [ ] Fechar fatura: pede confirmação; após fechar, trava edição/importação e a
      nova competência aparece disponível.

**Responsividade / UX**
- [ ] Desktop mostra Sidebar; mobile mostra BottomNav.
- [ ] Tabela de lançamentos com scroll horizontal no mobile (`Table.ScrollContainer`).
- [ ] `PrivacyContext`: valores monetários ocultam quando o modo privacidade está ativo.
