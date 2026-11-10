// ========================================
// CONTROLLER: DASHBOARD (início)
// ========================================
// Arquitetura de 2 camadas: o controller cuida de req/res E das regras de negócio;
// o SQL fica no repository. Usa `req.db` (transação com RLS aberta pelo rlsMiddleware).
//
// Autorização: qualquer membro da família vê o dashboard.
// Período: `competencia=YYYY-MM` (padrão = mês atual). Cartão: `cartaoId=<uuid>` ou `todos` (padrão).
// Body: não usa (é só leitura). Query: sempre desestruturada em `dados`.

import httpResponse from '../../utils/httpResponse.js';
import pgErrorHandler from '../../utils/pgErrorHandler.js';
import {
  listarCartoesDashboardRepository,
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
//resposta: { competencia, cartoes, resumo, portadores, categorias, semCategoria }
async function buscarDashboard(req, res) {
  try {
    //1º passo: recebe os filtros da URL
    const dados = {
      competencia: req.query.competencia,
      cartaoId: req.query.cartaoId
    };

    //2º passo: competência (mês atual se não vier)
    const agora = new Date();
    const competenciaInformada = dados.competencia !== undefined && dados.competencia !== ''
      ? String(dados.competencia).trim()
      : `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

    if (!REGEX_COMPETENCIA.test(competenciaInformada)) {
      return httpResponse.validationError(res, 'A competência deve estar no formato AAAA-MM.');
    }

    //3º passo: cartão (null = todos os cartões)
    const cartaoInformado = String(dados.cartaoId ?? 'todos').trim();
    const idCartao = cartaoInformado === 'todos' ? null : cartaoInformado;

    if (idCartao !== null && !REGEX_UUID.test(idCartao)) {
      return httpResponse.validationError(res, 'Cartão inválido.');
    }

    //4º passo: período do mês (do dia 1 até o dia 1 do mês seguinte, sem incluir)
    const [anoTexto, mesTexto] = competenciaInformada.split('-');
    const inicioPeriodo = `${anoTexto}-${mesTexto}-01`;
    const fimPeriodo = new Date(Date.UTC(Number(anoTexto), Number(mesTexto), 1)).toISOString().slice(0, 10);

    //5º passo: busca todas as infos do painel
    const [cartoes, resumo, saldoReserva, portadores, categorias, semCategoria] = await Promise.all([
      listarCartoesDashboardRepository(req.db),
      resumoPeriodoRepository(req.db, inicioPeriodo, fimPeriodo, idCartao),
      saldoReservaPeriodoRepository(req.db, idCartao),
      totalPorUsuarioRepository(req.db, inicioPeriodo, fimPeriodo, idCartao),
      totalPorCategoriaRepository(req.db, inicioPeriodo, fimPeriodo, idCartao),
      totalSemCategoriaRepository(req.db, inicioPeriodo, fimPeriodo, idCartao)
    ]);

    //6º passo: porcentagem de cada linha sobre o total do período (pg devolve NUMERIC como texto)
    const totalGeral = Number(resumo.total);
    const calcularPct = (valor) => (totalGeral > 0 ? (Number(valor) / totalGeral) * 100 : 0);

    //retorna o painel montado
    return httpResponse.success(res, 'Dashboard carregado com sucesso!', {
      competencia: competenciaInformada,
      cartoes,
      resumo: {
        pago: Number(resumo.pago),
        pendente: Number(resumo.pendente),
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
