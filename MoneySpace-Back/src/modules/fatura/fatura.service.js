// ========================================
// SERVICE: FATURA
// ========================================
// Regras de negócio do módulo de fatura. Orquestra repository + parser.
// NÃO toca em req/res. Recebe sempre `db` (transação com contexto RLS) e o
// repassa ao repository. NUMERIC volta como STRING do pg -> Number() ao calcular.
//
// Regras (design.md):
//   meta_reserva        = Σ valor onde status_liquidacao IN ('pendente','na hora')
//   total_fatura        = Σ valor onde status_liquidacao <> 'nao aplicavel'
//   diferenca_reserva   = saldo_reserva_declarado - meta_reserva
//   status_conferencia  = diferenca_reserva >= 0 ? 'OK' : 'DEFICIT'
//   Fatura FECHADA/PAGA bloqueia mutações (importar, editar transação, reserva).
//   Importação: transação única, idempotente por hash; fingerprint por linha.
//   Fechamento: muda status + fechada_em/por; abre próxima competência (idempotente).

import { createHash } from 'node:crypto';
import {
  listarFaturasPorConta,
  buscarFaturaPorCompetencia,
  buscarFaturaPorId,
  criarFatura,
  atualizarReserva,
  fecharFatura,
  buscarContaCredito,
  totaisPorStatus,
  totaisPorPortador,
  totaisPorCategoria,
  listarTransacoes,
  buscarTransacaoPorId,
  atualizarTransacao,
  buscarImportacaoPorHash,
  contarTransacoes,
  criarImportacao,
  inserirTransacoesEmLote,
} from './fatura.repositories.js';
import { obterParser } from './importadores/index.js';

