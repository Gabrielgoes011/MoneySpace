# Deploy na Discloud — MoneySpace

App único: o backend (Express) serve a API sob `/api` **e** o front já compilado
(`MoneySpace-Front/dist`) na raiz `/`. Hospedado na Discloud via integração com o
GitHub (deploy automático a cada push na branch principal).

## ⚠️ Regra de ouro (NÃO esquecer)

O front é compilado **localmente** e o `dist` é **versionado no git** (Opção A).
A Discloud sobe exatamente o que está no commit — ela NÃO compila o front.

> **Mexeu em qualquer coisa do front (`MoneySpace-Front/src`)? Rode o build ANTES de commitar.**
> Se esquecer, o deploy sobe sem erro, mas o site mostra a versão ANTERIOR do front.

### Fluxo quando MUDOU o FRONT

```bash
# na raiz do projeto
npm run build:front    # compila o front -> MoneySpace-Front/dist
git add .              # inclui o código E o dist atualizado
git commit -m "..."
git push               # Discloud detecta e faz o deploy sozinha
```

> **Por que `build:front` e não `build`?** A Discloud roda `npm run build --if-present`
> na raiz automaticamente. Se existisse um script `build` na raiz, ela tentaria
> compilar o front NO SERVIDOR (e falha: faltam deps como `cross-env` e estoura
> memória). Por isso o script de build do front na raiz se chama `build:front` — a
> Discloud não o encontra como `build` e segue direto, usando o `dist` já commitado.
> **Não crie um script `build` na raiz.**

### Fluxo quando mudou só o BACK (nada no front)

```bash
git add .
git commit -m "..."
git push               # não precisa buildar; o dist já commitado continua válido
```

Regra mental: **"mudou tela/componente? `npm run build` antes do commit."**

## Por que não buildar na Discloud

O build do front (Vite + HeroUI v3) pede ~4 GB de RAM. O plano Platinum tem 2 GB no
total e este app reserva `RAM=800`. Buildar no servidor estouraria a memória e
quebraria o deploy. Por isso o `BUILD` da Discloud roda só o `npm install` do back
(leve) e o front já vai pronto no `dist`.

## Variáveis de ambiente (cadastrar no painel da Discloud)

Os `.env*` **não** são commitados. Cadastre estas variáveis no painel da Discloud
(aba de variáveis de ambiente do app):

| Variável       | Valor em produção                                   | Obrigatória |
|----------------|-----------------------------------------------------|-------------|
| `NODE_ENV`     | `production`                                         | sim         |
| `DATABASE_URL` | string de conexão do Postgres (Neon)                | sim         |
| `JWT_SECRET`   | segredo forte e único (não reutilizar o de dev)     | sim         |
| `PORT`         | não precisa — o código já usa 8080 por padrão       | não         |
| `CORS_ORIGIN`  | só se outro domínio for consumir a API              | não         |

> Front (`VITE_*`) é build-time, resolvido no `npm run build` local. NÃO vai no
> painel. Em produção o front usa `/api` relativo (mesmo domínio), então não precisa
> de `VITE_API_URL`.

## discloud.config (na raiz)

```ini
NAME=MoneySpace
TYPE=site
ID=moneyspace                 # subdomínio -> moneyspace.discloud.app
MAIN=MoneySpace-Back/server.js
RAM=800
VERSION=latest
AUTORESTART=true
START=node MoneySpace-Back/server.js
```

- `ID` é o subdomínio, sem `.discloud.app`. Troque se `moneyspace` já estiver em uso.
- `RAM=800`: com 2 GB no total, sobram 1200 MB para outros apps. Em produção este app
  é leve (só serve estático + API); dá para baixar para `RAM=512` se quiser liberar
  mais espaço para um segundo app.
- **Sem `BUILD` custom:** a Discloud roda `npm install` na raiz automaticamente, o que
  instala as dependências do backend (declaradas no `package.json` da RAIZ — ver abaixo).

## Onde ficam as dependências do backend (importante)

As dependências de runtime do backend (`express`, `pg`, `dotenv`, `jsonwebtoken`,
`bcrypt`, etc.) estão declaradas no **`package.json` da RAIZ**, não só no do back.

Motivo: a Discloud instala apenas o `package.json` da raiz automaticamente. Como o
`node_modules` fica na raiz e o Node sobe a árvore de diretórios procurando pacotes,
o `MoneySpace-Back/server.js` resolve tudo a partir da raiz. Se as deps ficassem só em
`MoneySpace-Back/package.json`, o servidor subiria sem `node_modules` e quebraria com
`Cannot find package 'dotenv'`.

> **Ao adicionar uma dependência nova de runtime do backend, declare-a TAMBÉM no
> `package.json` da raiz.** O `MoneySpace-Back/package.json` continua existindo para o
> dev local (`cd MoneySpace-Back && npm run dev`), mas o deploy usa a raiz.

## Testar localmente em localhost:8080 (igual produção)

1. Compilar o front (gera o `dist` que o back serve):
   ```bash
   npm run build:front
   ```
2. Subir o back na porta 8080 (PowerShell):
   ```powershell
   cd MoneySpace-Back
   $env:PORT=8080; node server.js
   ```
   (o back usa 8080 por padrão; o `$env:PORT` é só para deixar explícito)
3. Validar no navegador / terminal:
   - `http://localhost:8080/` → deve carregar o app React (HTML do front)
   - `http://localhost:8080/api` → JSON `{"success":true,"message":"API ... no ar"}`
   - `http://localhost:8080/dashboard` (ou outra rota do front) → carrega o app
     (fallback SPA)
   - `http://localhost:8080/api/login` etc. → endpoints da API

> Dev normal (hot reload) continua o mesmo: `npm run dev` no front (porta 5173) e
> `npm run dev` no back. O Vite tem proxy de `/api` para `http://localhost:8080`.

## Checklist antes do push de deploy

- [ ] Mexeu no front? Rodei `npm run build:front`.
- [ ] `MoneySpace-Front/dist` está no commit (`git status` mostra o dist).
- [ ] Nenhum `.env*` no commit (`git status` não lista `.env`).
- [ ] Variáveis cadastradas no painel da Discloud (`NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`).
