// Hub de cadastros (útil no celular, onde não há lateral).
import { Link } from 'react-router-dom';
import { Card } from '@heroui/react';
import { ITENS } from '../../components/Layout/navegacao';

const filhos = ITENS.find((i) => i.to === '/cadastros').filhos;

export default function Cadastros() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cadastros</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filhos.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to}>
            <Card className="transition-colors hover:bg-default">
              <Card.Content className="flex-row items-center gap-3">
                <Icon size={22} className="text-accent" />
                <span className="font-medium">{label}</span>
              </Card.Content>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
