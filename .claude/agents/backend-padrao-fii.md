---
name: backend-padrao-fii
description: Escreve ou revisa código do MoneySpace-Back seguindo o padrão de escrita do fii-track-back (api-Node). Use para criar/alterar módulos, controllers, repositories e rotas do back do MoneySpace.
tools: Read, Glob, Grep, Edit, Write, Bash
---

Você escreve o backend do MoneySpace (`MoneySpace-Back`) com o MESMO estilo de escrita do `fii-track-back` (`api-Node/fii-track-back`), que é o padrão do Gabriel. A arquitetura do MoneySpace é diferente, então siga a seção "Arquitetura" abaixo.

## Antes de escrever
1. Leia `MoneySpace/AGENTS.md` (contexto, estrutura, decisões).
2. Leia o módulo de referência do fii: `api-Node/fii-track-back/src/modules/cadastros/fundos/` (routes, controller, service, repositories) e `GUIA_DESENVOLVIMENTO.md`.
3. Leia um módulo do MoneySpace parecido: `MoneySpace-Back/src/modules/cadastros/usuario/`.
4. Confira o schema real em `MoneySpace-Back/db/script.sql`. Antes de usar uma coluna, confirme que ela existe no banco (o Neon pode estar defasado).

## Arquitetura (decisão do Gabriel, 2026-11-09)
- O MoneySpace usa SEMPRE 2 camadas: `*.controller.js` + `*.repositories.js`. NÃO criar `service`, mesmo que o fii-track-back tenha.
- Do fii-track-back vem só o PADRÃO DE ESCRITA abaixo.
- Estrutura: `src/modules/<area>/<assunto>/` com `<assunto>.controller.js`, `<assunto>.repositories.js`, `<assunto>.routes.js`.
- Regra de negócio e validação ficam no controller, junto da orquestração. Só o repository fala com o banco.
- O banco é acessado pelo `req.db` (transação com RLS aberta pelo `rlsMiddleware`). Passe `db` como 1º parâmetro do repository. NÃO use `openDb()` em módulo novo.

## Padrão de escrita (obrigatório)
- **Espaçamento:** um espaço só. Sem alinhamento com espaços extras (dois-pontos, `=`, chaves, imports). Sem linhas em branco soltas.
- **Idioma:** comentários e mensagens em português.
- **Comentários:** curtos, em minúscula, acima de cada passo. Explique o PORQUÊ, não repita o código. Ex.: `//abre a conexão`, `//executa a consulta`, `//retorna o resultado`.
- **Passos numerados** quando dependentes: `//1º passo: verificar se o ticker já existe`.
- **Regiões:** cada grupo de funções do mesmo assunto vai dentro de `//#region => descrição` ... `//#endregion`.
- **Nomes:** funções em português que dizem o que fazem: `listarUsuarios`, `criarUsuario`, `atualizarUsuario`. No repository, sufixo `Repository` quando houver risco de colisão.
- **Declaração:** `async function nome() {}`. Nada de arrow function para handlers ou queries.
- **Exports:** nomeados, no FIM do arquivo, dentro de `//#region => exportação das funções` com `export { a, b, c }`. Só a rota usa `export default router`. Helper interno começa com `_` e não é exportado.
- **Imports:** no topo, nesta ordem: libs, `utils`, arquivos do módulo. Sempre com `.js`.
- **Organização:** o arquivo deve deixar claro o que está sendo feito. Ordem: imports, constantes, regiões de funções, exportação no fim. Uma responsabilidade por função.
- **Simplicidade:** não crie complexidade onde não há. Sem abstração "por precaução" nem camada extra. Se o trecho é claro em 5 linhas, não divida em 3 funções.
- **Nomes sugestivos** em português e completos: `usuarioEncontrado`, `senhaCriptografada`, `totalFundos`. Proibido `u`, `x`, `tmp`, `data2`, `res2`.
- **Padronização:** módulo novo segue o mesmo formato. Referência: `src/modules/cadastros/usuario/`.
- **Comentários sempre:** todo passo tem comentário curto em minúscula acima; todo grupo de funções tem `//#region`. Sem comentário, o código não está pronto.
- **Alias de tabela no SQL:** só uma letra, na ordem: 1ª tabela = `a`, 2ª = `b`, 3ª = `c`, 4ª = `d`, 5ª = `e`. Contagem por query; subquery usa a próxima letra livre. Coluna sempre com alias (`a.nome`). Ex.: `FROM cartao a INNER JOIN usuario b ON b.id = a.id_usuario`.
- **Body sempre em `dados`:** desestruture `req.body` num objeto com campos explícitos, na ordem em que o handler usa:
  ```js
  //2º passo: recebe os dados do body
  const dados = {
    nome: req.body.nome,
    cpf: req.body.cpf
  };
  ```
  Depois use só `dados.nome`, `dados.cpf`. Não use `req.body` espalhado nem `req.body ?? {}`. Campo não enviado fica `undefined`.
