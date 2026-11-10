// ========================================
// MOCK — Controle de Fatura & Reserva
// ========================================
// Dados fictícios baseados na planilha "Controle Cartão Rico". Quando o back
// existir, troque por chamadas em services/faturaService.js (mesmo formato).

// Campo ÚNICO de status. Todo lançamento novo nasce 'pendente'; o usuário altera.
export const STATUS = {
  pendente: { label: 'Pendente', color: 'warning' },
  na_hora: { label: 'Na hora', color: 'success' },
  no_fechamento: { label: 'No fechamento', color: 'accent' },
  pagamento: { label: 'Pagamento', color: 'default' },
};

export const CARTOES = [
  { id: 'rico', nome: 'Rico Mastercard', final: '4821' },
  { id: 'nubank', nome: 'Nubank Roxinho', final: '9034' },
];

export const COMPETENCIAS = [
  { id: '2026-10', nome: 'Outubro / 2026' },
  { id: '2026-09', nome: 'Setembro / 2026' },
];

let seq = 0;
const t = (data, estabelecimento, portador, valor, parcela, categoria, status) => ({
  id: `t${++seq}`, data, estabelecimento, portador, valor, parcela, categoria, status,
});

const G = 'GABRIEL GOES';
const V = 'GEOVANA TAVARES';
const H = 'na_hora';
const F = 'no_fechamento';

const outubroRico = [
  t('2026-09-26', 'MERCADOLIVRE*LENOSOM', G, 112.18, '2 de 3', 'Compras & Vestuário', F),
  t('2026-10-01', 'SILVIA REGINA DA', V, 170.0, '2 de 2', 'Alimentação & Mercado', H),
  t('2026-10-08', 'SUPERMERCAD TRES IRMAO', G, 19.75, null, 'Farmácia & Saúde', H),
  t('2026-10-08', 'SAHARA COMIDA ARABE', V, 28.97, null, 'Transporte & Combustível', H),
  t('2026-10-08', 'BPG CACAUSHOW', V, 29.99, null, 'Alimentação & Mercado', H),
  t('2026-10-08', 'POSTO TABOAO SAO ROQUE', V, 50.0, null, 'Lazer & Restaurantes', H),
  t('2026-10-08', 'DISCLOUD', G, 10.99, null, 'Serviços & Assinaturas', H),
  t('2026-10-08', 'MP*VINICIUSQUEIJ', V, 25.0, null, 'Compras & Vestuário', H),
  t('2026-10-08', 'AGROVERDE 100', V, 77.85, '1 de 2', 'Educação & Cursos', F),
  t('2026-10-09', 'SUPERMERCAD TRES IRMAO', V, 4.93, null, 'Compras & Vestuário', H),
  t('2026-10-09', 'ACAI DA BARRA', V, 14.07, null, 'Transporte & Combustível', H),
  t('2026-10-09', 'ACAI DA BARRA', V, 10.15, null, 'Pet & Veterinária', H),
  t('2026-10-10', 'POSTO TABOAO SAO ROQUE', V, 30.0, null, 'Farmácia & Saúde', H),
  t('2026-10-10', 'MERCADOLIVRE*MERCADOLI', G, 40.47, null, 'Alimentação & Mercado', H),
  t('2026-10-10', 'CANTINA ITALINA', G, 124.33, null, 'Alimentação & Mercado', H),
  t('2026-10-10', 'RONY PARK', G, 12.0, null, 'Transporte & Combustível', H),
  t('2026-10-11', 'FIX INOVAP *INOVAP 5', G, 38.2, null, 'Outros', H),
  t('2026-10-12', 'CASH', G, 50.0, null, 'Transporte & Combustível', H),
  t('2026-10-12', 'FAZENDA ANGOLANA', G, 50.0, null, 'Lazer & Restaurantes', H),
  t('2026-10-12', 'CARNES DOMINGUES', G, 13.7, null, 'Alimentação & Mercado', H),
  t('2026-10-12', 'PIZZARIA RETRO MAIRINQ', G, 83.6, null, 'Lazer & Restaurantes', H),
  t('2026-10-12', 'CAFE NA FAZENDA', V, 21.0, null, 'Alimentação & Mercado', H),
  t('2026-10-13', 'AUTOPOSTO', G, 20.0, null, 'Transporte & Combustível', H),
  t('2026-10-14', 'DROGASIL 1182', V, 247.71, null, 'Farmácia & Saúde', 'pendente'),
  t('2026-10-15', 'AMAZON PRIME', G, 19.9, null, 'Serviços & Assinaturas', F),
  t('2026-10-15', 'UDEMY CURSO REACT', G, 299.78, null, 'Educação & Cursos', 'pendente'),
  t('2026-10-16', 'PETZ SAO ROQUE', V, 35.15, null, 'Pet & Veterinária', H),
  t('2026-10-17', 'SHELL BOX', G, 210.0, null, 'Transporte & Combustível', 'pendente'),
  t('2026-10-18', 'RENNER', V, 175.2, null, 'Compras & Vestuário', H),
  t('2026-10-18', 'SPOTIFY', V, 21.9, null, 'Serviços & Assinaturas', F),
  t('2026-10-19', 'IFOOD *RESTAURANTE', G, 96.4, null, 'Lazer & Restaurantes', H),
  t('2026-10-20', 'ATACADAO', V, 428.51, null, 'Outros', H),
  t('2026-10-21', 'Pagamento de fatura', G, -1500.0, null, 'Pagamento de Fatura', 'pagamento'),
];

const setembroRico = outubroRico.slice(2, 12).map((x, i) => ({
  ...x, id: `s${i}`, data: x.data.replace('2026-10', '2026-09'),
}));

// Chave "cartao:competencia" -> dados da fatura
export const FATURAS = {
  'rico:2026-10': { status: 'ABERTA', fechamento: '2026-10-25', vencimento: '2026-11-05', saldoReserva: 5027.27, transacoes: outubroRico },
  'rico:2026-09': { status: 'PAGA', fechamento: '2026-09-25', vencimento: '2026-10-05', saldoReserva: 1200.0, transacoes: setembroRico },
};

