// ========================================
// 🧰 FORMATADORES
// ========================================
// Helpers de exibição alinhados ao banco:
//   - dinheiro em reais (NUMERIC(14,2) no Postgres; o driver pg entrega string,
//     então sempre convertemos com Number antes de formatar).
//   - datas DATE (dt_compra, dt_transacao) exibidas em pt-BR.

// Formata um valor numérico (ou string numérica) como moeda brasileira.
// Ex: 1234.5 -> "R$ 1.234,50"
export function formatarDinheiro(valor) {
  const numero = Number(valor) || 0;
  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// Versão que respeita a privacidade: oculta o valor quando `oculto` é true.
// Ex: formatarDinheiroPrivado(1234.5, true) -> "R$ ••••"
export function formatarDinheiroPrivado(valor, oculto) {
  return oculto ? 'R$ ••••' : formatarDinheiro(valor);
}

// Formata uma data (string ISO 'YYYY-MM-DD' ou Date) em pt-BR.
// Ex: "2026-03-10" -> "10/03/2026"
export function formatarData(data) {
  if (!data) return '-';
  const d = typeof data === 'string' ? new Date(`${data}T00:00:00`) : data;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

// Rótulo curto do mês/ano. Ex: new Date(2026, 2) -> "mar/2026"
export function formatarMesAno(data) {
  const d = data instanceof Date ? data : new Date(data);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}
