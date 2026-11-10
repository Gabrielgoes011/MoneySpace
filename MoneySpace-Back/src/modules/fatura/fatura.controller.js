// ========================================
// CONTROLLER: FATURA (cabeçalho + lançamentos)
// ========================================
// Arquitetura de 2 camadas: o controller cuida de req/res E das regras de negócio;
// o SQL fica no repository. Usa `req.db` (transação com RLS aberta pelo rlsMiddleware).
//
// Autorização: qualquer membro da família opera faturas (decisão de contrato, ver AGENTS.md).
// Regras:
//   - 1 fatura por cartão e competência (AAAA-MM); o título é "Mês / Ano".
//   - Fechamento e vencimento saem dos dias do cartão: o fechamento cai no mês da competência;
//     o vencimento cai no mesmo mês se for depois do fechamento, senão no mês seguinte.
//   - Fatura FECHADA não aceita saldo, lançamento nem troca de status.
//   - Lançamento sempre nasce como 'pendente' (a não ser que o front mande outro status válido).
// Body: sempre desestruturado em `dados` com campos explícitos.

import httpResponse from '../../utils/httpResponse.js';
import pgErrorHandler, { CODIGO_UNIQUE_VIOLATION } from '../../utils/pgErrorHandler.js';
import { buscarUsuarioPorIdRepository } from '../cadastros/usuario/cadUsuario.Repositories.js';
import {
  buscarCartaoParaFaturaRepository,
  listarFaturasCartaoRepository,
  buscarFaturaPorCartaoCompetenciaRepository,
  buscarFaturaPorIdRepository,
  listarLancamentosFaturaRepository,
  criarFaturaRepository,
  definirSaldoFaturaRepository,
  fecharFaturaRepository,
  buscarCategoriaRepository,
  criarLancamentoRepository,
  buscarLancamentoComFaturaRepository,
  alterarStatusLancamentoRepository,
  atualizarLancamentoRepository,
  excluirLancamentoRepository
} from './fatura.Repositories.js';

//#region => Constantes
const REGEX_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGEX_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const NOMES_DOS_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const STATUS_LANCAMENTO_VALIDOS = ['pendente', 'na hora', 'no fechamento', 'nao aplicavel'];
const CODIGO_FK_VIOLADA = '23503';
// (validação de data real fica em cadastrarLancamento, logo abaixo)
//#endregion

