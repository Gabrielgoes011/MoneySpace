// Lançamentos paginados (10 por página): Table no desktop, cards no celular.
// Status é um campo único; o usuário altera direto na linha.
import { useState } from 'react';
import { Table, Card, Chip, Select, ListBox, Pagination, Input } from '@heroui/react';
import { STATUS } from '../../../mocks/faturaMock';
import { moeda, dataCurta } from '../../../utils/formatar';
import useIsMobile from '../../../hooks/useIsMobile';

const POR_PAGINA_PADRAO = 10;
const POR_PAGINA_MAX = 200;

function StatusSelect({ tr, onChange, desabilitado }) {
  return (
    <Select
      aria-label={`Status de ${tr.estabelecimento}`}
      selectedKey={tr.status}
      isDisabled={desabilitado || tr.status === 'pagamento'}
      onSelectionChange={(k) => onChange(tr.id, k)}
      className="min-w-40"
    >
      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
      <Select.Popover>
        <ListBox>
          {Object.entries(STATUS).map(([k, s]) => (
            <ListBox.Item key={k} id={k} textValue={s.label}>{s.label}<ListBox.ItemIndicator /></ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
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

export default function TransacoesLista({ transacoes, onStatus, bloqueada }) {
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
                  <p className="text-xs text-muted">{dataCurta(tr.data)} · {tr.portador.split(' ')[0]} · {tr.categoria}</p>
                </div>
                <span className="font-semibold tabular-nums">{moeda(tr.valor)}</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusSelect tr={tr} onChange={onStatus} desabilitado={bloqueada} />
                {tr.parcela && <Chip size="sm" variant="soft">{tr.parcela}</Chip>}
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
        <Table.Content aria-label="Lançamentos da fatura" className="min-w-[900px]">
          <Table.Header>
            <Table.Column isRowHeader>Data</Table.Column>
            <Table.Column>Estabelecimento</Table.Column>
            <Table.Column>Portador</Table.Column>
            <Table.Column>Valor</Table.Column>
            <Table.Column>Parcela</Table.Column>
            <Table.Column>Categoria</Table.Column>
            <Table.Column>Status</Table.Column>
          </Table.Header>
          <Table.Body>
            {itens.map((tr) => (
              <Table.Row key={tr.id} id={tr.id}>
                <Table.Cell>{dataCurta(tr.data)}</Table.Cell>
                <Table.Cell>{tr.estabelecimento}</Table.Cell>
                <Table.Cell>{tr.portador}</Table.Cell>
                <Table.Cell className="tabular-nums">{moeda(tr.valor)}</Table.Cell>
                <Table.Cell>{tr.parcela ?? '—'}</Table.Cell>
                <Table.Cell>{tr.categoria}</Table.Cell>
                <Table.Cell><StatusSelect tr={tr} onChange={onStatus} desabilitado={bloqueada} /></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
      <Table.Footer>{pag}</Table.Footer>
    </Table>
  );
}
