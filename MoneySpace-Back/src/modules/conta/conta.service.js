// ========================================
// SERVICE: CONTA
// ========================================
// Regras de negócio do módulo de conta. Orquestra o repository.
// NÃO toca em req/res (isso é do controller).
//
// Regras de negócio (ver escopo):
//   - CARTEIRA / CORRENTE: usa saldo_inicial; ignora campos de cartão.
//   - CREDITO: usa bandeira, final_cartao, limite, dia_fechamento,
//     dia_vencimento; NÃO tem saldo_inicial.
//   - saldo_inicial é só a "foto" do saldo no dia da criação (não é receita).

import {
  listarContas,
  buscarContaPorId,
  criarConta,
  atualizarConta,
  arquivarConta,
} from './conta.repositories.js';

const TIPOS_VALIDOS = ['CORRENTE', 'CREDITO', 'CARTEIRA'];

// Converte para número ou retorna null (NUMERIC/‌SMALLINT aceitam null no banco).
function numeroOuNull(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  return Number.isNaN(n) ? null : n;
}

// Valida um dia de 1 a 31 (fechamento/vencimento do cartão).
function diaValido(dia) {
  return Number.isInteger(dia) && dia >= 1 && dia <= 31;
}

// Normaliza + valida os dados conforme o tipo. Retorna o objeto pronto para o
// repository, com os campos irrelevantes já zerados/nulos.
function normalizarEValidar(dados, { usuario_cadastro } = {}) {
  const nome = (dados.nome || '').trim();
  const tipo = (dados.tipo || '').trim().toUpperCase();

  if (!nome) {
    throw new Error('O nome da conta é obrigatório.');
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw new Error("Tipo inválido. Use 'CORRENTE', 'CREDITO' ou 'CARTEIRA'.");
  }

  // Base comum.
  const normalizado = {
    nome,
    tipo,
    saldo_inicial: null,
    bandeira: null,
    final_cartao: null,
    limite: null,
    dia_fechamento: null,
    dia_vencimento: null,
    usuario_cadastro: usuario_cadastro || null,
  };

  if (tipo === 'CREDITO') {
    // Campos de cartão.
    const limite = numeroOuNull(dados.limite);
    const diaFechamento = numeroOuNull(dados.dia_fechamento);
    const diaVencimento = numeroOuNull(dados.dia_vencimento);

    if (limite !== null && limite < 0) {
      throw new Error('O limite do cartão não pode ser negativo.');
    }
    if (diaFechamento !== null && !diaValido(diaFechamento)) {
      throw new Error('Dia de fechamento inválido (use um valor de 1 a 31).');
    }
    if (diaVencimento !== null && !diaValido(diaVencimento)) {
      throw new Error('Dia de vencimento inválido (use um valor de 1 a 31).');
    }

    normalizado.bandeira = (dados.bandeira || '').trim() || null;
    normalizado.final_cartao = (dados.final_cartao || '').toString().trim() || null;
    normalizado.limite = limite;
    normalizado.dia_fechamento = diaFechamento;
    normalizado.dia_vencimento = diaVencimento;
  } else {
    // CORRENTE / CARTEIRA: só saldo_inicial (default 0 se não informado).
    const saldo = numeroOuNull(dados.saldo_inicial);
    normalizado.saldo_inicial = saldo === null ? 0 : saldo;
  }

  return normalizado;
}

// Lista as contas da família. `db` = transação do request (contexto RLS).
async function listarContasService(db) {
  return await listarContas(db);
}

// Valida os dados conforme o tipo e cria a conta.
async function criarContaService(db, dados, contexto = {}) {
  const normalizado = normalizarEValidar(dados, contexto);
  return await criarConta(db, normalizado);
}

// Valida e atualiza a conta (garante que ela existe antes).
async function atualizarContaService(db, id, dados, contexto = {}) {
  const existente = await buscarContaPorId(db, id);
  if (!existente) {
    throw new Error('Conta não encontrada.');
  }

  const normalizado = normalizarEValidar(dados, {
    usuario_cadastro: existente.usuario_cadastro,
    ...contexto,
  });

  return await atualizarConta(db, id, normalizado);
}

// Arquiva a conta (soft delete).
async function arquivarContaService(db, id) {
  const existente = await buscarContaPorId(db, id);
  if (!existente) {
    throw new Error('Conta não encontrada.');
  }
  return await arquivarConta(db, id);
}

export {
  listarContasService,
  criarContaService,
  atualizarContaService,
  arquivarContaService,
};
