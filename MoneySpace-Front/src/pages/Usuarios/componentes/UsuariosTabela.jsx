// Lista de usuários com CUSTOM CELLS do HeroUI Table (avatar + nome/e-mail, chips, ações).
// No celular vira lista de cards.
import { Table, Card, Chip, Avatar, Button } from '@heroui/react';
import { FiEdit2, FiShield } from 'react-icons/fi';
import { cpfMascara, iniciais } from '../../../utils/formatar';
import useIsMobile from '../../../hooks/useIsMobile';

// Cor do avatar estável por nome (gradiente, como no exemplo do HeroUI).
function corAvatar(nome) {
  let h = 0;
  for (const c of String(nome)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 75% 72%), hsl(${(h + 45) % 360} 75% 55%))`;
}

function MembroCell({ u }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar size="md">
        <Avatar.Fallback style={{ background: corAvatar(u.nome), color: '#111' }}>{iniciais(u.nome)}</Avatar.Fallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{u.nome}</p>
        <p className="truncate text-xs text-muted">{u.email}</p>
      </div>
    </div>
  );
}

function PerfilChip({ u }) {
  if (u.is_master) return <Chip size="sm" variant="soft" color="accent"><FiShield size={12} /> Dono</Chip>;
  return u.role === 'ADMIN'
    ? <Chip size="sm" variant="soft" color="success">Administrador</Chip>
    : <Chip size="sm" variant="soft">Membro</Chip>;
}

function Acoes({ u, podeEditar, onEditar }) {
  if (!podeEditar) return null;
  return (
    <Button isIconOnly size="sm" variant="ghost" aria-label={`Editar ${u.nome}`} onPress={() => onEditar(u)}>
      <FiEdit2 size={16} />
    </Button>
  );
}

export default function UsuariosTabela({ usuarios, podeEditar, onEditar }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-2">
        {usuarios.map((u) => (
          <Card key={u.id}>
            <Card.Content className="gap-3">
              <div className="flex items-start justify-between gap-2">
                <MembroCell u={u} />
                <Acoes u={u} podeEditar={podeEditar} onEditar={onEditar} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PerfilChip u={u} />
                {u.mfa_ativo && <Chip size="sm" variant="soft">2FA</Chip>}
              </div>
              <p className="text-xs text-muted">CPF {cpfMascara(u.cpf)}</p>
            </Card.Content>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Usuários da família" className="min-w-[700px]">
          <Table.Header>
            <Table.Column isRowHeader>Membro</Table.Column>
            <Table.Column>CPF</Table.Column>
            <Table.Column>Perfil</Table.Column>
            <Table.Column>2FA</Table.Column>
            <Table.Column>Ações</Table.Column>
          </Table.Header>
          <Table.Body>
            {usuarios.map((u) => (
              <Table.Row key={u.id} id={u.id}>
                <Table.Cell><MembroCell u={u} /></Table.Cell>
                <Table.Cell className="tabular-nums">{cpfMascara(u.cpf)}</Table.Cell>
                <Table.Cell><PerfilChip u={u} /></Table.Cell>
                <Table.Cell>{u.mfa_ativo ? <Chip size="sm" variant="soft" color="success">Ligado</Chip> : <span className="text-muted">—</span>}</Table.Cell>
                <Table.Cell><Acoes u={u} podeEditar={podeEditar} onEditar={onEditar} /></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
