// ========================================
// CONTROLLER: DASHBOARD (início)
// ========================================
// Arquitetura de 2 camadas: o controller cuida de req/res E das regras de negócio;
// o SQL fica no repository. Usa `req.db` (transação com RLS aberta pelo rlsMiddleware).
//
// Autorização: qualquer membro da família vê o dashboard.
// Período: `competencia=YYYY-MM` da fatura (padrão = fatura mais recente do cartão; sem fatura = mês atual).
// Cartão: `cartaoId=<uuid>` ou `todos`;
// se não vier, usa o cartão principal da família (`principal = true`), ou todos se não houver principal.
// Body: não usa (é só leitura). Query: sempre desestruturada em `dados`.

import httpResponse from '../../utils/httpResponse.js';
import pgErrorHandler from '../../utils/pgErrorHandler.js';
import {
  listarCartoesDashboardRepository,
  buscarUltimaCompetenciaRepository,
  listarCompetenciasRepository,
  totalPorUsuarioRepository,
  totalPorCategoriaRepository,
  totalSemCategoriaRepository,
  resumoPeriodoRepository,
  saldoReservaPeriodoRepository
} from './dashboard.Repositories.js';

//#region => Constantes
const REGEX_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
//#endregion

//#region => buscar dados do dashboard
//resposta: { competencia, cartaoId, competencias, cartoes, resumo, portadores, categorias, semCategoria }
async function buscarDashboard(req, res) {
  try {
    //1º passo: recebe os filtros da URL
    const dados = {
      competencia: req.query.competencia,
      cartaoId: req.query.cartaoId
    };

    //2º passo: valida a competência, se vier (se não vier, é definida depois pela fatura mais recente)
    const competenciaTexto = String(dados.competencia ?? '').trim();

    if (competenciaTexto !== '' && !REGEX_COMPETENCIA.test(competenciaTexto)) {
      return httpResponse.validationError(res, 'A competência deve estar no formato AAAA-MM.');
    }

    //3º passo: busca os cartões da família (o principal é o cartão padrão do painel)
    const cartoes = await listarCartoesDashboardRepository(req.db);

    //4º passo: cartão do painel. Não informado = o principal; 'todos' = sem filtro (null)
    const cartaoInformado = String(dados.cartaoId ?? '').trim();
    const cartaoPrincipal = cartoes.find((cartao) => cartao.principal === true);
    let idCartao = null;

    if (cartaoInformado === '') {
      idCartao = cartaoPrincipal ? cartaoPrincipal.id : null;
    } else if (cartaoInformado !== 'todos') {
      if (!REGEX_UUID.test(cartaoInformado)) {
        return httpResponse.validationError(res, 'Cartão inválido.');
      }
      idCartao = cartaoInformado;
    }

    //5º passo: competência do painel. Não informada = fatura mais recente do cartão; sem fatura = mês atual
    let competenciaInformada = competenciaTexto;

    if (competenciaInformada === '') {
      const ultimaFatura = await buscarUltimaCompetenciaRepository(req.db, idCartao);
      const agora = new Date();
      competenciaInformada = ultimaFatura?.competencia
        ?? `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    }

    //6º passo: busca o restante das infos do painel pela competência da fatura (igual à tela de Faturas)
    const [competencias, resumo, saldoReserva, portadores, categorias, semCategoria] = await Promise.all([
      listarCompetenciasRepository(req.db, idCartao),
      resumoPeriodoRepository(req.db, competenciaInformada, idCartao),
      saldoReservaPeriodoRepository(req.db, competenciaInformada, idCartao),
      totalPorUsuarioRepository(req.db, competenciaInformada, idCartao),
      totalPorCategoriaRepository(req.db, competenciaInformada, idCartao),
      totalSemCategoriaRepository(req.db, competenciaInformada, idCartao)
    ]);

    //7º passo: porcentagem de cada linha sobre o total do período (pg devolve NUMERIC como texto)
    const totalGeral = Number(resumo.total);
    const calcularPct = (valor) => (totalGeral > 0 ? (Number(valor) / totalGeral) * 100 : 0);

    //retorna o painel montado
    return httpResponse.success(res, 'Dashboard carregado com sucesso!', {
      competencia: competenciaInformada,
      cartaoId: idCartao ?? 'todos',
      competencias: competencias.map((linha) => linha.competencia),
      cartoes,
      resumo: {
        pago: Number(resumo.pago),
        //pendente líquido: já descontado o que as outras pessoas já pagaram do rateio (o cartão cobra o cheio)
        pendente: Number(resumo.pendente) - Number(resumo.recebido_rateio),
        recebidoRateio: Number(resumo.recebido_rateio),
        fechamento: Number(resumo.fechamento),
        total: totalGeral,
        saldoReserva: Number(saldoReserva.saldo_reserva)
      },
      portadores: portadores.map((usuario) => ({
        id: usuario.id,
        nome: usuario.nome,
        total: Number(usuario.total),
        qtd: usuario.qtd,
        pct: calcularPct(usuario.total)
      })),
      categorias: categorias.map((categoria) => ({
        id: categoria.id,
        nome: categoria.valor,
        total: Number(categoria.total),
        qtd: categoria.qtd,
        pct: calcularPct(categoria.total)
      })),
      semCategoria: {
        total: Number(semCategoria.total),
        qtd: semCategoria.qtd,
        pct: calcularPct(semCategoria.total)
      }
    });

  } catch (error) {
    console.error('Erro ao buscar o dashboard na etapa do controller:', error);
    const secureMessage = pgErrorHandler(error, 'Erro ao carregar o dashboard.');
    return httpResponse.error(res, secureMessage);
  }
}
//#endregion

//#region => exportação das funções
export {
  buscarDashboard
}
//#endregion
