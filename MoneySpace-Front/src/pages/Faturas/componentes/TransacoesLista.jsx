// Lançamentos paginados (10 por página): Table no desktop, cards no celular.
// Status e categoria são editáveis direto na linha; editar e excluir ficam nas ações.
import { useState } from 'react';
import { Table, Card, Chip, Select, ListBox, Pagination, Input, Button } from '@heroui/react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { STATUS } from '../../../utils/statusFatura';
import { moeda, dataCurta, properCase } from '../../../utils/formatar';
import useIsMobile from '../../../hooks/useIsMobile';

const POR_PAGINA_PADRAO = 10;
const POR_PAGINA_MAX = 200;
const SEM_CATEGORIA = 'nenhum';

// Cores de cada status (ponto e texto). Classes escritas por extenso para o Tailwind gerar todas.
const COR_PONTO = { warning: 'bg-warning', success: 'bg-success', accent: 'bg-accent' };
const COR_TEXTO = { warning: 'text-warning', success: 'text-success', accent: 'text-accent' };

// Status editável na linha, com a cor do status (ponto + texto).
function StatusSelect({ tr, onChange, desabilitado }) {
  const estilo = STATUS[tr.status] ?? STATUS.pendente;
  return (
    <Select
      aria-label={`Status de ${tr.estabelecimento}`}
      selectedKey={tr.status}
      isDisabled={desabilitado}
      onSelectionChange={(k) => onChange(tr.id, k)}
      className="w-32"
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

// Categoria editável na linha: lista as categorias do cadastro (a mesma do status: dropdown).
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
      className="w-36"
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

// Ações do lançamento: editar e excluir (ficam travadas com a fatura fechada).
function AcoesLancamento({ tr, desabilitado, onEditar, onExcluir }) {
  return (
    <div className="flex items-center gap-1">
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

// Campo "itens por página": o texto pode ficar vazio enquanto digita; vazio/inválido = padrão (10).
function PorPagina({ valor, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Itens por página
      <Input
        aria-label="Itens por página" type="number" min={1} max={POR_PAGINA_MAX} inputMode="numeric"
        value={valor} onChange={(e) => onChange(e.target.value)} className="w-20"
      />
    </label>
  );
}

function Paginacao({ pagina, total, onPagina, de, ate, quantidade }) {
  if (total <= 1) return <span className="text-sm text-muted">{quantidade} itens</span>;
  return (
    <Pagination size="sm" className="flex-1">
      <Pagination.Summary>{de} a {ate} de {quantidade}</Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={pagina === 1} onPress={() => onPagina(pagina - 1)}>
            <Pagination.PreviousIcon />Anterior
          </Pagination.Previous>
        </Pagination.Item>
        {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
          <Pagination.Item key={p}>
            <Pagination.Link isActive={p === pagina} onPress={() => onPagina(p)}>{p}</Pagination.Link>
          </Pagination.Item>
        ))}
        <Pagination.Item>
          <Pagination.Next isDisabled={pagina === total} onPress={() => onPagina(pagina + 1)}>
            Próxima<Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

export default function TransacoesLista({ transacoes, categorias = [], onStatus, onCategoria, onEditar, onExcluir, bloqueada }) {
  const isMobile = useIsMobile();
  const [pagina, setPagina] = useState(1);
  const [textoPorPagina, setTextoPorPagina] = useState(String(POR_PAGINA_PADRAO));

  const digitado = parseInt(textoPorPagina, 10);
  const porPagina = Number.isFinite(digitado) && digitado >= 1
    ? Math.min(digitado, POR_PAGINA_MAX)
    : POR_PAGINA_PADRAO;

  const totalPaginas = Math.max(1, Math.ceil(transacoes.length / porPagina));
  const atual = Math.min(pagina, totalPaginas);
  const inicio = (atual - 1) * porPagina;
  const itens = transacoes.slice(inicio, inicio + porPagina);
  const pag = (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <Paginacao
        pagina={atual} total={totalPaginas} onPagina={setPagina}
        de={transacoes.length ? inicio + 1 : 0} ate={inicio + itens.length} quantidade={transacoes.length}
      />
      <PorPagina valor={textoPorPagina} onChange={(v) => { setTextoPorPagina(v); setPagina(1); }} />
    </div>
  );

  if (isMobile) {
    return (
      <div className="space-y-2">
        {itens.map((tr) => (
          <Card key={tr.id}>
            <Card.Content className="gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{tr.estabelecimento}</p>
                  <p className="text-xs text-muted">{dataCurta(tr.data)} · {tr.portador.split(' ')[0]}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold tabular-nums">{moeda(tr.valor)}</span>
                  <AcoesLancamento tr={tr} desabilitado={bloqueada} onEditar={onEditar} onExcluir={onExcluir} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusSelect tr={tr} onChange={onStatus} desabilitado={bloqueada} />
                <CategoriaSelect tr={tr} categorias={categorias} onChange={onCategoria} desabilitado={bloqueada} />
                {tr.parcela && tr.parcela !== '-' && <Chip size="sm" variant="soft">{tr.parcela}</Chip>}
              </div>
            </Card.Content>
          </Card>
        ))}
        {pag}
      </div>
    );
  }

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Lançamentos da fatura" className="min-w-[720px]">
          <Table.Header>
            <Table.Column isRowHeader>Data</Table.Column>
            <Table.Column>Estabelecimento</Table.Column>
            <Table.Column>Portador</Table.Column>
            <Table.Column>Valor</Table.Column>
            <Table.Column>Parcela</Table.Column>
            <Table.Column>Categoria</Table.Column>
            <Table.Column>Status</Table.Column>
            <Table.Column>Ações</Table.Column>
          </Table.Header>
          <Table.Body>
            {itens.map((tr) => (
              <Table.Row key={tr.id} id={tr.id}>
                <Table.Cell>{dataCurta(tr.data)}</Table.Cell>
                <Table.Cell className="max-w-44 truncate" title={tr.estabelecimento}>{tr.estabelecimento}</Table.Cell>
                <Table.Cell className="whitespace-nowrap" title={tr.portador}>{tr.portador.split(' ')[0]}</Table.Cell>
                <Table.Cell className="whitespace-nowrap tabular-nums">{moeda(tr.valor)}</Table.Cell>
                <Table.Cell>{tr.parcela ?? '—'}</Table.Cell>
                <Table.Cell><CategoriaSelect tr={tr} categorias={categorias} onChange={onCategoria} desabilitado={bloqueada} /></Table.Cell>
                <Table.Cell><StatusSelect tr={tr} onChange={onStatus} desabilitado={bloqueada} /></Table.Cell>
                <Table.Cell><AcoesLancamento tr={tr} desabilitado={bloqueada} onEditar={onEditar} onExcluir={onExcluir} /></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
      <Table.Footer>{pag}</Table.Footer>
    </Table>
  );
}
