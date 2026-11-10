// Cartões no dashboard (vindos do cadastro de cartões). O principal aparece primeiro.
import { Link } from 'react-router-dom';
import { Card, Chip } from '@heroui/react';
import { FiCreditCard, FiStar } from 'react-icons/fi';

export default function CartoesDashboard({ cartoes }) {
  if (cartoes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-separator p-6 text-center text-muted">
        Nenhum cartão cadastrado.{' '}
        <Link to="/cadastros/cartoes" className="text-accent underline">Cadastrar cartão</Link>
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cartoes.map((cartao) => (
        <Card key={cartao.id}>
          <Card.Content className="gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <FiCreditCard size={16} />
              </span>
              {cartao.principal && (
                <Chip size="sm" variant="soft" color="success"><FiStar size={12} /> Principal</Chip>
              )}
            </div>
            <p className="truncate font-medium">{cartao.nome}</p>
            <p className="text-xs text-muted tabular-nums">•••• {cartao.final} · {cartao.nome_dono}</p>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}
