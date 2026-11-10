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

// 'AAAA-MM' -> o mês seguinte em 'AAAA-MM' ('2026-12' -> '2027-01')
export const proximaCompetencia = (competencia) => {
  const [ano, mes] = competencia.split('-').map(Number);
  const proximo = new Date(Date.UTC(ano, mes, 1)); // mês é 0-based: 'mes' já aponta para o seguinte
  return `${proximo.getUTCFullYear()}-${String(proximo.getUTCMonth() + 1).padStart(2, '0')}`;
};

// 'AAAA-MM' -> 'Dezembro de 2026'
export const nomeCompetencia = (competencia) => {
  const [ano, mes] = competencia.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, 1));
  const texto = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(data);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Competências dos últimos meses (a partir de hoje), do mais recente para o mais antigo.
// Devolve [{ id: 'AAAA-MM', nome: 'Novembro de 2026' }].
export const gerarCompetencias = (quantidade) => {
  const formatoMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

  return Array.from({ length: quantidade }, (_, deslocamento) => {
    const mes = new Date();
    mes.setMonth(mes.getMonth() - deslocamento, 1);

    const id = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`;
    const textoMes = formatoMes.format(mes);
    return { id, nome: textoMes.charAt(0).toUpperCase() + textoMes.slice(1) };
  });
};

// 'alimentação & mercado' -> 'Alimentação & Mercado' (Proper Case só na exibição)
export const properCase = (texto) =>
  String(texto ?? '')
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (_, espaco, letra) => espaco + letra.toUpperCase());
