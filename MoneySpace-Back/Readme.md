# Template Backend (Node + Express)

API base para novos projetos. Login **simulado** (sem banco de dados), ideal para prototipar rápido.

## Como usar

1. Copie esta pasta com outro nome e rode `npm install`
2. Copie `.env.example` para `.env.development` e ajuste os valores
3. `npm run dev` e a API sobe em http://localhost:3000

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor com reload automático (`node --watch`) |
| `npm start` | Sobe o servidor em modo normal |

## Rotas prontas

| Método | Rota | Para que serve |
|---|---|---|
| `GET` | `/` | Confirma que a API está no ar |
| `GET` | `/health` | Health check (o front usa para mostrar "conectado") |
| `POST` | `/login` | Login **simulado**: aceita qualquer e-mail/senha e devolve um JWT |

Todas respondem no padrão `{ success, message, data }`.

### Exemplo de login

Qualquer e-mail/senha funciona (inclusive o botão **"Entrar com conta de teste"** do front usa `teste@template.com` / `123456`):

```http
POST /login
Content-Type: application/json

{ "email": "teste@template.com", "senha": "123456" }
```

Resposta:

```json
{
  "success": true,
  "message": "Login realizado com sucesso!",
  "data": { "usuario": { "id": 1, "nome": "teste", "email": "teste@template.com", "adm": true }, "token": "<jwt>" }
}
```

## Estrutura

| Pasta/arquivo | Para que serve |
|---|---|
| `server.js` | Ponto de entrada: carrega o `.env` e sobe a porta |
| `modules/app.js` | Configura o Express: CORS, parsers e registro das rotas |
| `routes/` | Define as rotas (`health.routes.js`, `auth.routes.js`) |
| `config/env.js` | Carrega o arquivo `.env.{ambiente}` |
| `config/configDb.js` | Pool do PostgreSQL (opcional, só quando ligar o banco de verdade) |
| `middleware/` | Autenticação JWT, admin, rate limit e RLS |
| `utils/httpResponse.js` | Padroniza as respostas HTTP |
| `utils/pgErrorHandler.js` | Traduz erros do PostgreSQL em mensagens amigáveis |

## Variáveis de ambiente

Veja `.env.example`. As principais:

| Variável | Para que serve |
|---|---|
| `PORT` | Porta do servidor (padrão `3000`) |
| `NODE_ENV` | `development` ou `production` |
| `CORS_ORIGIN` | Origem(ns) do front liberada(s) no CORS |
| `JWT_SECRET` | Segredo para assinar os tokens JWT |
| `DATABASE_URL` | Conexão PostgreSQL (opcional neste template) |

Só `PORT`, `NODE_ENV`, `CORS_ORIGIN` e `JWT_SECRET` são necessárias pra rodar o template como está (login mockado). Sem `DATABASE_URL`, o `config/configDb.js` avisa no console que o banco não foi configurado, é só um log, não trava a API.

## Transformando o login em real

O `routes/auth.routes.js` hoje só devolve um token fake. Para usar banco:

1. Ligue o PostgreSQL preenchendo `DATABASE_URL` no `.env`
2. No `/login`, consulte o usuário e compare a senha com hash (ex.: `bcrypt`)
3. Proteja rotas privadas com o middleware `middleware/auth/verificaToken.js`
