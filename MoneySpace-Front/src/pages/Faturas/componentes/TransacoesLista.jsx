// Lançamentos paginados: Table no desktop, cards no celular.
// Pesquisa única acima da lista. Aceita texto livre e filtros por coluna no formato "Coluna: valor",
// separados por ";" (ex.: "Portador: Gabriel; Categoria: mercado; posto").
// No desktop cada título de coluna abre um menu: filtrar (grava "Coluna: valor" na pesquisa) e ordenar.
// No celular a ordenação é um select. Status e categoria são editáveis na linha.
import { useState } from 'react';
import { Table, Card, Chip, Select, ListBox, Pagination, Button, SearchField, Popover, Input } from '@heroui/react';
import { FiEdit2, FiTrash2, FiChevronDown, FiArrowUp, FiArrowDown, FiFilter, FiX, FiUsers } from 'react-icons/fi';
import { STATUS } from '../../../utils/statusFatura';
import { moeda, dataCurta, properCase } from '../../../utils/formatar';
import useIsMobile from '../../../hooks/useIsMobile';
import Seletor from '../../../components/Seletor';

const OPCOES_POR_PAGINA = [10, 25, 50, 100, 200].map((n) => ({ id: String(n), nome: `${n} por página` }));
const SEM_CATEGORIA = 'nenhum';
const ORDEM_PADRAO = { column: 'data', direction: 'ascending' };

// Colunas que filtram e ordenam. `numerica` muda o texto do menu (menor/maior em vez de A-Z).
const COLUNAS = [
  { id: 'data', rotulo: 'Data', numerica: true },
  { id: 'estabelecimento', rotulo: 'Estabelecimento' },
  { id: 'portador', rotulo: 'Portador' },
  { id: 'valor', rotulo: 'Valor', numerica: true },
  { id: 'parcela', rotulo: 'Parcela' },
  { id: 'categoria', rotulo: 'Categoria' },
  { id: 'status', rotulo: 'Status' },
];

// Texto de cada coluna usado na pesquisa (o mesmo que aparece na tela, mais formatos úteis).
const TEXTO_COLUNA = {
  data: (tr) => `${dataCurta(tr.data)} ${tr.data}`,
  estabelecimento: (tr) => tr.estabelecimento,
  portador: (tr) => tr.portador,
  valor: (tr) => `${moeda(tr.valor)} ${tr.valor.toFixed(2)} ${tr.valor.toFixed(2).replace('.', ',')}`,
  parcela: (tr) => tr.parcela ?? '',
  categoria: (tr) => (tr.categoria ? properCase(tr.categoria) : 'Sem categoria'),
  status: (tr) => STATUS[tr.status]?.label ?? '',
};

// Tira acentos e deixa minúsculo para a pesquisa ('Farmácia' acha 'farmacia').
const normalizar = (texto) =>
  String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Lê a pesquisa: "Portador: Gabriel; posto" -> [{ coluna: 'portador', valor: 'Gabriel' }, { coluna: null, valor: 'posto' }]
// `texto` é o pedaço original (usado para reescrever a pesquisa quando um filtro de coluna muda).
function separarTermos(pesquisa) {
  return pesquisa.split(';').map((pedaco) => pedaco.trim()).filter(Boolean).map((pedaco) => {
    const posicaoDoisPontos = pedaco.indexOf(':');
    if (posicaoDoisPontos > 0) {
      const nomeColuna = normalizar(pedaco.slice(0, posicaoDoisPontos));
      const colunaEncontrada = COLUNAS.find((col) => normalizar(col.rotulo) === nomeColuna);
      if (colunaEncontrada) {
        return { coluna: colunaEncontrada.id, valor: pedaco.slice(posicaoDoisPontos + 1).trim(), texto: pedaco };
      }
    }
    return { coluna: null, valor: pedaco, texto: pedaco };
  }).filter((parte) => parte.valor !== '');
}

