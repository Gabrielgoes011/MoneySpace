// ========================================
// CONTAS & CARTÕES
// ========================================
// Mostra as contas da família (tabela `conta`): cartões de crédito, conta
// corrente e carteira. Cartões exibem bandeira, final e uso do limite.
// Dados mockados por enquanto (src/mocks).

import { Card, Chip, Button, Meter } from '@heroui/react';
import { FiCreditCard, FiDollarSign, FiPlus } from 'react-icons/fi';
import { usePrivacy } from '../../context/PrivacyContext';
import { formatarDinheiroPrivado } from '../../utils/format';
import { contas } from '../../mocks/dadosFinanceiros';

// Uso fictício do limite por cartão (viria do SUM das compras no crédito)
const usoLimite = { c1: 1850, c4: 3200 };

const rotuloTipo = {
  CREDITO: 'Cartão de crédito',
  CORRENTE: 'Conta corrente',
  CARTEIRA: 'Dinheiro',
};

function Contas() {
  const { valoresOcultos } = usePrivacy();

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      {/* ── Cabeçalho ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">Contas & Cartões</h1>
          <p className="text-sm text-foreground-500">Onde seu dinheiro mora</p>
        </div>
        {/* No mobile vira botão só de ícone (ganha espaço); no desktop mostra o texto. */}
        <Button color="primary" aria-label="Adicionar conta" className="shrink-0">
          <FiPlus size={18} />
          <span className="hidden sm:inline">Adicionar</span>
        </Button>
      </div>

      {/* ── Grid de contas ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {contas.map((conta) => {
          const ehCredito = conta.tipo === 'CREDITO';
          const usado = usoLimite[conta.id] || 0;
          const percentual = ehCredito && conta.limite ? Math.round((usado / conta.limite) * 100) : 0;

          return (
            <Card key={conta.id}>
              <Card.Content className="space-y-3 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex items-center justify-center size-10 rounded-xl shrink-0 ${
                        ehCredito ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'
                      }`}
                    >
                      {ehCredito ? <FiCreditCard size={20} /> : <FiDollarSign size={20} />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{conta.nome}</p>
                      <p className="text-xs text-foreground-500 truncate">{rotuloTipo[conta.tipo]}</p>
                    </div>
                  </div>
                  {ehCredito && (
                    <Chip size="sm" variant="flat" className="shrink-0">
                      {conta.bandeira} ••{conta.final_cartao}
                    </Chip>
                  )}
                </div>

                {ehCredito ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-foreground-500">
                      <span>Fatura atual</span>
                      <span>
                        {formatarDinheiroPrivado(usado, valoresOcultos)} de{' '}
                        {formatarDinheiroPrivado(conta.limite, valoresOcultos)}
                      </span>
                    </div>
                    <Meter
                      value={percentual}
                      color={percentual > 80 ? 'danger' : 'accent'}
                      aria-label={`Uso do limite do ${conta.nome}`}
                    >
                      <Meter.Track>
                        <Meter.Fill />
                      </Meter.Track>
                    </Meter>
                    <p className="text-xs text-foreground-500">
                      Fecha dia {conta.dia_fechamento} · vence dia {conta.dia_vencimento}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-foreground-500">Saldo</p>
                    <p className="text-xl font-bold">
                      {formatarDinheiroPrivado(conta.saldo_inicial, valoresOcultos)}
                    </p>
                  </div>
                )}
              </Card.Content>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default Contas;
