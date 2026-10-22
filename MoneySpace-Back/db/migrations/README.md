# Migrations — MoneySpace

Este diretório contém as alterações de schema aplicadas ao banco **depois** do
`db/script.sql` inicial. Cada arquivo é um passo numerado e incremental.

> **Fonte da verdade:** `db/script.sql` descreve o schema COMPLETO e atual.
> As migrations são o histórico de COMO chegamos lá. Ao final de cada migration
> aplicada, o `script.sql` é atualizado para refletir o estado novo.

## Convenção de nomes

```
migration-NN-descricao-curta.sql
```

- `NN` = número sequencial com zero à esquerda (`01`, `02`, `03`, ...).
- `descricao-curta` = em kebab-case, no que a migration faz (ex.: `add-transferencia`).
- Aplicar **sempre na ordem crescente** de `NN`. Uma migration assume que todas
  as anteriores já foram aplicadas.

Histórico atual:

| Arquivo                               | O que faz                                   |
|---------------------------------------|---------------------------------------------|
| `migration-01-add-transferencia.sql`  | Cria tabela `transferencia` (PIX interno).  |
| `migration-02-add-roles-usuario.sql`  | Adiciona `is_master` e `role` em `usuario`. |
| `migration-03-controle-fatura.sql`    | Cria `fatura`, `fatura_importacao`, `fatura_transacao` (RLS) + `utilitario` global com seed de `status`. |

## Como aplicar uma migration (Neon)

Não há ferramenta de migration automatizada no MVP. A aplicação é **manual**,
pelo SQL Editor do painel do Neon:

1. Acesse o painel do projeto no [Neon](https://console.neon.tech) e abra o
   **SQL Editor** (selecione o database/branch correto antes).
2. Abra o arquivo `migration-NN-*.sql` **ainda pendente de menor número**.
3. **Copie o conteúdo inteiro** do arquivo e **cole** no SQL Editor.
4. Revise se há blocos marcados como manuais/opcionais (ex.: `UPDATE` de promoção
   de master na migration 02) — esses ficam **comentados** de propósito; descomente
   só o que for intencional naquela execução.
5. Execute (**Run**). Confira a saída: sem erro = aplicada.
6. Rode a seção de **VERIFICAÇÃO** (quando houver, deixada comentada no fim do
   arquivo) para confirmar colunas/tabelas/policies criadas.
7. Repita para as migrations seguintes, em ordem.

### Importante — NÃO reexecutar o `script.sql` por cima

`db/script.sql` contém `CREATE TABLE` sem `IF NOT EXISTS` e descreve o banco do
zero. **Rodá-lo num banco que já tem dados é destrutivo/quebra** (conflito de
objetos já existentes, ou recriação que apaga dados se o schema for dropado antes).

Regras:

- **Banco já existente (com dados):** aplique apenas as **migrations** pendentes,
  uma a uma, na ordem. **Nunca** rode o `script.sql` inteiro de novo.
- **Banco novo/vazio (do zero):** rode o `script.sql` UMA vez (já contém tudo
  consolidado) e então aplique só as migrations de número **maior** que o último
  estado consolidado no `script.sql`, se houver.
- O `script.sql` é atualizado **ao final** de cada migration aplicada, para seguir
  sendo o retrato fiel do schema — mas isso é edição do arquivo, não comando a
  rodar num banco com dados.

## Como validar uma migration (constraints, RLS, NUMERIC)

Como as migrations são aplicadas à mão no Neon, vale validar o DDL **antes** de
colar em produção. Há duas formas (a migration-03 já tem as duas prontas):

1. **Banco descartável, automatizado (sem Neon/Docker/psql — só Node):**
   um harness Node sobe um Postgres REAL em memória (PGlite), aplica a migration
   e exercita constraints `CHECK`, `UNIQUE`, isolamento por **RLS** e conversão
   `NUMERIC(14,2)`.

   ```bash
   cd MoneySpace-Back
   npm install --no-save @electric-sql/pglite   # dependência só de validação
   node db/migrations/validate-migration-03.mjs
   ```

   Saída esperada: `RESULTADO: N passaram, 0 falharam`. O harness cria um role
   não-dono (`app_role`) e roda os testes de isolamento com `SET LOCAL ROLE`,
   porque a RLS é ignorada para o dono/superuser da tabela (como seria no app,
   que usa um role comum).

2. **No Neon (ou psql), não destrutivo:** `validate-migration-03.sql` roda as
   mesmas checagens dentro de uma transação que termina em `ROLLBACK` (nada é
   persistido). Aplique a migration-03 primeiro, depois cole o script de
   validação no SQL Editor. Obs.: se rodar como superuser, os SELECTs de
   isolamento RLS verão as duas famílias (falso-negativo esperado); use um role
   de aplicação para ver o filtro valer.

## Como escrever uma nova migration

- Cabeçalho padrão com número, data e descrição (ver migrations existentes).
- Preferir comandos **idempotentes/reexecutáveis** quando fizer sentido:
  `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
  `DROP CONSTRAINT IF EXISTS` antes de recriar.
- Tabelas novas que são por-família: habilitar **RLS** e criar a policy filtrando
  por `current_setting('app.current_familia_id', true)::uuid` (ver
  `migration-01`).
- Incluir um **bloco de rollback comentado** no mesmo arquivo (como desfazer),
  além de uma seção de **verificação** comentada, quando aplicável.
- Após aplicar e validar, **atualizar o `db/script.sql`** com o schema resultante.
