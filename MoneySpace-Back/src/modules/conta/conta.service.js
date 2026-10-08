// ========================================
// SERVICE: CONTA
// ========================================
// Regras de negócio do módulo de conta. Orquestra o repository.
// NÃO toca em req/res (isso é do controller).
//
// Regras de negócio relevantes (ver escopo):
//   - tipo CARTEIRA / CORRENTE: usa saldo_inicial; ignora campos de cartão.
//   - tipo CREDITO: usa bandeira, final_cartao, limite, dia_fechamento,
//     dia_vencimento; NÃO tem saldo_inicial.
//   - saldo_inicial é só a "foto" do saldo no dia da criação (não é receita).
//   - validar: nome obrigatório; tipo ∈ ('CORRENTE','CREDITO','CARTEIRA');
//     para CREDITO, validar dias (1-31) e limite >= 0.

import {
  listarContas,
  buscarContaPorId,
  criarConta,
  atualizarConta,
  arquivarConta,
} from './conta.repositories.js';

// implementar: retorna as contas da família (talvez já com cálculo de saldo/uso).
async function listarContasService() {
  // implementar
}

// implementar: valida os dados conforme o tipo e cria a conta.
async function criarContaService(dados) {
  // implementar: validar campos por tipo -> criarConta(dados)
}

// implementar: valida e atualiza a conta.
async function atualizarContaService(id, dados) {
  // implementar: buscar/validar -> atualizarConta(id, dados)
}

// implementar: arquiva a conta (soft delete da etapa 2.3).
async function arquivarContaService(id) {
  // implementar: arquivarConta(id)
}

export {
  listarContasService,
  criarContaService,
  atualizarContaService,
  arquivarContaService,
};
