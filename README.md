# MoneySpace

Controle simples do cartão de crédito em família.

`React + Vite + HeroUI` · `Node.js + Express` · `PostgreSQL (RLS)` · `JWT + 2FA` · `PWA`

---

## Por que existe

O MoneySpace nasceu de outro projeto que não foi pra frente. Aquele queria ser grande demais. Este aqui é o que sobrou da ideia e é bem menor: uma necessidade real de casa.

A família usa cartão de crédito, a fatura vem em CSV ou PDF e ninguém sabe ao certo quem gastou o quê, o que é de quem e quanto precisa ficar na reserva para pagar a fatura. A ideia é resolver isso de um jeito simples, que roda no computador e no celular.

Isto **não é um produto**. Não tem plano de vender, de abrir cadastro para o público nem de virar SaaS. É uma ferramenta de uso interno, feita para a nossa família.

---

## Índice

- [O que o app faz](#o-que-o-app-faz)
- [Decisões de arquitetura](#decisões-de-arquitetura)
- [Stack](#stack)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Modelo de dados](#modelo-de-dados)
- [Segurança](#segurança)
- [Como rodar](#como-rodar)
- [Status atual](#status-atual)
- [Próximos passos](#próximos-passos)

---

## O que o app faz

- **Fatura do cartão:** lista os lançamentos de uma fatura, com portador (quem gastou), categoria, parcela e status.
- **Conferência da reserva:** compara o saldo guardado com o que a fatura vai cobrar.
- **Status do lançamento:** todo lançamento nasce `pendente` e passa por `na hora`, `no fechamento` ou `pagamento`.
- **Cadastros:** usuários da família e categorias.
- **Celular e PC:** o front é mobile-first e instalável como PWA.

---

## Decisões de arquitetura

### Uma família, um tenant

A tabela `familia` é o tenant. Os dados de cada família ficam isolados no banco pelo Row-Level Security do PostgreSQL, usando `id_familia`. Hoje só uma família usa o app, mas o isolamento já está pronto e custa pouco manter.

A cada requisição autenticada, o `rlsMiddleware` abre uma transação e define o contexto da família a partir do token:

```sql
SELECT set_config('app.current_familia_id', '<uuid-da-familia>', true);
```

As políticas de RLS filtram por esse contexto. Mesmo assim, as queries também filtram por `id_familia` de forma explícita, como segunda barreira.

### Backend em 2 camadas

Cada módulo tem só três arquivos:

- **`*.controller.js`** cuida de `req` e `res`, da validação e da regra de negócio. Não tem SQL.
- **`*.Repositories.js`** é o único lugar com SQL. Recebe `req.db`, o client da transação com o contexto de RLS.
- **`*.routes.js`** liga o caminho aos middlewares e ao controller, nesta ordem: `verificaToken`, `rlsMiddleware`, controller.

Não existe camada de `service`. Para um app deste tamanho ela só criaria arquivos a mais.

O SQL é sempre literal e parametrizado (`$1`, `$2`). Nada de montar query concatenando texto.

### Respostas padronizadas

Todas as rotas respondem pelo mesmo formato, em `utils/httpResponse.js`:

```json
{ "success": true,  "message": "...", "data": {} }
{ "success": false, "message": "..." }
```

### Dinheiro

Valores usam `NUMERIC(14,2)`. O driver `pg` devolve `NUMERIC` como string, então o código converte com `Number(valor)` antes de calcular.

### Front e back no mesmo deploy

O backend serve o front compilado (`MoneySpace-Front/dist`). A pasta `dist` fica commitada de propósito, então é preciso rodar `npm run build` no front antes de subir. O deploy é na Discloud (veja `DEPLOY_DISCLOUD.md`).

---

## Stack

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

## Estrutura do projeto

Monorepo com dois projetos:

```text
MoneySpace/
├── MoneySpace-Back/
│   ├── server.js                       Ponto de entrada
│   ├── db/script.sql                   Schema do banco (fonte da verdade)
│   └── src/
│       ├── config/                     env.js e configDb.js (pool do pg)
│       ├── middleware/                 verificaToken, rlsMiddleware, rateLimiter
│       ├── modules/
│       │   ├── app.js                  Monta o Express e registra as rotas em /api
│       │   ├── login/                  Login, 2FA, refresh, logout
│       │   └── cadastros/
│       │       ├── familia/            Família
│       │       ├── usuario/            Usuários da família
│       │       └── categoria/          Categorias
│       ├── routes/                     health.routes.js
│       └── utils/                      httpResponse, pgErrorHandler, crypto
│
└── MoneySpace-Front/
    ├── public/                         manifest, service worker e ícones do PWA
    └── src/
        ├── App.jsx                     Providers e rotas
        ├── components/Layout/          Topbar, lateral, barra inferior (celular)
        ├── context/                    Auth, Theme, Fatura (mock compartilhado)
        ├── pages/                      Login, Dashboard, Faturas, Cadastros,
        │                               Usuarios, Categorias, Welcome (perfil)
        ├── services/                   api.js e um service por domínio
        └── utils/ · hooks/ · mocks/
```

---

## Modelo de dados

O schema completo e comentado está em [`MoneySpace-Back/db/script.sql`](MoneySpace-Back/db/script.sql). As chaves primárias são UUID, as estrangeiras usam o prefixo `id_` e os nomes seguem `snake_case`.

| Tabela | Papel |
| --- | --- |
| `familia` | O tenant. |
| `usuario` | Quem acessa o app. Tem `role` (`ADMIN` ou `MEMBRO`), `is_master` (dono do app), senha em bcrypt e os campos do 2FA. |
| `utilitario` | Lista global de opções (`tipo`, `valor`, `ordem`) que alimenta selects, como os status e as categorias. Não tem `id_familia` nem RLS. |
| `fatura_corpo` | A fatura de uma competência, com o saldo de reserva. |
| `fatura_transacao` | Cada lançamento da fatura, com portador, categoria, parcela e status. |

As categorias moram na `utilitario` com `tipo = 'categoria'`. Os valores ficam em minúsculo no banco e o front os exibe em Proper Case.

---

## Segurança

- **Primeiro fator:** e-mail e senha, com a senha em hash bcrypt.
- **Segundo fator (opcional):** código TOTP de seis dígitos, compatível com o Google Authenticator. O segredo é cifrado com AES-256-GCM antes de ir para o banco.
- **Sessão:** access token JWT de vida curta e refresh token, em cookie httpOnly.
- **Permissões:** o token carrega só `id`, `id_familia`, `familia_nome`, `nome` e `email`. O papel (`role`, `is_master`) é lido do banco a cada requisição que precisa dele.
- **Isolamento:** RLS por família no banco, mais o filtro explícito por `id_familia` nas queries.
- **Segredos:** `DATABASE_URL`, `JWT_SECRET` e afins ficam só em variáveis de ambiente.
- **Login:** a mensagem de erro é genérica, para não revelar se um e-mail existe, e as rotas sensíveis têm rate limiting.

---

## Como rodar

### Pré-requisitos

- Node.js 18 ou superior
- Uma instância PostgreSQL, local ou na nuvem (Neon)

### 1. Banco de dados

```bash
psql -U postgres -c "CREATE DATABASE moneyspace;"
psql -U postgres -d moneyspace -f MoneySpace-Back/db/script.sql
```

Se o banco já existe (por exemplo, no Neon), ele pode estar defasado em relação ao script. Confira as colunas em `information_schema.columns` antes de contar com elas.

### 2. Backend

```bash
cd MoneySpace-Back
npm install
# copie .env.example para .env.development e preencha DATABASE_URL e JWT_SECRET
npm run dev            # http://localhost:3000
```

| Variável | Para que serve |
| --- | --- |
| `PORT` | Porta da API (padrão `3000`) |
| `NODE_ENV` | `development` ou `production` |
| `CORS_ORIGIN` | Origem do front liberada (ex.: `http://localhost:5173`) |
| `JWT_SECRET` | Segredo para assinar os tokens |
| `DATABASE_URL` | String de conexão do PostgreSQL |
| `CRYPTO_SECRET` | Opcional. Chave para cifrar o segredo do 2FA; sem ela, usa o `JWT_SECRET` |

### 3. Frontend

```bash
cd MoneySpace-Front
npm install
# copie .env.example para .env.local e ajuste VITE_API_URL
npm run dev            # http://localhost:5173 (o proxy encaminha /api para a porta 3000)
```

Para ver as telas sem backend, rode com os dados de exemplo:

```bash
VITE_MODO_DEMO=true npm run dev
```

### 4. Primeiro acesso

O login é real, então é preciso ter uma família e um usuário no banco, com a senha em hash bcrypt. Crie-os via SQL ou com um pequeno script Node que gere o hash com `bcrypt.hash(...)`. Depois disso, os outros usuários são cadastrados pela tela de Usuários.

### 5. Build e deploy

```bash
cd MoneySpace-Front
npm run build          # gera o dist, que o backend serve
```

---

## Status atual

**Funcionando:**

- Login, 2FA (TOTP) e logout.
- Cadastro de usuários da família: listar, criar e editar. Só `ADMIN` ou o dono do app (`is_master`) cria e edita.
- Cadastro de categorias: listar e criar. Só o dono do app cria, porque a tabela é global.
- Layout com topbar, lateral recolhível e barra inferior no celular, tema claro e escuro, PWA instalável.

**Ainda com dados de exemplo (mock):**

- Início (`/dashboard`) e Faturas (`/faturas`). As telas existem e funcionam, mas ainda não leem da API.

**Ainda não existe:**

- Contas e cartões, o módulo de fatura no backend e a importação de CSV.
- Migrations. O schema vive só no `script.sql`.

---

## Próximos passos

- [ ] Backend da fatura: cartão, fatura por competência e lançamentos, ligados às telas que hoje usam mock.
- [ ] Importação do CSV da fatura: preview sem gravar, confirmação em uma transação só e idempotência por hash. Todo lançamento importado nasce `pendente`.
- [ ] Cadastro de contas (o cartão será uma conta do tipo crédito).
- [ ] Editar e excluir categorias, depois de decidir o que fazer com os lançamentos que usam o texto da categoria.
- [ ] Normalizar para minúsculo as categorias que já estão no banco.
- [ ] Trocar os ícones provisórios do PWA.

---

Feito por Gabriel Goes, para a família.
