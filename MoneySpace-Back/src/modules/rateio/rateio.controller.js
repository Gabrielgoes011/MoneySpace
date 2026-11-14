// ========================================
// CONTROLLER: RATEIO (compra rachada entre pessoas)
// ========================================
// Arquitetura de 2 camadas: o controller cuida de req/res E das regras de negócio;
// o SQL fica no repository. Usa `req.db` (transação com RLS aberta pelo rlsMiddleware).
//
// Autorização: qualquer membro da família cuida do rateio (controle da família, não do cartão).
// Vale mesmo com a fatura fechada.
// Regras:
//   - Cada parte tem um valor previsto; pode haver vários pagamentos por parte.
//   - Pagar a mais que o previsto é permitido (previsto 51,50, pago 52).
//   - O valor pago de uma parte é a SOMA dos pagamentos (nunca fica guardado em coluna).
//   - As partes NÃO precisam somar o valor da compra: a tela mostra o que falta ou sobra.
//     O que não foi rateado fica com quem adiantou (o portador do lançamento).
//   - Absorver: quem adiantou assume o que falta de uma parte; ela sai do "a cobrar".
//   - Parte com pagamento não pode ser apagada (apague o pagamento antes).
// Body: sempre desestruturado em `dados` com campos explícitos.
// Os endpoints de escrita devolvem só uma confirmação; a tela busca o rateio de novo (GET).

import httpResponse from '../../utils/httpResponse.js';
import pgErrorHandler, { CODIGO_UNIQUE_VIOLATION } from '../../utils/pgErrorHandler.js';
import {
  buscarLancamentoRateioRepository,
  listarPartesRateioRepository,
  listarPagamentosRateioRepository,
  listarPessoasRateioRepository,
  buscarParteRateioRepository,
  buscarPagamentoRateioRepository,
  buscarPessoaPorNomeRepository,
  criarPessoaRateioRepository,
  criarParteRateioRepository,
  atualizarValorParteRepository,
  definirAbsorvidoRepository,
  excluirParteRateioRepository,
  registrarPagamentoRateioRepository,
  excluirPagamentoRateioRepository,
  marcarLancamentoRateadoRepository
} from './rateio.Repositories.js';

//#region => Constantes
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGEX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
//#endregion

