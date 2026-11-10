// Formatadores pt-BR usados nas telas.
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const moeda = (v) => brl.format(Number(v) || 0);
export const percentual = (v) => `${(Number(v) || 0).toFixed(1).replace('.', ',')}%`;

// '2026-10-08' -> '08/10'
export const dataCurta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// '52998224725' (ou parcial) -> '529.982.247-25'
export const cpfMascara = (v) => {
  const d = String(v ?? '').replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

// ISO -> '09/11/2026 10:12' (ou '—' se vazio)
export const dataHora = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// 'Gabriel Goes' -> 'GG'
export const iniciais = (nome) =>
  String(nome ?? '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

// 'alimentação & mercado' -> 'Alimentação & Mercado' (Proper Case só na exibição)
export const properCase = (texto) =>
  String(texto ?? '')
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (_, espaco, letra) => espaco + letra.toUpperCase());
