// Faixa compacta com os totais da fatura, no topo da coluna dos lançamentos (PC).
import { Card } from '@heroui/react';
import { moeda } from '../../../utils/formatar';

export default function ResumoFaturaFaixa({ c }) {
  const itens = [
    { rotulo: 'Total da fatura', valor: c.bruto, destaque: true },
    { rotulo: 'Na hora', valor: c.pago },
    { rotulo: 'Pendente', valor: c.pendente },
    { rotulo: 'No fechamento', valor: c.fechamento },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {itens.map((item) => (
        <Card key={item.rotulo}>
          <Card.Content className="gap-0.5 p-4">
            <span className="text-xs text-muted">{item.rotulo}</span>
            <span className={`font-bold tabular-nums ${item.destaque ? 'text-xl text-accent' : 'text-lg'}`}>
              {moeda(item.valor)}
            </span>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}
