// Cálculos da fatura (espelham as fórmulas da planilha).

export function calcular(transacoes, saldoReserva) {
  const soma = (fn) => transacoes.filter(fn).reduce((a, x) => a + x.valor, 0);
  const pago = soma((x) => x.status === 'na_hora');
  const pendente = soma((x) => x.status === 'pendente');
  const fechamento = soma((x) => x.status === 'no_fechamento');
  const pagamentos = Math.abs(soma((x) => x.status === 'pagamento'));
  const bruto = pago + pendente + fechamento;
  const meta = pago + pendente;
  const diferenca = saldoReserva - meta;
  return { pago, pendente, fechamento, pagamentos, bruto, liquido: bruto - pagamentos, meta, diferenca };
}

export function agrupar(transacoes, chave) {
  const compras = transacoes.filter((x) => x.status !== 'pagamento');
  const total = compras.reduce((a, x) => a + x.valor, 0);
  const mapa = {};
  compras.forEach((x) => {
    mapa[x[chave]] ??= { nome: x[chave], total: 0, qtd: 0 };
    mapa[x[chave]].total += x.valor;
    mapa[x[chave]].qtd += 1;
  });
  return Object.values(mapa)
    .map((g) => ({ ...g, pct: total ? (g.total / total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);
}