// Título da coluna com menu: campo "Filtrar por X" (Enter aplica) e ordenação.
function MenuColuna({ coluna, ordem, filtroAtual, onOrdenar, onFiltrar }) {
  const [aberto, setAberto] = useState(false);
  const [textoFiltro, setTextoFiltro] = useState(filtroAtual);
  const ordenadaPorEsta = ordem.column === coluna.id;

  // Ao abrir, o campo mostra o filtro que já está na pesquisa.
  const mudarAberto = (abrir) => {
    if (abrir) setTextoFiltro(filtroAtual);
    setAberto(abrir);
  };

  const aplicar = (valor) => {
    onFiltrar(valor);
    setAberto(false);
  };

  const ordenar = (direcao) => {
    onOrdenar(direcao);
    setAberto(false);
  };

  return (
    <Popover isOpen={aberto} onOpenChange={mudarAberto}>
      <Button variant="ghost" size="sm" className="-ml-2 h-7 gap-1 px-2 font-medium">
        {coluna.rotulo}
        {filtroAtual && <FiFilter size={12} className="text-accent" aria-label="filtrada" />}
        {ordenadaPorEsta && (ordem.direction === 'ascending' ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />)}
        <FiChevronDown size={12} className="text-muted" />
      </Button>
      <Popover.Content placement="bottom start" className="w-64">
        <Popover.Dialog aria-label={`Opções da coluna ${coluna.rotulo}`} className="space-y-1 p-2">
          <form onSubmit={(e) => { e.preventDefault(); aplicar(textoFiltro); }} className="flex gap-1">
            <Input
              autoFocus aria-label={`Filtrar por ${coluna.rotulo}`} placeholder={`Filtrar por ${coluna.rotulo}...`}
              value={textoFiltro} onChange={(e) => setTextoFiltro(e.target.value)} className="flex-1"
            />
            {filtroAtual && (
              <Button isIconOnly size="sm" variant="ghost" aria-label="Tirar filtro" onPress={() => aplicar('')}>
                <FiX size={14} />
              </Button>
            )}
          </form>
          <div className="border-t border-separator pt-1">
            <Button variant="ghost" size="sm" className="w-full justify-start" onPress={() => ordenar('ascending')}>
              <FiArrowUp size={14} /> {coluna.numerica ? 'Menor → maior' : 'Ordenar A → Z'}
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start" onPress={() => ordenar('descending')}>
              <FiArrowDown size={14} /> {coluna.numerica ? 'Maior → menor' : 'Ordenar Z → A'}
            </Button>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

// Ordenação no celular (no desktop é o menu do título da coluna).
const OPCOES_ORDEM = [
  { id: 'data:ascending', nome: 'Data (mais antiga)' },
  { id: 'data:descending', nome: 'Data (mais recente)' },
  { id: 'valor:descending', nome: 'Maior valor' },
  { id: 'valor:ascending', nome: 'Menor valor' },
  { id: 'estabelecimento:ascending', nome: 'Estabelecimento (A-Z)' },
];

// Cores de cada status (ponto e texto). Classes escritas por extenso para o Tailwind gerar todas.
const COR_PONTO = { warning: 'bg-warning', success: 'bg-success', accent: 'bg-accent' };
const COR_TEXTO = { warning: 'text-warning', success: 'text-success', accent: 'text-accent' };

// Valor usado para ordenar cada coluna.
const VALOR_ORDENACAO = {
  data: (tr) => tr.data,
  estabelecimento: (tr) => tr.estabelecimento.toLowerCase(),
  portador: (tr) => tr.portador.toLowerCase(),
  valor: (tr) => tr.valor,
  parcela: (tr) => tr.parcela ?? '',
  categoria: (tr) => tr.categoria ?? '',
  status: (tr) => STATUS[tr.status]?.label ?? '',
};

// Status editável na linha, com a cor do status (ponto + texto).
function StatusSelect({ tr, onChange, desabilitado }) {
  const estilo = STATUS[tr.status] ?? STATUS.pendente;
  return (
    <Select
      aria-label={`Status de ${tr.estabelecimento}`}
      selectedKey={tr.status}
      isDisabled={desabilitado}
      onSelectionChange={(k) => onChange(tr.id, k)}
      className="w-36"
    >
      <Select.Trigger>
        <span className="flex items-center gap-2">
          <span className={`size-2.5 shrink-0 rounded-full ${COR_PONTO[estilo.color]}`} />
          <span className={`font-medium ${COR_TEXTO[estilo.color]}`}>{estilo.label}</span>
        </span>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {Object.entries(STATUS).map(([k, s]) => (
            <ListBox.Item key={k} id={k} textValue={s.label}>
              <span className="flex items-center gap-2">
                <span className={`size-2.5 rounded-full ${COR_PONTO[s.color]}`} />
                <span className={COR_TEXTO[s.color]}>{s.label}</span>
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

// Categoria editável na linha: lista as categorias do cadastro.
function CategoriaSelect({ tr, categorias, onChange, desabilitado }) {
  const itens = [
    { id: SEM_CATEGORIA, nome: 'Sem categoria' },
    ...categorias.map((c) => ({ id: c.valor, nome: properCase(c.valor) })),
  ];
  return (
    <Select
      aria-label={`Categoria de ${tr.estabelecimento}`}
      selectedKey={tr.categoria ?? SEM_CATEGORIA}
      isDisabled={desabilitado}
      onSelectionChange={(k) => onChange(tr.id, k === SEM_CATEGORIA ? '' : k)}
      className="w-40"
    >
      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
      <Select.Popover>
        <ListBox>
          {itens.map((i) => (
            <ListBox.Item key={i.id} id={i.id} textValue={i.nome}>{i.nome}<ListBox.ItemIndicator /></ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

// Marca da compra rateada: abre a tela do rateio (funciona também com a fatura fechada).
function MarcaRateio({ tr, onRateio }) {
  return (
    <Button size="sm" variant="ghost" aria-label={`Rateio de ${tr.estabelecimento}`}
      className="h-6 min-w-0 shrink-0 gap-1 px-2 text-xs font-medium text-accent" onPress={() => onRateio(tr)}>
      <FiUsers size={12} /> Rateio
    </Button>
  );
}

// Ações do lançamento: rateio (só nas compras rateadas), editar e excluir (editar e excluir
// ficam travados com a fatura fechada; o rateio continua disponível).
function AcoesLancamento({ tr, desabilitado, onEditar, onExcluir, onRateio }) {
  return (
    <div className="flex items-center gap-1">
      {tr.rateado && (
        <Button isIconOnly size="sm" variant="ghost" aria-label={`Administrar o rateio de ${tr.estabelecimento}`}
          onPress={() => onRateio(tr)}>
          <FiUsers size={16} />
        </Button>
      )}
      <Button isIconOnly size="sm" variant="ghost" aria-label={`Editar ${tr.estabelecimento}`}
        isDisabled={desabilitado} onPress={() => onEditar(tr)}>
        <FiEdit2 size={16} />
      </Button>
      <Button isIconOnly size="sm" variant="ghost" aria-label={`Excluir ${tr.estabelecimento}`}
        isDisabled={desabilitado} onPress={() => onExcluir(tr)}>
        <FiTrash2 size={16} />
      </Button>
    </div>
  );
}

// Páginas visíveis: primeira, última e vizinhas da atual; o resto vira '…'.
// Ex.: atual 7 de 13 -> [1, '…', 6, 7, 8, '…', 13]
function paginasVisiveis(atual, total) {
  const paginas = [];
  for (let numero = 1; numero <= total; numero += 1) {
    const ehPonta = numero === 1 || numero === total;
    const ehVizinha = Math.abs(numero - atual) <= 1;
    if (ehPonta || ehVizinha) {
      paginas.push(numero);
    } else if (paginas[paginas.length - 1] !== '…') {
      paginas.push('…');
    }
  }
  return paginas;
}

// Rodapé: resumo, páginas e itens por página. No celular só anterior / "3 de 13" / próxima.
function Rodape({ pagina, totalPaginas, onPagina, de, ate, quantidade, porPagina, onPorPagina, compacto }) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <span className="whitespace-nowrap text-sm text-muted tabular-nums">
        {quantidade === 0 ? 'Nenhum item' : `${de}–${ate} de ${quantidade}`}
      </span>

      {totalPaginas > 1 && (
        <Pagination size="sm" className="w-auto">
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous isDisabled={pagina === 1} onPress={() => onPagina(pagina - 1)} aria-label="Página anterior">
                <Pagination.PreviousIcon />
              </Pagination.Previous>
            </Pagination.Item>

            {compacto ? (
              <Pagination.Item>
                <span className="px-2 text-sm tabular-nums">{pagina} de {totalPaginas}</span>
              </Pagination.Item>
            ) : (
              paginasVisiveis(pagina, totalPaginas).map((item, posicao) => (
                <Pagination.Item key={item === '…' ? `reticencias-${posicao}` : item}>
                  {item === '…'
                    ? <Pagination.Ellipsis />
                    : <Pagination.Link isActive={item === pagina} onPress={() => onPagina(item)}>{item}</Pagination.Link>}
                </Pagination.Item>
              ))
            )}

            <Pagination.Item>
              <Pagination.Next isDisabled={pagina === totalPaginas} onPress={() => onPagina(pagina + 1)} aria-label="Próxima página">
                <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      )}

      <Seletor rotulo="Itens por página" itens={OPCOES_POR_PAGINA} valor={String(porPagina)}
        onChange={(valor) => onPorPagina(Number(valor))} className="w-40" />
    </div>
  );
}

export default function TransacoesLista({ transacoes, categorias = [], onStatus, onCategoria, onEditar, onExcluir, onRateio, bloqueada }) {
  const isMobile = useIsMobile();
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [pesquisa, setPesquisa] = useState('');
  const [ordem, setOrdem] = useState(ORDEM_PADRAO);

  // Qualquer filtro novo volta para a 1ª página.
  const filtrar = (definir) => (valor) => { definir(valor); setPagina(1); };

  // Filtro do menu da coluna: grava "Coluna: valor" na pesquisa (troca o da mesma coluna, se já existir).
  const aplicarFiltroColuna = (idColuna, valor) => {
    const rotulo = COLUNAS.find((col) => col.id === idColuna).rotulo;
    const outrosTermos = separarTermos(pesquisa).filter((parte) => parte.coluna !== idColuna).map((parte) => parte.texto);
    const novoTermo = valor.trim() ? [`${rotulo}: ${valor.trim()}`] : [];
    setPesquisa([...outrosTermos, ...novoTermo].join('; '));
    setPagina(1);
  };

  // 1º filtra pela pesquisa, 2º ordena, 3º pagina.
  const termos = separarTermos(pesquisa);
  const filtradas = transacoes.filter((tr) => termos.every((parte) => {
    const textoColuna = parte.coluna
      ? TEXTO_COLUNA[parte.coluna](tr)
      : Object.values(TEXTO_COLUNA).map((ler) => ler(tr)).join(' ');
    return normalizar(textoColuna).includes(normalizar(parte.valor));
  }));

  const lerValor = VALOR_ORDENACAO[ordem.column] ?? VALOR_ORDENACAO.data;
  const sentido = ordem.direction === 'descending' ? -1 : 1;
  const ordenadas = [...filtradas].sort((a, b) => {
    const valorA = lerValor(a);
    const valorB = lerValor(b);
    if (valorA < valorB) return -1 * sentido;
    if (valorA > valorB) return 1 * sentido;
    return 0;
  });

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / porPagina));
  const atual = Math.min(pagina, totalPaginas);
  const inicio = (atual - 1) * porPagina;
  const itens = ordenadas.slice(inicio, inicio + porPagina);
  const temFiltro = termos.length > 0;

  // Valor atual do filtro de cada coluna (para abrir o menu já preenchido).
  const filtroDaColuna = (idColuna) => termos.find((parte) => parte.coluna === idColuna)?.valor ?? '';

  const barraFiltros = (
    <div className="space-y-2">
      <SearchField aria-label="Pesquisar lançamentos" value={pesquisa} onChange={filtrar(setPesquisa)} fullWidth>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Pesquisar... ou Coluna: valor (ex.: Portador: Gabriel; Categoria: mercado)" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      {isMobile && (
        <Seletor rotulo="Ordenar" itens={OPCOES_ORDEM} valor={`${ordem.column}:${ordem.direction}`}
          onChange={(valor) => { const [column, direction] = valor.split(':'); setOrdem({ column, direction }); }}
          className="w-full" />
      )}
    </div>
  );

  const rodape = (
    <Rodape
      pagina={atual} totalPaginas={totalPaginas} onPagina={setPagina}
      de={ordenadas.length ? inicio + 1 : 0} ate={inicio + itens.length} quantidade={ordenadas.length}
      porPagina={porPagina} onPorPagina={filtrar(setPorPagina)} compacto={isMobile}
    />
  );

  const vazio = (
    <p className="rounded-xl border border-dashed border-separator p-6 text-center text-sm text-muted">
      Nenhum lançamento encontrado{temFiltro ? ' com esses filtros' : ''}.
    </p>
  );

  if (isMobile) {
    return (
      <div className="space-y-3">
        {barraFiltros}
        {itens.length === 0 ? vazio : itens.map((tr) => (
          <Card key={tr.id} className={tr.rateado ? 'border border-accent/40 bg-accent/5' : undefined}>
            <Card.Content className="gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{tr.estabelecimento}</p>
                  <p className="text-xs text-muted">{dataCurta(tr.data)} · {tr.portador.split(' ')[0]}</p>
                </div>
                <div className="flex items-center gap-1">
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{moeda(tr.valor)}</p>
                    {tr.recebido > 0 && <p className="text-xs text-accent tabular-nums">recebido {moeda(tr.recebido)}</p>}
                  </div>
                  <AcoesLancamento tr={tr} desabilitado={bloqueada} onEditar={onEditar} onExcluir={onExcluir} onRateio={onRateio} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusSelect tr={tr} onChange={onStatus} desabilitado={bloqueada} />
                <CategoriaSelect tr={tr} categorias={categorias} onChange={onCategoria} desabilitado={bloqueada} />
                {tr.parcela && tr.parcela !== '-' && <Chip size="sm" variant="soft">{tr.parcela}</Chip>}
                {tr.rateado && <MarcaRateio tr={tr} onRateio={onRateio} />}
              </div>
            </Card.Content>
          </Card>
        ))}
        {rodape}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {barraFiltros}
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Lançamentos da fatura" className="min-w-[760px]">
            <Table.Header>
              {COLUNAS.map((col, posicao) => (
                <Table.Column key={col.id} id={col.id} isRowHeader={posicao === 0}>
                  <MenuColuna
                    coluna={col}
                    ordem={ordem}
                    filtroAtual={filtroDaColuna(col.id)}
                    onOrdenar={(direction) => setOrdem({ column: col.id, direction })}
                    onFiltrar={(valor) => aplicarFiltroColuna(col.id, valor)}
                  />
                </Table.Column>
              ))}
              <Table.Column id="acoes">Ações</Table.Column>
            </Table.Header>
            <Table.Body renderEmptyState={() => (
              <p className="p-6 text-center text-sm text-muted">
                Nenhum lançamento encontrado{temFiltro ? ' com esses filtros' : ''}.
              </p>
            )}>
              {itens.map((tr) => (
                <Table.Row key={tr.id} id={tr.id} className={tr.rateado ? 'bg-accent/10' : undefined}>
                  <Table.Cell>{dataCurta(tr.data)}</Table.Cell>
                  <Table.Cell className="max-w-56" title={tr.estabelecimento}>
                    <div className="flex items-center gap-2">
                      <span className="truncate">{tr.estabelecimento}</span>
                      {tr.rateado && <MarcaRateio tr={tr} onRateio={onRateio} />}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap" title={tr.portador}>{tr.portador.split(' ')[0]}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap tabular-nums">
                    <div>{moeda(tr.valor)}</div>
                    {tr.recebido > 0 && <div className="text-xs text-accent">recebido {moeda(tr.recebido)}</div>}
                  </Table.Cell>
                  <Table.Cell>{tr.parcela ?? '—'}</Table.Cell>
                  <Table.Cell><CategoriaSelect tr={tr} categorias={categorias} onChange={onCategoria} desabilitado={bloqueada} /></Table.Cell>
                  <Table.Cell><StatusSelect tr={tr} onChange={onStatus} desabilitado={bloqueada} /></Table.Cell>
                  <Table.Cell><AcoesLancamento tr={tr} desabilitado={bloqueada} onEditar={onEditar} onExcluir={onExcluir} onRateio={onRateio} /></Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
        <Table.Footer>{rodape}</Table.Footer>
      </Table>
    </div>
  );
}