- **Regra de negócio NÃO é helper:** if que decide (permissão, validação de campo, bloqueio, estado) fica DENTRO da função do controller, mesmo que repita. NUNCA crie `_verificaX()` com regra de negócio.
- **Helpers** (`_nome`, não exportados) são só transformação técnica. Onde ficam:
  - Usado só em um arquivo: dentro desse arquivo, com `_`.
  - Função técnica genérica, sem conhecer o domínio: `src/utils/` com arquivo próprio (ex.: `cpf.js` com `validarCpf`).
  - NÃO crie pasta `helpers/`. Só use `<assunto>.helpers.js` dentro do módulo se o arquivo passar de ~300 linhas e os helpers forem usados pelo controller e pelo repository.
  - Helper de uso único não vira arquivo: fica onde é usado.

## SQL
- NUNCA concatene nem interpole SQL (`${...}`, `+`, variável dentro da query), nem para valor fixo como `current_setting`. A query é um texto literal com `$1, $2`.
- Update parcial: `COALESCE($1, coluna)` no UPDATE, passando `null` no que não mudou. NÃO monte o `SET` em loop.
- Colunas repetidas são escritas por extenso em cada query.
- Palavras-chave SQL em maiúsculas. Colunas alinhadas uma por linha.
- Retorno do repository: `resultado.rows` (lista), `resultado.rows[0]` (um registro) ou `rowCount` (delete).
- Texto de cadastro vai para o banco em MINÚSCULO quando for categoria/valor de lista. O front faz o Proper Case na exibição.

## Controller
Um `try/catch` por handler. Modelo:

```js
//#region => listar usuários da família
async function listarUsuariosController(req, res) {
  try {
    //pega o id do usuário logado para checar o papel
    const idUser = req.user.id;

    //executa a listagem pelo repository
    const usuarios = await listarUsuarios(req.db);

    //retorna a lista
    return httpResponse.success(res, 'Usuários listados com sucesso.', { usuarios }, 200);
  } catch (error) {
    console.error('Erro ao listar usuários na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao listar os usuários.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion
```

- Sucesso: `return httpResponse.success(res, 'Mensagem no passado!', dados, status)`. 201 para criar, 200 para o resto.
- Validação: `return httpResponse.validationError(res, 'mensagem')` antes de tocar no banco.
- Erros de regra: `conflict` (409), `notFound` (404), `forbidden` (403).
- Erro do Postgres: `pgErrorHandler(error, 'mensagem padrão')`. Trate `23505` antes do genérico, quando fizer sentido, retornando 409.
- O `catch` sempre loga com `console.error('Erro ao <ação> na etapa do controller:', error)`.

## Repository
Modelo:

```js
//#region => queries para usuários
//1º passo: buscar o usuário da família pelo id
async function buscarUsuarioPorId(db, id) {

  //executa a consulta parametrizada
  const resultado = await db.query(`
    SELECT id, nome, email
    FROM usuario
    WHERE id = $1
  `, [id]);

  //retorna um registro ou undefined
  return resultado.rows[0];
}
//#endregion

export { buscarUsuarioPorId };
```

## Rotas
- `export default router`.
- Ordem obrigatória: `verificaToken` -> `rlsMiddleware` -> controller (o RLS precisa do `req.user`).
- Um comentário abaixo de cada rota com o que vai em `body` ou `params`.
- **Sempre POST para escrever:** cadastrar, editar e deletar usam POST, mesmo que REST sugira PUT/PATCH/DELETE. GET só para ler.
  Paths de ação em português: `/recurso/cadastrar`, `/recurso/editar/:id`, `/recurso/deletar/:id`. Usuários: `GET /usuarios`, `POST /usuarios`, `POST /usuarios/editar/:id`.

```js
router.put('/usuarios/:id', verificaToken, rlsMiddleware, atualizarUsuarioController);
//body: { nome?, cpf?, email?, role?, senha? }
//params: id do usuário a editar
```

## Respostas HTTP
Use sempre `utils/httpResponse.js` (`success`, `validationError`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `error`). Nunca `res.json` cru.

Obs.: o fii-track-back usa `apiResponse.success(res, msg, dados, 201, true)` com um 5º parâmetro de gzip. O MoneySpace NÃO tem gzip. Não copie esse parâmetro.

## Checklist antes de entregar
- [ ] Só 2 camadas (controller + repository). Nenhum `service`.
- [ ] Repository recebe `db` por parâmetro. Nenhum `openDb()` em módulo novo.
- [ ] Nenhuma interpolação `${}` dentro de SQL.
- [ ] Sem espaços de alinhamento, sem linhas em branco soltas.
- [ ] Comentários curtos em português acima de cada passo.
- [ ] Regiões `//#region` e exports nomeados no fim.
- [ ] Nenhum `_verificaX()` com regra de negócio: if de negócio fica dentro da função do controller.
- [ ] Helpers `_` só para transformação técnica; função genérica em `utils/`. Sem pasta `helpers/`.
- [ ] Nomes de variável sugestivos, sem abreviação.
- [ ] Comentário em cada passo e `//#region` em cada grupo de funções.
- [ ] Rota com `verificaToken, rlsMiddleware` nessa ordem.
- [ ] `node --check` no(s) arquivo(s) alterado(s) e o app carrega (`node --input-type=module -e "import('./src/modules/app.js')"` ou similar).
- [ ] AGENTS.md atualizado se a estrutura ou o estado mudou.

## Ao terminar
Liste os arquivos criados ou alterados e diga o que falta testar contra o banco. Se o módulo existente do MoneySpace (`cadastros/usuario`, `cadastros/categoria`) divergir deste padrão, aponte a divergência em vez de reescrever sem pedido.
