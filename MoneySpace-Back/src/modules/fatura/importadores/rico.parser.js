// ========================================
// IMPORTADOR: PARSER DO CSV RICO
// ========================================
// Funções PURAS e testáveis que leem o export de fatura do cartão Rico e
// devolvem linhas normalizadas + erros por linha. NÃO toca em banco, req/res
// nem em estado global — recebe o buffer/texto e devolve objetos.
//
// LAYOUT:
//  - Delimitador: DETECTADO automaticamente entre TAB (`\t`), ponto-e-vírgula
//    (`;`) e vírgula (`,`). Exports do Rico via planilha PT-BR costumam vir com
//    `;` (porque a vírgula já é o separador decimal do valor). TAB também é aceito.
//  - Encoding: UTF-8; tolerar acento em "Responsável".
//  - Cabeçalho (ordem): Data | Estabelecimento | Responsável / Portador |
//    Valor (R$) | Parcela. Alias do portador: `Portador` ~ `Responsável / Portador`.
//  - Sem coluna de categoria no CSV (categoria é escolhida no app).
//  - Data: DD/MM/AAAA (ou AAAA-MM-DD já normalizada).
//  - Valor: `R$ `, milhar com ponto, decimal com vírgula; compras positivas,
//    pagamento/estorno negativo (`-R$ ...`). Persistimos o ABSOLUTO.
//  - Parcela: `-` (à vista) | `N de M` (parcelada) | ` de 1` (malformada = à vista).

// Regra de pagamento/estorno CENTRALIZADA (igualdade, não substring).
export const ESTABELECIMENTOS_NAO_APLICAVEL = ['pagamento de fatura'];

// Delimitadores candidatos, na ordem de preferência.
const DELIMITADORES = ['\t', ';', ','];

