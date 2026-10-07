// ========================================
// 🧪 DADOS DE EXEMPLO (MOCK)
// ========================================
// Dados fictícios que imitam o formato do banco (script.sql) só para dar vida
// às telas enquanto o backend das features ainda não existe. Troque por chamadas
// reais à API quando os endpoints estiverem prontos.
//
// Convenções mantidas iguais ao banco: tipo 'RECEITA'/'DESPESA',
// status 'PENDENTE'/'EFETIVADA', valores em reais (número), datas 'YYYY-MM-DD'.

// Contas e cartões (tabela `conta`)
export const contas = [
  { id: 'c1', nome: 'Nubank', tipo: 'CREDITO', bandeira: 'MASTERCARD', final_cartao: '1234', limite: 5000, dia_fechamento: 28, dia_vencimento: 5 },
  { id: 'c2', nome: 'Inter', tipo: 'CORRENTE', saldo_inicial: 3200.75 },
  { id: 'c3', nome: 'Carteira', tipo: 'CARTEIRA', saldo_inicial: 180 },
  { id: 'c4', nome: 'Rico', tipo: 'CREDITO', bandeira: 'VISA', final_cartao: '9876', limite: 8000, dia_fechamento: 15, dia_vencimento: 22 },
];

// Categorias (tabela `categoria`)
export const categorias = [
  { id: 'cat1', nome: 'Mercado', tipo: 'DESPESA', cor: '#FF6B6B', padrao_sistema: true },
  { id: 'cat2', nome: 'Lazer', tipo: 'DESPESA', cor: '#4ECDC4', padrao_sistema: true },
  { id: 'cat3', nome: 'Transporte', tipo: 'DESPESA', cor: '#FFD93D', padrao_sistema: true },
  { id: 'cat4', nome: 'Moradia', tipo: 'DESPESA', cor: '#6C5CE7', padrao_sistema: true },
  { id: 'cat5', nome: 'Salário', tipo: 'RECEITA', cor: '#2ECC71', padrao_sistema: true },
  { id: 'cat6', nome: 'Mesada do filho', tipo: 'DESPESA', cor: '#E17055', padrao_sistema: false },
];

// Transações / parcelas (tabela `transacao` + dados da `compra`)
export const transacoes = [
  { id: 't1', descricao: 'Supermercado Extra', categoria: 'Mercado', conta: 'Nubank', tipo: 'DESPESA', valor: 342.9, status: 'EFETIVADA', dt_transacao: '2026-10-02', numero_parcela: 1, total_parcelas: 1 },
  { id: 't2', descricao: 'Salário', categoria: 'Salário', conta: 'Inter', tipo: 'RECEITA', valor: 6500, status: 'EFETIVADA', dt_transacao: '2026-10-05', numero_parcela: 1, total_parcelas: 1 },
  { id: 't3', descricao: 'Notebook (3x)', categoria: 'Lazer', conta: 'Rico', tipo: 'DESPESA', valor: 1200, status: 'PENDENTE', dt_transacao: '2026-10-22', numero_parcela: 2, total_parcelas: 3 },
  { id: 't4', descricao: 'Uber', categoria: 'Transporte', conta: 'Nubank', tipo: 'DESPESA', valor: 28.5, status: 'EFETIVADA', dt_transacao: '2026-10-03', numero_parcela: 1, total_parcelas: 1 },
  { id: 't5', descricao: 'Aluguel', categoria: 'Moradia', conta: 'Inter', tipo: 'DESPESA', valor: 1800, status: 'PENDENTE', dt_transacao: '2026-10-10', numero_parcela: 1, total_parcelas: 1 },
  { id: 't6', descricao: 'Cinema', categoria: 'Lazer', conta: 'Carteira', tipo: 'DESPESA', valor: 64, status: 'EFETIVADA', dt_transacao: '2026-10-01', numero_parcela: 1, total_parcelas: 1 },
  { id: 't7', descricao: 'Farmácia', categoria: 'Mercado', conta: 'Nubank', tipo: 'DESPESA', valor: 89.3, status: 'EFETIVADA', dt_transacao: '2026-10-04', numero_parcela: 1, total_parcelas: 1 },
];

// Empréstimos / "quem me deve" (compra.emprestado = true, com id_devedor)
export const emprestimos = [
  { id: 'e1', devedor: 'João (cunhado)', descricao: 'Emprestei o cartão', valor: 300, reembolsado: false, dt_compra: '2026-09-20' },
  { id: 'e2', devedor: 'Maria (vizinha)', descricao: 'Mercado no débito', valor: 85, reembolsado: true, dt_compra: '2026-09-28' },
];

// Resumo agregado do mês atual (o backend calcularia isso com SUM/GROUP BY)
export function calcularResumoMes() {
  const receitas = transacoes.filter((t) => t.tipo === 'RECEITA').reduce((s, t) => s + t.valor, 0);
  const despesas = transacoes.filter((t) => t.tipo === 'DESPESA').reduce((s, t) => s + t.valor, 0);
  const pendentes = transacoes.filter((t) => t.status === 'PENDENTE').reduce((s, t) => s + t.valor, 0);
  return { receitas, despesas, saldo: receitas - despesas, pendentes };
}

// Gastos por categoria (para o gráfico/lista "onde gastei mais")
export function gastosPorCategoria() {
  const mapa = {};
  for (const t of transacoes) {
    if (t.tipo !== 'DESPESA') continue;
    mapa[t.categoria] = (mapa[t.categoria] || 0) + t.valor;
  }
  const cor = (nome) => categorias.find((c) => c.nome === nome)?.cor || '#888';
  return Object.entries(mapa)
    .map(([nome, total]) => ({ nome, total, cor: cor(nome) }))
    .sort((a, b) => b.total - a.total);
}

// Usuários da família (tabela `usuario`)
export const usuarios = [
  { id: 'u1', nome: 'Gabriel Goes', email: 'gabrielgoes20@gmail.com', mfa_ativo: false },
  { id: 'u2', nome: 'Maria Goes', email: 'maria@email.com', mfa_ativo: true },
  { id: 'u3', nome: 'Pedro Goes', email: 'pedro@email.com', mfa_ativo: false },
];
