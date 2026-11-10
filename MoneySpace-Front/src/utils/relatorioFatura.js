// Relatório da fatura: monta o PDF, o texto para o WhatsApp e compartilha/baixa.
// Tudo acontece no aparelho (sem servidor). Em celular, a folha de compartilhar abre
// e o WhatsApp aparece nela. Sem suporte, o arquivo é baixado.
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { moeda } from './formatar';

const ROTULO_STATUS = {
  'na hora': 'Na hora',
  pendente: 'Pendente',
  'no fechamento': 'No fechamento',
  'nao aplicavel': 'Nao aplicavel',
};

const VERDE = [20, 135, 59];
const MARGEM = 14;

// Onde a última tabela terminou (para escrever logo abaixo dela)
const _posicaoDepois = (doc, posicaoPadrao) => doc.lastAutoTable?.finalY ?? posicaoPadrao;

// Monta o PDF do relatório geral da fatura.
export function gerarPdfRelatorioFatura(relatorio) {
  const { cabecalho, resumo, porPortador, porCategoria, lancamentos } = relatorio;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Faixa de cabeçalho
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MoneySpace - Relatorio da fatura', MARGEM, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${cabecalho.titulo} - ${cabecalho.nomeCartao} ${cabecalho.finalCartao}`, MARGEM, 19);

  // Datas e situação da fatura
  doc.setTextColor(0, 0, 0);
  doc.text(
    `Fechamento: ${cabecalho.dataFechamento}    Vencimento: ${cabecalho.dataVencimento}    Situacao: ${cabecalho.fechada ? 'Fechada' : 'Aberta'}`,
    MARGEM,
    34
  );

  // Resumo (totais e reserva)
  const linhasResumo = [
    ['Total da fatura', moeda(resumo.totalGeral)],
    ['Na hora (pago)', moeda(resumo.totalNaHora)],
    ['Pendente', moeda(resumo.totalPendente)],
    ['No fechamento', moeda(resumo.totalNoFechamento)],
    ['Saldo da reserva', moeda(resumo.saldoReserva)],
    ['Meta da reserva (na hora + pendente)', moeda(resumo.metaReserva)],
    [resumo.sobraOuFalta >= 0 ? 'Sobra na reserva' : 'Falta na reserva', moeda(Math.abs(resumo.sobraOuFalta))],
  ];
  autoTable(doc, {
    startY: 40,
    head: [['Resumo', 'Valor']],
    body: linhasResumo,
    theme: 'striped',
    headStyles: { fillColor: VERDE },
    margin: { left: MARGEM, right: MARGEM },
    columnStyles: { 1: { halign: 'right' } },
  });

  // Quanto cada pessoa gastou
  let y = _posicaoDepois(doc, 100) + 8;
  autoTable(doc, {
    startY: y,
    head: [['Quem gastou', 'Lancamentos', 'Total']],
    body: porPortador.map((p) => [p.nome, String(p.quantidade), moeda(p.total)]),
    theme: 'striped',
    headStyles: { fillColor: VERDE },
    margin: { left: MARGEM, right: MARGEM },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
  });

  // Gasto por categoria
  y = _posicaoDepois(doc, y) + 8;
  autoTable(doc, {
    startY: y,
    head: [['Categoria', 'Lancamentos', 'Total']],
    body: porCategoria.map((c) => [c.nome, String(c.quantidade), moeda(c.total)]),
    theme: 'striped',
    headStyles: { fillColor: VERDE },
    margin: { left: MARGEM, right: MARGEM },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
  });

  // Lista completa de lançamentos (quebra de página sozinha)
  y = _posicaoDepois(doc, y) + 8;
  autoTable(doc, {
    startY: y,
    head: [['Data', 'Estabelecimento', 'Portador', 'Parcela', 'Categoria', 'Status', 'Valor']],
    body: lancamentos.map((l) => [
      l.dataCompra,
      l.estabelecimento,
      l.portador,
      l.parcela ?? '-',
      l.categoria,
      ROTULO_STATUS[l.statusTransacao] ?? l.statusTransacao,
      moeda(l.valor),
    ]),
    theme: 'striped',
    headStyles: { fillColor: VERDE },
    margin: { left: MARGEM, right: MARGEM },
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: { 6: { halign: 'right' } },
  });

  // Rodapé com a paginação em todas as páginas
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`MoneySpace - pagina ${pagina} de ${totalPaginas}`, 105, 290, { align: 'center' });
  }

  const nomeArquivo = `fatura-${cabecalho.competencia}-${cabecalho.finalCartao}.pdf`;
  return { doc, nomeArquivo };
}

