import { Card, InputGroup, Button, Chip } from '@heroui/react';
import { FiLock, FiUnlock } from 'react-icons/fi';
import { moeda } from '../../../utils/formatar';

const Linha = ({ rotulo, valor, forte }) => (
  <div className={`flex justify-between gap-4 py-1.5 text-sm ${forte ? 'font-semibold' : ''}`}>
    <span className={forte ? '' : 'text-muted'}>{rotulo}</span>
    <span className="tabular-nums">{valor}</span>
  </div>
);

// `saldo` é o texto digitado; `onSaldo` atualiza a tela; `onSalvarSaldo` grava no banco ao sair do campo.
export default function ConferenciaReserva({ c, saldo, onSaldo, onSalvarSaldo, fechada, onFechar, onAbrir }) {
  const coberta = c.diferenca >= 0;
  return (
    <Card>
      <Card.Header>
        <Card.Title>Conferência da reserva</Card.Title>
        <Card.Description>Dinheiro guardado × o que a fatura exige</Card.Description>
      </Card.Header>
      <Card.Content className="gap-1">
        <Linha rotulo="Compras quitadas (na hora)" valor={moeda(c.pago)} />
        <Linha rotulo="Compras pendentes (pendente)" valor={moeda(c.pendente)} />
        <Linha forte rotulo="Total que DEVE estar na reserva" valor={moeda(c.meta)} />

        <div className="my-3">
          <label className="mb-1 block text-sm font-medium" htmlFor="saldo-reserva">Saldo atual na sua reserva</label>
          <InputGroup fullWidth isDisabled={fechada}>
            <InputGroup.Prefix>R$</InputGroup.Prefix>
            <InputGroup.Input
              id="saldo-reserva"
              inputMode="decimal"
              value={String(saldo)}
              onChange={(e) => onSaldo(e.target.value)}
              onBlur={() => onSalvarSaldo?.()}
            />
          </InputGroup>
        </div>

        <div className={`flex items-center justify-between rounded-xl p-3 ${coberta ? 'bg-success/10' : 'bg-danger/10'}`}>
          <span className="text-sm font-medium">{coberta ? 'Sobra na reserva' : 'Falta na reserva'}</span>
          <Chip color={coberta ? 'success' : 'danger'} variant="soft">{moeda(Math.abs(c.diferenca))}</Chip>
        </div>

        <div className="mt-3 border-t border-separator pt-2">
          <Linha rotulo="Previsão a pagar no fechamento" valor={moeda(c.fechamento)} />
          <Linha rotulo="Total bruto da fatura" valor={moeda(c.bruto)} />
          <Linha rotulo="(−) Pagamentos / ajustes" valor={moeda(c.pagamentos)} />
          <Linha forte rotulo="Total líquido do mês" valor={moeda(c.liquido)} />
        </div>

        {fechada ? (
          <Button className="mt-3" variant="secondary" onPress={onAbrir}>
            <FiUnlock size={16} /> Abrir para ajustes
          </Button>
        ) : (
          <Button className="mt-3" onPress={onFechar}>
            <FiLock size={16} /> Fechar fatura
          </Button>
        )}
      </Card.Content>
    </Card>
  );
}