//#region => buscar fatura do cartão no mês
//query: cartaoId (obrigatório), competencia (AAAA-MM, obrigatório)
//resposta: { cartao, fatura (ou null), lancamentos }
async function buscarFatura(req, res) {
  try {
    //1º passo: recebe os filtros da URL
    const dados = {
      cartaoId: req.query.cartaoId,
      competencia: req.query.competencia
    };

    //2º passo: valida os filtros
    const idCartao = String(dados.cartaoId ?? '').trim();
    const competencia = String(dados.competencia ?? '').trim();

    if (!REGEX_UUID.test(idCartao)) {
      return httpResponse.validationError(res, 'Informe o cartão.');
    }
    if (!REGEX_COMPETENCIA.test(competencia)) {
      return httpResponse.validationError(res, 'A competência deve estar no formato AAAA-MM.');
    }

    //3º passo: o cartão precisa existir na família
    const cartaoEncontrado = await buscarCartaoParaFaturaRepository(req.db, idCartao);

    if (!cartaoEncontrado) {
      return httpResponse.notFound(res, 'Cartão não encontrado.');
    }

    //4º passo: busca a fatura do mês (se existir) e os lançamentos dela
    const faturaEncontrada = await buscarFaturaPorCartaoCompetenciaRepository(req.db, idCartao, competencia);
    const lancamentos = faturaEncontrada
      ? await listarLancamentosFaturaRepository(req.db, faturaEncontrada.id_fatura)
      : [];

    //retorna o cartão, a fatura e os lançamentos no formato do front
    return httpResponse.success(res, 'Fatura carregada com sucesso!', {
      cartao: {
        id: cartaoEncontrado.id,
        nome: cartaoEncontrado.nome,
        final: cartaoEncontrado.final,
        diaFechamento: cartaoEncontrado.dia_fechamento,
        diaVencimento: cartaoEncontrado.dia_vencimento
      },
      fatura: faturaEncontrada ? {
        id: faturaEncontrada.id_fatura,
        titulo: faturaEncontrada.titulo,
        cartaoId: faturaEncontrada.id_cartao,
        competencia: faturaEncontrada.competencia,
        saldoReserva: Number(faturaEncontrada.saldo_reserva),
        fechada: faturaEncontrada.status_fat === 'FECHADA',
        dataFechamento: faturaEncontrada.data_fechamento,
        dataVencimento: faturaEncontrada.data_vencimento
      } : null,
      lancamentos: lancamentos.map((lancamento) => ({
        id: lancamento.id_transacao,
        dataCompra: lancamento.dt_compra,
        estabelecimento: lancamento.estabelecimento,
        portador: lancamento.portador,
        valor: Number(lancamento.valor),
        parcela: lancamento.parcela,
        categoria: lancamento.categoria,
        statusTransacao: lancamento.status_transacao
      }))
    });

  } catch (error) {
    console.error('Erro ao buscar a fatura na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao buscar a fatura.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => criar fatura do cartão no mês
//body: { cartaoId, competencia }
async function criarFatura(req, res) {
  try {
    //1º passo: recebe os dados do body
    const dados = {
      cartaoId: req.body.cartaoId,
      competencia: req.body.competencia
    };

    //2º passo: valida os campos
    const idCartao = String(dados.cartaoId ?? '').trim();
    const competencia = String(dados.competencia ?? '').trim();

    if (!REGEX_UUID.test(idCartao)) {
      return httpResponse.validationError(res, 'Informe o cartão.');
    }
    if (!REGEX_COMPETENCIA.test(competencia)) {
      return httpResponse.validationError(res, 'A competência deve estar no formato AAAA-MM.');
    }

    //3º passo: o cartão precisa existir e ter os dias de fechamento e vencimento
    const cartaoEncontrado = await buscarCartaoParaFaturaRepository(req.db, idCartao);

    if (!cartaoEncontrado) {
      return httpResponse.notFound(res, 'Cartão não encontrado.');
    }
    if (!cartaoEncontrado.dia_fechamento || !cartaoEncontrado.dia_vencimento) {
      return httpResponse.validationError(res, 'Cadastre os dias de fechamento e vencimento do cartão antes de criar a fatura.');
    }

    //4º passo: calcula as datas. Dia que não existe no mês (ex.: 31 em abril) vira o último dia do mês.
    const [anoTexto, mesTexto] = competencia.split('-');
    const ano = Number(anoTexto);
    const mes = Number(mesTexto);
    const ultimoDiaDoMes = (anoCalculo, mesCalculo) => new Date(Date.UTC(anoCalculo, mesCalculo, 0)).getUTCDate();
    const formatarData = (anoCalculo, mesCalculo, diaCalculo) =>
      `${anoCalculo}-${String(mesCalculo).padStart(2, '0')}-${String(diaCalculo).padStart(2, '0')}`;

    const diaFechamento = Math.min(cartaoEncontrado.dia_fechamento, ultimoDiaDoMes(ano, mes));
    const dataFechamento = formatarData(ano, mes, diaFechamento);

    //vencimento: mesmo mês do fechamento se o dia for depois dele; senão, mês seguinte
    const vencimentoNoMesSeguinte = cartaoEncontrado.dia_vencimento <= cartaoEncontrado.dia_fechamento;
    const primeiroDiaVencimento = new Date(Date.UTC(ano, mes - 1 + (vencimentoNoMesSeguinte ? 1 : 0), 1));
    const anoVencimento = primeiroDiaVencimento.getUTCFullYear();
    const mesVencimento = primeiroDiaVencimento.getUTCMonth() + 1;
    const diaVencimento = Math.min(cartaoEncontrado.dia_vencimento, ultimoDiaDoMes(anoVencimento, mesVencimento));
    const dataVencimento = formatarData(anoVencimento, mesVencimento, diaVencimento);

    const titulo = `${NOMES_DOS_MESES[mes - 1]} / ${ano}`;

    //5º passo: quem está criando (nome gravado como snapshot)
    const faturaCriada = await criarFaturaRepository(req.db, {
      idCartao,
      titulo,
      competencia,
      dataFechamento,
      dataVencimento,
      usuarioCadastro: req.user.nome
    });

    //retorna a fatura criada (sem lançamentos ainda)
    return httpResponse.success(res, 'Fatura criada com sucesso!', {
      fatura: {
        id: faturaCriada.id_fatura,
        titulo: faturaCriada.titulo,
        cartaoId: faturaCriada.id_cartao,
        competencia: faturaCriada.competencia,
        saldoReserva: Number(faturaCriada.saldo_reserva),
        fechada: faturaCriada.status_fat === 'FECHADA',
        dataFechamento: faturaCriada.data_fechamento,
        dataVencimento: faturaCriada.data_vencimento
      }
    }, 201);

  } catch (error) {
    console.error('Erro ao criar a fatura na etapa do controller:', error);

    //já existe fatura desse cartão nesse mês -> 409
    if (error.code === CODIGO_UNIQUE_VIOLATION) {
      return httpResponse.conflict(res, 'Já existe fatura deste cartão neste mês.');
    }
    const secureMessage = pgErrorHandler(error, 'Erro ao criar a fatura.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => salvar saldo da reserva
//params: :id da fatura; body: { saldo }
async function definirSaldoFatura(req, res) {
  try {
    //1º passo: recebe os dados
    const { id: idFatura } = req.params;
    const dados = { saldo: req.body.saldo };

    //2º passo: valida o id e o saldo (número, zero ou positivo)
    if (!REGEX_UUID.test(String(idFatura))) {
      return httpResponse.validationError(res, 'Fatura inválida.');
    }
    const saldoNumero = Number(String(dados.saldo ?? '').replace(',', '.'));
    if (!Number.isFinite(saldoNumero) || saldoNumero < 0) {
      return httpResponse.validationError(res, 'O saldo da reserva deve ser um valor positivo ou zero.');
    }

    //3º passo: a fatura precisa existir e estar aberta
    const faturaEncontrada = await buscarFaturaPorIdRepository(req.db, idFatura);

    if (!faturaEncontrada) {
      return httpResponse.notFound(res, 'Fatura não encontrada.');
    }
    if (faturaEncontrada.status_fat === 'FECHADA') {
      return httpResponse.conflict(res, 'Esta fatura está fechada e não pode ser alterada.');
    }

    //4º passo: grava o saldo
    const faturaAtualizada = await definirSaldoFaturaRepository(req.db, idFatura, saldoNumero);

    return httpResponse.success(res, 'Saldo da reserva salvo com sucesso!', {
      saldoReserva: Number(faturaAtualizada.saldo_reserva)
    });

  } catch (error) {
    console.error('Erro ao salvar o saldo na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao salvar o saldo da reserva.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => fechar fatura
//params: :id da fatura
async function fecharFatura(req, res) {
  try {
    //1º passo: valida o id
    const { id: idFatura } = req.params;

    if (!REGEX_UUID.test(String(idFatura))) {
      return httpResponse.validationError(res, 'Fatura inválida.');
    }

    //2º passo: a fatura precisa existir e estar aberta
    const faturaEncontrada = await buscarFaturaPorIdRepository(req.db, idFatura);

    if (!faturaEncontrada) {
      return httpResponse.notFound(res, 'Fatura não encontrada.');
    }
    if (faturaEncontrada.status_fat === 'FECHADA') {
      return httpResponse.conflict(res, 'Esta fatura já está fechada.');
    }

    //3º passo: fecha a fatura
    await fecharFaturaRepository(req.db, idFatura);

    return httpResponse.success(res, 'Fatura fechada com sucesso!', { fechada: true });

  } catch (error) {
    console.error('Erro ao fechar a fatura na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao fechar a fatura.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => lançar gasto manualmente
//body: { idFatura, dataCompra (AAAA-MM-DD), estabelecimento, valor, idUsuario?, categoria?, parcela?, statusTransacao? }
async function cadastrarLancamento(req, res) {
  try {
    //1º passo: recebe os dados do body
    const dados = {
      idFatura: req.body.idFatura,
      dataCompra: req.body.dataCompra,
      estabelecimento: req.body.estabelecimento,
      valor: req.body.valor,
      idUsuario: req.body.idUsuario,
      categoria: req.body.categoria,
      parcela: req.body.parcela,
      statusTransacao: req.body.statusTransacao
    };

    //2º passo: normaliza os campos
    const idFatura = String(dados.idFatura ?? '').trim();
    const dataCompra = String(dados.dataCompra ?? '').trim();
    const estabelecimento = String(dados.estabelecimento ?? '').trim().replace(/\s+/g, ' ');
    const valorNumero = Number(String(dados.valor ?? '').replace(',', '.'));
    const parcela = String(dados.parcela ?? '').trim() || '-';
    const statusTransacao = String(dados.statusTransacao ?? 'pendente').trim();
    const categoriaInformada = String(dados.categoria ?? '').trim();
    const idUsuarioInformado = String(dados.idUsuario ?? '').trim();

    //3º passo: valida cada campo
    if (!REGEX_UUID.test(idFatura)) {
      return httpResponse.validationError(res, 'Fatura inválida.');
    }
    //a data precisa existir de verdade: 2026-02-31 não pode virar 2026-03-03 sem avisar
    const dataCalendario = new Date(`${dataCompra}T00:00:00Z`);
    const dataEhReal = !Number.isNaN(dataCalendario.getTime()) && dataCalendario.toISOString().slice(0, 10) === dataCompra;
    if (!REGEX_DATA_ISO.test(dataCompra) || !dataEhReal) {
      return httpResponse.validationError(res, 'Informe a data da compra.');
    }
    if (estabelecimento.length < 2 || estabelecimento.length > 255) {
      return httpResponse.validationError(res, 'Informe o estabelecimento (entre 2 e 255 caracteres).');
    }
    if (!Number.isFinite(valorNumero) || valorNumero <= 0) {
      return httpResponse.validationError(res, 'O valor deve ser maior que zero.');
    }
    if (parcela.length > 20) {
      return httpResponse.validationError(res, 'A parcela deve ter no máximo 20 caracteres.');
    }
    if (!STATUS_LANCAMENTO_VALIDOS.includes(statusTransacao)) {
      return httpResponse.validationError(res, 'Status de lançamento inválido.');
    }

    //4º passo: a fatura precisa existir e estar aberta
    const faturaEncontrada = await buscarFaturaPorIdRepository(req.db, idFatura);

    if (!faturaEncontrada) {
      return httpResponse.notFound(res, 'Fatura não encontrada.');
    }
    if (faturaEncontrada.status_fat === 'FECHADA') {
      return httpResponse.conflict(res, 'Esta fatura está fechada e não aceita novos lançamentos.');
    }

    //5º passo: categoria, se informada, precisa estar cadastrada (grava o valor exato do cadastro)
    let categoriaGravada = null;
    if (categoriaInformada !== '') {
      const categoriaEncontrada = await buscarCategoriaRepository(req.db, categoriaInformada);
      if (!categoriaEncontrada) {
        return httpResponse.validationError(res, 'A categoria informada não está cadastrada.');
      }
      categoriaGravada = categoriaEncontrada.valor;
    }

    //6º passo: portador, se informado, é o nome do usuário da família (vínculo pelo nome, ver AGENTS.md)
    let portadorGravado = null;
    if (idUsuarioInformado !== '') {
      if (!REGEX_UUID.test(idUsuarioInformado)) {
        return httpResponse.validationError(res, 'Portador inválido.');
      }
      const usuarioEncontrado = await buscarUsuarioPorIdRepository(req.db, idUsuarioInformado);
      if (!usuarioEncontrado) {
        return httpResponse.validationError(res, 'O portador informado não pertence a esta família.');
      }
      portadorGravado = usuarioEncontrado.nome;
    }

    //7º passo: grava o lançamento
    const lancamentoCriado = await criarLancamentoRepository(req.db, {
      idFatura,
      dataCompra,
      estabelecimento,
      portador: portadorGravado,
      valor: valorNumero,
      parcela,
      categoria: categoriaGravada,
      statusTransacao,
      usuarioCadastro: req.user.nome
    });

    return httpResponse.success(res, 'Lançamento cadastrado com sucesso!', { id: lancamentoCriado.id_transacao }, 201);

  } catch (error) {
    console.error('Erro ao cadastrar lançamento na etapa do controller:', error);

    //fatura apagada no meio do caminho (FK) -> 409
    if (error.code === CODIGO_FK_VIOLADA) {
      return httpResponse.conflict(res, 'A fatura informada não existe mais.');
    }
    const secureMessage = pgErrorHandler(error, 'Erro ao cadastrar o lançamento.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => alterar status de um lançamento
//params: :id do lançamento; body: { statusTransacao }
async function alterarStatusLancamento(req, res) {
  try {
    //1º passo: recebe os dados
    const { id: idLancamento } = req.params;
    const dados = { statusTransacao: req.body.statusTransacao };

    //2º passo: valida o id e o status
    if (!REGEX_UUID.test(String(idLancamento))) {
      return httpResponse.validationError(res, 'Lançamento inválido.');
    }
    const statusNovo = String(dados.statusTransacao ?? '').trim();
    if (!STATUS_LANCAMENTO_VALIDOS.includes(statusNovo)) {
      return httpResponse.validationError(res, 'Status de lançamento inválido.');
    }

    //3º passo: o lançamento precisa existir e a fatura dele estar aberta
    const lancamentoEncontrado = await buscarLancamentoComFaturaRepository(req.db, idLancamento);

    if (!lancamentoEncontrado) {
      return httpResponse.notFound(res, 'Lançamento não encontrado.');
    }
    if (lancamentoEncontrado.status_fat === 'FECHADA') {
      return httpResponse.conflict(res, 'Esta fatura está fechada e não pode ser alterada.');
    }

    //4º passo: grava o novo status
    const lancamentoAtualizado = await alterarStatusLancamentoRepository(req.db, idLancamento, statusNovo);

    return httpResponse.success(res, 'Status alterado com sucesso!', {
      id: lancamentoAtualizado.id_transacao,
      statusTransacao: lancamentoAtualizado.status_transacao
    });

  } catch (error) {
    console.error('Erro ao alterar o status do lançamento na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao alterar o status do lançamento.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => editar lançamento
//params: :id do lançamento
//body: qualquer de { dataCompra, estabelecimento, valor, idUsuario, categoria, parcela, statusTransacao }
//campo que não vier fica como está; idUsuario '' tira o portador; categoria '' tira a categoria
async function editarLancamento(req, res) {
  try {
    //1º passo: valida o id da URL
    const { id: idLancamento } = req.params;

    if (!REGEX_UUID.test(String(idLancamento))) {
      return httpResponse.validationError(res, 'Lançamento inválido.');
    }

    //2º passo: o lançamento precisa existir e a fatura dele estar aberta
    const lancamentoAtual = await buscarLancamentoComFaturaRepository(req.db, idLancamento);

    if (!lancamentoAtual) {
      return httpResponse.notFound(res, 'Lançamento não encontrado.');
    }
    if (lancamentoAtual.status_fat === 'FECHADA') {
      return httpResponse.conflict(res, 'Esta fatura está fechada e não pode ser alterada.');
    }

    //3º passo: recebe os dados do body (undefined = não mudou)
    const dados = {
      dataCompra: req.body.dataCompra,
      estabelecimento: req.body.estabelecimento,
      valor: req.body.valor,
      idUsuario: req.body.idUsuario,
      categoria: req.body.categoria,
      parcela: req.body.parcela,
      statusTransacao: req.body.statusTransacao
    };

    //4º passo: valida data, estabelecimento, valor, parcela e status (só os que vieram)
    const dataCompra = dados.dataCompra === undefined ? lancamentoAtual.dt_compra : String(dados.dataCompra).trim();
    const dataCalendario = new Date(`${dataCompra}T00:00:00Z`);
    const dataEhReal = !Number.isNaN(dataCalendario.getTime()) && dataCalendario.toISOString().slice(0, 10) === dataCompra;
    if (!REGEX_DATA_ISO.test(dataCompra) || !dataEhReal) {
      return httpResponse.validationError(res, 'Informe a data da compra.');
    }

    const estabelecimento = dados.estabelecimento === undefined
      ? lancamentoAtual.estabelecimento
      : String(dados.estabelecimento).trim().replace(/\s+/g, ' ');
    if (estabelecimento.length < 2 || estabelecimento.length > 255) {
      return httpResponse.validationError(res, 'Informe o estabelecimento (entre 2 e 255 caracteres).');
    }

    const valor = dados.valor === undefined
      ? Number(lancamentoAtual.valor)
      : Number(String(dados.valor).replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) {
      return httpResponse.validationError(res, 'O valor deve ser maior que zero.');
    }

    const parcela = dados.parcela === undefined
      ? lancamentoAtual.parcela
      : String(dados.parcela).trim() || '-';
    if (parcela.length > 20) {
      return httpResponse.validationError(res, 'A parcela deve ter no máximo 20 caracteres.');
    }

    const statusTransacao = dados.statusTransacao === undefined
      ? lancamentoAtual.status_transacao
      : String(dados.statusTransacao).trim();
    if (!STATUS_LANCAMENTO_VALIDOS.includes(statusTransacao)) {
      return httpResponse.validationError(res, 'Status de lançamento inválido.');
    }

    //5º passo: categoria ('' tira; não enviada mantém; enviada precisa estar cadastrada)
    let categoria = lancamentoAtual.categoria;
    if (dados.categoria !== undefined) {
      const categoriaInformada = String(dados.categoria).trim();

      if (categoriaInformada === '') {
        categoria = null;
      } else {
        const categoriaEncontrada = await buscarCategoriaRepository(req.db, categoriaInformada);
        if (!categoriaEncontrada) {
          return httpResponse.validationError(res, 'A categoria informada não está cadastrada.');
        }
        categoria = categoriaEncontrada.valor;
      }
    }

    //6º passo: portador ('' tira; não enviado mantém; enviado precisa ser da família)
    let portador = lancamentoAtual.portador;
    if (dados.idUsuario !== undefined) {
      const idUsuarioInformado = String(dados.idUsuario).trim();

      if (idUsuarioInformado === '') {
        portador = null;
      } else {
        if (!REGEX_UUID.test(idUsuarioInformado)) {
          return httpResponse.validationError(res, 'Portador inválido.');
        }
        const usuarioEncontrado = await buscarUsuarioPorIdRepository(req.db, idUsuarioInformado);
        if (!usuarioEncontrado) {
          return httpResponse.validationError(res, 'O portador informado não pertence a esta família.');
        }
        portador = usuarioEncontrado.nome;
      }
    }

    //7º passo: grava o lançamento com os valores finais
    const lancamentoAtualizado = await atualizarLancamentoRepository(req.db, idLancamento, {
      dataCompra,
      estabelecimento,
      portador,
      valor,
      parcela,
      categoria,
      statusTransacao
    });

    return httpResponse.success(res, 'Lançamento atualizado com sucesso!', {
      id: lancamentoAtualizado.id_transacao,
      statusTransacao: lancamentoAtualizado.status_transacao
    });

  } catch (error) {
    console.error('Erro ao editar o lançamento na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao editar o lançamento.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => excluir lançamento
//params: :id do lançamento (só com a fatura aberta)
async function excluirLancamento(req, res) {
  try {
    //1º passo: valida o id da URL
    const { id: idLancamento } = req.params;

    if (!REGEX_UUID.test(String(idLancamento))) {
      return httpResponse.validationError(res, 'Lançamento inválido.');
    }

    //2º passo: o lançamento precisa existir e a fatura dele estar aberta
    const lancamentoAtual = await buscarLancamentoComFaturaRepository(req.db, idLancamento);

    if (!lancamentoAtual) {
      return httpResponse.notFound(res, 'Lançamento não encontrado.');
    }
    if (lancamentoAtual.status_fat === 'FECHADA') {
      return httpResponse.conflict(res, 'Esta fatura está fechada e não pode ser alterada.');
    }

    //3º passo: apaga o lançamento
    await excluirLancamentoRepository(req.db, idLancamento);

    return httpResponse.success(res, 'Lançamento excluído com sucesso!', { id: idLancamento });

  } catch (error) {
    console.error('Erro ao excluir o lançamento na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao excluir o lançamento.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => listar faturas do cartão (para o seletor de competência)
//query: cartaoId (obrigatório)
//resposta: { faturas: [{ id, titulo, competencia, fechada }] }
async function listarFaturasCartao(req, res) {
  try {
    //1º passo: recebe o cartão da URL
    const dados = { cartaoId: req.query.cartaoId };
    const idCartao = String(dados.cartaoId ?? '').trim();

    //2º passo: valida o cartão
    if (!REGEX_UUID.test(idCartao)) {
      return httpResponse.validationError(res, 'Informe o cartão.');
    }

    //3º passo: o cartão precisa existir na família
    const cartaoEncontrado = await buscarCartaoParaFaturaRepository(req.db, idCartao);

    if (!cartaoEncontrado) {
      return httpResponse.notFound(res, 'Cartão não encontrado.');
    }

    //4º passo: busca as faturas do cartão
    const faturas = await listarFaturasCartaoRepository(req.db, idCartao);

    return httpResponse.success(res, 'Faturas listadas com sucesso!', {
      faturas: faturas.map((fatura) => ({
        id: fatura.id_fatura,
        titulo: fatura.titulo,
        competencia: fatura.competencia,
        fechada: fatura.status_fat === 'FECHADA'
      }))
    });

  } catch (error) {
    console.error('Erro ao listar as faturas na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao listar as faturas.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => exportação das funções
export {
  listarFaturasCartao,
  editarLancamento,
  excluirLancamento,
  buscarFatura,
  criarFatura,
  definirSaldoFatura,
  fecharFatura,
  cadastrarLancamento,
  alterarStatusLancamento
}
//#endregion