// Texto curto para mandar no WhatsApp (resumo que cabe numa mensagem).
export function montarTextoResumo(relatorio) {
  const { cabecalho, resumo, porPortador } = relatorio;
  const linhasPorPessoa = porPortador.map((p) => `- ${p.nome}: ${moeda(p.total)}`).join('\n');

  return [
    `*${cabecalho.titulo} - ${cabecalho.nomeCartao} ${cabecalho.finalCartao}*`,
    `Fecha ${cabecalho.dataFechamento} | vence ${cabecalho.dataVencimento}`,
    '',
    `Total da fatura: *${moeda(resumo.totalGeral)}*`,
    `Na hora: ${moeda(resumo.totalNaHora)} | Pendente: ${moeda(resumo.totalPendente)} | No fechamento: ${moeda(resumo.totalNoFechamento)}`,
    `Reserva: ${moeda(resumo.saldoReserva)} | ${resumo.sobraOuFalta >= 0 ? 'Sobra' : 'Falta'}: ${moeda(Math.abs(resumo.sobraOuFalta))}`,
    '',
    'Por pessoa:',
    linhasPorPessoa,
  ].join('\n');
}

// PDF do relatório por semana: um quadro com as semanas e, depois, os lançamentos de cada categoria.
export function gerarPdfRelatorioSemanal(relatorio) {
  const { cabecalho, totalGeral, semanas, categoriasDetalhe } = relatorio;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Cabeçalho (mesmo estilo do relatório geral)
  doc.setFillColor(...VERDE);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MoneySpace - Gasto por semana', MARGEM, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${cabecalho.titulo} - ${cabecalho.nomeCartao} ${cabecalho.finalCartao}`, MARGEM, 19);

  doc.setTextColor(0, 0, 0);
  doc.text(`Total da fatura: ${moeda(totalGeral)}    Fechamento: ${cabecalho.dataFechamento}    Vencimento: ${cabecalho.dataVencimento}`, MARGEM, 34);

  // Quadro das semanas
  autoTable(doc, {
    startY: 40,
    head: [['Semana', 'Periodo', 'Lancamentos', 'Total']],
    body: semanas.map((semana) => [semana.rotulo, semana.periodo, String(semana.quantidade), moeda(semana.total)]),
    foot: [['', 'Total', String(semanas.reduce((soma, semana) => soma + semana.quantidade, 0)), moeda(totalGeral)]],
    theme: 'striped',
    headStyles: { fillColor: VERDE },
    footStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: MARGEM, right: MARGEM },
    columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' } },
  });

  // Detalhes por categoria (cada uma com os seus lançamentos)
  let y = _posicaoDepois(doc, 60) + 10;
  categoriasDetalhe.forEach((categoria) => {
    // quebra de página se o título ficar sozinho no fim da folha
    if (y > 260) {
      doc.addPage();
      y = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...VERDE);
    doc.text(`${categoria.nome} - ${categoria.quantidade} lancamento(s) - ${moeda(categoria.total)}`, MARGEM, y);
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: y + 2,
      head: [['Data', 'Estabelecimento', 'Portador', 'Parcela', 'Status', 'Valor']],
      body: categoria.lancamentos.map((l) => [
        l.dataCompra,
        l.estabelecimento,
        l.portador,
        l.parcela ?? '-',
        ROTULO_STATUS[l.statusTransacao] ?? l.statusTransacao,
        moeda(l.valor),
      ]),
      theme: 'striped',
      headStyles: { fillColor: VERDE },
      margin: { left: MARGEM, right: MARGEM },
      styles: { fontSize: 8, cellPadding: 1.5 },
      columnStyles: { 5: { halign: 'right' } },
    });
    y = _posicaoDepois(doc, y) + 8;
  });

  const totalPaginas = doc.internal.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`MoneySpace - pagina ${pagina} de ${totalPaginas}`, 105, 290, { align: 'center' });
  }

  const nomeArquivo = `semanas-${cabecalho.competencia}-${cabecalho.finalCartao}.pdf`;
  return { doc, nomeArquivo };
}

// Texto curto do relatório por semana, para o WhatsApp.
export function montarTextoSemanal(relatorio) {
  const { cabecalho, totalGeral, semanas, categoriasDetalhe } = relatorio;
  const linhasSemanas = semanas.map((semana) => `- ${semana.rotulo} (${semana.periodo}): ${moeda(semana.total)}`).join('\n');
  const linhasCategorias = categoriasDetalhe.map((c) => `- ${c.nome}: ${moeda(c.total)}`).join('\n');

  return [
    `*${cabecalho.titulo} - ${cabecalho.nomeCartao} ${cabecalho.finalCartao}*`,
    `Gasto por semana (total ${moeda(totalGeral)}):`,
    linhasSemanas,
    '',
    'Por categoria:',
    linhasCategorias,
  ].join('\n');
}

// Abre a folha de compartilhar com o PDF (WhatsApp incluso). Sem suporte, baixa o arquivo.
// Retorna 'compartilhado', 'cancelado' ou 'baixado'.
export async function compartilharRelatorioPdf(doc, nomeArquivo, texto) {
  const arquivo = new File([doc.output('blob')], nomeArquivo, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: nomeArquivo, text: texto });
      return 'compartilhado';
    } catch (erro) {
      // o usuário fechou a folha de compartilhar: não é erro
      if (erro.name === 'AbortError') return 'cancelado';
      throw erro;
    }
  }

  doc.save(nomeArquivo);
  return 'baixado';
}
