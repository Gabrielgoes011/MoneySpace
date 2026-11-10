// Quem gasta mais (donut) e gastos por categoria (barras).
import { Card, ProgressBar } from '@heroui/react';
import { moeda, percentual } from '../../../utils/formatar';

const CORES = ['#1db954', '#f59e0b', '#8b5cf6', '#ef4444'];

export function AnalisePortador({ dados }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  let acumulado = 0;
  return (
    <Card>
      <Card.Header><Card.Title>Quem gasta mais</Card.Title></Card.Header>
      <Card.Content className="flex-row items-center gap-4">
        <svg viewBox="0 0 100 100" className="size-28 shrink-0 -rotate-90 sm:size-32" role="img" aria-label="Divisão da fatura por portador">
          {dados.map((d, i) => {
            const len = (d.pct / 100) * C;
            const el = (
              <circle
                key={d.nome} cx="50" cy="50" r={R} fill="none" stroke={CORES[i % CORES.length]}
                strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acumulado}
              />
            );
            acumulado += len;
            return el;
          })}
        </svg>
        <ul className="flex-1 space-y-2 text-sm">
          {dados.map((d, i) => (
            <li key={d.nome}>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: CORES[i % CORES.length] }} />
                <span className="flex-1 truncate">{d.nome}</span>
                <span className="font-semibold tabular-nums">{percentual(d.pct)}</span>
              </div>
              <div className="pl-4 text-xs text-muted">{moeda(d.total)} · {d.qtd} compras</div>
            </li>
          ))}
        </ul>
      </Card.Content>
    </Card>
  );
}

export function AnaliseCategoria({ dados }) {
  return (
    <Card>
      <Card.Header><Card.Title>Gastos por categoria</Card.Title></Card.Header>
      <Card.Content className="gap-3">
        {dados.map((d) => (
          <ProgressBar key={d.nome} aria-label={d.nome} value={d.pct} size="sm">
            <div className="mb-1 flex justify-between text-sm">
              <span>{d.nome}</span>
              <span className="tabular-nums text-muted">{moeda(d.total)} · {percentual(d.pct)}</span>
            </div>
            <ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
          </ProgressBar>
        ))}
      </Card.Content>
    </Card>
  );
}
