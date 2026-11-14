// Lista de famílias (tabela no PC, cards no celular). "Entrar" troca a família ativa do dono do app.
import { Table, Card, Chip, Button } from '@heroui/react';
import { FiLogIn } from 'react-icons/fi';
import useIsMobile from '../../../hooks/useIsMobile';

const dataBr = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

function Marcas({ familia, idAtual, idPropria }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {familia.id === idPropria && <Chip size="sm" variant="soft">Sua família</Chip>}
      {familia.id === idAtual && <Chip size="sm" variant="soft" color="success">Ativa agora</Chip>}
    </div>
  );
}

function BotaoEntrar({ familia, idAtual, onEntrar }) {
  if (familia.id === idAtual) return <span className="text-sm text-muted">—</span>;
  return (
    <Button size="sm" variant="secondary" onPress={() => onEntrar(familia)}>
      <FiLogIn size={14} /> Entrar
    </Button>
  );
}

export default function FamiliasTabela({ familias, idAtual, idPropria, onEntrar }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-2">
        {familias.map((f) => (
          <Card key={f.id}>
            <Card.Content className="gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{f.nome}</p>
                  <p className="text-xs text-muted">Criada em {dataBr(f.dt_cadastro)}</p>
                </div>
                <BotaoEntrar familia={f} idAtual={idAtual} onEntrar={onEntrar} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Chip size="sm" variant="soft">{f.total_usuarios} usuário{f.total_usuarios === 1 ? '' : 's'}</Chip>
                <Chip size="sm" variant="soft">{f.total_cartoes} cartão{f.total_cartoes === 1 ? '' : 'ões'}</Chip>
                <Marcas familia={f} idAtual={idAtual} idPropria={idPropria} />
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
        <Table.Content aria-label="Famílias" className="min-w-[640px]">
          <Table.Header>
            <Table.Column isRowHeader>Família</Table.Column>
            <Table.Column>Usuários</Table.Column>
            <Table.Column>Cartões</Table.Column>
            <Table.Column>Criada em</Table.Column>
            <Table.Column>Ações</Table.Column>
          </Table.Header>
          <Table.Body>
            {familias.map((f) => (
              <Table.Row key={f.id} id={f.id}>
                <Table.Cell>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{f.nome}</span>
                    <Marcas familia={f} idAtual={idAtual} idPropria={idPropria} />
                  </div>
                </Table.Cell>
                <Table.Cell className="tabular-nums">{f.total_usuarios}</Table.Cell>
                <Table.Cell className="tabular-nums">{f.total_cartoes}</Table.Cell>
                <Table.Cell>{dataBr(f.dt_cadastro)}</Table.Cell>
                <Table.Cell><BotaoEntrar familia={f} idAtual={idAtual} onEntrar={onEntrar} /></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
