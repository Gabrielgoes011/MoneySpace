// ========================================
// CONTROLLER: CADASTRO DE CARTÕES
// ========================================
// Arquitetura de 2 camadas: o controller cuida de req/res E das regras de negócio;
// o SQL fica no repository. Usa `req.db` (transação com RLS aberta pelo rlsMiddleware).
//
// Autorização (o JWT não carrega `role`: o papel é lido do banco):
//   - listar:    qualquer membro da família
//   - cadastrar: só ADMIN da família (ou dono do app)
//   - excluir:   só ADMIN da família (ou dono do app)
//
// Regras: 1 cartão principal por família (o anterior é desmarcado antes de gravar),
// o dono precisa ser um usuário da mesma família, e 4 dígitos no final do cartão.
// Excluir só se o cartão não tiver lançamento (movimentação) nas suas faturas.
// Body: sempre desestruturado em `dados` com campos explícitos.

import httpResponse from '../../../utils/httpResponse.js';
import pgErrorHandler, { CODIGO_UNIQUE_VIOLATION } from '../../../utils/pgErrorHandler.js';
import { buscarPapelRepository, buscarUsuarioPorIdRepository } from '../usuario/cadUsuario.Repositories.js';
import {
  listarCartoesRepository,
  desmarcarPrincipalRepository,
  criarCartaoRepository,
  buscarCartaoPorIdRepository,
  contarMovimentacoesCartaoRepository,
  excluirFaturasVaziasCartaoRepository,
  excluirCartaoRepository
} from './cadCartao.Repositories.js';

//#region => Constantes
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGEX_FINAL_CARTAO = /^\d{4}$/;
//#endregion

