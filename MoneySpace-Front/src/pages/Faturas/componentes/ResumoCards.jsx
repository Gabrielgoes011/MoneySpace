import { Card, Chip } from '@heroui/react';
import { moeda } from '../../../utils/formatar';

export default function ResumoCards({ c }) {
  const coberta = c.diferenca >= 0;
  const itens = [
    { t: 'Total da fatura', v: c.bruto, d: 'Gastos do mês no cartão' },
    { t: 'Na hora', v: c.pago, d: 'Já debitado da conta' },
    { t: 'Pendente', v: c.pendente, d: c.recebido > 0 ? `Já recebido do rateio: ${moeda(c.recebido)}` : 'Aguardando transferir' },
    { t: 'No fechamento', v: c.fechamento, d: 'Parcelas e fixas' },
    { t: 'Meta na reserva', v: c.meta, d: 'Deveria estar guardado' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      {itens.map((i, n) => (
        <Card key={i.t} className={n === 0 ? 'col-span-2 lg:col-span-1' : ''}>
          <Card.Content className="gap-1">
            <span className="text-xs text-muted">{i.t}</span>
            <span className={`${n === 0 ? 'text-2xl' : 'text-lg'} font-bold tabular-nums lg:text-lg`}>{moeda(i.v)}</span>
            <span className="text-xs text-muted">{i.d}</span>
          </Card.Content>
        </Card>
      ))}
      <Card className="col-span-2 lg:col-span-1">
        <Card.Content className="gap-1">
          <span className="text-xs text-muted">Status da conferência</span>
          <Chip color={coberta ? 'success' : 'danger'} variant="soft" className="w-fit">
            {coberta ? 'COBERTA' : 'FALTA'}
          </Chip>
          <span className="text-xs text-muted">Dif: {moeda(c.diferenca)}</span>
        </Card.Content>
      </Card>
    </div>
  );
}
