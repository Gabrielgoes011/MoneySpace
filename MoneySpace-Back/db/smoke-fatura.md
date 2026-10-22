# Smoke test — Controle de Fatura & Conferência da Reserva (Task 22)

Prova de ponta a ponta do fluxo autenticado de fatura **mais** o isolamento de
tenant entre duas famílias (Requisitos 10.1 e 10.3). Este documento acompanha:

- `smoke-fatura.http` — sequência de requisições pronta para a extensão
  **REST Client** (VS Code) ou **HTTP Client** (IntelliJ). É o caminho principal.
- `smoke-fatura-exemplo-rico.csv` — CSV de exemplo do Rico (separado por **TAB**),
  com uma compra à vista, uma parcelada e um pagamento de fatura (valor negativo).
- `smoke-fatura.mjs` — alternativa em Node (sem dependências) para rodar o fluxo
  da família A de forma automatizada quando o backend estiver implementado.

> ⚠️ **BLOQUEIO ATUAL (por que ainda não passa).** Por decisão do projeto
> (AGENTS.md), a lógica do backend de fatura é escrita pelo Gabriel. Hoje
> `src/modules/fatura/` é **esqueleto**: controllers/services/repositories lançam
> "ainda não implementada", o `rico.parser.js` não parseia, e `multer` **não está
> instalado**. Portanto este smoke test **não pode passar agora** — ele está
> preparado para rodar no instante em que o backend for implementado. Esta tarefa
> é explicitamente "(com Gabriel)".

## Pré-condições (tudo isto antes de rodar)

1. **Backend implementado (Gabriel):** a lógica real em
   `src/modules/fatura/fatura.controller.js`, `fatura.service.js`,
   `fatura.repositories.js` e `src/modules/fatura/importadores/rico.parser.js`.
2. **Multer instalado:** `cd MoneySpace-Back && npm install multer` e o
   `src/middleware/upload.js` implementado (memória, limite de tamanho, validação
   de tipo CSV/texto — Req 3.9).
3. **Migration aplicada:** `migration-03-controle-fatura.sql` rodada no Neon de
   desenvolvimento (tabelas `fatura`, `fatura_importacao`, `fatura_transacao`,
   `utilitario`, RLS + policies).
4. **Seed de dados no banco dev:**
   - **Família A:** um usuário (com email/senha que você vai usar no login) e
     **pelo menos uma conta `tipo = 'CREDITO'` ativa** (anote o `id` dela — use
     `GET /api/contas`).
   - **Família B:** um usuário de **outra família** (para o teste de isolamento).
5. **Backend no ar:** `cd MoneySpace-Back && npm run dev` (porta **3000**,
   base `http://localhost:3000/api`).

## Como rodar (REST Client)

1. Abra `smoke-fatura.http` no VS Code (extensão REST Client instalada).
2. Preencha as variáveis `@...` no topo com os dados do seu seed
   (emails, senhas de **desenvolvimento**, `id_conta` CREDITO da família A).
   **Não comite senhas reais** — são placeholders de ambiente local.
3. Clique em **"Send Request"** em cada bloco, **na ordem** (de cima para baixo).
   As variáveis de resposta (`@tokenA`, `@idFatura`, `@idTransacao`, `@tokenB`)
   são capturadas automaticamente dos passos anteriores.

## Sequência e status esperados

| Passo | Ação | Esperado |
|---|---|---|
| 1 | Login família A (`POST /login`) | 200 + `data.token` + cookie httpOnly |
| 2 | Criar competência (`POST /faturas`) | 201, status `ABERTA` |
| 2b | Criar competência duplicada | 409 (unique competência) |
| 3 | Preview import (`.../importacoes/preview`, campo `arquivo`) | 200; à vista=`pendente`, parcelado=`no fechamento`, pagamento=`nao aplicavel` |
| 4 | Confirmar import (`.../importacoes`) | 201, `data.importacao` |
| 5 | Reimportar mesmo arquivo | 409 (hash duplicado), **sem duplicar** |
| 6 | Dashboard (`.../dashboard`) | 200; meta=`pendente`+`na hora`; com reserva 0 → `DEFICIT` |
| 7 | Atualizar reserva (`PATCH .../reserva`) | 200; reconsultar dashboard → `OK` |
| 8 | Listar transações (`.../transacoes`) | 200; `total` **não dobrou** |
| 9 | Editar status de 1 à vista → `na hora` | 200; KPIs mudam no dashboard |
| 10 | Fechar (`.../fechamento`) | 200; `FECHADA` + `data.proxima` (mês+1) |
| 10b | Fechar de novo | 200 idempotente (não recria próxima) |
| 11a–c | Importar/editar/reserva em fatura fechada | 409 nos três |
| 12 | Login família B | 200 + `data.token` |
| 13 | B lê fatura de A (`GET /faturas/:id`) | **404** (sem vazar dados) |
| 14 | B lê dashboard de A | **404** |
| 15 | B lista transações de A | **404** ou 200 com `transacoes: []`, `total: 0` |
| 16 | B muta reserva de A | **404** |
| 17 | B lista faturas do cartão de A (`?id_conta=`) | 400 ou 200 com `faturas: []` |
| 18 | Qualquer rota sem `Authorization` | **401** |

### Critérios de aprovação (Req 10.1 / 10.3)

- **Fluxo A completo** passa nos status acima (criar → importar → idempotência →
  dashboard → reserva → editar → fechar → bloqueio de fatura fechada).
- **Isolamento:** nos passos 13–17 a família B **nunca** recebe dado da família A
  (sempre 404 ou coleção vazia). As faturas das duas famílias não se cruzam.
- **Sem sessão** (passo 18) sempre 401.

## Alternativa automatizada (Node)

`smoke-fatura.mjs` roda o fluxo da família A sem dependências externas (usa
`fetch`/`FormData`/`Blob` nativos do Node 18+). Preencha as variáveis de ambiente
e execute:

```bash
cd MoneySpace-Back
SMOKE_EMAIL="email_familia_A" \
SMOKE_SENHA="senha_dev_familia_A" \
SMOKE_ID_CONTA="uuid_conta_credito_A" \
node db/smoke-fatura.mjs
```

O script faz: login → criar fatura → preview → importar → reimportar (espera 409)
→ dashboard → atualizar reserva → listar/editar transação → fechar, imprimindo o
status de cada passo e um resumo PASS/FAIL. Para o teste de isolamento completo,
use os passos 12–18 do arquivo `.http` (dois tokens).

## CSV de exemplo (`smoke-fatura-exemplo-rico.csv`)

Separado por TAB, com cabeçalho `Data / Estabelecimento / Portador / Valor /
Parcela / Categoria`:

- `SUPERMERCAD TRES IRMAO` — à vista (`-`), `R$ 170,00` → sugere **`pendente`**.
- `MAGALU *LOJA ONLINE` — parcelado (`3 de 10`), `R$ 1.200,00` → **`no fechamento`**.
- `PAGAMENTO DE FATURA` — `-R$ 1.500,00` → **`nao aplicavel`** (visível na tabela,
  fora dos KPIs).

Ajuste as colunas/aliases ao layout real do Rico quando ele for confirmado; o
parser (Gabriel) detecta o cabeçalho e os aliases aprovados no design.