//#region => listar cartões
//resposta: { cartoes: [...], pode_cadastrar: boolean }
async function listarCartoes(req, res) {
  try {
    //1º passo: busca os cartões da família e o papel de quem chamou
    const [cartoes, papelSolicitante] = await Promise.all([
      listarCartoesRepository(req.db),
      buscarPapelRepository(req.db, req.user.id)
    ]);

    //2º passo: diz se quem chamou pode cadastrar (ADMIN da família ou dono do app)
    const podeCadastrar = papelSolicitante?.role === 'ADMIN' || papelSolicitante?.is_master === true;

    //retorna a lista
    return httpResponse.success(res, 'Cartões listados com sucesso!', {
      cartoes,
      pode_cadastrar: podeCadastrar
    });

  } catch (error) {
    console.error('Erro ao listar cartões na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao listar os cartões.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => cadastrar cartão
//body: { nome, final, idUsuario, limite?, diaFechamento?, diaVencimento?, principal? }
async function criarCartao(req, res) {
  try {
    //1º passo: só ADMIN da família cadastra cartão
    const papelSolicitante = await buscarPapelRepository(req.db, req.user.id);
    const solicitanteEhAdmin = papelSolicitante?.role === 'ADMIN' || papelSolicitante?.is_master === true;

    if (!solicitanteEhAdmin) {
      return httpResponse.forbidden(res, 'Apenas administradores da família podem cadastrar cartões.');
    }

    //2º passo: recebe os dados do body
    const dados = {
      nome: req.body.nome,
      final: req.body.final,
      idUsuario: req.body.idUsuario,
      limite: req.body.limite,
      diaFechamento: req.body.diaFechamento,
      diaVencimento: req.body.diaVencimento,
      principal: req.body.principal
    };

    //3º passo: normaliza os campos (vazio/ausente vira null)
    const nomeNormalizado = String(dados.nome ?? '').trim();
    const finalNormalizado = String(dados.final ?? '').trim();
    const idUsuarioNormalizado = String(dados.idUsuario ?? '').trim();
    const limiteNumero = dados.limite === undefined || dados.limite === '' ? null : Number(dados.limite);
    const diaFechamentoNumero = dados.diaFechamento === undefined || dados.diaFechamento === '' ? null : Number(dados.diaFechamento);
    const diaVencimentoNumero = dados.diaVencimento === undefined || dados.diaVencimento === '' ? null : Number(dados.diaVencimento);
    const ehPrincipal = dados.principal === true;

    //4º passo: valida cada campo
    if (nomeNormalizado.length < 2) {
      return httpResponse.validationError(res, 'Informe o nome do cartão (mínimo 2 letras).');
    }
    if (!REGEX_FINAL_CARTAO.test(finalNormalizado)) {
      return httpResponse.validationError(res, 'Informe os 4 últimos dígitos do cartão.');
    }
    if (!REGEX_UUID.test(idUsuarioNormalizado)) {
      return httpResponse.validationError(res, 'Informe o dono do cartão.');
    }
    if (limiteNumero !== null && (!Number.isFinite(limiteNumero) || limiteNumero < 0)) {
      return httpResponse.validationError(res, 'O limite deve ser um valor positivo.');
    }
    if (diaFechamentoNumero !== null && !(Number.isInteger(diaFechamentoNumero) && diaFechamentoNumero >= 1 && diaFechamentoNumero <= 31)) {
      return httpResponse.validationError(res, 'O dia de fechamento deve estar entre 1 e 31.');
    }
    if (diaVencimentoNumero !== null && !(Number.isInteger(diaVencimentoNumero) && diaVencimentoNumero >= 1 && diaVencimentoNumero <= 31)) {
      return httpResponse.validationError(res, 'O dia de vencimento deve estar entre 1 e 31.');
    }

    //5º passo: o dono precisa ser um usuário da mesma família
    const donoDoCartao = await buscarUsuarioPorIdRepository(req.db, idUsuarioNormalizado);

    if (!donoDoCartao) {
      return httpResponse.validationError(res, 'O dono informado não pertence a esta família.');
    }

    //6º passo: se for o principal, tira o principal atual (só pode haver 1 por família)
    if (ehPrincipal) {
      await desmarcarPrincipalRepository(req.db);
    }

    //7º passo: grava o cartão (usuario_cadastro = nome de quem cadastrou)
    const cartaoCriado = await criarCartaoRepository(req.db, {
      idUsuario: idUsuarioNormalizado,
      nome: nomeNormalizado,
      final: finalNormalizado,
      limite: limiteNumero,
      diaFechamento: diaFechamentoNumero,
      diaVencimento: diaVencimentoNumero,
      principal: ehPrincipal,
      usuarioCadastro: req.user.nome
    });

    //retorna o cartão criado
    return httpResponse.success(res, 'Cartão cadastrado com sucesso!', { cartao: cartaoCriado }, 201);

  } catch (error) {
    console.error('Erro ao cadastrar cartão na etapa do controller:', error);

    //nome de cartão repetido na família -> 409
    if (error.code === CODIGO_UNIQUE_VIOLATION) {
      return httpResponse.conflict(res, 'Já existe um cartão com este nome nesta família.');
    }
    const secureMessage = pgErrorHandler(error, 'Erro ao cadastrar o cartão.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => excluir cartão
//params: :id do cartão
async function excluirCartao(req, res) {
  try {
    //1º passo: só ADMIN da família exclui cartão
    const papelSolicitante = await buscarPapelRepository(req.db, req.user.id);
    const solicitanteEhAdmin = papelSolicitante?.role === 'ADMIN' || papelSolicitante?.is_master === true;

    if (!solicitanteEhAdmin) {
      return httpResponse.forbidden(res, 'Apenas administradores da família podem excluir cartões.');
    }

    //2º passo: valida o id recebido na URL
    const idCartao = String(req.params.id ?? '').trim();

    if (!REGEX_UUID.test(idCartao)) {
      return httpResponse.validationError(res, 'Cartão inválido.');
    }

    //3º passo: o cartão precisa existir na família
    const cartaoEncontrado = await buscarCartaoPorIdRepository(req.db, idCartao);

    if (!cartaoEncontrado) {
      return httpResponse.notFound(res, 'Cartão não encontrado.');
    }

    //4º passo: se tiver lançamento nas faturas, não pode excluir
    const totalMovimentacoes = await contarMovimentacoesCartaoRepository(req.db, idCartao);

    if (totalMovimentacoes > 0) {
      return httpResponse.conflict(res, 'Este cartão tem lançamentos e não pode ser excluído.');
    }

    //5º passo: apaga as faturas vazias do cartão e depois o cartão
    await excluirFaturasVaziasCartaoRepository(req.db, idCartao);
    const cartaoExcluido = await excluirCartaoRepository(req.db, idCartao);

    //retorna o cartão excluído
    return httpResponse.success(res, 'Cartão excluído com sucesso!', { cartao: cartaoExcluido });

  } catch (error) {
    console.error('Erro ao excluir cartão na etapa do controller:', error);

    //cartão com fatura vinculada (FK RESTRICT do banco) -> 409
    if (error.code === '23503') {
      return httpResponse.conflict(res, 'Este cartão tem faturas vinculadas e não pode ser excluído.');
    }
    const secureMessage = pgErrorHandler(error, 'Erro ao excluir o cartão.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => exportação das funções
export {
  listarCartoes,
  criarCartao,
  excluirCartao
}
//#endregion
