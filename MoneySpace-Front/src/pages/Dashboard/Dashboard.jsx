// ========================================
// DASHBOARD (visão financeira do mês)
// ========================================
// Tela inicial do MoneySpace: resumo do mês, gastos por categoria e as
// próximas contas a pagar. Dados mockados por enquanto (src/mocks).

import { Card, Chip, Button, Meter } from '@heroui/react';
import {
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign,
  FiClock,
  FiEye,
  FiEyeOff,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { usePrivacy } from '../../context/PrivacyContext';
import { formatarDinheiroPrivado, formatarData } from '../../utils/format';
import {
  calcularResumoMes,
  gastosPorCategoria,
  transacoes,
} from '../../mocks/dadosFinanceiros';

function CardResumo({ icon: Icon, titulo, valor, cor, oculto }) {
  return (
    <Card>
      <Card.Content className="flex items-center gap-4 py-4">
        <div className={`flex items-center justify-center size-11 rounded-xl ${cor}`}>
          <Icon size={22} />
        </div>
        <div>
          <p className="text-xs text-foreground-500">{titulo}</p>
          <p className="text-lg font-bold">{formatarDinheiroPrivado(valor, oculto)}</p>
        </div>
      </Card.Content>
    </Card>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const { valoresOcultos, togglePrivacidade } = usePrivacy();

  const resumo = calcularResumoMes();
  const porCategoria = gastosPorCategoria();
  const totalDespesas = resumo.despesas || 1;

  // Próximas contas: pendentes ordenadas por data
  const proximasContas = transacoes
    .filter((t) => t.status === 'PENDENTE')
    .sort((a, b) => a.dt_transacao.localeCompare(b.dt_transacao));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ── Cabeçalho ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Olá, {user?.nome || 'por aqui'} 👋</h1>
          <p className="text-sm text-foreground-500">Aqui está o resumo do seu mês.</p>
        </div>
        <Button
          variant="ghost"
          onPress={togglePrivacidade}
          startContent={valoresOcultos ? <FiEye size={18} /> : <FiEyeOff size={18} />}
        >
          {valoresOcultos ? 'Mostrar valores' : 'Ocultar valores'}
        </Button>
      </div>

      {/* ── Cards de resumo ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardResumo
          icon={FiDollarSign}
          titulo="Saldo do mês"
          valor={resumo.saldo}
          cor="bg-primary/10 text-primary"
          oculto={valoresOcultos}
        />
        <CardResumo
          icon={FiTrendingUp}
          titulo="Receitas"
          valor={resumo.receitas}
          cor="bg-success/10 text-success"
          oculto={valoresOcultos}
        />
        <CardResumo
          icon={FiTrendingDown}
          titulo="Despesas"
          valor={resumo.despesas}
          cor="bg-danger/10 text-danger"
          oculto={valoresOcultos}
        />
        <CardResumo
          icon={FiClock}
          titulo="A pagar"
          valor={resumo.pendentes}
          cor="bg-warning/10 text-warning"
          oculto={valoresOcultos}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Gastos por categoria ─────────────────────────────── */}
        <Card>
          <Card.Header>
            <Card.Title>Gastos por categoria</Card.Title>
            <Card.Description>Onde seu dinheiro foi este mês</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-4">
            {porCategoria.map((c) => {
              const percentual = Math.round((c.total / totalDespesas) * 100);
              return (
                <div key={c.nome} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="size-3 rounded-full" style={{ backgroundColor: c.cor }} />
                      {c.nome}
                    </span>
                    <span className="text-foreground-500">
                      {formatarDinheiroPrivado(c.total, valoresOcultos)} · {percentual}%
                    </span>
                  </div>
                  <Meter value={percentual} aria-label={`Gastos em ${c.nome}`}>
                    <Meter.Track>
                      <Meter.Fill />
                    </Meter.Track>
                  </Meter>
                </div>
              );
            })}
          </Card.Content>
        </Card>

        {/* ── Próximas contas ──────────────────────────────────── */}
        <Card>
          <Card.Header>
            <Card.Title>Próximas contas</Card.Title>
            <Card.Description>Lançamentos pendentes</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-3">
            {proximasContas.length === 0 && (
              <p className="text-sm text-foreground-500">Nada pendente. 🎉</p>
            )}
            {proximasContas.map((t) => (
              <div key={t.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t.descricao}</p>
                  <p className="text-xs text-foreground-500">
                    {t.categoria} · vence {formatarData(t.dt_transacao)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {formatarDinheiroPrivado(t.valor, valoresOcultos)}
                  </p>
                  <Chip size="sm" color="warning" variant="flat">
                    Pendente
                  </Chip>
                </div>
              </div>
            ))}
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;