const STATUS_LIQUIDACAO = ['pendente', 'na hora', 'no fechamento', 'nao aplicavel'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Erro de negócio que o controller mapeia para um status HTTP específico.
class ErroNegocio extends Error {
  constructor(message, httpStatus = 400) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Normaliza 'AAAA-MM-01'. Aceita 'AAAA-MM' ou 'AAAA-MM-DD' e força o dia 1.
function normalizarCompetencia(texto) {
  const s = String(texto ?? '').trim();
  const m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (!m) throw new ErroNegocio('Competência inválida. Use AAAA-MM-01.');
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) throw new ErroNegocio('Competência inválida (mês fora de 1-12).');
  return `${ano}-${String(mes).padStart(2, '0')}-01`;
}

// "Outubro / 2026" a partir de 'AAAA-MM-01'.
function nomeExibicao(competencia) {
  const [ano, mes] = competencia.split('-').map(Number);
  return `${MESES_PT[mes - 1]} / ${ano}`;
}

// Competência do mês seguinte (trata virada de ano).
function proximaCompetencia(competencia) {
  let [ano, mes] = competencia.split('-').map(Number);
  mes += 1;
  if (mes > 12) { mes = 1; ano += 1; }
  return `${ano}-${String(mes).padStart(2, '0')}-01`;
}

// Monta o resumo (KPIs) a partir dos totais por status + saldo declarado.
function montarResumo(totais, saldoDeclarado) {
  const porStatus = {};
  for (const r of totais) porStatus[r.status_liquidacao] = num(r.total);

  const total_na_hora = porStatus['na hora'] ?? 0;
  const total_pendente = porStatus['pendente'] ?? 0;
  const total_no_fechamento = porStatus['no fechamento'] ?? 0;
  // total_fatura exclui 'nao aplicavel'.
  const total_fatura = total_na_hora + total_pendente + total_no_fechamento;
  const meta_reserva = total_pendente + total_na_hora;
  const diferenca_reserva = num(saldoDeclarado) - meta_reserva;
  const status_conferencia = diferenca_reserva >= 0 ? 'OK' : 'DEFICIT';

  const f2 = (n) => n.toFixed(2);
  return {
    total_fatura: f2(total_fatura),
    total_na_hora: f2(total_na_hora),
    total_pendente: f2(total_pendente),
    total_no_fechamento: f2(total_no_fechamento),
    meta_reserva: f2(meta_reserva),
    diferenca_reserva: f2(diferenca_reserva),
    status_conferencia,
  };
}

// Percentual (string com 1 casa) sobre um total; "0.0" quando total 0.
function pct(valor, total) {
  if (!total) return '0.0';
  return ((num(valor) / total) * 100).toFixed(1);
}

// ── Cabeçalho / listagem ─────────────────────────────────────────────────────

async function listarFaturasService(db, idConta) {
  if (!idConta || !UUID_RE.test(String(idConta))) {
    throw new ErroNegocio('Informe um id_conta válido.');
  }
  return await listarFaturasPorConta(db, idConta);
}

async function criarFaturaService(db, dados, contexto = {}) {
  const idConta = dados?.id_conta;
  if (!idConta || !UUID_RE.test(String(idConta))) {
    throw new ErroNegocio('Informe um id_conta válido.');
  }
  const competencia = normalizarCompetencia(dados?.competencia);

  const conta = await buscarContaCredito(db, idConta);
  if (!conta) {
    throw new ErroNegocio('Conta inválida: precisa ser um cartão de crédito da família.');
  }

  return await criarFatura(db, {
    id_conta: idConta,
    competencia,
    nome_exibicao: nomeExibicao(competencia),
    usuario_cadastro: contexto.usuario_cadastro || null,
  });
}

async function obterFaturaService(db, idFatura) {
  const fatura = await buscarFaturaPorId(db, idFatura);
  if (!fatura) throw new ErroNegocio('Fatura não encontrada.', 404);

  const totais = await totaisPorStatus(db, idFatura);
  const resumo = montarResumo(totais, fatura.saldo_reserva_declarado);
  return { fatura, resumo };
}

async function obterDashboardService(db, idFatura) {
  const fatura = await buscarFaturaPorId(db, idFatura);
  if (!fatura) throw new ErroNegocio('Fatura não encontrada.', 404);

  const [totais, portadores, categorias] = [
    await totaisPorStatus(db, idFatura),
    await totaisPorPortador(db, idFatura),
    await totaisPorCategoria(db, idFatura),
  ];

  const resumo = montarResumo(totais, fatura.saldo_reserva_declarado);
  const totalBase = num(resumo.total_fatura);

  const por_portador = portadores.map((p) => ({
    id_usuario: p.id_usuario,
    nome: p.nome,
    total: num(p.total).toFixed(2),
    percentual: pct(p.total, totalBase),
    qtd: p.qtd,
  }));

  const por_categoria = categorias.map((c) => ({
    id_categoria: c.id_categoria,
    nome: c.nome,
    cor: c.cor ?? null,
    total: num(c.total).toFixed(2),
    percentual: pct(c.total, totalBase),
    qtd: c.qtd,
  }));

  return { fatura, resumo, por_portador, por_categoria };
}

async function atualizarReservaService(db, idFatura, saldoDeclarado) {
  const fatura = await buscarFaturaPorId(db, idFatura);
  if (!fatura) throw new ErroNegocio('Fatura não encontrada.', 404);
  if (fatura.status !== 'ABERTA') {
    throw new ErroNegocio('Fatura fechada/paga: a reserva não pode ser alterada.', 409);
  }

  const valor = Number(saldoDeclarado);
  if (!Number.isFinite(valor) || valor < 0) {
    throw new ErroNegocio('Saldo da reserva inválido (deve ser um número não negativo).');
  }
  const normalizado = (Math.round(valor * 100) / 100).toFixed(2);
  return await atualizarReserva(db, idFatura, normalizado);
}

// ── Importação ───────────────────────────────────────────────────────────────

function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

// fingerprint determinístico por linha (inclui a ordem no arquivo).
function fingerprint(linha, ordem) {
  const base = [
    linha.dt_compra,
    linha.estabelecimento,
    linha.portador_nome_importado ?? '',
    String(linha.valor),
    linha.parcela_texto ?? '-',
    String(ordem),
  ].join('|');
  return createHash('sha256').update(base).digest('hex');
}

async function garantirFaturaMutavel(db, idFatura) {
  const fatura = await buscarFaturaPorId(db, idFatura);
  if (!fatura) throw new ErroNegocio('Fatura não encontrada.', 404);
  if (fatura.status !== 'ABERTA') {
    throw new ErroNegocio('Fatura fechada/paga não aceita importação.', 409);
  }
  return fatura;
}

// PREVIEW: parse sem persistir.
async function gerarPreview(db, idFatura, buffer) {
  if (!buffer || !buffer.length) throw new ErroNegocio('Arquivo CSV ausente ou vazio.');
  await garantirFaturaMutavel(db, idFatura);

  const parser = obterParser('RICO');
  let resultado;
  try {
    resultado = parser.parseCsv(buffer);
  } catch (e) {
    // Erro de CSV (cabeçalho/estrutura) -> 400 com a mensagem.
    throw new ErroNegocio(e.message || 'CSV inválido.');
  }

  const hash = hashBuffer(buffer);
  const existente = await buscarImportacaoPorHash(db, idFatura, hash);

  return {
    hash,
    linhas_validas: resultado.linhasValidas,
    erros: resultado.erros,
    ja_importado: Boolean(existente),
  };
}

// CONFIRMAR: persiste em transação única, idempotente por hash.
async function confirmarImportacao(db, idFatura, buffer, usuario, nomeArquivo) {
  if (!buffer || !buffer.length) throw new ErroNegocio('Arquivo CSV ausente ou vazio.');
  await garantirFaturaMutavel(db, idFatura);

  const hash = hashBuffer(buffer);
  const existente = await buscarImportacaoPorHash(db, idFatura, hash);
  if (existente) {
    throw new ErroNegocio('Este arquivo já foi importado.', 409);
  }

  // Política "CSV corrigido" (hash diferente, mesma competência já com lançamentos):
  // avisa/rejeita, não duplica.
  const jaTem = await contarTransacoes(db, idFatura);
  if (jaTem > 0) {
    throw new ErroNegocio(
      'Esta fatura já possui lançamentos. Para reimportar, use o mesmo arquivo (bloqueado por hash) ou limpe os lançamentos antes.',
      409
    );
  }

  const parser = obterParser('RICO');
  let resultado;
  try {
    resultado = parser.parseCsv(buffer);
  } catch (e) {
    throw new ErroNegocio(e.message || 'CSV inválido.');
  }

  const linhas = resultado.linhasValidas;
  if (!linhas.length) {
    throw new ErroNegocio('Nenhuma linha válida no arquivo para importar.');
  }

  // Cabeçalho do lote.
  const importacao = await criarImportacao(db, {
    id_fatura: idFatura,
    emissor: 'RICO',
    hash_arquivo: hash,
    nome_arquivo: nomeArquivo || null,
    tamanho_bytes: buffer.length,
    qtd_linhas: linhas.length,
    usuario_cadastro: usuario || null,
  });

  // Linhas com fingerprint por ordem no arquivo.
  const comFingerprint = linhas.map((l, idx) => ({
    ...l,
    fingerprint_linha: fingerprint(l, idx),
  }));

  await inserirTransacoesEmLote(db, idFatura, importacao.id, comFingerprint, usuario);

  return { importacao };
}

// ── Transações ───────────────────────────────────────────────────────────────

async function listarTransacoesService(db, idFatura, filtros = {}) {
  const fatura = await buscarFaturaPorId(db, idFatura);
  if (!fatura) throw new ErroNegocio('Fatura não encontrada.', 404);

  // Normaliza filtros vindos da query.
  const norm = {};
  if (filtros.status && STATUS_LIQUIDACAO.includes(filtros.status)) norm.status = filtros.status;
  if (filtros.portador && UUID_RE.test(String(filtros.portador))) norm.portador = filtros.portador;
  if (filtros.categoria && UUID_RE.test(String(filtros.categoria))) norm.categoria = filtros.categoria;
  if (filtros.busca) norm.busca = String(filtros.busca).trim();

  // sort = "campo:dir"
  const [sc, sd] = String(filtros.sort ?? 'dt_compra:desc').split(':');
  norm.sortCampo = sc === 'valor' ? 'valor' : 'dt_compra';
  norm.sortDir = sd === 'asc' ? 'asc' : 'desc';

  const pageSize = Math.min(Math.max(Number(filtros.page_size) || 50, 1), 200);
  const page = Math.max(Number(filtros.page) || 1, 1);
  norm.limit = pageSize;
  norm.offset = (page - 1) * pageSize;

  const { transacoes, total } = await listarTransacoes(db, idFatura, norm);
  return { transacoes, total, page, page_size: pageSize };
}

async function atualizarTransacaoService(db, idFatura, idTransacao, dados) {
  const fatura = await buscarFaturaPorId(db, idFatura);
  if (!fatura) throw new ErroNegocio('Fatura não encontrada.', 404);
  if (fatura.status !== 'ABERTA') {
    throw new ErroNegocio('Fatura fechada/paga: lançamentos não podem ser editados.', 409);
  }

  const atual = await buscarTransacaoPorId(db, idFatura, idTransacao);
  if (!atual) throw new ErroNegocio('Transação não encontrada.', 404);

  // Merge: só muda o que veio no body; valida UUIDs e status.
  const temCategoria = Object.prototype.hasOwnProperty.call(dados, 'id_categoria');
  const temPortador = Object.prototype.hasOwnProperty.call(dados, 'id_usuario_portador');
  const temStatus = Object.prototype.hasOwnProperty.call(dados, 'status_liquidacao');

  let id_categoria = atual.id_categoria;
  if (temCategoria) {
    const v = dados.id_categoria;
    if (v !== null && v !== '' && !UUID_RE.test(String(v))) {
      throw new ErroNegocio('id_categoria inválido.');
    }
    id_categoria = v === '' ? null : v;
  }

  let id_usuario_portador = atual.id_usuario_portador;
  if (temPortador) {
    const v = dados.id_usuario_portador;
    if (v !== null && v !== '' && !UUID_RE.test(String(v))) {
      throw new ErroNegocio('id_usuario_portador inválido.');
    }
    id_usuario_portador = v === '' ? null : v;
  }

  let status_liquidacao = atual.status_liquidacao;
  if (temStatus) {
    if (!STATUS_LIQUIDACAO.includes(dados.status_liquidacao)) {
      throw new ErroNegocio('status_liquidacao inválido.');
    }
    status_liquidacao = dados.status_liquidacao;
  }

  return await atualizarTransacao(db, idFatura, idTransacao, {
    id_categoria,
    id_usuario_portador,
    status_liquidacao,
  });
}

// ── Fechamento ───────────────────────────────────────────────────────────────

async function fecharFaturaService(db, idFatura, idUsuario) {
  const fatura = await buscarFaturaPorId(db, idFatura);
  if (!fatura) throw new ErroNegocio('Fatura não encontrada.', 404);

  const competenciaProxima = proximaCompetencia(
    String(fatura.competencia).slice(0, 10)
  );

  // Já fechada/paga -> idempotente: não refecha nem recria; devolve a existente.
  if (fatura.status !== 'ABERTA') {
    const proxima = await buscarFaturaPorCompetencia(db, fatura.id_conta, competenciaProxima);
    return { fatura, proxima: proxima ?? null };
  }

  // Fecha (fechar com pendentes é permitido; não bloqueia).
  const fechada = await fecharFatura(db, idFatura, idUsuario);

  // Abre a próxima competência no máximo uma vez.
  let proxima = await buscarFaturaPorCompetencia(db, fatura.id_conta, competenciaProxima);
  if (!proxima) {
    proxima = await criarFatura(db, {
      id_conta: fatura.id_conta,
      competencia: competenciaProxima,
      nome_exibicao: nomeExibicao(competenciaProxima),
      usuario_cadastro: fatura.usuario_cadastro || null,
    });
  }

  return { fatura: fechada, proxima };
}

export {
  ErroNegocio,
  listarFaturasService,
  criarFaturaService,
  obterFaturaService,
  obterDashboardService,
  atualizarReservaService,
  gerarPreview,
  confirmarImportacao,
  listarTransacoesService,
  atualizarTransacaoService,
  fecharFaturaService,
};
