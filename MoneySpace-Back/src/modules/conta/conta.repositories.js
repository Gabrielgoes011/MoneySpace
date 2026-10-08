// ========================================
// REPOSITORY: CONTA
// ========================================
// Camada de acesso ao banco. ÚNICO lugar com SQL do módulo de conta.
// Mapeado para a tabela `conta` do script.sql:
//   tipo ∈ ('CORRENTE', 'CREDITO', 'CARTEIRA')
//   campos de cartão (bandeira, final_cartao, limite, dia_fechamento,
//   dia_vencimento) só valem quando tipo = 'CREDITO'.
//   `ativo` = soft delete (arquivar). RLS filtra por id_familia automaticamente.
//
// OBS: o RLS (rlsMiddleware) já injeta app.current_familia_id por request, então
// as queries podem confiar nas policies. Use openDb() para pegar a conexão.

import { openDb } from '../../config/configDb.js';

// implementar: lista as contas da família (RLS filtra por id_familia).
// Sugestão de assinatura: async function listarContas() { ... return rows; }
async function listarContas() {
  // implementar: SELECT * FROM conta WHERE ativo = true ORDER BY ...
}

// implementar: busca uma conta pelo id.
async function buscarContaPorId(id) {
  // implementar: SELECT * FROM conta WHERE id = $1
}

// implementar: cria uma nova conta. `dados` traz nome, tipo e os campos
// específicos conforme o tipo (saldo_inicial OU bandeira/limite/dias).
async function criarConta(dados) {
  // implementar: INSERT INTO conta (...) VALUES (...) RETURNING *
}

// implementar: atualiza uma conta existente.
async function atualizarConta(id, dados) {
  // implementar: UPDATE conta SET ... WHERE id = $N RETURNING *
}

// implementar: arquiva (soft delete) uma conta -> ativo = false.
// (usado na etapa 2.3, mas já deixo o espaço aqui)
async function arquivarConta(id) {
  // implementar: UPDATE conta SET ativo = false WHERE id = $1
}

export {
  listarContas,
  buscarContaPorId,
  criarConta,
  atualizarConta,
  arquivarConta,
};