//#region => buscar o rateio de um lançamento
//query: lancamentoId (obrigatório)
//resposta: { lancamento, partes, resumo, pessoas }
async function buscarRateio(req, res) {
  try {
    //1º passo: recebe o lançamento da URL
    const dados = { lancamentoId: req.query.lancamentoId };
    const idLancamento = String(dados.lancamentoId ?? '').trim();

    //2º passo: valida o lançamento
    if (!REGEX_UUID.test(idLancamento)) {
      return httpResponse.validationError(res, 'Informe o lançamento.');
    }

    //3º passo: o lançamento precisa existir na família
    const lancamentoEncontrado = await buscarLancamentoRateioRepository(req.db, idLancamento);

    if (!lancamentoEncontrado) {
      return httpResponse.notFound(res, 'Lançamento não encontrado.');
    }

    //4º passo: busca as partes, os pagamentos e os nomes já usados
    const partesEncontradas = await listarPartesRateioRepository(req.db, idLancamento);
    const pagamentosEncontrados = await listarPagamentosRateioRepository(req.db, idLancamento);
    const pessoasEncontradas = await listarPessoasRateioRepository(req.db);

    //5º passo: monta cada parte com o que já foi pago, o saldo e a situação
    //saldo > 0: ainda falta; saldo < 0: pagou a mais
    const arredondar = (valor) => Math.round(valor * 100) / 100;
    const partes = partesEncontradas.map((parte) => {
      const pagamentosDaParte = pagamentosEncontrados.filter((pagamento) => pagamento.id_rateio === parte.id_rateio);
      const valorPrevisto = Number(parte.valor_previsto);
      const valorPago = arredondar(pagamentosDaParte.reduce((total, pagamento) => total + Number(pagamento.valor), 0));
      const saldo = arredondar(valorPrevisto - valorPago);

      let situacao = 'pendente';
      if (parte.absorvido) {
        situacao = 'absorvido';
      } else if (saldo < 0) {
        situacao = 'pagou a mais';
      } else if (saldo === 0) {
        situacao = 'pago';
      } else if (valorPago > 0) {
        situacao = 'parcial';
      }

      return {
        id: parte.id_rateio,
        nome: parte.nome,
        valorPrevisto,
        valorPago,
        saldo,
        absorvido: parte.absorvido,
        situacao,
        pagamentos: pagamentosDaParte.map((pagamento) => ({
          id: pagamento.id_pagamento,
          valor: Number(pagamento.valor),
          data: pagamento.dt_pagamento
        }))
      };
    });

    //6º passo: totais do rateio
    //aCobrar = o que falta nas partes não absorvidas; absorvido = o que quem adiantou assume
    const valorLancamento = Number(lancamentoEncontrado.valor);
    const totalPrevisto = arredondar(partes.reduce((total, parte) => total + parte.valorPrevisto, 0));
    const totalPago = arredondar(partes.reduce((total, parte) => total + parte.valorPago, 0));
    const totalACobrar = arredondar(partes
      .filter((parte) => !parte.absorvido)
      .reduce((total, parte) => total + Math.max(parte.saldo, 0), 0));
    const totalAbsorvido = arredondar(partes
      .filter((parte) => parte.absorvido)
      .reduce((total, parte) => total + Math.max(parte.saldo, 0), 0));

    //retorna o rateio completo
    return httpResponse.success(res, 'Rateio carregado com sucesso!', {
      lancamento: {
        id: lancamentoEncontrado.id_transacao,
        dataCompra: lancamentoEncontrado.dt_compra,
        estabelecimento: lancamentoEncontrado.estabelecimento,
        portador: lancamentoEncontrado.portador,
        valor: valorLancamento,
        parcela: lancamentoEncontrado.parcela,
        rateado: lancamentoEncontrado.rateado
      },
      partes,
      resumo: {
        valorLancamento,
        totalPrevisto,
        totalPago,
        totalACobrar,
        totalAbsorvido,
        naoRateado: arredondar(valorLancamento - totalPrevisto)
      },
      pessoas: pessoasEncontradas.map((pessoa) => pessoa.nome)
    });

  } catch (error) {
    console.error('Erro ao buscar o rateio na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao buscar o rateio.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => incluir a parte de uma pessoa
//body: { idLancamento, nome, valor }
async function cadastrarParte(req, res) {
  try {
    //1º passo: recebe os dados do body
    const dados = {
      idLancamento: req.body.idLancamento,
      nome: req.body.nome,
      valor: req.body.valor
    };

    //2º passo: normaliza os campos
    const idLancamento = String(dados.idLancamento ?? '').trim();
    const nomeNormalizado = String(dados.nome ?? '').trim().replace(/\s+/g, ' ');
    const valorNumero = Math.round(Number(String(dados.valor ?? '').replace(',', '.')) * 100) / 100;

    //3º passo: valida cada campo
    if (!REGEX_UUID.test(idLancamento)) {
      return httpResponse.validationError(res, 'Lançamento inválido.');
    }
    if (nomeNormalizado.length < 2 || nomeNormalizado.length > 100) {
      return httpResponse.validationError(res, 'Informe o nome da pessoa (entre 2 e 100 caracteres).');
    }
    if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
      return httpResponse.validationError(res, 'O valor da parte deve ser maior que zero.');
    }

    //4º passo: o lançamento precisa existir na família
    const lancamentoEncontrado = await buscarLancamentoRateioRepository(req.db, idLancamento);

    if (!lancamentoEncontrado) {
      return httpResponse.notFound(res, 'Lançamento não encontrado.');
    }

    //5º passo: usa a pessoa já cadastrada (sem diferença de maiúsculas) ou cria uma nova
    let pessoaEncontrada = await buscarPessoaPorNomeRepository(req.db, nomeNormalizado);

    if (!pessoaEncontrada) {
      pessoaEncontrada = await criarPessoaRateioRepository(req.db, nomeNormalizado, req.user.nome);
    }

    //6º passo: inclui a parte e liga a flag "rateado" do lançamento
    const parteCriada = await criarParteRateioRepository(req.db, {
      idTransacao: idLancamento,
      idPessoa: pessoaEncontrada.id_pessoa,
      valorPrevisto: valorNumero,
      usuarioCadastro: req.user.nome
    });
    await marcarLancamentoRateadoRepository(req.db, idLancamento);

    return httpResponse.success(res, 'Parte incluída com sucesso!', { id: parteCriada.id_rateio }, 201);

  } catch (error) {
    console.error('Erro ao incluir a parte do rateio na etapa do controller:', error);

    //a mesma pessoa duas vezes no mesmo lançamento -> 409
    if (error.code === CODIGO_UNIQUE_VIOLATION) {
      return httpResponse.conflict(res, 'Esta pessoa já está no rateio desta compra.');
    }
    const secureMessage = pgErrorHandler(error, 'Erro ao incluir a parte do rateio.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => mudar o valor previsto de uma parte
//params: :id da parte; body: { valor }
//pode mudar mesmo com pagamentos: os pagamentos já feitos continuam como estão
async function editarParte(req, res) {
  try {
    //1º passo: valida o id da URL e recebe o body
    const { id: idParte } = req.params;
    const dados = { valor: req.body.valor };

    if (!REGEX_UUID.test(String(idParte))) {
      return httpResponse.validationError(res, 'Parte inválida.');
    }

    //2º passo: valida o valor
    const valorNumero = Math.round(Number(String(dados.valor ?? '').replace(',', '.')) * 100) / 100;

    if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
      return httpResponse.validationError(res, 'O valor da parte deve ser maior que zero.');
    }

    //3º passo: a parte precisa existir na família
    const parteEncontrada = await buscarParteRateioRepository(req.db, idParte);

    if (!parteEncontrada) {
      return httpResponse.notFound(res, 'Parte não encontrada.');
    }

    //4º passo: grava o novo valor previsto
    await atualizarValorParteRepository(req.db, idParte, valorNumero);

    return httpResponse.success(res, 'Valor da parte atualizado com sucesso!', { id: idParte });

  } catch (error) {
    console.error('Erro ao editar a parte do rateio na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao editar a parte do rateio.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => apagar uma parte
//params: :id da parte (só sem pagamentos: para apagar com pagamento, apague os pagamentos antes)
async function excluirParte(req, res) {
  try {
    //1º passo: valida o id da URL
    const { id: idParte } = req.params;

    if (!REGEX_UUID.test(String(idParte))) {
      return httpResponse.validationError(res, 'Parte inválida.');
    }

    //2º passo: a parte precisa existir e não pode ter pagamentos
    const parteEncontrada = await buscarParteRateioRepository(req.db, idParte);

    if (!parteEncontrada) {
      return httpResponse.notFound(res, 'Parte não encontrada.');
    }
    if (Number(parteEncontrada.valor_pago) > 0) {
      return httpResponse.conflict(res, 'Esta parte já tem pagamentos. Apague os pagamentos antes de remover a pessoa.');
    }

    //3º passo: apaga a parte
    await excluirParteRateioRepository(req.db, idParte);

    return httpResponse.success(res, 'Parte removida com sucesso!', { id: idParte });

  } catch (error) {
    console.error('Erro ao excluir a parte do rateio na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao remover a parte do rateio.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => registrar um pagamento de uma parte
//params: :id da parte; body: { valor, dataPagamento? (AAAA-MM-DD; sem data = hoje) }
//pode pagar em várias vezes e pode pagar a mais que o previsto
async function registrarPagamento(req, res) {
  try {
    //1º passo: valida o id da URL e recebe o body
    const { id: idParte } = req.params;
    const dados = {
      valor: req.body.valor,
      dataPagamento: req.body.dataPagamento
    };

    if (!REGEX_UUID.test(String(idParte))) {
      return httpResponse.validationError(res, 'Parte inválida.');
    }

    //2º passo: valida o valor e a data (opcional)
    const valorNumero = Math.round(Number(String(dados.valor ?? '').replace(',', '.')) * 100) / 100;

    if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
      return httpResponse.validationError(res, 'O valor do pagamento deve ser maior que zero.');
    }

    const dataInformada = String(dados.dataPagamento ?? '').trim();
    if (dataInformada !== '') {
      //a data precisa existir de verdade: 2026-02-31 não pode virar março sem avisar
      const dataCalendario = new Date(`${dataInformada}T00:00:00Z`);
      const dataEhReal = !Number.isNaN(dataCalendario.getTime()) && dataCalendario.toISOString().slice(0, 10) === dataInformada;
      if (!REGEX_DATA_ISO.test(dataInformada) || !dataEhReal) {
        return httpResponse.validationError(res, 'Informe uma data de pagamento válida.');
      }
    }

    //3º passo: a parte precisa existir e não pode estar absorvida
    const parteEncontrada = await buscarParteRateioRepository(req.db, idParte);

    if (!parteEncontrada) {
      return httpResponse.notFound(res, 'Parte não encontrada.');
    }
    if (parteEncontrada.absorvido) {
      return httpResponse.conflict(res, 'Esta parte foi absorvida. Desfaça a absorção para registrar pagamento.');
    }

    //4º passo: grava o pagamento
    const pagamentoCriado = await registrarPagamentoRateioRepository(req.db, {
      idRateio: idParte,
      valor: valorNumero,
      dataPagamento: dataInformada === '' ? null : dataInformada,
      usuarioCadastro: req.user.nome
    });

    return httpResponse.success(res, 'Pagamento registrado com sucesso!', { id: pagamentoCriado.id_pagamento }, 201);

  } catch (error) {
    console.error('Erro ao registrar o pagamento do rateio na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao registrar o pagamento.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => apagar um pagamento lançado por engano
//params: :id do pagamento
async function excluirPagamento(req, res) {
  try {
    //1º passo: valida o id da URL
    const { id: idPagamento } = req.params;

    if (!REGEX_UUID.test(String(idPagamento))) {
      return httpResponse.validationError(res, 'Pagamento inválido.');
    }

    //2º passo: o pagamento precisa existir na família
    const pagamentoEncontrado = await buscarPagamentoRateioRepository(req.db, idPagamento);

    if (!pagamentoEncontrado) {
      return httpResponse.notFound(res, 'Pagamento não encontrado.');
    }

    //3º passo: apaga o pagamento
    await excluirPagamentoRateioRepository(req.db, idPagamento);

    return httpResponse.success(res, 'Pagamento removido com sucesso!', { id: idPagamento });

  } catch (error) {
    console.error('Erro ao excluir o pagamento do rateio na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao remover o pagamento.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => absorver (ou desfazer a absorção de) uma parte
//params: :id da parte; body: { absorvido? } (sem o campo = true)
//absorvida: quem adiantou a compra assume o que falta e a parte sai do "a cobrar"
async function definirAbsorcao(req, res) {
  try {
    //1º passo: valida o id da URL e recebe o body
    const { id: idParte } = req.params;
    const dados = { absorvido: req.body.absorvido };

    if (!REGEX_UUID.test(String(idParte))) {
      return httpResponse.validationError(res, 'Parte inválida.');
    }

    //2º passo: sem o campo, absorve; só aceita verdadeiro ou falso
    const absorvido = dados.absorvido === undefined ? true : (dados.absorvido === true || dados.absorvido === 'true');

    //3º passo: a parte precisa existir na família
    const parteEncontrada = await buscarParteRateioRepository(req.db, idParte);

    if (!parteEncontrada) {
      return httpResponse.notFound(res, 'Parte não encontrada.');
    }

    //4º passo: grava
    await definirAbsorvidoRepository(req.db, idParte, absorvido);

    return httpResponse.success(
      res,
      absorvido ? 'Parte absorvida por quem adiantou a compra.' : 'Absorção desfeita.',
      { id: idParte, absorvido }
    );

  } catch (error) {
    console.error('Erro ao definir a absorção da parte na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao atualizar a parte do rateio.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => exportação das funções
export {
  buscarRateio,
  cadastrarParte,
  editarParte,
  excluirParte,
  registrarPagamento,
  excluirPagamento,
  definirAbsorcao
}
//#endregion
