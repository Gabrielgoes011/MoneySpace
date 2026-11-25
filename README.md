# MoneySpace

Controle simples do cartão de crédito em família.

`React + Vite + HeroUI` · `Node.js + Express` · `PostgreSQL (RLS)` · `JWT + 2FA` · `PWA`

---

## Índice

- [O que é](#o-que-é)
- [Problema que resolve](#problema-que-resolve)
- [Tecnologias](#tecnologias)
- [Como executar](#como-executar)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Como rodar os testes](#como-rodar-os-testes)
- [Demonstração](#demonstração)
- [Detalhes do projeto](#detalhes-do-projeto)

---

## O que é

App financeiro familiar que roda no computador e no celular (PWA instalável). Cada família é um tenant, com os dados isolados no banco por Row-Level Security do PostgreSQL.

Hoje é uma ferramenta de **uso interno**, feita para a nossa família. Não é um produto: não há plano de vender nem de abrir cadastro ao público.

---

## Problema que resolve

A família usa cartão de crédito, a fatura vem em CSV ou PDF e ninguém sabe ao certo quem gastou o quê, o que é de quem e quanto precisa ficar na reserva para pagar a fatura.

O MoneySpace lista os lançamentos da fatura com portador, categoria, parcela e status, compara a reserva com o que a fatura vai cobrar e divide compras entre pessoas.

O projeto nasceu de outro que não foi pra frente porque queria ser grande demais. Este é o que sobrou da ideia, bem menor: uma necessidade real de casa.

---

## Tecnologias

| Camada | Tecnologia | Observações |
| --- | --- | --- |
| Frontend | React 19 + Vite 8 | SPA mobile-first com React Router |
| UI | HeroUI v3 + Tailwind CSS 4 | Tema verde, claro e escuro |
| HTTP | Axios | Serviços em `src/services` |
| Backend | Node.js + Express 4 | JavaScript com ES Modules, sem TypeScript |
| Banco | PostgreSQL (Neon) | SQL nativo com o driver `pg`, sem ORM |
| Autenticação | JWT, bcrypt, TOTP | Cookie httpOnly, 2FA opcional |
| Isolamento | Row-Level Security | Contexto por requisição |
| PWA | Manifest + service worker | O service worker só roda em produção e nunca guarda `/api` em cache |

---

## Como executar

### Pré-requisitos

- Node.js 18 ou superior
- Uma instância PostgreSQL, local ou na nuvem (Neon)

### 1. Banco de dados

```bash
psql -U postgres -c "CREATE DATABASE moneyspace;"
psql -U postgres -d moneyspace -f MoneySpace-Back/db/script.sql
```

Se o banco já existe (por exemplo, no Neon), ele pode estar defasado em relação ao script. Confira as colunas em `information_schema.columns` e aplique as migrations de `MoneySpace-Back/db/migrations/` em ordem.

### 2. Backend

```bash
cd MoneySpace-Back
npm install
cp .env.example .env.development   # preencha os valores (veja Variáveis de ambiente)
npm run dev                        # http://localhost:3000
```

### 3. Frontend

```bash
cd MoneySpace-Front
npm install
cp .env.example .env.local
npm run dev                        # http://localhost:5173 (o proxy encaminha /api para o back)
```

Para ver as telas sem backend, com dados de exemplo:

```bash
VITE_MODO_DEMO=true npm run dev
```

### 4. Primeiro acesso

O login é real, então é preciso ter uma família e um usuário no banco, com a senha em hash bcrypt. Crie-os via SQL ou com um pequeno script Node que gere o hash com `bcrypt.hash(...)`. Depois, os outros usuários são cadastrados pela tela de Usuários.

### 5. Build e deploy

```bash
cd MoneySpace-Front
npm run build          # gera o dist, que o backend serve
```

O `dist` fica commitado de propósito: recompile o front antes de subir. O deploy é na Discloud (veja `DEPLOY_DISCLOUD.md`).

---

## Variáveis de ambiente

> **Nunca versione o `.env` com credenciais reais.** O repositório guarda só os modelos `.env.example`, com valores de mentira. O `.gitignore` já bloqueia `.env` e `.env.*` (menos o `.example`). Em produção, as variáveis ficam no painel da Discloud.

### Backend (`MoneySpace-Back/.env.development`, modelo em `.env.example`)

| Variável | Obrigatória | Para que serve |
| --- | --- | --- |
| `DATABASE_URL` | sim | String de conexão do PostgreSQL (use o role `app_moneyspace`, não o dono) |
| `JWT_SECRET` | sim | Assina o token de acesso |
| `JWT_REFRESH_SECRET` | sim | Assina o token de refresh (diferente do `JWT_SECRET`) |
| `CRYPTO_SECRET` | sim | Cifra o segredo do 2FA no banco |
| `PORT` | não | Porta da API (a Discloud espera `8080`) |
| `NODE_ENV` | não | `development` ou `production` |
| `CORS_ORIGIN` | não | Origem do front liberada (ex.: `http://localhost:5173`) |
| `ACCESS_TOKEN_EXPIRES` / `REFRESH_TOKEN_EXPIRES` | não | Validade dos tokens |

Sem `JWT_SECRET`, `JWT_REFRESH_SECRET` ou `CRYPTO_SECRET`, ou com dois deles iguais, o servidor não sobe. Se já existe 2FA ativo, `CRYPTO_SECRET` deve ser o valor antigo do `JWT_SECRET`.

### Frontend (`MoneySpace-Front/.env.local`, modelo em `.env.example`)

| Variável | Para que serve |
| --- | --- |
| `VITE_API_URL` | Só se a API estiver em outro endereço (padrão: `/api`) |
| `VITE_MODO_DEMO` | `true` libera as rotas e usa dados de exemplo |

---

## Como rodar os testes

O projeto **ainda não tem suíte de testes automatizados** (não há `npm test`). Hoje a conferência é manual:

- **Back:** com o back no ar, chame as rotas com o token de login.
- **Banco e RLS:** confira com o role do app dentro de `BEGIN ... ROLLBACK`, usando `SET LOCAL ROLE app_moneyspace`: sem contexto devolve 0 linhas, e uma família não vê nem grava na outra.
- **Front:** `npm run build` precisa passar sem erro.

- [ ] Criar a suíte de testes e o script `npm test`.

---

## Demonstração

- **Sem backend:** `VITE_MODO_DEMO=true npm run dev` no `MoneySpace-Front` abre as telas com dados de exemplo.
- **Capturas de tela:** ainda não adicionadas. Colocar em `docs/img/` e referenciar aqui.

---

## Detalhes do projeto

### O que o app faz

- **Fatura do cartão:** lista os lançamentos de uma fatura, com portador (quem gastou), categoria, parcela e status.
- **Conferência da reserva:** compara o saldo guardado com o que a fatura vai cobrar.
- **Status do lançamento:** todo lançamento nasce `pendente` e passa por `na hora`, `no fechamento` ou `pagamento`.
- **Cadastros:** usuários da família e categorias.
- **Celular e PC:** o front é mobile-first e instalável como PWA.

### Decisões de arquitetura

#### Uma família, um tenant

A tabela `familia` é o tenant. Os dados de cada família ficam isolados no banco pelo Row-Level Security do PostgreSQL, usando `id_familia`. Hoje só uma família usa o app, mas o isolamento já está pronto e custa pouco manter.

A cada requisição autenticada, o `rlsMiddleware` abre uma transação e define o contexto da família a partir do token:

```sql
SELECT set_config('app.current_familia_id', '<uuid-da-familia>', true);
```

As políticas de RLS filtram por esse contexto. Mesmo assim, as queries também filtram por `id_familia` de forma explícita, como segunda barreira.

#### Backend em 2 camadas

Cada módulo tem só três arquivos:

- **`*.controller.js`** cuida de `req` e `res`, da validação e da regra de negócio. Não tem SQL.
- **`*.Repositories.js`** é o único lugar com SQL. Recebe `req.db`, o client da transação com o contexto de RLS.
- **`*.routes.js`** liga o caminho aos middlewares e ao controller, nesta ordem: `verificaToken`, `rlsMiddleware`, controller.

Não existe camada de `service`. Para um app deste tamanho ela só criaria arquivos a mais.

O SQL é sempre literal e parametrizado (`$1`, `$2`). Nada de montar query concatenando texto.

#### Respostas padronizadas

Todas as rotas respondem pelo mesmo formato, em `utils/httpResponse.js`:

```json
{ "success": true,  "message": "...", "data": {} }
{ "success": false, "message": "..." }
```

#### Dinheiro

Valores usam `NUMERIC(14,2)`. O driver `pg` devolve `NUMERIC` como string, então o código converte com `Number(valor)` antes de calcular.

#### Front e back no mesmo deploy

O backend serve o front compilado (`MoneySpace-Front/dist`). A pasta `dist` fica commitada de propósito, então é preciso rodar `npm run build` no front antes de subir.

### Estrutura do projeto

Monorepo com dois projetos:

```text
MoneySpace/
├── MoneySpace-Back/
│   ├── server.js                       Ponto de entrada
│   ├── db/script.sql                   Schema do banco (fonte da verdade)
│   ├── db/migrations/                  Alterações do schema, em ordem
│   └── src/
│       ├── config/                     env.js, segredos.js e configDb.js (pool do pg)
│       ├── middleware/                 verificaToken, rlsMiddleware, rateLimiter
│       ├── modules/
│       │   ├── app.js                  Monta o Express e registra as rotas em /api
│       │   ├── login/                  Login, 2FA, refresh, logout
│       │   ├── cadastros/              familia, usuario, categoria, cartao
│       │   ├── dashboard/              Resumo do início
│       │   ├── fatura/                 Faturas e lançamentos
│       │   ├── relatorios/             Fatura, semanal e pendências
│       │   └── rateio/                 Divisão de compras entre pessoas
│       ├── routes/                     health.routes.js
│       └── utils/                      httpResponse, pgErrorHandler, crypto, cpf
│
└── MoneySpace-Front/
    ├── public/                         manifest, service worker e ícones do PWA
    └── src/
        ├── App.jsx                     Providers e rotas
        ├── components/Layout/          Topbar, lateral, barra inferior (celular)
        ├── context/                    Auth, Theme, Privacidade
        ├── pages/                      Login, Dashboard, Faturas, Cadastros, Usuarios,
        │                               Cartoes, Categorias, Relatorios, Familias, Conta
        ├── services/                   api.js e um service por domínio
        └── utils/ · hooks/
```

### Modelo de dados

O schema completo e comentado está em [`MoneySpace-Back/db/script.sql`](MoneySpace-Back/db/script.sql). As chaves primárias são UUID, as estrangeiras usam o prefixo `id_` e os nomes seguem `snake_case`.

| Tabela | Papel |
| --- | --- |
| `familia` | O tenant. |
| `usuario` | Quem acessa o app. Tem `role` (`Admin` ou `Membro`), `is_master` (dono do app), senha em bcrypt e os campos do 2FA. |
| `utilitario` | Lista global de opções (`tipo`, `valor`, `ordem`) que alimenta selects, como as categorias. Não tem `id_familia` nem RLS. |
| `cartao` | Cartões da família, com dono, final, limite e dias de fechamento e vencimento. |
| `fatura_corpo` | A fatura de uma competência de um cartão. |
| `fatura_transacao` | Cada lançamento da fatura, com portador, categoria, parcela e status. |
| `rateio_pessoa`, `fatura_rateio`, `fatura_rateio_pagamento` | Divisão de uma compra entre pessoas e os pagamentos de cada parte. |

As categorias moram na `utilitario` com `tipo = 'categoria'`. Os valores ficam em minúsculo no banco e o front os exibe em Proper Case.

### Segurança

- **Primeiro fator:** e-mail e senha, com a senha em hash bcrypt.
- **Segundo fator (opcional):** código TOTP de seis dígitos, compatível com o Google Authenticator. O segredo é cifrado com AES-256-GCM antes de ir para o banco.
- **Sessão:** access token JWT de vida curta e refresh token, em cookie httpOnly, cada um com segredo próprio.
- **Permissões:** o token carrega só `id`, `id_familia`, `familia_nome`, `nome` e `email`. O papel (`role`, `is_master`) é lido do banco a cada requisição que precisa dele.
- **Isolamento:** RLS por família no banco, com um role sem BYPASSRLS, mais o filtro explícito por `id_familia` nas queries.
- **Segredos:** `DATABASE_URL`, `JWT_SECRET` e afins ficam só em variáveis de ambiente.
- **Login:** a mensagem de erro é genérica, para não revelar se um e-mail existe, e as rotas sensíveis têm rate limiting.

### Status atual

**Funcionando:** login com 2FA, usuários, famílias (dono do app), categorias, cartões, faturas e lançamentos, rateio, dashboard e relatórios (PDF, WhatsApp e texto), tema claro e escuro, PWA.

**Ainda não existe:** conta corrente/carteira, importação de CSV da fatura e testes automatizados.

### Próximos passos

- [ ] Importação do CSV da fatura: preview sem gravar, confirmação em uma transação só e idempotência por hash.
- [ ] Cadastro de contas.
- [ ] Editar e excluir categorias, depois de decidir o que fazer com os lançamentos que usam o texto da categoria.
- [ ] Normalizar para minúsculo as categorias que já estão no banco.
- [ ] Trocar os ícones provisórios do PWA.
- [ ] Suíte de testes automatizados.

---

Feito por Gabriel Goes, para a família.
