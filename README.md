<div align="center">

# 💰 MoneySpace

### *Um espaço para organizar toda a vida financeira da sua família.*

Controle de gastos **multi-família**, pensado para o dia a dia no celular: lançamentos rápidos, cartões e parcelamentos, "quem me deve", reservas de dinheiro e relatórios automáticos por e-mail.

`React + Vite + HeroUI`  ·  `Node.js + Express`  ·  `PostgreSQL (RLS)`

</div>

---

## 📑 Índice

- [O que é o MoneySpace](#-o-que-é-o-moneyspace)
- [O problema que ele resolve](#-o-problema-que-ele-resolve)
- [Conceitos que tornam o app diferente](#-conceitos-que-tornam-o-app-diferente)
- [Stack técnica](#-stack-técnica)
- [Arquitetura](#-arquitetura)
- [Modelo de dados](#-modelo-de-dados)
- [Segurança: RLS + 2FA](#-segurança-rls--2fa)
- [Como rodar o projeto](#-como-rodar-o-projeto)
- [Status atual](#-status-atual)
- [Roadmap](#-roadmap)

---

## 🎯 O que é o MoneySpace

O MoneySpace é um sistema de finanças **familiar e multi-tenant**: várias famílias usam a mesma aplicação e o mesmo banco, mas cada família enxerga **somente** os próprios dados — isolamento garantido no nível do banco pelo Row-Level Security do PostgreSQL.

A proposta não é ser mais uma planilha bonita. É dar à família respostas que normalmente dão trabalho:

- *Para onde foi o dinheiro este mês?*
- *Quem gastou o quê?* (marido, esposa, filhos)
- *Quanto ainda vou pagar de parcelas?*
- *Quem me deve e quanto?*
- *Já separei o dinheiro da fatura do cartão?*

E tudo isso chega no seu e-mail automaticamente, no dia e na frequência que a família escolher.


---

## 💡 O problema que ele resolve

Apps de finanças genéricos tratam cada usuário como uma ilha e misturam todo gasto numa pilha só. Na vida real de uma família, as dores são outras:

| Dor do dia a dia | Como o MoneySpace trata |
| --- | --- |
| "Comprei em 12x e perdi a noção de quanto falta." | A **compra** é separada das **parcelas**: 1 compra de 12x vira 12 transações mensais, cada uma com data e status próprios. |
| "Emprestei meu cartão pro cunhado e isso bagunçou meu relatório." | A compra marca `emprestado`, aponta o **devedor** e controla o **reembolso** — sem poluir seus gastos pessoais. |
| "Paguei no crédito mas já separei o dinheiro no débito. Já reservei tudo?" | Flag `valor_reservado` por compra responde "o dinheiro da fatura já está guardado?". |
| "Recebi o salário dia 30, mas ele é pra pagar o mês que vem." | Guardamos a data real do recebimento e resolvemos a "dor do dia 30" com **filtros de período** no dashboard. |
| "Quero saber quanto cada um da casa trouxe de renda." | Receitas ficam atreladas ao **usuário** dono, então dá pra ver quanto o marido e a esposa somaram no mês. |
| "Ninguém abre o app pra acompanhar as finanças." | **Relatório automático por e-mail** leva o resumo até a família, sem precisar lembrar de entrar. |

---

## 🧠 Conceitos que tornam o app diferente

Estes são os pilares de modelagem — entender eles é entender o MoneySpace:

### Compra ≠ Transação
- **`compra`** é o *fato econômico*: a decisão de gastar (ex.: uma TV de R$ 1.200 em 12x no Nubank).
- **`transacao`** é o *movimento no tempo* (regime de caixa): cada parcela efetiva. À vista gera 1 linha; em 12x gera 12 linhas, uma por mês.

Isso permite que o dashboard mostre tanto "quanto essa compra custou no total" quanto "quanto cai na fatura deste mês".

### O "Dia Zero" (saldo inicial)
`saldo_inicial` só serve para sincronizar o saldo do app com o saldo real no dia em que a conta é cadastrada. **Nunca** é somado como receita depois — evita contar dinheiro duas vezes.

### Categorias híbridas (sistema vs. família)
- Categorias do **sistema** (`padrao_sistema = true`, `id_familia = NULL`): já vêm prontas (Mercado, Lazer, Salário...), todas as famílias usam, ninguém edita.
- Categorias da **família** (`padrao_sistema = false`): criadas pela própria família, com cor personalizada e editáveis.

### Auditoria sem JOIN
Cada registro guarda `usuario_cadastro` (o **nome** de quem lançou, no momento do lançamento). Leitura rápida de "quem fez isso" sem precisar cruzar tabelas.

### Dinheiro exato
Valores em `NUMERIC(14,2)` (reais, 2 casas). Sem erro de ponto flutuante e sem dividir por 100. Detalhe de implementação: o driver `pg` entrega `NUMERIC` como **string**, então o código usa `Number(valor)` antes de fazer contas.

---

## 🛠 Stack técnica

| Camada | Tecnologia | Observações |
| --- | --- | --- |
| **Frontend** | React 19 + Vite 8 | Mobile-first, SPA com React Router 7 |
| **UI** | HeroUI v3 + Tailwind CSS 4 | HeroUI para componentes; Tailwind só para grid/espaçamento |
| **HTTP** | Axios | Interceptors para token e tratamento de sessão |
| **Backend** | Node.js + Express 4 | JavaScript puro (sem TypeScript), ES Modules |
| **Banco** | PostgreSQL | Queries nativas com o driver `pg`, **sem ORM** |
| **Auth** | JWT + bcrypt + TOTP (speakeasy) | Access + refresh token; 2FA opcional por usuário |
| **Isolamento** | Row-Level Security (RLS) | Contexto por request via `app.current_familia_id` |

---

## 🏗 Arquitetura

Monorepo com dois projetos independentes:

```text
MoneySpace/
├── MoneySpace-Back/          # API Express + PostgreSQL
│   ├── server.js             # Ponto de entrada (carrega .env e sobe a porta)
│   ├── db/script.sql         # Schema completo e comentado do banco
│   └── src/
│       ├── config/           # env.js (carrega .env) + configDb.js (pool pg)
│       ├── middleware/       # verificaToken (JWT), rlsMiddleware, rateLimiter
│       ├── modules/
│       │   ├── app.js        # Monta o Express: CORS, parsers, RLS, rotas
│       │   └── login/        # Módulo de login (controller/service/repository/routes)
│       ├── routes/           # health.routes.js
│       └── utils/            # httpResponse, pgErrorHandler, crypto (cifra o 2FA)
│
└── MoneySpace-Front/         # React + Vite + HeroUI
    └── src/
        ├── App.jsx           # Rotas e proteção por autenticação
        ├── pages/            # Login, Dashboard, Transacoes, Contas, Categorias
        ├── components/Layout # Header, Sidebar (desktop), BottomNavMobile (mobile)
        ├── context/          # Auth, Theme (claro/escuro), Privacy (ocultar valores)
        ├── hooks/            # useIsMobile
        ├── services/api.js   # Axios central (token + refresh/sessão)
        ├── utils/format.js   # Formatação de dinheiro/data em pt-BR
        └── mocks/            # Dados de exemplo enquanto a feature não tem API
```

### Backend em camadas (por módulo de domínio)

Cada domínio segue **Controller → Service → Repository**:

- **Controller** — lida com `req`/`res` e status HTTP. Decide a mensagem de erro (regra de negócio vs. erro do Postgres).
- **Service** — regras de negócio puras (validar senha, checar 2FA, montar o token).
- **Repository** — o **único** lugar que escreve SQL. Toda query passa pelo pool `pg`.

### Padrão de resposta da API

Todas as rotas respondem no mesmo formato, via `utils/httpResponse.js`:

```json
{ "success": true,  "message": "...", "data": { } }
{ "success": false, "message": "..." }
```

---

## 🗄 Modelo de dados

Multi-tenant: tudo pendura em `familia` via `id_familia`. PKs em **UUID**, FKs com prefixo `id_`, nomes em `snake_case`.

```text
familia 1───N usuario
familia 1───N conta           (CORRENTE | CREDITO | CARTEIRA)
familia 1───N categoria       (do sistema: id_familia = NULL)
familia 1───N contato
familia 1───N compra ───N transacao      (1 compra → N parcelas)
compra  N───1 conta / categoria / usuario
compra  N───1 contato         (via id_devedor, quando emprestado)
familia 1───1 preferencia_notificacao
familia 1───N email_destinatario
```

| Tabela | Papel |
| --- | --- |
| `familia` | O tenant (a casa). Tudo se isola por ela. |
| `usuario` | Quem loga. Guarda `senha` (hash bcrypt), `mfa_secreto` e `mfa_ativo`. |
| `conta` | Onde o dinheiro mora: conta corrente, carteira ou **cartão de crédito** (bandeira, final, limite, fechamento, vencimento). |
| `categoria` | Classificação `RECEITA`/`DESPESA`, com regra híbrida sistema/família. |
| `contato` | Terceiros ligados à família (para "quem me deve"). |
| `compra` | O fato econômico; agrupa parcelas e carrega flags (`valor_reservado`, `emprestado`, `reembolsado`). |
| `transacao` | Cada parcela/movimento efetivo, com `status` (`PENDENTE`/`EFETIVADA`). |
| `preferencia_notificacao` | Config única da família para o relatório automático. |
| `email_destinatario` | Lista de e-mails que recebem o relatório. |

> O schema completo e **comentado**, com exemplos de uso, está em [`MoneySpace-Back/db/script.sql`](MoneySpace-Back/db/script.sql).

Chaves com `ON DELETE CASCADE`: apagar uma família remove todos os dados dela; apagar uma compra remove suas parcelas.

---

## 🔐 Segurança: RLS + 2FA

### Autenticação em duas camadas
1. **Fator 1** — e-mail + senha, com a senha guardada em hash **bcrypt**.
2. **Fator 2 (opcional)** — código TOTP de 6 dígitos (Google Authenticator). O segredo é **cifrado** (AES-256-GCM, em `utils/crypto.js`) antes de ir para a coluna `mfa_secreto`.
3. **Sessão** — JWT de vida curta (access token) + refresh token para renovar sem pedir senha. O token carrega `id`, `id_familia`, `nome` e `email`.

### Isolamento por família (Row-Level Security)
A cada request autenticado, o `rlsMiddleware` abre uma transação e injeta o contexto da família (vindo do JWT):

```sql
SELECT set_config('app.current_familia_id', '<uuid-da-familia>', true);
```

Com o RLS ativo, até um `SELECT * FROM transacao` **sem WHERE** devolve apenas os dados daquela família. As policies usam `current_setting('app.current_familia_id', true)::uuid`.

> ⚠️ Detalhe importante: o contexto de RLS usa o **UUID da família** (`id_familia`), não um id numérico de usuário. É isso que todas as policies do banco esperam.

### Boas práticas aplicadas
- `DATABASE_URL`, `JWT_SECRET` e credenciais SMTP **só** no `.env` (nunca no banco nem no front).
- Mensagens de login genéricas ("E-mail ou senha inválidos") para não revelar se um e-mail existe.
- Rate limiting nas rotas sensíveis (login, 2FA, refresh) contra força bruta.

---

## 🚀 Como rodar o projeto

### Pré-requisitos
- Node.js 18+ e npm
- Uma instância PostgreSQL (local ou na nuvem, ex.: Neon)

### 1. Banco de dados
Crie o banco e rode o schema:

```bash
# cria o database (ajuste usuário/host conforme sua instalação)
psql -U postgres -c "CREATE DATABASE moneyspace;"

# aplica o schema completo
psql -U postgres -d moneyspace -f MoneySpace-Back/db/script.sql
```

### 2. Backend

```bash
cd MoneySpace-Back
npm install
# crie o .env.development a partir do exemplo e preencha a DATABASE_URL
cp .env.example .env.development
npm run dev            # sobe em http://localhost:3000 com reload automático
```

Variáveis principais do `.env.development`:

| Variável | Para que serve |
| --- | --- |
| `PORT` | Porta da API (padrão `3000`) |
| `NODE_ENV` | `development` ou `production` |
| `CORS_ORIGIN` | Origem do front liberada (ex.: `http://localhost:5173`) |
| `JWT_SECRET` | Segredo para assinar os tokens |
| `DATABASE_URL` | String de conexão do PostgreSQL |
| `CRYPTO_SECRET` | *(opcional)* chave para cifrar o segredo do 2FA; cai no `JWT_SECRET` se ausente |

### 3. Frontend

```bash
cd MoneySpace-Front
npm install
# aponte para a API (ex.: VITE_API_URL=http://localhost:3000)
cp .env.example .env.local
npm run dev            # abre em http://localhost:5173
```

### 4. Primeiro acesso
Como o login é real, você precisa de pelo menos uma família + um usuário com senha em hash bcrypt no banco. Crie-os manualmente (via SQL) ou com um pequeno script Node usando `bcrypt.hash(...)` antes de inserir na tabela `usuario`.

---

## ✅ Status atual

O que já está **funcionando de ponta a ponta**:

- 🔑 **Login real** contra o banco (bcrypt), com access + refresh token e rota `/me`.
- 🔒 **RLS por família** aplicado automaticamente nas requisições autenticadas.
- 🛡️ **2FA (TOTP)** com segredo cifrado — fluxo de iniciar, confirmar, validar e desativar.
- 🎨 **Front mobile-first** com HeroUI: sidebar no desktop, menu inferior no mobile, tema claro/escuro e modo "ocultar valores".
- 📊 Telas iniciais (com dados de exemplo): **Dashboard**, **Transações**, **Contas & Cartões** e **Categorias**.
- 🔔 Toasts de feedback no login (`toast.promise`: carregando → bem-vindo / erro).

> As telas financeiras hoje consomem **mocks** (`src/mocks`) no formato do banco. Trocar por chamadas reais à API é o próximo passo natural quando os endpoints de cada domínio existirem.

---

## 🗺 Roadmap

Próximos domínios a implementar no backend (seguindo o padrão controller/service/repository) e ligar ao front:

- [ ] **Contas & cartões** — CRUD, arquivar sem apagar (`ativo`).
- [ ] **Lançamentos** — criar compra e **gerar as parcelas** automaticamente.
- [ ] **Empréstimos** — marcar devedor e acompanhar reembolso ("quem me deve").
- [ ] **Categorias** — CRUD das categorias da família (respeitando as do sistema).
- [ ] **Dashboard/relatórios** — agregações reais por categoria, pessoa, conta e período.
- [ ] **Relatório automático por e-mail** — job agendado lendo preferências + destinatários e enviando via SMTP.

---

<div align="center">

Feito com ☕ por **Gabriel Goes** · *MoneySpace — um espaço para organizar toda sua vida financeira.*

</div>
