<div align="center">

# MoneySpace

### Sistema de gestão financeira multi-tenant para núcleos familiares

Aplicação web mobile-first em que várias famílias compartilham a mesma infraestrutura, mas cada uma acessa apenas os próprios dados, com isolamento garantido no nível do banco pelo Row-Level Security do PostgreSQL.

`React + Vite + HeroUI` · `Node.js + Express` · `PostgreSQL (RLS)` · `JWT + 2FA`

</div>

---

## Índice

- [Visão geral](#visão-geral)
- [Decisões de arquitetura](#decisões-de-arquitetura)
- [Modelagem de domínio](#modelagem-de-domínio)
- [Stack técnica](#stack-técnica)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Modelo de dados](#modelo-de-dados)
- [Segurança](#segurança)
- [Como rodar o projeto](#como-rodar-o-projeto)
- [Status atual](#status-atual)
- [Roadmap](#roadmap)

---

## Visão geral

O MoneySpace organiza as finanças de um núcleo familiar tratando a família como um tenant isolado. Todas as famílias usam a mesma aplicação e o mesmo banco de dados, porém cada registro pertence a uma família e nunca cruza essa fronteira. Esse isolamento não depende de o código lembrar de filtrar por família em cada consulta: ele é aplicado pelo próprio PostgreSQL, via Row-Level Security.

A aplicação cobre o ciclo financeiro de uma casa: contas e cartões, lançamentos à vista e parcelados, classificação por categoria, controle de valores a receber de terceiros e relatórios periódicos. O que diferencia o projeto está menos nas telas e mais nas decisões de modelagem e de segurança descritas a seguir.

---

## Decisões de arquitetura

### Multi-tenancy com isolamento no banco

Cada linha de dado carrega o identificador da família (`id_familia`). A cada requisição autenticada, um middleware abre uma transação e define o contexto da família a partir do token:

```sql
SELECT set_config('app.current_familia_id', '<uuid-da-familia>', true);
```

As políticas de RLS filtram por esse contexto, então mesmo um `SELECT * FROM transacao` sem cláusula `WHERE` devolve apenas os dados da família corrente. A segurança deixa de ser responsabilidade de cada consulta e passa a ser uma garantia da camada de dados.

### Backend em camadas por domínio

Cada domínio segue a separação Controller, Service e Repository:

- **Controller** cuida de `req` e `res` e dos status HTTP. Não contém SQL.
- **Service** concentra a regra de negócio: validar senha, verificar o segundo fator, montar o token.
- **Repository** é o único ponto que escreve SQL. Toda consulta passa pelo pool do driver `pg`.

Essa divisão mantém a regra de negócio testável e independente do framework web, e deixa o acesso a dados num só lugar.

### Respostas padronizadas

Todas as rotas respondem no mesmo formato, centralizado em `utils/httpResponse.js`:

```json
{ "success": true,  "message": "...", "data": {} }
{ "success": false, "message": "..." }
```

Isso simplifica o consumo no front, que trata sucesso e erro de forma uniforme.

---

## Modelagem de domínio

A modelagem é o núcleo do projeto. Três decisões merecem destaque.

### Compra e transação são coisas diferentes

O sistema separa o fato econômico do movimento no tempo:

- **Compra** é a decisão de gastar. Por exemplo, uma televisão de R$ 1.200 em doze vezes.
- **Transação** é cada movimento efetivo no caixa. A mesma compra em doze vezes gera doze transações, uma por mês, cada uma com data e status próprios.

Com essa separação, o painel consegue responder tanto quanto a compra custou no total quanto quanto dela cai na fatura de um mês específico. É a distinção clássica entre regime de competência e regime de caixa, resolvida na própria modelagem.

### Despesas de terceiros com rastreio de reembolso

Uma compra pode ser registrada em nome de um contato externo à família. Nesse caso ela fica marcada como despesa de terceiro, aponta o devedor e acompanha a situação do reembolso. O efeito prático é que esses valores não se misturam com os gastos próprios da família nos relatórios, e ainda assim ficam rastreados até a quitação.

### Categorias híbridas

As categorias existem em dois níveis. As categorias de sistema (`padrao_sistema = true`, `id_familia = NULL`) já vêm prontas, servem a todas as famílias e ninguém edita. As categorias de família são criadas por cada família, com cor própria e totalmente editáveis. O mesmo mecanismo entrega padrões úteis de imediato e flexibilidade para quem quiser personalizar.

### Precisão monetária

Valores usam `NUMERIC(14,2)`, o que evita erros de ponto flutuante e a necessidade de guardar centavos como inteiros. Vale registrar um detalhe de implementação: o driver `pg` entrega `NUMERIC` como string, então o código converte com `Number(valor)` antes de qualquer cálculo.

### Auditoria sem junção de tabelas

Cada registro guarda o nome de quem o lançou no momento do lançamento (`usuario_cadastro`). Saber quem fez o quê não exige cruzar tabelas, o que torna a leitura mais direta.

---

## Stack técnica

| Camada | Tecnologia | Observações |
| --- | --- | --- |
| Frontend | React 19 + Vite 8 | SPA mobile-first com React Router 7 |
| UI | HeroUI v3 + Tailwind CSS 4 | HeroUI para os componentes; Tailwind para ajustes pontuais de layout |
| HTTP | Axios | Interceptors para token e tratamento de sessão |
| Backend | Node.js + Express 4 | JavaScript puro com ES Modules, sem TypeScript |
| Banco | PostgreSQL | Consultas nativas com o driver `pg`, sem ORM |
| Autenticação | JWT, bcrypt, TOTP (speakeasy) | Access e refresh token; segundo fator opcional por usuário |
| Isolamento | Row-Level Security | Contexto por requisição via `app.current_familia_id` |

---

## Estrutura do projeto

Monorepo com dois projetos independentes:

```text
MoneySpace/
├── MoneySpace-Back/          API Express + PostgreSQL
│   ├── server.js             Ponto de entrada (carrega o .env e sobe a porta)
│   ├── db/script.sql         Schema completo e comentado do banco
│   └── src/
│       ├── config/           env.js (carrega o .env) e configDb.js (pool do pg)
│       ├── middleware/       verificaToken (JWT), rlsMiddleware, rateLimiter
│       ├── modules/
│       │   ├── app.js        Monta o Express: CORS, parsers, RLS e rotas
│       │   └── login/        Módulo de login (controller/service/repository/routes)
│       ├── routes/           health.routes.js
│       └── utils/            httpResponse, pgErrorHandler, crypto (cifra o 2FA)
│
└── MoneySpace-Front/         React + Vite + HeroUI
    └── src/
        ├── App.jsx           Rotas e proteção por autenticação
        ├── pages/            Login, Dashboard, Transacoes, Contas, Categorias
        ├── components/Layout Header, Sidebar (desktop), BottomNavMobile (mobile)
        ├── context/          Auth, Theme (claro e escuro), Privacy (ocultar valores)
        ├── hooks/            useIsMobile
        ├── services/api.js   Axios central (token e controle de sessão)
        └── utils/format.js   Formatação de dinheiro e data em pt-BR
```

---

## Modelo de dados

A modelagem é multi-tenant: tudo se liga à família por `id_familia`. As chaves primárias são UUID, as estrangeiras usam o prefixo `id_` e os nomes seguem `snake_case`.

```text
familia 1───N usuario
familia 1───N conta           (CORRENTE | CREDITO | CARTEIRA)
familia 1───N categoria       (do sistema: id_familia = NULL)
familia 1───N contato
familia 1───N compra ───N transacao      (uma compra gera N parcelas)
compra  N───1 conta / categoria / usuario
compra  N───1 contato         (via id_devedor, quando for despesa de terceiro)
familia 1───1 preferencia_notificacao
familia 1───N email_destinatario
```

| Tabela | Papel |
| --- | --- |
| `familia` | O tenant. Tudo se isola por ela. |
| `usuario` | Quem acessa a aplicação. Guarda a senha em hash bcrypt, além de `mfa_secreto` e `mfa_ativo`. |
| `conta` | Onde o dinheiro fica: conta corrente, carteira ou cartão de crédito (bandeira, final, limite, fechamento, vencimento). |
| `categoria` | Classificação de receita ou despesa, com a regra híbrida de sistema e família. |
| `contato` | Pessoas externas ligadas à família, usadas no controle de valores a receber. |
| `compra` | O fato econômico. Agrupa as parcelas e carrega indicadores como valor reservado, despesa de terceiro e reembolso. |
| `transacao` | Cada parcela ou movimento efetivo, com status pendente ou efetivada. |
| `preferencia_notificacao` | Configuração única da família para o relatório periódico. |
| `email_destinatario` | Lista de e-mails que recebem o relatório. |

O schema completo e comentado, com exemplos de uso, está em [`MoneySpace-Back/db/script.sql`](MoneySpace-Back/db/script.sql). As chaves com `ON DELETE CASCADE` fazem com que remover uma família apague todos os seus dados e remover uma compra apague suas parcelas.

---

## Segurança

### Autenticação em duas camadas

1. **Primeiro fator**: e-mail e senha, com a senha armazenada em hash bcrypt.
2. **Segundo fator (opcional)**: código TOTP de seis dígitos compatível com aplicativos como o Google Authenticator. O segredo é cifrado com AES-256-GCM (em `utils/crypto.js`) antes de chegar à coluna `mfa_secreto`.
3. **Sessão**: um access token JWT de vida curta mais um refresh token para renovar sem pedir a senha novamente. O token carrega `id`, `id_familia`, `nome` e `email`.

### Isolamento por família

O contexto de RLS usa o UUID da família, não um identificador de usuário. É esse valor que todas as políticas do banco esperam. Como o filtro vive no banco, uma consulta que esqueça a cláusula de família ainda assim não vaza dados de outro tenant.

### Boas práticas aplicadas

- Segredos como `DATABASE_URL`, `JWT_SECRET` e credenciais de SMTP ficam apenas em variáveis de ambiente, nunca no banco ou no front.
- As mensagens de login são genéricas, do tipo "e-mail ou senha inválidos", para não revelar se um e-mail existe.
- As rotas sensíveis (login, segundo fator e refresh) têm rate limiting contra tentativas de força bruta.

---

## Como rodar o projeto

### Pré-requisitos

- Node.js 18 ou superior e npm
- Uma instância PostgreSQL, local ou na nuvem (por exemplo, Neon)

### 1. Banco de dados

Crie o banco e aplique o schema:

```bash
# cria o database (ajuste usuário e host conforme sua instalação)
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
| `CORS_ORIGIN` | Origem do front liberada (por exemplo, `http://localhost:5173`) |
| `JWT_SECRET` | Segredo usado para assinar os tokens |
| `DATABASE_URL` | String de conexão do PostgreSQL |
| `CRYPTO_SECRET` | Opcional. Chave para cifrar o segredo do 2FA; na ausência, usa o `JWT_SECRET` |

### 3. Frontend

```bash
cd MoneySpace-Front
npm install
# aponte para a API (por exemplo, VITE_API_URL=http://localhost:3000)
cp .env.example .env.local
npm run dev            # abre em http://localhost:5173
```

### 4. Primeiro acesso

Como o login é real, é preciso ter ao menos uma família e um usuário com senha em hash bcrypt no banco. Crie-os via SQL ou com um pequeno script Node que gere o hash com `bcrypt.hash(...)` antes de inserir na tabela `usuario`.

---

## Status atual

Funcionando de ponta a ponta:

- Login real contra o banco com bcrypt, access e refresh token e rota `/me`.
- RLS por família aplicado automaticamente nas requisições autenticadas.
- Segundo fator TOTP com segredo cifrado, cobrindo iniciar, confirmar, validar e desativar.
- Front mobile-first com HeroUI: sidebar no desktop, menu inferior no mobile, tema claro e escuro e modo de ocultar valores.
- Telas iniciais de Dashboard, Transações, Contas e Cartões e Categorias.
- Feedback de login com toasts (carregando, boas-vindas e erro).

As telas financeiras hoje consomem dados de exemplo no formato do banco. Substituí-los por chamadas reais à API é o próximo passo conforme os endpoints de cada domínio ficam prontos.

---

## Roadmap

Próximos domínios a implementar no backend, seguindo o padrão controller, service e repository, e a ligar ao front:

- [ ] Contas e cartões: CRUD completo e arquivamento sem exclusão (`ativo`).
- [ ] Lançamentos: criar a compra e gerar as parcelas automaticamente.
- [ ] Despesas de terceiros: registrar o devedor e acompanhar o reembolso.
- [ ] Categorias: CRUD das categorias da família, respeitando as de sistema.
- [ ] Dashboard e relatórios: agregações reais por categoria, pessoa, conta e período.
- [ ] Relatório periódico por e-mail: tarefa agendada que lê as preferências e os destinatários e envia via SMTP.

---

<div align="center">

Desenvolvido por Gabriel Goes

</div>
