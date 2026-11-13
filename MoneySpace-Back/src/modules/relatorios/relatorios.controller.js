// ========================================
// CONTROLLER: RELATÓRIOS
// ========================================
// Arquitetura de 2 camadas: o controller cuida de req/res E das regras de negócio;
// o SQL fica no repository. Usa `req.db` (transação com RLS aberta pelo rlsMiddleware).
//
// Autorização: qualquer membro da família vê os relatórios.
// Relatório geral da fatura: cabeçalho, resumo por status, por portador, por categoria e a lista de lançamentos.
// Body: não usa (é só leitura). Query: sempre desestruturada em `dados`.

import httpResponse from '../../utils/httpResponse.js';
import pgErrorHandler from '../../utils/pgErrorHandler.js';
import {
  buscarCabecalhoFaturaRepository,
  listarLancamentosRelatorioRepository
} from './relatorios.Repositories.js';

//#region => Constantes
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEM_CATEGORIA = 'Sem categoria';
const SEM_PORTADOR = 'Sem portador';
//#endregion

//#region => relatório geral da fatura
//query: faturaId (obrigatório)
//resposta: { cabecalho, resumo, porPortador, porCategoria, lancamentos }
async function relatorioFatura(req, res) {
  try {
    //1º passo: recebe a fatura da URL
    const dados = { faturaId: req.query.faturaId };
    const idFatura = String(dados.faturaId ?? '').trim();

    //2º passo: valida a fatura
    if (!REGEX_UUID.test(idFatura)) {
      return httpResponse.validationError(res, 'Informe a fatura.');
    }

    //3º passo: a fatura precisa existir na família
    const cabecalhoEncontrado = await buscarCabecalhoFaturaRepository(req.db, idFatura);

    if (!cabecalhoEncontrado) {
      return httpResponse.notFound(res, 'Fatura não encontrada.');
    }

    //4º passo: busca os lançamentos da fatura
    const lancamentos = await listarLancamentosRelatorioRepository(req.db, idFatura);

    //5º passo: soma por status (na hora = pago, pendente, no fechamento)
    const somarStatus = (statusProcurado) => lancamentos
      .filter((lancamento) => lancamento.status_transacao === statusProcurado)
      .reduce((total, lancamento) => total + Number(lancamento.valor), 0);

    const totalNaHora = somarStatus('na hora');
    const totalPendente = somarStatus('pendente');
    const totalNoFechamento = somarStatus('no fechamento');
    const totalGeral = lancamentos.reduce((total, lancamento) => total + Number(lancamento.valor), 0);
    const saldoReserva = Number(cabecalhoEncontrado.saldo_reserva);
    const metaReserva = totalNaHora + totalPendente;

    //6º passo: agrupa por portador (sem portador vira uma linha própria)
    const mapaPortadores = {};
    lancamentos.forEach((lancamento) => {
      const nomePortador = lancamento.portador ?? SEM_PORTADOR;
      mapaPortadores[nomePortador] ??= { nome: nomePortador, total: 0, quantidade: 0 };
      mapaPortadores[nomePortador].total += Number(lancamento.valor);
      mapaPortadores[nomePortador].quantidade += 1;
    });

    //7º passo: agrupa por categoria (sem categoria vira uma linha própria)
    const mapaCategorias = {};
    lancamentos.forEach((lancamento) => {
      const nomeCategoria = lancamento.categoria ?? SEM_CATEGORIA;
      mapaCategorias[nomeCategoria] ??= { nome: nomeCategoria, total: 0, quantidade: 0 };
      mapaCategorias[nomeCategoria].total += Number(lancamento.valor);
      mapaCategorias[nomeCategoria].quantidade += 1;
    });

    const ordenarPorTotal = (lista) => lista.sort((a, b) => b.total - a.total);

    //retorna o relatório completo
    return httpResponse.success(res, 'Relatório gerado com sucesso!', {
      cabecalho: {
        titulo: cabecalhoEncontrado.titulo,
        competencia: cabecalhoEncontrado.competencia,
        nomeCartao: cabecalhoEncontrado.nome_cartao,
        finalCartao: cabecalhoEncontrado.final_cartao,
        fechada: cabecalhoEncontrado.status_fat === 'FECHADA',
        dataFechamento: cabecalhoEncontrado.data_fechamento,
        dataVencimento: cabecalhoEncontrado.data_vencimento
      },
      resumo: {
        totalGeral,
        totalNaHora,
        totalPendente,
        totalNoFechamento,
        saldoReserva,
        metaReserva,
        sobraOuFalta: saldoReserva - metaReserva,
        quantidadeLancamentos: lancamentos.length
      },
      porPortador: ordenarPorTotal(Object.values(mapaPortadores)),
      porCategoria: ordenarPorTotal(Object.values(mapaCategorias)),
      lancamentos: lancamentos.map((lancamento) => ({
        dataCompra: lancamento.data_compra,
        estabelecimento: lancamento.estabelecimento,
        portador: lancamento.portador ?? SEM_PORTADOR,
        valor: Number(lancamento.valor),
        parcela: lancamento.parcela,
        categoria: lancamento.categoria ?? SEM_CATEGORIA,
        statusTransacao: lancamento.status_transacao
      }))
    });

  } catch (error) {
    console.error('Erro ao gerar o relatório da fatura na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao gerar o relatório.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => relatório por semana e categoria
//query: faturaId (obrigatório)
//semana = segunda a domingo; cada semana traz o total e o total por categoria.
//categoriasDetalhe traz todos os lançamentos de cada categoria.
//resposta: { cabecalho, totalGeral, semanas, categoriasDetalhe }
async function relatorioSemanal(req, res) {
  try {
    //1º passo: recebe a fatura da URL
    const dados = { faturaId: req.query.faturaId };
    const idFatura = String(dados.faturaId ?? '').trim();

    //2º passo: valida a fatura
    if (!REGEX_UUID.test(idFatura)) {
      return httpResponse.validationError(res, 'Informe a fatura.');
    }

    //3º passo: a fatura precisa existir na família
    const cabecalhoEncontrado = await buscarCabecalhoFaturaRepository(req.db, idFatura);

    if (!cabecalhoEncontrado) {
      return httpResponse.notFound(res, 'Fatura não encontrada.');
    }

    //4º passo: busca os lançamentos da fatura
    const lancamentos = await listarLancamentosRelatorioRepository(req.db, idFatura);

    //5º passo: formata uma data 'AAAA-MM-DD' como 'DD/MM' (para os rótulos)
    const formatarDiaMes = (dataIso) => `${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)}`;
    const formatarDiaMesAno = (dataIso) => `${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)}/${dataIso.slice(0, 4)}`;

    //6º passo: descobre a segunda-feira da semana de cada lançamento
    const segundaDaSemana = (dataIso) => {
      const dataUtc = new Date(`${dataIso}T00:00:00Z`);
      const diaDaSemana = dataUtc.getUTCDay(); // 0 = domingo ... 6 = sábado
      const voltarAteSegunda = diaDaSemana === 0 ? 6 : diaDaSemana - 1;
      return new Date(dataUtc.getTime() - voltarAteSegunda * 86400000).toISOString().slice(0, 10);
    };

    //7º passo: separa compra nova (à vista ou 1 de N) de parcela de fatura passada (2 de N em diante).
    //parcela passada não é gasto desta semana: ela só cobra uma parte de uma compra antiga.
    const lancamentosNovos = [];
    const lancamentosParcelasAnteriores = [];
    lancamentos.forEach((lancamento) => {
      const numeroDaParcela = Number(String(lancamento.parcela ?? '').match(/^(\d+)\s+de\s+\d+$/i)?.[1] ?? 1);
      if (numeroDaParcela > 1) {
        lancamentosParcelasAnteriores.push(lancamento);
      } else {
        lancamentosNovos.push(lancamento);
      }
    });

    //8º passo: agrupa as compras novas por semana e, dentro da semana, por categoria
    const mapaSemanas = {};
    lancamentosNovos.forEach((lancamento) => {
      const inicioSemana = segundaDaSemana(lancamento.data_iso);
      const nomeCategoria = lancamento.categoria ?? SEM_CATEGORIA;

      mapaSemanas[inicioSemana] ??= { inicio: inicioSemana, total: 0, quantidade: 0, categorias: {} };
      const semana = mapaSemanas[inicioSemana];
      semana.total += Number(lancamento.valor);
      semana.quantidade += 1;

      semana.categorias[nomeCategoria] ??= { nome: nomeCategoria, total: 0, quantidade: 0 };
      semana.categorias[nomeCategoria].total += Number(lancamento.valor);
      semana.categorias[nomeCategoria].quantidade += 1;
    });

    //8º passo: monta as semanas em ordem (com o período e o rótulo)
    const semanas = Object.values(mapaSemanas)
      .sort((a, b) => (a.inicio < b.inicio ? -1 : 1))
      .map((semana, indice) => {
        const domingo = new Date(new Date(`${semana.inicio}T00:00:00Z`).getTime() + 6 * 86400000).toISOString().slice(0, 10);
        return {
          rotulo: `Semana ${indice + 1}`,
          inicio: formatarDiaMesAno(semana.inicio),
          fim: formatarDiaMesAno(domingo),
          periodo: `${formatarDiaMes(semana.inicio)} a ${formatarDiaMes(domingo)}`,
          total: semana.total,
          quantidade: semana.quantidade,
          categorias: Object.values(semana.categorias).sort((a, b) => b.total - a.total)
        };
      });

    //9º passo: detalhes por categoria (só compras novas; parcelas passadas têm bloco próprio)
    const mapaCategorias = {};
    lancamentosNovos.forEach((lancamento) => {
      const nomeCategoria = lancamento.categoria ?? SEM_CATEGORIA;
      mapaCategorias[nomeCategoria] ??= { nome: nomeCategoria, total: 0, quantidade: 0, lancamentos: [] };
      const categoria = mapaCategorias[nomeCategoria];
      categoria.total += Number(lancamento.valor);
      categoria.quantidade += 1;
      categoria.lancamentos.push({
        dataCompra: formatarDiaMesAno(lancamento.data_iso),
        estabelecimento: lancamento.estabelecimento,
        portador: lancamento.portador ?? SEM_PORTADOR,
        valor: Number(lancamento.valor),
        parcela: lancamento.parcela,
        statusTransacao: lancamento.status_transacao
      });
    });

    const categoriasDetalhe = Object.values(mapaCategorias).sort((a, b) => b.total - a.total);

    //10º passo: bloco final com as parcelas de faturas passadas (não entram nas semanas)
    const parcelasAnteriores = {
      total: lancamentosParcelasAnteriores.reduce((total, lancamento) => total + Number(lancamento.valor), 0),
      quantidade: lancamentosParcelasAnteriores.length,
      lancamentos: lancamentosParcelasAnteriores.map((lancamento) => ({
        dataCompra: formatarDiaMesAno(lancamento.data_iso),
        estabelecimento: lancamento.estabelecimento,
        portador: lancamento.portador ?? SEM_PORTADOR,
        valor: Number(lancamento.valor),
        parcela: lancamento.parcela,
        categoria: lancamento.categoria ?? SEM_CATEGORIA,
        statusTransacao: lancamento.status_transacao
      }))
    };

    //retorna o relatório por semana
    return httpResponse.success(res, 'Relatório por semana gerado com sucesso!', {
      cabecalho: {
        titulo: cabecalhoEncontrado.titulo,
        competencia: cabecalhoEncontrado.competencia,
        nomeCartao: cabecalhoEncontrado.nome_cartao,
        finalCartao: cabecalhoEncontrado.final_cartao,
        fechada: cabecalhoEncontrado.status_fat === 'FECHADA',
        dataFechamento: cabecalhoEncontrado.data_fechamento,
        dataVencimento: cabecalhoEncontrado.data_vencimento
      },
      totalGeral: lancamentos.reduce((total, lancamento) => total + Number(lancamento.valor), 0),
      semanas,
      categoriasDetalhe,
      parcelasAnteriores
    });

  } catch (error) {
    console.error('Erro ao gerar o relatório por semana na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao gerar o relatório por semana.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => relatório de pendências (o que ainda falta pagar na fatura)
//query: faturaId (obrigatório)
//pendente = lançamento com status 'pendente' (ainda não marcado como pago).
//resposta: { cabecalho, totalPendente, quantidadePendente, porPessoa, lancamentos }
async function relatorioPendencias(req, res) {
  try {
    //1º passo: recebe a fatura da URL
    const dados = { faturaId: req.query.faturaId };
    const idFatura = String(dados.faturaId ?? '').trim();

    //2º passo: valida a fatura
    if (!REGEX_UUID.test(idFatura)) {
      return httpResponse.validationError(res, 'Informe a fatura.');
    }

    //3º passo: a fatura precisa existir na família
    const cabecalhoEncontrado = await buscarCabecalhoFaturaRepository(req.db, idFatura);

    if (!cabecalhoEncontrado) {
      return httpResponse.notFound(res, 'Fatura não encontrada.');
    }

    //4º passo: busca os lançamentos e fica só com os pendentes
    const lancamentos = await listarLancamentosRelatorioRepository(req.db, idFatura);
    const lancamentosPendentes = lancamentos.filter((lancamento) => lancamento.status_transacao === 'pendente');

    //5º passo: soma quanto cada usuário tem pendente (sem portador vira uma linha própria)
    const mapaPessoas = {};
    lancamentosPendentes.forEach((lancamento) => {
      const nomePessoa = lancamento.portador ?? SEM_PORTADOR;
      mapaPessoas[nomePessoa] ??= { nome: nomePessoa, total: 0, quantidade: 0 };
      mapaPessoas[nomePessoa].total += Number(lancamento.valor);
      mapaPessoas[nomePessoa].quantidade += 1;
    });

    //6º passo: arredonda em 2 casas e ordena do maior para o menor valor
    const arredondar = (valor) => Math.round(valor * 100) / 100;
    const porPessoa = Object.values(mapaPessoas)
      .map((pessoa) => ({ nome: pessoa.nome, total: arredondar(pessoa.total), quantidade: pessoa.quantidade }))
      .sort((a, b) => b.total - a.total);
    const totalPendente = arredondar(lancamentosPendentes.reduce((total, lancamento) => total + Number(lancamento.valor), 0));

    //retorna as pendências
    return httpResponse.success(res, 'Pendências geradas com sucesso!', {
      cabecalho: {
        titulo: cabecalhoEncontrado.titulo,
        competencia: cabecalhoEncontrado.competencia,
        nomeCartao: cabecalhoEncontrado.nome_cartao,
        finalCartao: cabecalhoEncontrado.final_cartao,
        fechada: cabecalhoEncontrado.status_fat === 'FECHADA',
        dataFechamento: cabecalhoEncontrado.data_fechamento,
        dataVencimento: cabecalhoEncontrado.data_vencimento
      },
      totalPendente,
      quantidadePendente: lancamentosPendentes.length,
      porPessoa,
      //o que falta pagar, item a item (do mais antigo para o mais recente)
      lancamentos: lancamentosPendentes.map((lancamento) => ({
        dataCompra: lancamento.data_compra,
        estabelecimento: lancamento.estabelecimento,
        parcela: lancamento.parcela,
        valor: Number(lancamento.valor)
      }))
    });

  } catch (error) {
    console.error('Erro ao gerar as pendências na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao gerar as pendências.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => exportação das funções
export {
  relatorioFatura,
  relatorioSemanal,
  relatorioPendencias
}
//#endregion
