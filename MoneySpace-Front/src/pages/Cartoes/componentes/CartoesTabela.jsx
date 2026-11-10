// Lista de cartões: Table no PC (custom cells) e cards no celular.
// O botão de excluir só aparece quando `podeExcluir` (admin, vem do back).
import { Table, Card, Chip, Avatar, Button } from '@heroui/react';
import { FiCreditCard, FiStar, FiTrash2 } from 'react-icons/fi';
import { iniciais, moeda } from '../../../utils/formatar';
import useIsMobile from '../../../hooks/useIsMobile';

// Ícone + apelido + final do cartão (custom cell do nome)
function CartaoCell({ cartao }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
        <FiCreditCard size={16} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{cartao.nome}</p>
        <p className="text-xs text-muted tabular-nums">•••• {cartao.final}</p>
      </div>
    </div>
  );
}

// Dono do cartão com avatar (custom cell)
function DonoCell({ nome }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar size="sm">
        <Avatar.Fallback>{iniciais(nome)}</Avatar.Fallback>
      </Avatar>
      <span className="truncate text-sm">{nome}</span>
    </div>
  );
}

const DiasCell = ({ cartao }) =>
  cartao.dia_fechamento
    ? <span className="text-sm tabular-nums">fecha {cartao.dia_fechamento} · vence {cartao.dia_vencimento ?? '—'}</span>
    : <span className="text-muted">—</span>;

const PrincipalChip = ({ cartao }) =>
  cartao.principal
    ? <Chip size="sm" variant="soft" color="success"><FiStar size={12} /> Principal</Chip>
    : null;

// Botão de excluir (só admin). Abre a confirmação no pai.
function ExcluirBotao({ cartao, onExcluir }) {
  return (
    <Button isIconOnly size="sm" variant="ghost" aria-label={`Excluir ${cartao.nome}`} onPress={() => onExcluir(cartao)}>
      <FiTrash2 size={16} />
    </Button>
  );
}

export default function CartoesTabela({ cartoes, podeExcluir = false, onExcluir }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-2">
        {cartoes.map((cartao) => (
          <Card key={cartao.id}>
            <Card.Content className="gap-3">
              <div className="flex items-start justify-between gap-2">
                <CartaoCell cartao={cartao} />
                <div className="flex items-center gap-1">
                  <PrincipalChip cartao={cartao} />
                  {podeExcluir && <ExcluirBotao cartao={cartao} onExcluir={onExcluir} />}
                </div>
              </div>
              <DonoCell nome={cartao.nome_dono} />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                {cartao.limite != null && <span>Limite {moeda(cartao.limite)}</span>}
                <DiasCell cartao={cartao} />
              </div>
            </Card.Content>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Cartões da família" className="min-w-[760px]">
          <Table.Header>
            <Table.Column isRowHeader>Cartão</Table.Column>
            <Table.Column>Dono</Table.Column>
            <Table.Column>Limite</Table.Column>
            <Table.Column>Fechamento / vencimento</Table.Column>
            <Table.Column>Status</Table.Column>
            {podeExcluir && <Table.Column>Ações</Table.Column>}
          </Table.Header>
          <Table.Body>
            {cartoes.map((cartao) => (
              <Table.Row key={cartao.id} id={cartao.id}>
                <Table.Cell><CartaoCell cartao={cartao} /></Table.Cell>
                <Table.Cell><DonoCell nome={cartao.nome_dono} /></Table.Cell>
                <Table.Cell className="tabular-nums">{cartao.limite != null ? moeda(cartao.limite) : <span className="text-muted">—</span>}</Table.Cell>
                <Table.Cell><DiasCell cartao={cartao} /></Table.Cell>
                <Table.Cell><PrincipalChip cartao={cartao} /></Table.Cell>
                {podeExcluir && <Table.Cell><ExcluirBotao cartao={cartao} onExcluir={onExcluir} /></Table.Cell>}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