// Remove acentos e normaliza caixa/espaços (p/ casar cabeçalho e regra).
function semAcento(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza um estabelecimento para comparação de regra (trim + minúsculas).
 */
export function normalizarEstabelecimento(texto) {
  return String(texto ?? '').trim().toLowerCase();
}

/**
 * Normaliza um valor monetário do Rico para número POSITIVO (absoluto).
 * Aceita `R$`, pontos de milhar, vírgula decimal, espaços e sinal `-`.
 * Lança Error quando não for interpretável (o chamador coleta em `erros`).
 */
export function normalizarValor(texto) {
  const bruto = String(texto ?? '').trim();
  // Mantém só dígitos, vírgula, ponto e sinal.
  const limpo = bruto.replace(/[^\d.,-]/g, '');
  // Remove separador de milhar (ponto) e troca vírgula decimal por ponto.
  const semMilhar = limpo.replace(/\./g, '').replace(',', '.');
  const n = Number(semMilhar);
  if (!Number.isFinite(n) || semMilhar === '' || semMilhar === '-') {
    throw new Error(`Valor inválido: "${bruto}"`);
  }
  // Arredonda para 2 casas e devolve sempre o absoluto.
  return Math.abs(Math.round(n * 100) / 100);
}

/**
 * Indica se o texto de valor representa um valor NEGATIVO (sinal `-` antes do
 * número). Usado por `classificar` para detectar pagamento/estorno.
 */
export function valorEhNegativo(texto) {
  const s = String(texto ?? '');
  const idxDigito = s.search(/\d/);
  if (idxDigito === -1) return false;
  return s.slice(0, idxDigito).includes('-');
}

/**
 * Normaliza uma data para `YYYY-MM-DD`. Aceita `DD/MM/AAAA` e `AAAA-MM-DD`.
 * Lança Error em datas inválidas.
 */
export function normalizarData(texto) {
  const s = String(texto ?? '').trim();

  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const dia = Number(br[1]);
    const mes = Number(br[2]);
    const ano = Number(br[3]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) {
      throw new Error(`Data inválida: "${s}"`);
    }
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const ano = Number(iso[1]);
    const mes = Number(iso[2]);
    const dia = Number(iso[3]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) {
      throw new Error(`Data inválida: "${s}"`);
    }
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  throw new Error(`Data inválida: "${s}"`);
}

/**
 * Interpreta a coluna `Parcela`.
 *   `-`/vazio → { numero: null, total: null } (à vista)
 *   `N de M` com 1 <= N <= M → { numero: N, total: M }
 *   qualquer outra coisa (inclui ` de 1`) → à vista (null/null)
 */
export function parseParcela(texto) {
  const s = String(texto ?? '').trim();
  if (!s || s === '-') return { numero: null, total: null };

  const m = s.match(/^(\d+)\s+de\s+(\d+)$/i);
  if (m) {
    const numero = Number(m[1]);
    const total = Number(m[2]);
    if (Number.isInteger(numero) && Number.isInteger(total) && numero >= 1 && numero <= total) {
      return { numero, total };
    }
  }
  return { numero: null, total: null };
}

/**
 * Classifica o `status_liquidacao` de UMA linha já parseada.
 *   1. valor negativo OU estabelecimento == 'Pagamento de fatura' → 'nao aplicavel'
 *   2. parcela válida `N de M` → 'no fechamento'
 *   3. demais (à vista) → 'pendente'
 */
export function classificar(linha) {
  const negativo = Boolean(linha?.valorEhNegativo);
  const estab = normalizarEstabelecimento(linha?.estabelecimento);
  if (negativo || ESTABELECIMENTOS_NAO_APLICAVEL.includes(estab)) {
    return 'nao aplicavel';
  }
  const p = linha?.parcela ?? {};
  if (p.numero != null && p.total != null) {
    return 'no fechamento';
  }
  return 'pendente';
}

// Casa o nome de uma coluna do cabeçalho com um papel conhecido.
function papelDaColuna(nomeCru) {
  const n = semAcento(nomeCru).trim().toLowerCase().replace(/\s+/g, ' ');
  if (n === 'data') return 'data';
  if (n === 'estabelecimento') return 'estabelecimento';
  if (n.includes('portador')) return 'portador'; // 'portador' ou 'responsavel / portador'
  if (n.startsWith('valor')) return 'valor'; // 'valor' ou 'valor (r$)'
  if (n === 'parcela') return 'parcela';
  return null;
}

// Mapeia os papéis das colunas a partir das células do cabeçalho.
function mapearCabecalho(celulas) {
  const mapa = {};
  celulas.forEach((nome, i) => {
    const papel = papelDaColuna(nome);
    if (papel && mapa[papel] === undefined) {
      mapa[papel] = i;
    }
  });
  return mapa;
}

const COLS_OBRIGATORIAS = ['data', 'estabelecimento', 'portador', 'valor', 'parcela'];

/**
 * Detecta o delimitador (TAB, ';' ou ',') testando qual deles faz o cabeçalho
 * reconhecer TODAS as colunas obrigatórias. Retorna { delimitador, mapa } ou
 * null se nenhum servir.
 */
function detectarDelimitador(linhaCabecalho) {
  for (const delim of DELIMITADORES) {
    const celulas = linhaCabecalho.split(delim);
    if (celulas.length < COLS_OBRIGATORIAS.length) continue;
    const mapa = mapearCabecalho(celulas);
    const faltando = COLS_OBRIGATORIAS.filter((c) => mapa[c] === undefined);
    if (faltando.length === 0) {
      return { delimitador: delim, mapa };
    }
  }
  return null;
}

/**
 * Lê o buffer/texto do CSV Rico → { linhasValidas, erros }.
 * Detecta o delimitador automaticamente. NÃO persiste nada. Linhas inválidas
 * entram em `erros` sem bloquear as válidas.
 */
export function parseCsvRico(buffer) {
  let texto = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer ?? '');
  texto = texto.replace(/^\uFEFF/, ''); // remove BOM

  const linhas = texto.split(/\r\n|\r|\n/);
  while (linhas.length && linhas[linhas.length - 1].trim() === '') {
    linhas.pop();
  }
  if (linhas.length === 0) {
    throw new Error('CSV vazio ou sem cabeçalho.');
  }

  // Primeira linha não-vazia = cabeçalho.
  let idxCabecalho = 0;
  while (idxCabecalho < linhas.length && linhas[idxCabecalho].trim() === '') {
    idxCabecalho += 1;
  }

  const deteccao = detectarDelimitador(linhas[idxCabecalho]);
  if (!deteccao) {
    throw new Error('Cabeçalho do CSV Rico não reconhecido.');
  }
  const { delimitador, mapa } = deteccao;

  const linhasValidas = [];
  const erros = [];

  for (let i = idxCabecalho + 1; i < linhas.length; i += 1) {
    const linhaNum = i + 1; // 1-based
    const cru = linhas[i];
    if (cru.trim() === '') continue;

    const cols = cru.split(delimitador);
    try {
      const dataCrua = (cols[mapa.data] ?? '').trim();
      const estabelecimento = (cols[mapa.estabelecimento] ?? '').trim();
      const portador = (cols[mapa.portador] ?? '').trim();
      const valorCru = (cols[mapa.valor] ?? '').trim();
      const parcelaCrua = (cols[mapa.parcela] ?? '').trim();

      if (!estabelecimento) {
        throw new Error('Estabelecimento vazio.');
      }

      const dt_compra = normalizarData(dataCrua);
      const valor = normalizarValor(valorCru);
      const negativo = valorEhNegativo(valorCru);
      const parcela = parseParcela(parcelaCrua);

      const temParcela = parcela.numero != null && parcela.total != null;
      const parcela_texto = temParcela ? `${parcela.numero} de ${parcela.total}` : '-';

      const status_liquidacao = classificar({
        estabelecimento,
        valorEhNegativo: negativo,
        parcela,
      });

      linhasValidas.push({
        dt_compra,
        estabelecimento,
        portador_nome_importado: portador,
        valor,
        valor_original: valorCru,
        parcela_texto,
        numero_parcela: parcela.numero,
        total_parcelas: parcela.total,
        status_liquidacao,
      });
    } catch (e) {
      erros.push({ linha: linhaNum, motivo: e.message || 'Linha inválida.' });
    }
  }

  return { linhasValidas, erros };
}
